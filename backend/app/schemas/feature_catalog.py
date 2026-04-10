"""Feature Catalog 스키마

플랫폼별 제공 기능과 권한 상태를 정의합니다.
"""

from typing import Literal, Optional
from pydantic import BaseModel


# ─── 권한 상태 타입 ────────────────────────────────────────────────────────────
PermissionStatus = Literal["granted", "missing", "partial", "unknown", "not_applicable"]


# ─── Feature 카탈로그 정의 ──────────────────────────────────────────────────────
FEATURE_CATALOG: list[dict] = [
    {
        "id": "send_message",
        "name": "메시지 전송",
        "description": "수신된 메시지를 연결된 다른 채널로 전달합니다.",
        "category": "messaging",
        "is_core": True,
        "platform_support": {
            "slack": {
                "supported": True,
                "implemented": True,
                "required_scopes": ["chat:write"],
            },
            "teams": {
                "supported": True,
                "implemented": True,
                "required_permissions": ["ChannelMessage.Send"],
            },
        },
    },
    {
        "id": "receive_message",
        "name": "메시지 수신",
        "description": "채널의 메시지를 실시간으로 수신합니다.",
        "category": "messaging",
        "is_core": True,
        "platform_support": {
            "slack": {
                "supported": True,
                "implemented": True,
                "required_scopes": ["channels:history"],
            },
            "teams": {
                "supported": True,
                "implemented": True,
                "required_permissions": ["ChannelMessage.Read.All"],
            },
        },
    },
    {
        "id": "send_file",
        "name": "파일 전송",
        "description": "파일 및 이미지를 다른 채널로 전달합니다.",
        "category": "file",
        "is_core": False,
        "platform_support": {
            "slack": {
                "supported": True,
                "implemented": True,
                "required_scopes": ["files:write", "files:read"],
            },
            "teams": {
                "supported": True,
                "implemented": True,
                "required_permissions": ["Files.ReadWrite"],
            },
        },
    },
    {
        "id": "receive_file",
        "name": "파일 수신",
        "description": "다른 채널에서 전송된 파일을 수신합니다.",
        "category": "file",
        "is_core": False,
        "platform_support": {
            "slack": {
                "supported": True,
                "implemented": True,
                "required_scopes": ["files:read"],
            },
            "teams": {
                "supported": True,
                "implemented": True,
                "required_permissions": ["Files.ReadWrite"],
            },
        },
    },
    {
        "id": "forward_reaction",
        "name": "리액션 전달",
        "description": "이모지 리액션을 다른 채널로 전달합니다.",
        "category": "social",
        "is_core": False,
        "platform_support": {
            "slack": {
                "supported": True,
                "implemented": True,
                "required_scopes": ["reactions:read", "reactions:write"],
            },
            "teams": {
                "supported": True,
                "implemented": True,
                "reason": "Teams 6종 리액션만 지원 (like, heart, laugh, surprised, sad, angry)",
                "required_permissions": ["ChannelMessage.Read.All"],
            },
        },
    },
    {
        "id": "forward_edit",
        "name": "편집 알림 전달",
        "description": "메시지 편집 시 변경 사실을 다른 채널에 알립니다.",
        "category": "messaging",
        "is_core": False,
        "platform_support": {
            "slack": {
                "supported": True,
                "implemented": True,
                "required_scopes": ["channels:history"],
            },
            "teams": {
                "supported": True,
                "implemented": True,
                "reason": "알림 방식 (새 메시지로 편집 사실 전달)",
                "required_permissions": ["ChannelMessage.Read.All"],
            },
        },
    },
    {
        "id": "forward_delete",
        "name": "삭제 알림 전달",
        "description": "메시지 삭제 시 삭제 사실을 다른 채널에 알립니다.",
        "category": "messaging",
        "is_core": False,
        "platform_support": {
            "slack": {
                "supported": True,
                "implemented": True,
                "required_scopes": ["channels:history"],
            },
            "teams": {
                "supported": True,
                "implemented": True,
                "reason": "알림 방식 (새 메시지로 삭제 사실 전달)",
                "required_permissions": ["ChannelMessage.Read.All"],
            },
        },
    },
    {
        "id": "thread_reply",
        "name": "스레드/댓글 지원",
        "description": "답글이 달린 스레드 구조를 유지하여 전달합니다.",
        "category": "messaging",
        "is_core": False,
        "platform_support": {
            "slack": {
                "supported": True,
                "implemented": True,
                "required_scopes": ["chat:write"],
            },
            "teams": {
                "supported": True,
                "implemented": True,
                "required_permissions": ["ChannelMessage.Send"],
            },
        },
    },
    {
        "id": "list_channels",
        "name": "채널 목록 조회",
        "description": "Route 설정 시 채널을 검색하고 선택할 수 있습니다.",
        "category": "channel",
        "is_core": False,
        "platform_support": {
            "slack": {
                "supported": True,
                "implemented": True,
                "required_scopes": ["channels:read", "groups:read"],
            },
            "teams": {
                "supported": True,
                "implemented": True,
                "required_permissions": ["Channel.ReadBasic.All"],
            },
        },
    },
    {
        "id": "list_conversations",
        "name": "DM/그룹 대화 조회",
        "description": "Route 설정 시 DM 및 그룹 대화를 검색하고 선택할 수 있습니다.",
        "category": "channel",
        "is_core": False,
        "platform_support": {
            "slack": {
                "supported": True,
                "implemented": True,
                "required_scopes": ["im:read", "mpim:read"],
            },
            "teams": {
                "supported": True,
                "implemented": True,
                "reason": "Microsoft 계정 연결 필요 (Delegated Auth)",
            },
        },
    },
    {
        "id": "user_display_name",
        "name": "발신자 이름 표시",
        "description": "메시지에 원본 발신자의 이름을 표시합니다.",
        "category": "messaging",
        "is_core": False,
        "platform_support": {
            "slack": {
                "supported": True,
                "implemented": True,
                "required_scopes": ["users:read"],
            },
            "teams": {
                "supported": True,
                "implemented": True,
                "required_permissions": ["User.Read"],
            },
        },
    },
]

