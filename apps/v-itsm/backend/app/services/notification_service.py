"""v-itsm 내장 provider 기반 알림 디스패처.

설계 §7 알림 설계 기준. 모든 외부 호출은 **fail-open** — 알림 실패가 티켓 처리를
막지 않도록 예외를 삼키고 구조화 로그만 남긴다.

이전 구현(httpx → v-channel-bridge `/api/bridge/notify`) 은 앱 간 런타임 HTTP 의존을
만들어 브리지가 내려가면 ITSM 알림이 멈췄다. 현재는 `app.providers` 의 Slack/Teams
provider 를 직접 호출해 **독립 동작**한다.

Phase 1 범위
  * 기본 채널(`ITSM_DEFAULT_NOTIFY_CHANNELS`) 로 broadcast
  * 티켓/계약/부서 단위 라우팅은 Phase 2 (DB 기반 매핑 테이블)

채널 포맷: `<platform>:<channel_id>` 를 콤마(,) 로 구분.
    slack:C0123ABCD,teams:19%3Axxx%40thread.tacv2
platform 과 channel_id 사이 첫 ':' 만 구분자로 사용하므로 channel_id 내부의 ':' 는 보존.

공개 API(sync)는 그대로 두되, provider 송출이 async 이므로 running loop 에
`create_task` 로 fire-and-forget. 루프가 없는 환경(테스트/스크립트)에서는 임시
스레드에서 `asyncio.run` 으로 최선 노력 송출.
"""

from __future__ import annotations

import asyncio
import os
import threading
import uuid
from datetime import datetime, timezone

import structlog

from app.models.sla import SLATimer
from app.models.ticket import Ticket
from app.providers import provider_registry
from app.schemas.common_message import (
    Channel,
    ChannelType,
    CommonMessage,
    MessageType,
    Platform,
    User,
)
from app.services import notification_log_service

logger = structlog.get_logger(__name__)

_DEFAULT_CHANNELS_ENV = "ITSM_DEFAULT_NOTIFY_CHANNELS"

# CommonMessage.user 는 required 이므로 ITSM 자동 알림용 상수 User
_BOT_USER = User(
    id="itsm-bot",
    username="itsm",
    display_name="ITSM Bot",
    platform=Platform.VMS,
)


# ─── Channel parsing ──────────────────────────────────────────
def _parse_channels(raw: str) -> list[dict[str, str]]:
    channels: list[dict[str, str]] = []
    for token in raw.split(","):
        token = token.strip()
        if not token or ":" not in token:
            continue
        platform, channel_id = token.split(":", 1)
        platform = platform.strip().lower()
        channel_id = channel_id.strip()
        if not platform or not channel_id:
            continue
        channels.append({"platform": platform, "channel_id": channel_id})
    return channels


def _default_channels() -> list[dict[str, str]]:
    raw = os.getenv(_DEFAULT_CHANNELS_ENV, "")
    return _parse_channels(raw)


def _resolve_platform(raw: str) -> Platform | None:
    try:
        return Platform(raw)
    except ValueError:
        return None


# ─── Log helpers (best-effort, fail-open) ─────────────────────
def _log_pending(
    *,
    ticket_id: str | None,
    event_type: str,
    channel: str,
    target_address: str,
    payload: dict,
) -> str | None:
    """NotificationLog pending row 작성. 세션 오류는 경고 후 None."""
    try:
        from v_platform.core.database import SessionLocal
    except Exception:  # noqa: BLE001
        return None
    try:
        with SessionLocal() as db:
            row = notification_log_service.create_pending(
                db,
                ticket_id=ticket_id,
                event_type=event_type,
                channel=channel,
                target_user_id=None,
                target_address=target_address,
                payload=payload,
            )
            return row.id
    except Exception as e:  # noqa: BLE001
        logger.warning("notify.log_pending_error", error=str(e), event=event_type)
        return None


def _log_result(log_id: str | None, *, ok: bool, error: str | None) -> None:
    if not log_id:
        return
    try:
        from v_platform.core.database import SessionLocal
    except Exception:  # noqa: BLE001
        return
    try:
        with SessionLocal() as db:
            if ok:
                notification_log_service.mark_success(db, log_id)
            else:
                notification_log_service.mark_failure(
                    db, log_id, error=error or "unknown error"
                )
    except Exception as e:  # noqa: BLE001
        logger.warning("notify.log_result_error", error=str(e), log_id=log_id)


# ─── Async dispatch core ──────────────────────────────────────
async def _dispatch_one(
    platform: Platform,
    channel_id: str,
    text: str,
    blocks: list[dict] | None,
    event: str | None,
    *,
    ticket_id: str | None = None,
) -> bool:
    event_type = event or "unknown"
    payload = {"text": text, "blocks": blocks or [], "channel_id": channel_id}
    log_id = _log_pending(
        ticket_id=ticket_id,
        event_type=event_type,
        channel=platform.value,
        target_address=channel_id,
        payload=payload,
    )

    provider = provider_registry.get(platform)
    if provider is None:
        logger.debug(
            "notify.provider_missing", platform=platform.value, event=event
        )
        _log_result(log_id, ok=False, error="provider_missing")
        return False
    if not provider.is_connected:
        logger.debug(
            "notify.provider_disconnected", platform=platform.value, event=event
        )
        _log_result(log_id, ok=False, error="provider_disconnected")
        return False

    msg = CommonMessage(
        message_id=f"itsm-{uuid.uuid4().hex[:12]}",
        timestamp=datetime.now(timezone.utc),
        type=MessageType.TEXT,
        platform=platform,
        user=_BOT_USER,
        channel=Channel(
            id=channel_id,
            name="",
            platform=platform,
            type=ChannelType.CHANNEL,
        ),
        text=text,
        raw_message={"blocks": blocks} if blocks else {},
    )
    try:
        ok = await provider.send_message(msg)
        _log_result(log_id, ok=bool(ok), error=None if ok else "send_returned_false")
        return bool(ok)
    except Exception as e:  # noqa: BLE001 — fail-open
        logger.warning(
            "notify.provider_exception",
            platform=platform.value,
            event=event,
            error=str(e),
        )
        _log_result(log_id, ok=False, error=str(e))
        return False


async def _dispatch_all(
    text: str,
    targets: list[dict[str, str]],
    blocks: list[dict] | None,
    event: str | None,
    *,
    ticket_id: str | None = None,
) -> None:
    tasks: list[asyncio.Task[bool]] = []
    for t in targets:
        platform = _resolve_platform(t["platform"])
        if platform is None:
            logger.debug(
                "notify.unknown_platform", platform=t["platform"], event=event
            )
            continue
        tasks.append(
            asyncio.create_task(
                _dispatch_one(
                    platform,
                    t["channel_id"],
                    text,
                    blocks,
                    event,
                    ticket_id=ticket_id,
                )
            )
        )
    if not tasks:
        return
    results = await asyncio.gather(*tasks, return_exceptions=True)
    sent = sum(1 for r in results if r is True)
    logger.info(
        "notify.dispatched", event=event, sent=sent, total=len(tasks)
    )


def _fire_and_forget(coro) -> None:
    """Sync 콜사이트에서 async dispatch 를 최선 노력으로 예약.

    running loop 가 있으면 create_task, 없으면 daemon thread 에서 asyncio.run.
    예외 전파는 없음 (fail-open).
    """
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(coro)
        return
    except RuntimeError:
        pass

    def _runner() -> None:
        try:
            asyncio.run(coro)
        except Exception as e:  # noqa: BLE001
            logger.warning("notify.thread_dispatch_error", error=str(e))

    threading.Thread(target=_runner, daemon=True).start()


# ─── Public sync API ──────────────────────────────────────────
def send_notification(
    *,
    text: str,
    channels: list[dict[str, str]] | None = None,
    blocks: list[dict] | None = None,
    event: str | None = None,
    ticket_id: str | None = None,
) -> None:
    """기본 채널 또는 지정 채널로 알림 송출. 실패는 warn 로그로만 남김.

    `ticket_id` 는 NotificationLog 연관 키로만 쓰이며 provider 송출에는 영향 없음.
    """
    targets = channels if channels is not None else _default_channels()
    if not targets:
        logger.debug("notify.no_channels", event=event)
        return
    _fire_and_forget(
        _dispatch_all(text, targets, blocks, event, ticket_id=ticket_id)
    )


# ─── 이벤트별 헬퍼 ────────────────────────────────────────────
def notify_assignment(
    ticket: Ticket,
    *,
    old_owner_id: int | None,
    new_owner_id: int | None,
) -> None:
    if old_owner_id == new_owner_id:
        return
    if new_owner_id is None:
        text = (
            f"[ITSM] 배정 해제 · {ticket.ticket_no} · {ticket.title}\n"
            f"이전 담당자: #{old_owner_id}"
        )
    else:
        text = (
            f"[ITSM] 티켓 배정 · {ticket.ticket_no} · {ticket.title}\n"
            f"새 담당자: #{new_owner_id}"
            + (f" (이전: #{old_owner_id})" if old_owner_id else "")
        )
    send_notification(text=text, event="ticket.assignment", ticket_id=ticket.id)


def notify_transition(
    ticket: Ticket,
    *,
    from_stage: str | None,
    to_stage: str,
    action: str,
    actor_id: int | None,
    note: str | None,
) -> None:
    header = f"[ITSM] Loop 전이 · {ticket.ticket_no} · {action}"
    body = f"{from_stage or '-'} → {to_stage}"
    if actor_id is not None:
        body += f" · actor #{actor_id}"
    text = f"{header}\n{body}"
    if note:
        text += f"\n메모: {note[:300]}"
    send_notification(text=text, event="ticket.transition", ticket_id=ticket.id)


def _resolve_sla_targets(
    trigger_event: str, ticket_id: str
) -> list[dict[str, str]] | None:
    """SLANotificationPolicy 매칭 결과 union 을 채널 targets 로 변환.

    정책이 하나도 매칭되지 않거나 채널이 비면 None — 호출자가 기본 채널로 fallback.
    """
    try:
        from v_platform.core.database import SessionLocal

        from app.models.ticket import Ticket
        from app.services import sla_notification_policy_service
    except Exception:  # noqa: BLE001
        return None
    try:
        with SessionLocal() as db:
            ticket = db.get(Ticket, ticket_id)
            priority = ticket.priority if ticket is not None else None
            service_type = getattr(ticket, "service_type", None) if ticket else None
            policies = sla_notification_policy_service.resolve_for_event(
                db,
                trigger_event=trigger_event,
                priority=priority,
                service_type=service_type,
            )
            channels_raw = [c for p in policies for c in (p.notify_channels or [])]
    except Exception as e:  # noqa: BLE001
        logger.warning(
            "notify.sla_policy_lookup_error", error=str(e), event=trigger_event
        )
        return None
    if not channels_raw:
        return None
    seen: set[str] = set()
    uniq: list[str] = []
    for c in channels_raw:
        if c not in seen:
            seen.add(c)
            uniq.append(c)
    return _parse_channels(",".join(uniq))


def notify_sla_warning(timer: SLATimer) -> None:
    text = (
        f"[ITSM] SLA 80% 경고 · ticket {timer.ticket_id} · {timer.kind}\n"
        f"마감: {timer.due_at.isoformat()}"
    )
    targets = _resolve_sla_targets("warning", timer.ticket_id)
    send_notification(
        text=text,
        channels=targets,
        event="sla.warning",
        ticket_id=timer.ticket_id,
    )


def notify_sla_breach(timer: SLATimer) -> None:
    text = (
        f"[ITSM] SLA 위반 · ticket {timer.ticket_id} · {timer.kind}\n"
        f"마감 경과: {timer.due_at.isoformat()}"
    )
    targets = _resolve_sla_targets("breach", timer.ticket_id)
    send_notification(
        text=text,
        channels=targets,
        event="sla.breach",
        ticket_id=timer.ticket_id,
    )
