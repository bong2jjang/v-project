"""계정 관리 스키마

Slack 및 Microsoft Teams 계정 관리를 위한 Pydantic 모델
"""

from pydantic import BaseModel, Field


class SlackAccountBase(BaseModel):
    """Slack 계정 기본 정보"""

    token: str = Field(..., min_length=1, description="Slack Bot Token (xoxb-...)")
    prefix_messages_with_nick: bool = Field(
        default=True, alias="PrefixMessagesWithNick"
    )
    edit_suffix: str = Field(default=" (edited)", alias="EditSuffix")
    edit_disable: bool = Field(default=False, alias="EditDisable")
    use_username: bool = Field(default=True, alias="UseUsername")
    no_send_join_part: bool = Field(default=True, alias="NoSendJoinPart")
    use_api: bool = Field(default=True, alias="UseAPI")

    class Config:
        populate_by_name = True


class SlackAccountCreate(SlackAccountBase):
    """Slack 계정 생성 요청"""

    name: str = Field(..., min_length=1, description="계정 이름 (예: myslack)")


class SlackAccountUpdate(BaseModel):
    """Slack 계정 수정 요청"""

    token: str | None = None
    prefix_messages_with_nick: bool | None = Field(None, alias="PrefixMessagesWithNick")
    edit_suffix: str | None = Field(None, alias="EditSuffix")
    edit_disable: bool | None = Field(None, alias="EditDisable")
    use_username: bool | None = Field(None, alias="UseUsername")
    no_send_join_part: bool | None = Field(None, alias="NoSendJoinPart")
    use_api: bool | None = Field(None, alias="UseAPI")

    class Config:
        populate_by_name = True


class TeamsAccountBase(BaseModel):
    """Microsoft Teams 계정 기본 정보"""

    tenant_id: str = Field(
        ..., min_length=1, alias="TenantID", description="Azure Tenant ID"
    )
    app_id: str = Field(
        ..., min_length=1, alias="AppID", description="Application/Client ID"
    )
    app_password: str = Field(
        ..., min_length=1, alias="AppPassword", description="Client Secret"
    )
    prefix_messages_with_nick: bool = Field(
        default=True, alias="PrefixMessagesWithNick"
    )
    edit_suffix: str = Field(default=" (edited)", alias="EditSuffix")
    edit_disable: bool = Field(default=False, alias="EditDisable")
    use_username: bool = Field(default=True, alias="UseUsername")

    class Config:
        populate_by_name = True


class TeamsAccountCreate(TeamsAccountBase):
    """Microsoft Teams 계정 생성 요청"""

    name: str = Field(..., min_length=1, description="계정 이름 (예: myteams)")


class TeamsAccountUpdate(BaseModel):
    """Microsoft Teams 계정 수정 요청"""

    tenant_id: str | None = Field(None, alias="TenantID")
    app_id: str | None = Field(None, alias="AppID")
    app_password: str | None = Field(None, alias="AppPassword")
    prefix_messages_with_nick: bool | None = Field(None, alias="PrefixMessagesWithNick")
    edit_suffix: str | None = Field(None, alias="EditSuffix")
    edit_disable: bool | None = Field(None, alias="EditDisable")
    use_username: bool | None = Field(None, alias="UseUsername")

    class Config:
        populate_by_name = True


class AccountInfo(BaseModel):
    """계정 정보 응답 (마스킹 처리된)"""

    name: str = Field(..., description="계정 이름")
    platform: str = Field(..., description="플랫폼 (slack 또는 teams)")
    masked_token: str | None = Field(None, description="마스킹된 토큰")
    tenant_id: str | None = Field(None, description="Teams Tenant ID")
    usage_count: int = Field(default=0, description="사용 중인 Gateway 수")


class AccountListResponse(BaseModel):
    """계정 목록 응답"""

    slack: list[AccountInfo] = Field(default_factory=list)
    teams: list[AccountInfo] = Field(default_factory=list)


class AccountCreateRequest(BaseModel):
    """계정 생성 요청 (통합)"""

    platform: str = Field(..., description="플랫폼 (slack 또는 teams)")
    name: str = Field(..., min_length=1, description="계정 이름")
    slack: SlackAccountBase | None = None
    teams: TeamsAccountBase | None = None


class MessageResponse(BaseModel):
    """일반 메시지 응답"""

    message: str
