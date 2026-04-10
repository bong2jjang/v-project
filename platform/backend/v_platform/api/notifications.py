"""
Notifications API Endpoint

알림 관련 API
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from v_platform.models.user import User
from v_platform.utils.auth import require_admin_or_above
from v_platform.services.notification_service import NotificationService

router = APIRouter()


# === Pydantic Models ===


class NotificationCreate(BaseModel):
    """알림 생성 요청"""

    severity: str = Field(..., description="critical, error, warning, info, success")
    category: str = Field(..., description="service, message, config, user, system")
    title: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1, max_length=1000)
    source: str = Field(..., description="발생 원천")
    metadata: Optional[Dict[str, Any]] = Field(None, description="추가 데이터")
    actions: Optional[List[Dict[str, Any]]] = Field(None, description="액션 버튼")
    link: Optional[str] = Field(None, description="관련 페이지 링크")
    dismissible: bool = Field(True, description="삭제 가능 여부")
    persistent: bool = Field(False, description="영구 저장 여부")


class TestNotificationRequest(BaseModel):
    """테스트 알림 요청"""

    severity: Optional[str] = Field("info", description="알림 레벨")
    category: Optional[str] = Field("system", description="알림 카테고리")
    title: Optional[str] = Field("테스트 알림", description="알림 제목")
    message: Optional[str] = Field(
        "이것은 테스트 알림입니다.", description="알림 메시지"
    )


# === API Endpoints ===


@router.post("/test", status_code=status.HTTP_201_CREATED)
async def create_test_notification(
    request: TestNotificationRequest = TestNotificationRequest(),
    current_user: User = Depends(require_admin_or_above()),
):
    """
    테스트 알림 생성 (관리자 전용)

    개발 및 테스트 목적으로 알림을 즉시 생성하여 전송합니다.
    """
    await NotificationService.send_notification(
        severity=request.severity,
        category=request.category,
        title=request.title,
        message=request.message,
        source="test_api",
        metadata={"created_by": current_user.username},
    )

    return {
        "message": "Test notification sent",
        "notification": {
            "severity": request.severity,
            "category": request.category,
            "title": request.title,
            "message": request.message,
        },
    }


@router.post("/send", status_code=status.HTTP_201_CREATED)
async def send_notification(
    notification: NotificationCreate,
    current_user: User = Depends(require_admin_or_above()),
):
    """
    알림 전송 (관리자 전용)

    커스텀 알림을 생성하여 모든 사용자에게 전송합니다.
    """
    # Severity 검증
    valid_severities = {"critical", "error", "warning", "info", "success"}
    if notification.severity not in valid_severities:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid severity. Must be one of: {valid_severities}",
        )

    # Category 검증
    valid_categories = {"service", "message", "config", "user", "system"}
    if notification.category not in valid_categories:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid category. Must be one of: {valid_categories}",
        )

    await NotificationService.send_notification(
        severity=notification.severity,
        category=notification.category,
        title=notification.title,
        message=notification.message,
        source=notification.source,
        metadata=notification.metadata,
        actions=notification.actions,
        link=notification.link,
        dismissible=notification.dismissible,
        persistent=notification.persistent,
    )

    return {
        "message": "Notification sent successfully",
        "notification": {
            "title": notification.title,
            "severity": notification.severity,
            "category": notification.category,
        },
    }


@router.post("/test/all-types", status_code=status.HTTP_201_CREATED)
async def test_all_notification_types(
    current_user: User = Depends(require_admin_or_above()),
):
    """
    모든 알림 타입 테스트 (관리자 전용)

    5가지 severity 레벨의 알림을 모두 생성합니다.
    """
    notifications_sent = []

    # Success
    await NotificationService.notify_success(
        title="성공 알림 테스트",
        message="이것은 성공 알림입니다.",
        source="test_api",
        category="system",
    )
    notifications_sent.append("success")

    # Info
    await NotificationService.notify_info(
        title="정보 알림 테스트",
        message="이것은 정보 알림입니다.",
        source="test_api",
        category="system",
    )
    notifications_sent.append("info")

    # Warning
    await NotificationService.notify_warning(
        title="경고 알림 테스트",
        message="이것은 경고 알림입니다.",
        source="test_api",
        category="service",
    )
    notifications_sent.append("warning")

    # Error
    await NotificationService.notify_error(
        title="에러 알림 테스트",
        message="이것은 에러 알림입니다.",
        source="test_api",
        category="service",
    )
    notifications_sent.append("error")

    # Critical
    await NotificationService.notify_critical(
        title="치명적 알림 테스트",
        message="이것은 치명적 알림입니다.",
        source="test_api",
        category="service",
    )
    notifications_sent.append("critical")

    return {
        "message": "All notification types sent",
        "notifications_sent": notifications_sent,
    }
