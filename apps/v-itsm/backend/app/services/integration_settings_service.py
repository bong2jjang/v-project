"""Integration Settings service — workspace별 싱글턴 get/update + 연결 테스트 기록.

설계 §4.2·§7.3. 민감값은 모델의 `*_decrypted`/`*_enc` 프로퍼티 세터를 통해서만
저장(자동 Fernet 암호화). 응답 DTO 는 `*_set: bool` 로만 노출.

운영상 주의
  * `update_settings` 에서 빈 문자열("")은 **삭제 의미** 로 해석해 컬럼을 NULL 처리.
  * `None` (또는 DTO 에서 `exclude_unset`) 은 **변경 없음** 의미.
  * 워크스페이스별 row 는 lazy-create (`ensure_row`) 로 보장.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session
from ulid import ULID

from app.models.integration_settings import IntegrationSettings
from app.schemas.integration_settings import (
    IntegrationSettingsOut,
    IntegrationSettingsUpdate,
    IntegrationTestResult,
)

# 평문/암호화 모두 프로퍼티 세터로 쓰기 — 직접 `*_enc` 접근 금지
_SECRET_FIELDS = (
    "slack_bot_token",
    "slack_app_token",
    "slack_signing_secret",
    "teams_app_password",
    "teams_webhook_url",
    "email_smtp_user",
    "email_smtp_password",
)

_PLAIN_FIELDS = (
    "slack_default_channel",
    "teams_tenant_id",
    "teams_app_id",
    "teams_team_id",
    "teams_default_channel_id",
    "email_smtp_host",
    "email_smtp_port",
    "email_from",
)


def ensure_row(db: Session, workspace_id: str) -> IntegrationSettings:
    """워크스페이스별 singleton row 보장. 없으면 신규 생성."""
    row = db.execute(
        select(IntegrationSettings).where(
            IntegrationSettings.workspace_id == workspace_id
        )
    ).scalar_one_or_none()
    if row is None:
        row = IntegrationSettings(workspace_id=workspace_id)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def get_settings(db: Session, *, workspace_id: str) -> IntegrationSettings:
    return ensure_row(db, workspace_id)


def update_settings(
    db: Session,
    payload: IntegrationSettingsUpdate,
    *,
    workspace_id: str,
    actor_id: int | None,
) -> IntegrationSettings:
    row = ensure_row(db, workspace_id)
    data = payload.model_dump(exclude_unset=True)

    for field in _SECRET_FIELDS:
        if field not in data:
            continue
        value = data[field]
        # "" = 삭제, None = 변경 없음(이미 exclude_unset 으로 걸러짐이 정상이지만 방어)
        if value == "":
            setattr(row, field, None)
        elif value is not None:
            setattr(row, field, value)

    for field in _PLAIN_FIELDS:
        if field not in data:
            continue
        value = data[field]
        if value == "":
            setattr(row, field, None)
        else:
            setattr(row, field, value)

    row.updated_by = actor_id
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return row


def record_test_result(
    db: Session,
    channel: str,
    *,
    workspace_id: str,
    ok: bool,
    message: str,
) -> IntegrationSettings:
    """연결 테스트 결과를 저장(채널별 last_test_*). channel: slack|teams|email."""
    row = ensure_row(db, workspace_id)
    now = datetime.now(timezone.utc)
    if channel == "slack":
        row.slack_last_test_at = now
        row.slack_last_test_ok = ok
        row.slack_last_test_message = message
    elif channel == "teams":
        row.teams_last_test_at = now
        row.teams_last_test_ok = ok
        row.teams_last_test_message = message
    elif channel == "email":
        row.email_last_test_at = now
        row.email_last_test_ok = ok
        row.email_last_test_message = message
    else:
        raise ValueError(f"unknown channel: {channel}")
    db.commit()
    db.refresh(row)
    return row


def to_out(row: IntegrationSettings) -> IntegrationSettingsOut:
    """모델 → 응답 DTO (*_set: bool 마스킹)."""

    def _bool(col: str | None) -> bool:
        return bool(col)

    def _test(
        at: datetime | None, ok: bool | None, msg: str | None
    ) -> IntegrationTestResult | None:
        if at is None or ok is None:
            return None
        return IntegrationTestResult(ok=ok, message=msg or "", tested_at=at)

    return IntegrationSettingsOut(
        id=row.id,
        slack_bot_token_set=_bool(row.slack_bot_token_enc),
        slack_app_token_set=_bool(row.slack_app_token_enc),
        slack_signing_secret_set=_bool(row.slack_signing_secret_enc),
        slack_default_channel=row.slack_default_channel,
        teams_tenant_id=row.teams_tenant_id,
        teams_app_id=row.teams_app_id,
        teams_app_password_set=_bool(row.teams_app_password_enc),
        teams_team_id=row.teams_team_id,
        teams_webhook_url_set=_bool(row.teams_webhook_url_enc),
        teams_default_channel_id=row.teams_default_channel_id,
        email_smtp_host=row.email_smtp_host,
        email_smtp_port=row.email_smtp_port,
        email_from=row.email_from,
        email_smtp_user_set=_bool(row.email_smtp_user_enc),
        email_smtp_password_set=_bool(row.email_smtp_password_enc),
        slack_last_test=_test(
            row.slack_last_test_at, row.slack_last_test_ok, row.slack_last_test_message
        ),
        teams_last_test=_test(
            row.teams_last_test_at, row.teams_last_test_ok, row.teams_last_test_message
        ),
        email_last_test=_test(
            row.email_last_test_at, row.email_last_test_ok, row.email_last_test_message
        ),
        updated_by=row.updated_by,
        updated_at=row.updated_at,
    )


def get_slack_plaintext(db: Session, *, workspace_id: str) -> dict[str, str | None]:
    """Provider 초기화용 평문 Slack 구성 반환 (없으면 값 None)."""
    row = db.execute(
        select(IntegrationSettings).where(
            IntegrationSettings.workspace_id == workspace_id
        )
    ).scalar_one_or_none()
    if row is None:
        return {"bot_token": None, "app_token": None, "signing_secret": None}
    return {
        "bot_token": row.slack_bot_token,
        "app_token": row.slack_app_token,
        "signing_secret": row.slack_signing_secret,
        "default_channel": row.slack_default_channel,
    }


def get_teams_plaintext(db: Session, *, workspace_id: str) -> dict[str, str | None]:
    row = db.execute(
        select(IntegrationSettings).where(
            IntegrationSettings.workspace_id == workspace_id
        )
    ).scalar_one_or_none()
    if row is None:
        return {
            "tenant_id": None,
            "app_id": None,
            "app_password": None,
            "team_id": None,
            "webhook_url": None,
            "default_channel_id": None,
        }
    return {
        "tenant_id": row.teams_tenant_id,
        "app_id": row.teams_app_id,
        "app_password": row.teams_app_password,
        "team_id": row.teams_team_id,
        "webhook_url": row.teams_webhook_url,
        "default_channel_id": row.teams_default_channel_id,
    }


def get_email_plaintext(
    db: Session, *, workspace_id: str
) -> dict[str, str | int | None]:
    row = db.execute(
        select(IntegrationSettings).where(
            IntegrationSettings.workspace_id == workspace_id
        )
    ).scalar_one_or_none()
    if row is None:
        return {
            "host": None,
            "port": None,
            "from_addr": None,
            "user": None,
            "password": None,
        }
    return {
        "host": row.email_smtp_host,
        "port": row.email_smtp_port,
        "from_addr": row.email_from,
        "user": row.email_smtp_user,
        "password": row.email_smtp_password,
    }
