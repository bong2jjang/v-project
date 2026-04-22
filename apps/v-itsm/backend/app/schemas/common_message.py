"""CommonMessage — 플랫폼 중립 메시지 스키마 (v-channel-bridge 에서 포팅).

v-itsm 은 Slack/Teams 알림을 **직접** 송출하기 위해 provider 를 내장한다.
provider 는 이 스키마로 송신 메시지를 받고 플랫폼별 페이로드로 변환한다.

Phase 1 범위
  * outbound(송신) 전용. receive/command_* 는 v-itsm 스코프 아웃 (Phase 2 접수 경로).
  * is_command/parse_command 등 커맨드 유틸은 포함하지 않음.

원본: apps/v-channel-bridge/backend/app/schemas/common_message.py
"""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class MessageType(str, Enum):
    TEXT = "text"
    FILE = "file"
    IMAGE = "image"
    REACTION = "reaction"
    COMMAND = "command"
    SYSTEM = "system"


class Platform(str, Enum):
    SLACK = "slack"
    TEAMS = "teams"
    VMS = "vms"


class ChannelType(str, Enum):
    CHANNEL = "channel"
    DM = "dm"
    GROUP_DM = "group_dm"


class Attachment(BaseModel):
    id: str = Field(..., description="첨부파일 고유 ID")
    name: str = Field(..., description="파일명")
    mime_type: str = Field(..., description="MIME 타입")
    size: int = Field(..., description="파일 크기(bytes)")
    url: str = Field(..., description="파일 접근 URL")
    local_path: str | None = None
    delivered_url: str | None = None
    download_status: str = "pending"
    download_error: str | None = None
    width: int | None = None
    height: int | None = None


class User(BaseModel):
    id: str
    username: str
    display_name: str
    platform: Platform
    avatar_url: str | None = None


class Channel(BaseModel):
    id: str
    name: str
    platform: Platform
    type: ChannelType = ChannelType.CHANNEL


class CommonMessage(BaseModel):
    """플랫폼 중립 메시지. provider.send_message() 가 이 스키마를 받는다."""

    message_id: str
    timestamp: datetime
    type: MessageType
    platform: Platform

    user: User
    channel: Channel

    text: str | None = None
    attachments: list[Attachment] = Field(default_factory=list)
    reactions: list[str] = Field(default_factory=list)
    is_edited: bool = False

    thread_id: str | None = None
    parent_id: str | None = None

    raw_message: dict[str, Any] = Field(default_factory=dict)
    target_channels: list[Channel] = Field(default_factory=list)

    # v-itsm outbound 에서는 미사용이지만 스키마 호환성을 위해 유지
    command: str | None = None
    command_args: list[str] = Field(default_factory=list)
