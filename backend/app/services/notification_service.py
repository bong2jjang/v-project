"""
Notification Service

알림 생성 및 전송 서비스
"""

from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)


class NotificationService:
    """알림 생성 및 전송 서비스"""

    # Severity levels
    CRITICAL = "critical"
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"
    SUCCESS = "success"

    # Categories
    SERVICE = "service"
    MESSAGE = "message"
    CONFIG = "config"
    USER = "user"
    SYSTEM = "system"

    @staticmethod
    def create_notification(
        severity: str,
        category: str,
        title: str,
        message: str,
        source: str,
        metadata: Optional[Dict[str, Any]] = None,
        actions: Optional[List[Dict[str, Any]]] = None,
        link: Optional[str] = None,
        dismissible: bool = True,
        persistent: bool = False,
    ) -> Dict[str, Any]:
        """
        알림 생성

        Args:
            severity: critical, error, warning, info, success
            category: service, message, config, user, system
            title: 알림 제목
            message: 알림 본문
            source: 발생 원천
            metadata: 추가 컨텍스트 데이터
            actions: 사용자 액션 버튼
            link: 관련 페이지 링크
            dismissible: 사용자 삭제 가능 여부
            persistent: 페이지 새로고침 후에도 유지 여부

        Returns:
            알림 딕셔너리
        """
        notification = {
            "id": f"notif_{uuid.uuid4().hex[:12]}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "severity": severity,
            "category": category,
            "title": title,
            "message": message,
            "source": source,
            "metadata": metadata or {},
            "actions": actions or [],
            "link": link,
            "dismissible": dismissible,
            "persistent": persistent,
            "read": False,
        }

        logger.info(
            f"Notification created: {notification['id']} - "
            f"{severity.upper()} - {title}"
        )

        return notification

    @staticmethod
    async def broadcast_notification(notification: Dict[str, Any]):
        """
        모든 연결된 클라이언트에게 알림 브로드캐스트

        Args:
            notification: 알림 데이터
        """
        from app.services.websocket_manager import manager

        try:
            await manager.broadcast(
                {"type": "notification", "data": notification}, channel="notifications"
            )

            logger.debug(
                f"Notification broadcast: {notification['id']} - {notification['title']}"
            )

        except Exception as e:
            logger.error(f"Failed to broadcast notification: {e}")

    @staticmethod
    async def send_notification(
        severity: str,
        category: str,
        title: str,
        message: str,
        source: str,
        metadata: Optional[Dict[str, Any]] = None,
        actions: Optional[List[Dict[str, Any]]] = None,
        link: Optional[str] = None,
        dismissible: bool = True,
        persistent: bool = False,
    ):
        """
        알림 생성 및 즉시 전송

        Args:
            severity: critical, error, warning, info, success
            category: service, message, config, user, system
            title: 알림 제목
            message: 알림 본문
            source: 발생 원천
            metadata: 추가 컨텍스트 데이터
            actions: 사용자 액션 버튼
            link: 관련 페이지 링크
            dismissible: 사용자 삭제 가능 여부
            persistent: 페이지 새로고침 후에도 유지 여부
        """
        notification = NotificationService.create_notification(
            severity=severity,
            category=category,
            title=title,
            message=message,
            source=source,
            metadata=metadata,
            actions=actions,
            link=link,
            dismissible=dismissible,
            persistent=persistent,
        )

        await NotificationService.broadcast_notification(notification)

    # === 편의 메서드 ===

    @staticmethod
    async def notify_success(
        title: str, message: str, source: str, category: str = SERVICE, **kwargs
    ):
        """성공 알림"""
        await NotificationService.send_notification(
            severity=NotificationService.SUCCESS,
            category=category,
            title=title,
            message=message,
            source=source,
            **kwargs,
        )

    @staticmethod
    async def notify_error(
        title: str, message: str, source: str, category: str = SERVICE, **kwargs
    ):
        """에러 알림"""
        await NotificationService.send_notification(
            severity=NotificationService.ERROR,
            category=category,
            title=title,
            message=message,
            source=source,
            **kwargs,
        )

    @staticmethod
    async def notify_warning(
        title: str, message: str, source: str, category: str = SERVICE, **kwargs
    ):
        """경고 알림"""
        await NotificationService.send_notification(
            severity=NotificationService.WARNING,
            category=category,
            title=title,
            message=message,
            source=source,
            **kwargs,
        )

    @staticmethod
    async def notify_info(
        title: str, message: str, source: str, category: str = SYSTEM, **kwargs
    ):
        """정보 알림"""
        await NotificationService.send_notification(
            severity=NotificationService.INFO,
            category=category,
            title=title,
            message=message,
            source=source,
            **kwargs,
        )

    @staticmethod
    async def notify_critical(
        title: str, message: str, source: str, category: str = SERVICE, **kwargs
    ):
        """치명적 알림"""
        await NotificationService.send_notification(
            severity=NotificationService.CRITICAL,
            category=category,
            title=title,
            message=message,
            source=source,
            **kwargs,
        )
