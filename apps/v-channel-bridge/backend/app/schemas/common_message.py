"""
VMS-Message-Schema: Common Message Schema for Light-Zowe Architecture

Zowe Chat의 Common Message Schema 개념을 VMS Channel Bridge에 적용한 통합 메시지 스키마.
모든 플랫폼(Slack, Teams, VMS 등)의 메시지를 이 스키마로 변환하여 처리합니다.

작성일: 2026-03-31
영감: Zowe Chat Architecture
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class MessageType(str, Enum):
    """메시지 타입"""

    TEXT = "text"
    FILE = "file"
    IMAGE = "image"
    REACTION = "reaction"
    COMMAND = "command"
    SYSTEM = "system"


class Platform(str, Enum):
    """지원 플랫폼"""

    SLACK = "slack"
    TEAMS = "teams"
    VMS = "vms"  # 향후 확장


class ChannelType(str, Enum):
    """채널/대화 유형"""

    CHANNEL = "channel"
    DM = "dm"
    GROUP_DM = "group_dm"


class Attachment(BaseModel):
    """첨부파일 표준 스키마"""

    id: str = Field(..., description="첨부파일 고유 ID")
    name: str = Field(..., description="파일명")
    mime_type: str = Field(..., description="MIME 타입 (예: image/png)")
    size: int = Field(..., description="파일 크기 (bytes)")
    url: str = Field(..., description="파일 접근 URL (원본)")

    # 파일 처리를 위한 추가 필드
    local_path: Optional[str] = Field(None, description="다운로드된 로컬 파일 경로")
    delivered_url: Optional[str] = Field(
        None, description="전송 완료 후 대상 플랫폼 URL"
    )
    download_status: str = Field(
        default="pending",
        description="다운로드 상태 (pending, downloaded, uploaded, failed)",
    )
    download_error: Optional[str] = Field(
        None, description="다운로드 실패 시 에러 메시지"
    )

    # 이미지 관련 메타데이터 (선택)
    width: Optional[int] = Field(None, description="이미지 너비 (픽셀)")
    height: Optional[int] = Field(None, description="이미지 높이 (픽셀)")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "att-123",
                "name": "screenshot.png",
                "mime_type": "image/png",
                "size": 102400,
                "url": "https://example.com/files/screenshot.png",
                "local_path": "/tmp/vms-attachments/screenshot.png",
                "delivered_url": None,
                "download_status": "pending",
            }
        }


class User(BaseModel):
    """사용자 표준 스키마"""

    id: str = Field(..., description="플랫폼별 사용자 고유 ID")
    username: str = Field(..., description="사용자명")
    display_name: str = Field(..., description="표시 이름")
    platform: Platform = Field(..., description="소속 플랫폼")
    avatar_url: Optional[str] = Field(None, description="프로필 이미지 URL")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "U123456",
                "username": "john.doe",
                "display_name": "John Doe",
                "platform": "slack",
                "avatar_url": "https://example.com/avatar.png",
            }
        }


class Channel(BaseModel):
    """채널 표준 스키마"""

    id: str = Field(..., description="플랫폼별 채널 고유 ID")
    name: str = Field(..., description="채널명")
    platform: Platform = Field(..., description="소속 플랫폼")
    type: ChannelType = Field(default=ChannelType.CHANNEL, description="채널/대화 유형")

    class Config:
        json_schema_extra = {
            "example": {
                "id": "C789012",
                "name": "general",
                "platform": "slack",
                "type": "channel",
            }
        }


class CommonMessage(BaseModel):
    """
    통합 메시지 스키마 (Zowe Chat Common Schema 개념)

    모든 플랫폼의 메시지를 이 스키마로 변환하여 처리합니다.
    Provider는 이 스키마로의 변환(transform_to_common)과
    이 스키마로부터의 변환(transform_from_common)을 구현해야 합니다.
    """

    # 메시지 메타데이터
    message_id: str = Field(..., description="메시지 고유 ID")
    timestamp: datetime = Field(..., description="메시지 생성 시각")
    type: MessageType = Field(..., description="메시지 타입")
    platform: Platform = Field(..., description="발신 플랫폼")

    # 발신자/채널 정보
    user: User = Field(..., description="발신자 정보")
    channel: Channel = Field(..., description="채널 정보")

    # 메시지 내용
    text: Optional[str] = Field(None, description="메시지 텍스트")
    attachments: List[Attachment] = Field(
        default_factory=list, description="첨부파일 목록"
    )
    reactions: List[str] = Field(default_factory=list, description="리액션 목록")
    is_edited: bool = Field(default=False, description="메시지 편집 여부")

    # 스레드/답글
    thread_id: Optional[str] = Field(None, description="스레드 ID")
    parent_id: Optional[str] = Field(None, description="부모 메시지 ID")

    # 원본 메시지 (디버깅/로깅용)
    raw_message: Dict[str, Any] = Field(
        default_factory=dict, description="플랫폼 원본 메시지"
    )

    # 라우팅 정보
    target_channels: List[Channel] = Field(
        default_factory=list, description="전송 대상 채널 목록"
    )

    # 커맨드 정보 (Command Processor용)
    command: Optional[str] = Field(None, description="커맨드 (예: /vms)")
    command_args: List[str] = Field(default_factory=list, description="커맨드 인자")

    class Config:
        json_schema_extra = {
            "example": {
                "message_id": "msg-123456",
                "timestamp": "2026-03-31T10:00:00Z",
                "type": "text",
                "platform": "slack",
                "user": {
                    "id": "U123456",
                    "username": "john.doe",
                    "display_name": "John Doe",
                    "platform": "slack",
                },
                "channel": {"id": "C789012", "name": "general", "platform": "slack"},
                "text": "Hello World!",
                "attachments": [],
                "reactions": [],
                "thread_id": None,
                "parent_id": None,
                "raw_message": {},
                "target_channels": [],
                "command": None,
                "command_args": [],
            }
        }

    def is_command(self) -> bool:
        """메시지가 커맨드인지 확인"""
        return self.text is not None and self.text.startswith("/")

    def parse_command(self) -> tuple[str, list[str]]:
        """
        메시지에서 커맨드 파싱

        Returns:
            (command, args) 튜플

        Example:
            "/vms status --verbose" -> ("/vms", ["status", "--verbose"])
        """
        if not self.is_command() or self.text is None:
            return ("", [])

        parts = self.text.split()
        command = parts[0].lower()
        args = parts[1:] if len(parts) > 1 else []

        return (command, args)
