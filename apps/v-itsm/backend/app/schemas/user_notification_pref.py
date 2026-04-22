"""User Notification Preference 스키마 — 설계 §7.5.

사용자별 알림 선호. `itsm_user_notification_pref` 는 user_id UNIQUE 이므로
본인용 upsert(`PUT /api/me/notification-pref`) 중심으로 사용.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class UserNotificationPrefUpdate(BaseModel):
    """본인 upsert 또는 관리자 전면 교체 (PUT 용). 생략된 필드는 변경하지 않음."""

    slack_user_id: str | None = Field(default=None, max_length=50)
    teams_user_id: str | None = Field(default=None, max_length=100)
    teams_channel_override: str | None = Field(default=None, max_length=200)
    email_override: str | None = Field(default=None, max_length=300)

    channels: list[str] | None = None  # ["email","slack","teams"]
    event_overrides: dict[str, Any] | None = None
    enabled: bool | None = None
    quiet_hours: dict[str, Any] | None = None


class UserNotificationPrefOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: int

    slack_user_id: str | None
    teams_user_id: str | None
    teams_channel_override: str | None
    email_override: str | None

    channels: list[str]
    event_overrides: dict[str, Any] | None
    enabled: bool
    quiet_hours: dict[str, Any] | None

    created_at: datetime
    updated_at: datetime
