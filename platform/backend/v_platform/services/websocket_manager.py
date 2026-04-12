"""
WebSocket Connection Manager

관리 기능:
- 클라이언트 연결 관리
- 구독(subscription) 관리
- 메시지 브로드캐스팅
"""

from typing import Dict, Set, Optional
from fastapi import WebSocket, WebSocketDisconnect
from datetime import datetime, timezone
import logging
import uuid

logger = logging.getLogger(__name__)


class ConnectionManager:
    """WebSocket 연결 관리자"""

    def __init__(self):
        # client_id -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}
        # client_id -> Set of channel names
        self.subscriptions: Dict[str, Set[str]] = {}

    async def connect(self, websocket: WebSocket) -> str:
        """
        새 클라이언트 연결 수락

        Args:
            websocket: WebSocket 연결

        Returns:
            client_id: 생성된 클라이언트 ID
        """
        await websocket.accept()

        client_id = str(uuid.uuid4())
        self.active_connections[client_id] = websocket
        # 기본적으로 모든 채널 구독
        self.subscriptions[client_id] = {"status", "logs", "config", "notifications"}

        logger.info(
            f"Client {client_id} connected. Total connections: {len(self.active_connections)}"
        )

        # 연결 확인 메시지 전송
        await self.send_personal_message(
            {
                "type": "connection",
                "data": {"status": "connected", "client_id": client_id},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            client_id,
        )

        return client_id

    def disconnect(self, client_id: str):
        """
        클라이언트 연결 해제

        Args:
            client_id: 클라이언트 ID
        """
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            del self.subscriptions[client_id]
            logger.info(
                f"Client {client_id} disconnected. Total connections: {len(self.active_connections)}"
            )

    async def send_personal_message(self, message: dict, client_id: str):
        """
        특정 클라이언트에게 메시지 전송

        Args:
            message: 전송할 메시지 (dict)
            client_id: 대상 클라이언트 ID
        """
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_json(message)
            except Exception as e:
                # React StrictMode나 빠른 재연결로 인한 일시적 에러는 debug 레벨로
                logger.debug(
                    f"Client {client_id} disconnected during message send: {e}"
                )
                self.disconnect(client_id)

    async def broadcast(self, message: dict, channel: Optional[str] = None):
        """
        모든 연결된 클라이언트에게 메시지 브로드캐스트

        Args:
            message: 브로드캐스트할 메시지
            channel: 특정 채널 구독자에게만 전송 (None이면 모두에게)
        """
        disconnected_clients = []

        for client_id, websocket in self.active_connections.items():
            # 채널 필터링
            if channel and channel not in self.subscriptions.get(client_id, set()):
                continue

            try:
                await websocket.send_json(message)
            except WebSocketDisconnect:
                disconnected_clients.append(client_id)
            except Exception as e:
                logger.error(f"Error broadcasting to {client_id}: {e}")
                disconnected_clients.append(client_id)

        # 연결이 끊긴 클라이언트 정리
        for client_id in disconnected_clients:
            self.disconnect(client_id)

    def update_subscription(
        self, client_id: str, channels: Set[str], action: str = "subscribe"
    ):
        """
        클라이언트의 채널 구독 업데이트

        Args:
            client_id: 클라이언트 ID
            channels: 채널 목록
            action: "subscribe" 또는 "unsubscribe"
        """
        if client_id not in self.subscriptions:
            return

        if action == "subscribe":
            self.subscriptions[client_id].update(channels)
            logger.debug(f"Client {client_id} subscribed to {channels}")
        elif action == "unsubscribe":
            self.subscriptions[client_id].difference_update(channels)
            logger.debug(f"Client {client_id} unsubscribed from {channels}")

    def get_connection_count(self) -> int:
        """활성 연결 수 반환"""
        return len(self.active_connections)

    def get_client_info(self, client_id: str) -> Optional[dict]:
        """클라이언트 정보 반환"""
        if client_id not in self.active_connections:
            return None

        return {
            "client_id": client_id,
            "subscriptions": list(self.subscriptions.get(client_id, set())),
        }


# Global instance
manager = ConnectionManager()
