"""SLA 타이머 서비스 (골격) — 설계 §6 기준.

Phase 1 MVP 범위:
  * Ticket 접수 시 priority/category 에 매칭되는 SLA Policy 로 response/resolution
    타이머 2건을 생성한다.
  * APScheduler 가 1분 주기로 `scan_due_timers()` 를 호출해 80% 경고 / 100% 위반
    을 감지하고 `warning_sent_at` / `breached_at` 를 기록한다(멱등).
  * 임박 티켓(due_at - now < 30분)은 Redis ZSET `itsm:sla:timers` 에 캐시한다.
  * 실제 알림(Slack/Teams)은 v-channel-bridge 연동을 별도 작업에서 연결한다.
    현 시점에는 구조화 로그만 기록한다 (hook point: `_notify_*`).

영업시간/공휴일 반영(§6.2)은 Phase 1 Scope-out. 전 구간 24/7 계산.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from redis import Redis
from redis.exceptions import RedisError
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session
from ulid import ULID
from v_platform.core.database import SessionLocal

from app.models.contract import Contract
from app.models.enums import Priority, SLAKind
from app.models.sla import SLAPolicy, SLATimer
from app.models.sla_tier import SLATier
from app.models.ticket import Ticket

logger = structlog.get_logger(__name__)

SCAN_INTERVAL_SECONDS = 60
WARNING_RATIO = 0.8
IMMINENT_WINDOW_MINUTES = 30
REDIS_ZSET_KEY = "itsm:sla:timers"


# ─── Redis 연결 (lazy) ────────────────────────────────────────
_redis_client: Redis | None = None


def _redis() -> Redis | None:
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    url = os.getenv("REDIS_URL", "redis://:redispassword@redis:6379/0")
    try:
        _redis_client = Redis.from_url(url, decode_responses=True)
        _redis_client.ping()
    except RedisError as e:
        logger.warning("sla_timer.redis_unavailable", error=str(e))
        _redis_client = None
    return _redis_client


# ─── 정책 기본값 (시드 전 임시) ─────────────────────────────────
# 설계 §6.1 표. DB 에 정책이 없는 경우의 폴백 (분 단위).
_DEFAULT_POLICY_MINUTES: dict[Priority, tuple[int, int]] = {
    Priority.CRITICAL: (15, 4 * 60),
    Priority.HIGH: (60, 8 * 60),
    Priority.NORMAL: (4 * 60, 3 * 8 * 60),
    Priority.LOW: (8 * 60, 5 * 8 * 60),
}


def _resolve_from_tier(
    db: Session, contract_id: str | None, priority: Priority
) -> tuple[int, int] | None:
    """계약 → SLA 티어 → priority_matrix 로 (response, resolution) 분 산출.

    티어 미지정·티어 비활성·매트릭스 키 누락 시 None.
    """
    if contract_id is None:
        return None
    contract = db.get(Contract, contract_id)
    if contract is None or contract.sla_tier_id is None:
        return None
    tier = db.get(SLATier, contract.sla_tier_id)
    if tier is None or not tier.active:
        return None
    matrix = tier.priority_matrix or {}
    entry = matrix.get(priority.value)
    if not isinstance(entry, dict):
        return None
    try:
        return int(entry["response"]), int(entry["resolution"])
    except (KeyError, TypeError, ValueError):
        return None


def _resolve_policy(
    db: Session,
    priority: Priority,
    category: str | None,
    *,
    contract_id: str | None = None,
) -> tuple[int, int, str | None]:
    """SLA 분 해상도 체인: 계약 티어 → SLAPolicy → 하드코딩 기본값.

    반환: (response_min, resolution_min, sla_policy_id | None)
    티어에서 찾은 경우 policy_id = None (SLAPolicy 로우가 아니므로).
    """
    # 1) 계약 기반 티어
    tier_result = _resolve_from_tier(db, contract_id, priority)
    if tier_result is not None:
        response, resolution = tier_result
        return response, resolution, None

    # 2) 카테고리 단위 SLAPolicy 예외
    stmt = select(SLAPolicy).where(
        SLAPolicy.active.is_(True),
        SLAPolicy.priority == priority.value,
        or_(SLAPolicy.category == category, SLAPolicy.category.is_(None)),
    )
    rows = db.execute(stmt).scalars().all()
    rows.sort(key=lambda p: 0 if p.category == category else 1)
    if rows:
        top = rows[0]
        return top.response_minutes, top.resolution_minutes, top.id

    # 3) 하드코딩 기본값
    response, resolution = _DEFAULT_POLICY_MINUTES[priority]
    return response, resolution, None


# ─── 타이머 생성 ──────────────────────────────────────────────
def create_timers(db: Session, ticket: Ticket) -> list[SLATimer]:
    """티켓에 response/resolution 타이머 2건을 생성(멱등)."""
    existing = db.execute(
        select(SLATimer).where(SLATimer.ticket_id == ticket.id)
    ).scalars().all()
    if existing:
        return list(existing)

    priority = Priority(ticket.priority)
    response_min, resolution_min, policy_id = _resolve_policy(
        db, priority, ticket.category_l1, contract_id=ticket.contract_id
    )
    if policy_id is not None and ticket.sla_policy_id is None:
        ticket.sla_policy_id = policy_id

    now = datetime.now(timezone.utc)
    timers = [
        SLATimer(
            id=str(ULID()),
            ticket_id=ticket.id,
            kind=SLAKind.RESPONSE.value,
            due_at=now + timedelta(minutes=response_min),
        ),
        SLATimer(
            id=str(ULID()),
            ticket_id=ticket.id,
            kind=SLAKind.RESOLUTION.value,
            due_at=now + timedelta(minutes=resolution_min),
        ),
    ]
    db.add_all(timers)
    db.commit()
    for t in timers:
        _cache_imminent(t)
    return timers


def _cache_imminent(timer: SLATimer) -> None:
    client = _redis()
    if client is None:
        return
    now = datetime.now(timezone.utc)
    if (timer.due_at - now).total_seconds() > IMMINENT_WINDOW_MINUTES * 60:
        return
    try:
        client.zadd(REDIS_ZSET_KEY, {timer.id: timer.due_at.timestamp()})
    except RedisError as e:
        logger.warning("sla_timer.cache_failed", timer_id=timer.id, error=str(e))


# ─── 주기 스캔 ────────────────────────────────────────────────
def scan_due_timers(db: Session) -> dict[str, int]:
    """80% 경고 / 100% 위반 감지. 멱등하게 warning_sent_at / breached_at 기록."""
    now = datetime.now(timezone.utc)
    warnings_sent = 0
    breaches_recorded = 0

    breach_stmt = select(SLATimer).where(
        and_(
            SLATimer.due_at <= now,
            SLATimer.breached_at.is_(None),
            SLATimer.satisfied_at.is_(None),
        )
    )
    for timer in db.execute(breach_stmt).scalars():
        timer.breached_at = now
        breaches_recorded += 1
        _notify_breach(timer)

    warn_stmt = select(SLATimer).where(
        and_(
            SLATimer.due_at > now,
            SLATimer.warning_sent_at.is_(None),
            SLATimer.satisfied_at.is_(None),
        )
    )
    for timer in db.execute(warn_stmt).scalars():
        total = (timer.due_at - timer.created_at).total_seconds()
        elapsed = (now - timer.created_at).total_seconds()
        if total <= 0:
            continue
        if (elapsed / total) >= WARNING_RATIO:
            timer.warning_sent_at = now
            warnings_sent += 1
            _notify_warning(timer)

    if warnings_sent or breaches_recorded:
        db.commit()

    return {"warnings": warnings_sent, "breaches": breaches_recorded}


def mark_satisfied(db: Session, ticket_id: str, kind: SLAKind) -> None:
    """담당자 첫 응답 / 해결 완료 시 해당 타이머를 만족 상태로."""
    stmt = select(SLATimer).where(
        SLATimer.ticket_id == ticket_id,
        SLATimer.kind == kind.value,
        SLATimer.satisfied_at.is_(None),
    )
    timer = db.execute(stmt).scalar_one_or_none()
    if timer is None:
        return
    timer.satisfied_at = datetime.now(timezone.utc)
    db.commit()


# ─── Notification hooks (bridge 연동 자리) ─────────────────────
def _notify_warning(timer: SLATimer) -> None:
    logger.info(
        "sla_timer.warning",
        ticket_id=timer.ticket_id,
        kind=timer.kind,
        due_at=timer.due_at.isoformat(),
    )


def _notify_breach(timer: SLATimer) -> None:
    logger.warning(
        "sla_timer.breach",
        ticket_id=timer.ticket_id,
        kind=timer.kind,
        due_at=timer.due_at.isoformat(),
    )


# ─── Scheduler 생명주기 ───────────────────────────────────────
_scheduler: AsyncIOScheduler | None = None


def _scan_job() -> None:
    db = SessionLocal()
    try:
        result = scan_due_timers(db)
        if result["warnings"] or result["breaches"]:
            logger.info("sla_timer.scan_done", **result)
    except Exception:  # noqa: BLE001
        logger.exception("sla_timer.scan_failed")
    finally:
        db.close()


def start_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is not None:
        return _scheduler
    sched = AsyncIOScheduler(timezone="UTC")
    sched.add_job(
        _scan_job,
        "interval",
        seconds=SCAN_INTERVAL_SECONDS,
        id="itsm_sla_scan",
        replace_existing=True,
    )
    sched.start()
    _scheduler = sched
    logger.info("sla_timer.scheduler_started", interval=SCAN_INTERVAL_SECONDS)
    return sched


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is None:
        return
    _scheduler.shutdown(wait=False)
    _scheduler = None
    logger.info("sla_timer.scheduler_stopped")
