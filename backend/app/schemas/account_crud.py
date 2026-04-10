"""Account CRUD Pydantic 스키마

DB 기반 Account 관리를 위한 요청/응답 스키마
기존 account.py (TOML 기반)과 구분됨
"""

import json
from datetime import datetime, timezone

from pydantic import BaseModel, Field


class SlackAccountFields(BaseModel):
    """Slack 계정 필드"""

    token: str = Field(..., description="Bot User OAuth Token (xoxb-...)")
    app_token: str | None = Field(
        None, description="App-Level Token for Socket Mode (xapp-...)"
    )
    prefix_messages_with_nick: bool = Field(
        True, description="메시지에 닉네임 접두사 추가"
    )
    edit_suffix: str = Field(" (edited)", description="편집된 메시지 접미사")
    edit_disable: bool = Field(False, description="메시지 편집 비활성화")
    use_username: bool = Field(True, description="사용자 이름 표시")
    no_send_join_part: bool = Field(True, description="입장/퇴장 메시지 비활성화")
    use_api: bool = Field(True, description="API 사용")
    debug: bool = Field(False, description="디버그 모드")


class TeamsAccountFields(BaseModel):
    """Teams 계정 필드"""

    tenant_id: str = Field(..., description="Azure Tenant ID")
    app_id: str = Field(..., description="Application (Client) ID")
    app_password: str = Field(..., description="Client Secret")
    team_id: str = Field(..., description="Teams Team ID")
    prefix_messages_with_nick: bool = Field(
        True, description="메시지에 닉네임 접두사 추가"
    )
    edit_suffix: str = Field(" (edited)", description="편집된 메시지 접미사")
    edit_disable: bool = Field(False, description="메시지 편집 비활성화")
    use_username: bool = Field(True, description="사용자 이름 표시")


class AccountCreateRequest(BaseModel):
    """Account 생성 요청"""

    platform: str = Field(..., description="플랫폼 (slack 또는 teams)")
    name: str = Field(..., description="계정 이름 (고유해야 함)")
    slack: SlackAccountFields | None = Field(None, description="Slack 계정 정보")
    teams: TeamsAccountFields | None = Field(None, description="Teams 계정 정보")
    enabled: bool = Field(True, description="계정 활성화 여부")
    enabled_features: list[str] | None = Field(
        None, description="활성화할 기능 목록. None = 전체 활성화"
    )


class SlackAccountUpdate(BaseModel):
    """Slack 계정 수정"""

    token: str | None = None
    app_token: str | None = None
    prefix_messages_with_nick: bool | None = None
    edit_suffix: str | None = None
    edit_disable: bool | None = None
    use_username: bool | None = None
    no_send_join_part: bool | None = None
    use_api: bool | None = None
    debug: bool | None = None


class TeamsAccountUpdate(BaseModel):
    """Teams 계정 수정"""

    tenant_id: str | None = None
    app_id: str | None = None
    app_password: str | None = None
    team_id: str | None = None
    prefix_messages_with_nick: bool | None = None
    edit_suffix: str | None = None
    edit_disable: bool | None = None
    use_username: bool | None = None


class AccountUpdateRequest(BaseModel):
    """Account 수정 요청"""

    slack: SlackAccountUpdate | None = None
    teams: TeamsAccountUpdate | None = None
    enabled: bool | None = None
    enabled_features: list[str] | None = None  # None = 변경 없음, [] = 초기화(전체)


class ValidationError(BaseModel):
    """유효성 검증 오류"""

    field: str = Field(..., description="오류 필드")
    message: str = Field(..., description="오류 메시지")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="오류 발생 시간",
    )

    def to_dict(self) -> dict:
        """딕셔너리로 변환"""
        return {
            "field": self.field,
            "message": self.message,
            "timestamp": self.timestamp.isoformat(),
        }


