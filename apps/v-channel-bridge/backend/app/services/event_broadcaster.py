"""
Event Broadcaster

실시간 이벤트를 WebSocket 클라이언트에게 브로드캐스트
"""

import asyncio
from datetime import datetime, timezone
from typing import Optional
import logging

from .websocket_manager import ConnectionManager

logger = logging.getLogger(__name__)


class EventBroadcaster:
    """이벤트 브로드캐스터 - 실시간 업데이트 전송"""

    def __init__(
        self, manager: ConnectionManager, control_service: Optional[object] = None
    ):
        self.manager = manager
        self.control_service = (
            control_service  # Light-Zowe에서는 사용하지 않음 (호환성 유지)
        )
        self.running = False
        self._tasks = []
        self._last_log_position = 0

    async def start(self):
        """브로드캐스터 시작"""
        if self.running:
            logger.warning("EventBroadcaster already running")
            return

        self.running = True
        logger.info("EventBroadcaster started (Light-Zowe mode)")

        # Light-Zowe: 상태/로그 브로드캐스트는 비활성화
        # 필요 시 Light-Zowe 브리지 상태 브로드캐스트 추가 가능
        self._tasks = []

    async def stop(self):
        """브로드캐스터 중지"""
        self.running = False
        logger.info("EventBroadcaster stopping...")

        # 모든 태스크 취소
        for task in self._tasks:
            task.cancel()

        # 태스크 완료 대기
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks = []
        logger.info("EventBroadcaster stopped")

    async def _status_broadcast_loop(self):
        """상태 업데이트 브로드캐스트 루프 (Light-Zowe: 비활성화됨)"""
        # Light-Zowe: 브리지 상태는 직접 API 호출로 확인
        pass

    async def _log_broadcast_loop(self):
        """로그 업데이트 브로드캐스트 루프 (Light-Zowe: 비활성화됨)"""
        # Light-Zowe: 로그는 Docker logs로 확인
        pass

    async def broadcast_config_update(self, gateway_count: int, account_count: int):
        """
        설정 변경 이벤트 브로드캐스트

        Args:
            gateway_count: Gateway 수
            account_count: Account 수
        """
        message = {
            "type": "config_update",
            "data": {"gateway_count": gateway_count, "account_count": account_count},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await self.manager.broadcast(message, channel="config")
        logger.info("Config update broadcasted")

    async def broadcast_error(self, error_message: str, error_code: str = "UNKNOWN"):
        """
        에러 이벤트 브로드캐스트

        Args:
            error_message: 에러 메시지
            error_code: 에러 코드
        """
        message = {
            "type": "error",
            "data": {"message": error_message, "code": error_code},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await self.manager.broadcast(message)
        logger.error(f"Error broadcasted: {error_code} - {error_message}")

    async def broadcast_message_created(self, message_data: dict):
        """
        새 메시지 생성 이벤트 브로드캐스트

        Args:
            message_data: 메시지 데이터 (to_dict() 결과)
        """
        message = {
            "type": "message_created",
            "data": message_data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await self.manager.broadcast(message, channel="messages")
        logger.info(f"Message created event broadcasted: {message_data.get('id')}")


# Global instance (will be initialized in main.py)
broadcaster: Optional[EventBroadcaster] = None
