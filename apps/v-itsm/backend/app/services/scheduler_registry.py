"""APScheduler 잡 레지스트리 — JobSpec 기반 등록 + DB override 반영.

설계
  * 앱 전체에 **단일 AsyncIOScheduler** 를 둔다. 잡은 ``JobSpec`` 으로 선언하고,
    ``register()`` 로 레지스트리에 등록한 뒤 ``start()`` 에서 일괄 스케줄한다.
  * ``itsm_scheduler_override`` 테이블에 ``interval_seconds``/``paused`` 가 있으면
    그 값을 (min/max 범위 내로 클램프한 뒤) 우선 적용. 없으면 ``default_interval``.
  * 런타임에 간격을 바꾸고 싶을 때 ``reschedule()`` 로 DB upsert + 잡 재스케줄을
    한 번에 처리. 관리자 API 라우터에서 이 함수를 호출한다.
  * ``snapshot()`` 은 관리자 UI 용 상태 조회(마지막 실행/다음 실행/override 등).

메모리 잡스토어 기준이라 프로세스 재기동 시 override 는 다시 읽어들인다.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select

from app.models.scheduler_override import SchedulerOverride

logger = structlog.get_logger(__name__)


@dataclass(frozen=True)
class JobSpec:
    """스케줄러 잡 선언.

    Attributes:
        job_id: 전역 유일 식별자. ``itsm_scheduler_override.job_id`` 와 매칭.
        func: 인자 없이 호출 가능한 콜러블 (동기/코루틴 모두 허용).
        default_interval_seconds: override 가 없을 때 적용할 기본 간격.
        min_interval_seconds: override 로 내릴 수 있는 하한(과도한 부하 방지).
        max_interval_seconds: override 로 올릴 수 있는 상한(지연 허용 한계).
        description: 관리자 UI 표시용 설명.
    """

    job_id: str
    func: Callable[..., Any]
    default_interval_seconds: int
    min_interval_seconds: int
    max_interval_seconds: int
    description: str


class _SchedulerRegistry:
    def __init__(self) -> None:
        self._specs: dict[str, JobSpec] = {}
        self._scheduler: AsyncIOScheduler | None = None

    # ─── 선언 단계 ──────────────────────────────────────────
    def register(self, spec: JobSpec) -> None:
        """앱 기동 전 import 시점에 호출. 중복 등록은 덮어쓴다."""
        self._specs[spec.job_id] = spec

    def specs(self) -> list[JobSpec]:
        return list(self._specs.values())

    def get_spec(self, job_id: str) -> JobSpec | None:
        return self._specs.get(job_id)

    # ─── 라이프사이클 ───────────────────────────────────────
    def start(self) -> AsyncIOScheduler:
        """DB override 반영 후 모든 잡을 스케줄하고 시작."""
        if self._scheduler is not None:
            return self._scheduler
        sched = AsyncIOScheduler(timezone="UTC")
        overrides = self._load_overrides()
        for spec in self._specs.values():
            override = overrides.get(spec.job_id)
            interval = self._clamp(
                spec,
                override.interval_seconds if override else spec.default_interval_seconds,
            )
            paused = bool(override and override.paused)
            job = sched.add_job(
                spec.func,
                IntervalTrigger(seconds=interval),
                id=spec.job_id,
                replace_existing=True,
            )
            if paused:
                job.pause()
            logger.info(
                "scheduler.job_registered",
                job_id=spec.job_id,
                interval=interval,
                paused=paused,
                source="db" if override else "default",
            )
        sched.start()
        self._scheduler = sched
        logger.info("scheduler.started", jobs=len(self._specs))
        return sched

    def stop(self) -> None:
        if self._scheduler is None:
            return
        self._scheduler.shutdown(wait=False)
        self._scheduler = None
        logger.info("scheduler.stopped")

    # ─── 런타임 제어 ───────────────────────────────────────
    def reschedule(
        self,
        db,
        job_id: str,
        *,
        interval_seconds: int | None = None,
        paused: bool | None = None,
        updated_by: int | None = None,
    ) -> dict[str, Any]:
        """DB override upsert + 런타임 잡 반영.

        둘 중 하나만 변경하려면 나머지는 None 으로 생략.
        반환: 갱신 후 상태 스냅샷 1건.
        """
        spec = self._specs.get(job_id)
        if spec is None:
            raise ValueError(f"unknown job_id: {job_id}")

        row = db.get(SchedulerOverride, job_id)
        if row is None:
            row = SchedulerOverride(
                job_id=job_id,
                interval_seconds=spec.default_interval_seconds,
                paused=False,
            )
            db.add(row)

        if interval_seconds is not None:
            row.interval_seconds = self._clamp(spec, interval_seconds)
        if paused is not None:
            row.paused = bool(paused)
        row.updated_by = updated_by
        row.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(row)

        if self._scheduler is not None:
            job = self._scheduler.get_job(job_id)
            if job is not None:
                if interval_seconds is not None:
                    job.reschedule(IntervalTrigger(seconds=row.interval_seconds))
                if paused is not None:
                    if row.paused:
                        job.pause()
                    else:
                        job.resume()

        return self._snapshot_one(spec, row)

    # ─── 조회 ──────────────────────────────────────────────
    def snapshot(self, db) -> list[dict[str, Any]]:
        overrides = self._load_overrides(db)
        out: list[dict[str, Any]] = []
        for spec in self._specs.values():
            out.append(self._snapshot_one(spec, overrides.get(spec.job_id)))
        return out

    def _snapshot_one(
        self, spec: JobSpec, override: SchedulerOverride | None
    ) -> dict[str, Any]:
        interval = (
            override.interval_seconds
            if override is not None
            else spec.default_interval_seconds
        )
        paused = bool(override and override.paused)
        next_run: str | None = None
        last_run: str | None = None
        if self._scheduler is not None:
            job = self._scheduler.get_job(spec.job_id)
            if job is not None and job.next_run_time is not None:
                next_run = job.next_run_time.isoformat()
        return {
            "job_id": spec.job_id,
            "description": spec.description,
            "interval_seconds": interval,
            "default_interval_seconds": spec.default_interval_seconds,
            "min_interval_seconds": spec.min_interval_seconds,
            "max_interval_seconds": spec.max_interval_seconds,
            "paused": paused,
            "next_run_at": next_run,
            "last_run_at": last_run,
            "override_updated_at": (
                override.updated_at.isoformat() if override else None
            ),
            "override_updated_by": override.updated_by if override else None,
        }

    # ─── 내부 ──────────────────────────────────────────────
    def _clamp(self, spec: JobSpec, seconds: int) -> int:
        return max(spec.min_interval_seconds, min(spec.max_interval_seconds, int(seconds)))

    def _load_overrides(self, db=None) -> dict[str, SchedulerOverride]:
        """DB 에서 override 로우를 읽어 dict 화. 실패/빈 DB 는 {} 로 폴백."""
        if db is not None:
            rows = db.execute(select(SchedulerOverride)).scalars().all()
            return {r.job_id: r for r in rows}
        try:
            from v_platform.core.database import SessionLocal
        except Exception:  # noqa: BLE001
            return {}
        try:
            with SessionLocal() as session:
                rows = session.execute(select(SchedulerOverride)).scalars().all()
                return {r.job_id: r for r in rows}
        except Exception as e:  # noqa: BLE001
            logger.warning("scheduler.override_load_error", error=str(e))
            return {}


scheduler_registry = _SchedulerRegistry()