# category 표시 이름
CATEGORY_LABELS: dict[str, str] = {
    "messaging": "메시징",
    "file": "파일",
    "social": "소셜",
    "channel": "채널 관리",
}


# ─── Pydantic 스키마 ───────────────────────────────────────────────────────────


class FeaturePermissionStatus(BaseModel):
    """기능별 권한 상태"""

    feature_id: str
    feature_name: str
    category: str
    status: PermissionStatus
    missing_scopes: list[str] = []
    note: Optional[str] = None


class FeaturePlatformSupport(BaseModel):
    """플랫폼별 기능 지원 정보"""

    supported: bool
    implemented: bool
    required_scopes: list[str] = []
    required_permissions: list[str] = []
    reason: Optional[str] = None


class FeatureCatalogItem(BaseModel):
    """기능 카탈로그 항목"""

    id: str
    name: str
    description: str
    category: str
    category_label: str
    is_core: bool
    platform_support: dict[str, FeaturePlatformSupport]


class FeatureCatalogResponse(BaseModel):
    """기능 카탈로그 응답"""

    features: list[FeatureCatalogItem]
    category_labels: dict[str, str]


def build_catalog_response() -> FeatureCatalogResponse:
    """FEATURE_CATALOG 상수로부터 FeatureCatalogResponse 생성"""
    items = []
    for f in FEATURE_CATALOG:
        platform_support = {}
        for platform, support in f["platform_support"].items():
            platform_support[platform] = FeaturePlatformSupport(
                supported=support.get("supported", False),
                implemented=support.get("implemented", False),
                required_scopes=support.get("required_scopes", []),
                required_permissions=support.get("required_permissions", []),
                reason=support.get("reason"),
            )
        items.append(
            FeatureCatalogItem(
                id=f["id"],
                name=f["name"],
                description=f["description"],
                category=f["category"],
                category_label=CATEGORY_LABELS.get(f["category"], f["category"]),
                is_core=f["is_core"],
                platform_support=platform_support,
            )
        )
    return FeatureCatalogResponse(features=items, category_labels=CATEGORY_LABELS)
