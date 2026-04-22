"""Integration Settings 스키마 — 설계 §4.2 (Operations Console).

보안: 평문 시크릿은 요청 본문(write-only) 으로만 전달. 응답은 민감값의
*존재 여부(_set)* 만 노출하고 값 자체는 반환하지 않는다.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class IntegrationSettingsUpdate(BaseModel):
    """Partial update. 생략된 필드는 변경하지 않음. 빈 문자열은 '삭제' 의미."""

    # Slack
    slack_bot_token: str | None = None
    slack_app_token: str | None = None
    slack_signing_secret: str | None = None
    slack_default_channel: str | None = Field(default=None, max_length=200)

    # Teams
    teams_tenant_id: str | None = Field(default=None, max_length=100)
    teams_app_id: str | None = Field(default=None, max_length=100)
    teams_app_password: str | None = None
    teams_team_id: str | None = Field(default=None, max_length=100)
    teams_webhook_url: str | None = None
    teams_default_channel_id: str | None = Field(default=None, max_length=200)

    # Email
    email_smtp_host: str | None = Field(default=None, max_length=200)
    email_smtp_port: int | None = Field(default=None, ge=1, le=65535)
    email_from: str | None = Field(default=None, max_length=300)
    email_smtp_user: str | None = None
    email_smtp_password: str | None = None


class IntegrationTestResult(BaseModel):
    ok: bool
    message: str
    tested_at: datetime


class IntegrationSettingsOut(BaseModel):
    """민감값은 *_set(bool) 로만 노출."""

    model_config = ConfigDict(from_attributes=True)

    id: int

    slack_bot_token_set: bool
    slack_app_token_set: bool
    slack_signing_secret_set: bool
    slack_default_channel: str | None

    teams_tenant_id: str | None
    teams_app_id: str | None
    teams_app_password_set: bool
    teams_team_id: str | None
    teams_webhook_url_set: bool
    teams_default_channel_id: str | None

    email_smtp_host: str | None
    email_smtp_port: int | None
    email_from: str | None
    email_smtp_user_set: bool
    email_smtp_password_set: bool

    slack_last_test: IntegrationTestResult | None = None
    teams_last_test: IntegrationTestResult | None = None
    email_last_test: IntegrationTestResult | None = None

    updated_by: int | None
    updated_at: datetime
