"""Prometheus 메트릭 엔드포인트"""

from fastapi import APIRouter
from fastapi.responses import Response
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)

router = APIRouter()

# HTTP 요청 메트릭
http_requests_total = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"],
)

http_request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "endpoint"],
)

# WebSocket 연결 메트릭
websocket_connections = Gauge(
    "websocket_connections",
    "Active WebSocket connections",
)

# 메시지 카운트 메트릭
message_count_total = Counter(
    "message_count_total",
    "Total messages processed",
    ["channel", "direction"],
)

# 채널 상태 메트릭
channel_status = Gauge(
    "channel_status",
    "Channel active status (1=active, 0=inactive)",
    ["slack_channel", "teams_channel"],
)

# 사용자 활동 메트릭
user_login_total = Counter(
    "user_login_total",
    "Total user logins",
    ["role"],
)

user_active = Gauge(
    "user_active",
    "Active users count",
)


@router.get("/metrics")
async def metrics():
    """
    Prometheus 메트릭 엔드포인트

    Returns:
        Prometheus 형식의 메트릭 데이터
    """
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )
