"""Notification Log service — 전송 로그 CRUD + 재시도 훅.

설계 §7.4. `notification_service._dispatch_one` 직전/직후에
`create_pending()` → `mark_success()` / `mark_failure()` 로 상태 전이.

재시도는 API 라우터에서 `get_log()` 후 `retry_log()` 를 호출하여 payload 를
기반으로 `_dispatch_one` 을 재수행하고 결과를 `last_retry_at` 과 함께 반영.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session
from ulid import ULID

from app.models.notification_log import NotificationLog
from app.schemas.notification_log import NotificationLogFilter


def _new_ulid() -> str:
    return str(ULID())


def create_pending(
    db: Session,
    *,
    ticket_id: str | None,
    event_type: str,
    channel: str,
    target_user_id: int | None,
    target_address: str,
    payload: dict[str, Any],
) -> NotificationLog:
    row = NotificationLog(
        id=_new_ulid(),
        ticket_id=ticket_id,
        event_type=event_type,
        channel=channel,
        target_user_id=target_user_id,
        target_address=target_address,
        payload=payload,
        status="pending",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def mark_success(db: Session, log_id: str) -> NotificationLog | None:
    row = db.get(NotificationLog, log_id)
    if row is None:
        return None
    row.status = "success"
    row.error_message = None
    row.delivered_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return row


def mark_failure(
    db: Session, log_id: str, *, error: str, is_retry: bool = False
) -> NotificationLog | None:
    row = db.get(NotificationLog, log_id)
    if row is None:
        return None
    row.status = "failure"
    row.error_message = error[:2000] if error else None
    if is_retry:
        row.retry_count = (row.retry_count or 0) + 1
        row.last_retry_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return row


def get_log(db: Session, log_id: str) -> NotificationLog | None:
    return db.get(NotificationLog, log_id)


def list_logs(
    db: Session, filt: NotificationLogFilter
) -> tuple[list[NotificationLog], int]:
    conds = []
    if filt.status:
        conds.append(NotificationLog.status == filt.status)
    if filt.channel:
        conds.append(NotificationLog.channel == filt.channel)
    if filt.event_type:
        conds.append(NotificationLog.event_type == filt.event_type)
    if filt.ticket_id:
        conds.append(NotificationLog.ticket_id == filt.ticket_id)
    if filt.target_user_id is not None:
        conds.append(NotificationLog.target_user_id == filt.target_user_id)
    if filt.since is not None:
        conds.append(NotificationLog.created_at >= filt.since)
    if filt.until is not None:
        conds.append(NotificationLog.created_at <= filt.until)
    if filt.search:
        like = f"%{filt.search}%"
        conds.append(
            or_(
                NotificationLog.target_address.ilike(like),
                NotificationLog.error_message.ilike(like),
            )
        )

    where = and_(*conds) if conds else None
    total_stmt = select(func.count(NotificationLog.id))
    list_stmt = select(NotificationLog).order_by(NotificationLog.created_at.desc())
    if where is not None:
        total_stmt = total_stmt.where(where)
        list_stmt = list_stmt.where(where)

    total = int(db.execute(total_stmt).scalar_one())
    offset = (filt.page - 1) * filt.page_size
    rows = list(
        db.execute(list_stmt.offset(offset).limit(filt.page_size)).scalars().all()
    )
    return rows, total


def mark_retry_pending(db: Session, log_id: str) -> NotificationLog | None:
    row = db.get(NotificationLog, log_id)
    if row is None:
        return None
    row.status = "pending"
    row.error_message = None
    row.retry_count = (row.retry_count or 0) + 1
    row.last_retry_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return row
