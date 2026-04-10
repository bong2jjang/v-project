"""
WebSocket API Endpoint

실시간 업데이트를 위한 WebSocket 연결 처리
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
import logging
import json

from ..services.websocket_manager import manager
from ..services.event_broadcaster import broadcaster
from app.models.user import User
from app.utils.auth import get_current_user, verify_token
from app.db import get_db_session

router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db_session),
):
    """
    WebSocket 엔드포인트 (인증 필요)

    실시간 업데이트를 위한 WebSocket 연결

    Query Parameters:
        - token: JWT 액세스 토큰 (필수)

    Protocol:
        Client → Server:
            - {"type": "subscribe", "data": {"channels": ["status", "logs", "notifications"]}}
            - {"type": "unsubscribe", "data": {"channels": ["logs"]}}
            - {"type": "ping"}

        Server → Client:
            - {"type": "status_update", "data": {...}, "timestamp": "..."}
            - {"type": "log_update", "data": {...}, "timestamp": "..."}
            - {"type": "config_update", "data": {...}, "timestamp": "..."}
            - {"type": "notification", "data": {...}, "timestamp": "..."}
            - {"type": "connection", "data": {...}, "timestamp": "..."}
            - {"type": "error", "data": {...}, "timestamp": "..."}
    """
    # 토큰 검증
    if not token:
        await websocket.close(code=1008, reason="Authentication required")
        return

    try:
        # JWT 토큰 검증 및 데이터 추출
        token_data = verify_token(token)

        # DB에서 사용자 조회
        user = db.query(User).filter(User.id == token_data.user_id).first()
        if not user:
            await websocket.close(code=1008, reason="User not found")
            return

        # 사용자 활성화 상태 확인
        if not user.is_active:
            await websocket.close(code=1008, reason="Inactive user")
            return
    except Exception as e:
        logger.error(f"WebSocket authentication failed: {e}")
        await websocket.close(code=1008, reason="Authentication failed")
        return

    client_id = await manager.connect(websocket)

    try:
        while True:
            # 클라이언트로부터 메시지 수신
            data = await websocket.receive_text()

            try:
                message = json.loads(data)
                await handle_client_message(client_id, message)
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON from client {client_id}: {data}")
                await manager.send_personal_message(
                    {
                        "type": "error",
                        "data": {
                            "message": "Invalid JSON format",
                            "code": "INVALID_JSON",
                        },
                    },
                    client_id,
                )

    except WebSocketDisconnect:
        manager.disconnect(client_id)
        logger.info(f"Client {client_id} disconnected normally")

    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        manager.disconnect(client_id)


async def handle_client_message(client_id: str, message: Dict[str, Any]):
    """
    클라이언트 메시지 처리

    Args:
        client_id: 클라이언트 ID
        message: 수신한 메시지
    """
    message_type = message.get("type")
    data = message.get("data", {})

    if message_type == "subscribe":
        # 채널 구독
        channels = set(data.get("channels", []))
        valid_channels = channels & {"status", "logs", "config", "notifications"}

        if valid_channels:
            manager.update_subscription(client_id, valid_channels, action="subscribe")
            await manager.send_personal_message(
                {
                    "type": "subscription_updated",
                    "data": {"action": "subscribed", "channels": list(valid_channels)},
                },
                client_id,
            )
        else:
            await manager.send_personal_message(
                {
                    "type": "error",
                    "data": {
                        "message": "No valid channels specified",
                        "code": "INVALID_CHANNELS",
                    },
                },
                client_id,
            )

    elif message_type == "unsubscribe":
        # 채널 구독 해제
        channels = set(data.get("channels", []))

        if channels:
            manager.update_subscription(client_id, channels, action="unsubscribe")
            await manager.send_personal_message(
                {
                    "type": "subscription_updated",
                    "data": {"action": "unsubscribed", "channels": list(channels)},
                },
                client_id,
            )

    elif message_type == "ping":
        # Ping-pong (keep-alive)
        await manager.send_personal_message({"type": "pong"}, client_id)

    else:
        # 알 수 없는 메시지 타입
        logger.warning(f"Unknown message type from client {client_id}: {message_type}")
        await manager.send_personal_message(
            {
                "type": "error",
                "data": {
                    "message": f"Unknown message type: {message_type}",
                    "code": "UNKNOWN_MESSAGE_TYPE",
                },
            },
            client_id,
        )


@router.get("/ws/info")
async def websocket_info(
    current_user: User = Depends(get_current_user),
):
    """
    WebSocket 연결 정보 (인증 필요)

    Returns:
        dict: 연결 정보
            - active_connections: 활성 연결 수
            - broadcaster_running: 브로드캐스터 실행 상태
    """
    return {
        "active_connections": manager.get_connection_count(),
        "broadcaster_running": broadcaster.running if broadcaster else False,
    }