class AccountResponse(BaseModel):
    """Account 응답"""

    id: int
    platform: str
    name: str

    # Slack (마스킹 처리)
    token: str | None = None
    app_token: str | None = None

    # Teams (마스킹 처리)
    tenant_id: str | None = None
    app_id: str | None = None
    team_id: str | None = None
    # app_password는 응답에 포함하지 않음

    # 공통 설정 (복호화 실패 시 None일 수 있음)
    prefix_messages_with_nick: bool | None = None
    edit_suffix: str | None = None
    edit_disable: bool | None = None
    use_username: bool | None = None
    no_send_join_part: bool | None = None  # Slack only
    use_api: bool | None = None  # Slack only
    debug: bool | None = None

    # 기능 설정 (None = 전체 활성화)
    enabled_features: list[str] | None = None

    # 유효성
    is_valid: bool
    validation_errors: list[dict] | None = None

    # 메타데이터
    enabled: bool
    created_at: datetime
    updated_at: datetime
    created_by: int | None = None
    updated_by: int | None = None
    is_connected: bool = Field(default=False, description="브리지 연결 상태 (실시간)")

    # Teams Delegated Auth
    has_delegated_auth: bool = Field(
        default=False, description="Microsoft Delegated Auth 연결 여부"
    )
    ms_user_id: str | None = Field(
        default=None, description="연결된 Microsoft 사용자 ID"
    )

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_masking(cls, account):
        """ORM 객체에서 생성 (토큰 마스킹 포함)"""
        # Bridge 연결 상태 확인
        is_connected = False
        try:
            from app.services.websocket_bridge import get_bridge

            bridge = get_bridge()
            if bridge:
                if account.platform in bridge.providers:
                    provider = bridge.providers[account.platform]
                    is_connected = provider.is_connected
        except Exception:
            # Bridge 초기화 전이거나 오류 발생 시 False
            is_connected = False

        data = {
            "id": account.id,
            "platform": account.platform,
            "name": account.name,
            # 복호화 후 마스킹 처리
            "token": (
                cls._mask_token(account.token_decrypted)
                if account.token_decrypted
                else None
            ),
            "app_token": (
                cls._mask_token(account.app_token_decrypted)
                if account.app_token_decrypted
                else None
            ),
            "tenant_id": (
                cls._mask_token(account.tenant_id_decrypted)
                if account.tenant_id_decrypted
                else None
            ),
            "app_id": (
                cls._mask_token(account.app_id_decrypted)
                if account.app_id_decrypted
                else None
            ),
            "team_id": (
                cls._mask_token(account.team_id_decrypted)
                if account.team_id_decrypted
                else None
            ),
            "prefix_messages_with_nick": account.prefix_messages_with_nick,
            "edit_suffix": account.edit_suffix,
            "edit_disable": account.edit_disable,
            "use_username": account.use_username,
            "no_send_join_part": account.no_send_join_part,
            "use_api": account.use_api,
            "debug": account.debug,
            "enabled_features": (
                json.loads(account.enabled_features)
                if account.enabled_features
                else None
            ),
            "is_valid": account.is_valid,
            "validation_errors": (
                json.loads(account.validation_errors)
                if account.validation_errors
                else None
            ),
            "enabled": account.enabled,
            "created_at": account.created_at,
            "updated_at": account.updated_at,
            "created_by": account.created_by,
            "updated_by": account.updated_by,
            "is_connected": is_connected,
            # Teams Delegated Auth
            "has_delegated_auth": bool(account.ms_refresh_token)
            if account.platform == "teams"
            else False,
            "ms_user_id": account.ms_user_id if account.platform == "teams" else None,
        }
        return cls(**data)

    @staticmethod
    def _mask_token(token: str) -> str:
        """토큰 마스킹 처리

        예: xoxb-your-token-here
            → xoxb-you...en-here
        """
        if not token or len(token) < 20:
            return "***"
        return f"{token[:8]}...{token[-7:]}"


class AccountListResponse(BaseModel):
    """Account 목록 응답"""

    accounts: list[AccountResponse]
    total: int


class MessageResponse(BaseModel):
    """일반 메시지 응답"""

    message: str
    account_id: int | None = None
