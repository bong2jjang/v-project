"""SLA 타이머 서비스 (골격) — 설계 §6 기준.

Phase 1 MVP 범위:
  * Ticket 접수 시 priority/category 에 매칭되는 SLA Policy 로 response/resolution
    타이머 2건을 생성한다.
  * APScheduler 가 1분 주기로 `scan_due_timers()` 를 호출해 80% 경고 / 100% 위반
    을 감지하고 `warning_sent_at` / `breached_at` 를 기록한다(멱등).
  * 임박 티켓(due_at - now < 30분)은 Redis ZSET `itsm:sla:timers` 에 캐시한다.
  * 알림은 `app/services/notification_service.py` → `app/providers/` (v-itsm 내장
    Slack/Teams outbound provider) 로 직접 전송한다. v-channel-bridge 에 HTTP
    의존하지 않는다. 실패는 fail-open (WARN 로그만, FSM/스케줄 차단 없음).

영업시간/공휴일 반영(§6.2)은 Phase 1 Scope-out. 전 구간 24/7 계산.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import structlog
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
from app.services import notification_service
from app.services.scheduler_registry import JobSpec, scheduler_registry

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


def recalculate_active_timers(
    db: Session,
    *,
    only_policy_id: str | None = None,
    only_tier_id: str | None = None,
) -> dict[str, int]:
    """정책/티어 변경 후 활성 타이머의 due_at 을 재산출 — 설계 §6.1.

    breached / satisfied 타이머는 건드리지 않는다(과거 이벤트는 사실로 유지).
    only_policy_id / only_tier_id 가 주어지면 해당 정책·티어를 사용하는 티켓만 대상.
    """
    tickets_scanned = 0
    timers_updated = 0
    skipped_breached = 0
    skipped_satisfied = 0

    ticket_stmt = select(Ticket)
    if only_tier_id is not None:
        ticket_stmt = ticket_stmt.join(
            Contract, Contract.id == Ticket.contract_id
        ).where(Contract.sla_tier_id == only_tier_id)
    elif only_policy_id is not None:
        ticket_stmt = ticket_stmt.where(Ticket.sla_policy_id == only_policy_id)

    tickets = list(db.execute(ticket_stmt).scalars().all())
    for ticket in tickets:
        tickets_scanned += 1
        priority = Priority(ticket.priority)
        response_min, resolution_min, policy_id = _resolve_policy(
            db, priority, ticket.category_l1, contract_id=ticket.contract_id
        )
        ticket.sla_policy_id = policy_id

        minutes_by_kind = {
            SLAKind.RESPONSE.value: response_min,
            SLAKind.RESOLUTION.value: resolution_min,
        }
        timers = db.execute(
            select(SLATimer).where(SLATimer.ticket_id == ticket.id)
        ).scalars().all()
        for timer in timers:
            if timer.breached_at is not None:
                skipped_breached += 1
                continue
            if timer.satisfied_at is not None:
                skipped_satisfied += 1
                continue
            minutes = minutes_by_kind.get(timer.kind)
            if minutes is None:
                continue
            new_due = timer.created_at + timedelta(minutes=minutes)
            if new_due != timer.due_at:
                timer.due_at = new_due
                timers_updated += 1

    if timers_updated or tickets_scanned:
        db.commit()

    logger.info(
        "sla_timer.recalculate_done",
        tickets_scanned=tickets_scanned,
        timers_updated=timers_updated,
        skipped_breached=skipped_breached,
        skipped_satisfied=skipped_satisfied,
        only_policy_id=only_policy_id,
        only_tier_id=only_tier_id,
    )
    return {
        "tickets_scanned": tickets_scanned,
        "timers_updated": timers_updated,
        "skipped_breached": skipped_breached,
        "skipped_satisfied": skipped_satisfied,
    }


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


# ─── Notification hooks (embedded provider, notification_service) ─────────────────────
def _notify_warning(timer: SLATimer) -> None:
    logger.info(
        "sla_timer.warning",
        ticket_id=timer.ticket_id,
        kind=timer.kind,
        due_at=timer.due_at.isoformat(),
    )
    notification_service.notify_sla_warning(timer)


def _notify_breach(timer: SLATimer) -> None:
    logger.warning(
        "sla_timer.breach",
        ticket_id=timer.ticket_id,
        kind=timer.kind,
        due_at=timer.due_at.isoformat(),
    )
    notification_service.notify_sla_breach(timer)


# ─── Scheduler 연결 ───────────────────────────────────────────
# 실제 AsyncIOScheduler 인스턴스는 scheduler_registry 가 소유한다.
# 여기서는 JobSpec 만 선언하고 레지스트리에 등록한다.
SLA_SCAN_JOB_ID = "itsm_sla_scan"


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


scheduler_registry.register(
    JobSpec(
        job_id=SLA_SCAN_JOB_ID,
        func=_scan_job,
        default_interval_seconds=SCAN_INTERVAL_SECONDS,
        min_interval_seconds=15,
        max_interval_seconds=15 * 60,
        description="SLA 타이머 주기 스캔 (경고/위반 감지)",
    )
)
