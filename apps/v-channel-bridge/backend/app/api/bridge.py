"""
Bridge API - Light-Zowe 아키텍처

자체 메시지 브리지 제어 API
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from ..services.websocket_bridge import get_bridge
from ..models.user import User
from ..utils.auth import require_permission, require_system_admin

router = APIRouter(prefix="/api/bridge", tags=["bridge"])


class RouteConfig(BaseModel):
    """라우팅 룰 설정"""

    source_platform: str
    source_channel: str
    target_platform: str
    target_channel: str
    target_channel_name: Optional[str] = None
    source_channel_name: Optional[str] = None
    message_mode: Optional[str] = "sender_info"  # "sender_info" or "editable"
    is_bidirectional: bool = True  # 양방향 라우트 (기본값: True)
    is_enabled: bool = True  # 활성/비활성 (기본값: 활성)


class RouteToggleRequest(BaseModel):
    """라우트 활성/비활성 토글 요청"""

    source_platform: str
    source_channel: str
    target_platform: str
    target_channel: str
    is_enabled: bool


@router.get("/status")
async def get_status(
    current_user: User = Depends(require_permission("channels", "read")),
):
    """브리지 상태 조회"""
    bridge = get_bridge()
    if not bridge:
        raise HTTPException(status_code=503, detail="Bridge not initialized")

    return {
        "is_running": bridge.is_running,
        "providers": [
            {
                "platform": provider.platform_name,
                "connected": provider.is_connected,
                "config": {},
            }
            for provider in bridge.providers.values()
        ],
        "active_tasks": len(bridge._tasks) if hasattr(bridge, "_tasks") else 0,
    }


@router.get("/providers")
async def get_providers(
    current_user: User = Depends(require_permission("channels", "read")),
):
    """Provider 목록 조회"""
    bridge = get_bridge()
    if not bridge:
        raise HTTPException(status_code=503, detail="Bridge not initialized")

    return [
        {
            "platform": provider.platform_name,
            "connected": provider.is_connected,
            "config": {},
        }
        for provider in bridge.providers.values()
    ]


@router.get("/routes")
async def get_routes(
    current_user: User = Depends(require_permission("channels", "read")),
):
    """라우팅 룰 목록 조회"""
    bridge = get_bridge()
    if not bridge:
        raise HTTPException(status_code=503, detail="Bridge not initialized")

    # Redis에서 라우팅 룰 조회
    # get_all_routes()는 이미 올바른 형식의 리스트를 반환
    routes = await bridge.route_manager.get_all_routes()

    # 안정적인 정렬 순서 보장 (소스 플랫폼 → 소스 채널명)
    routes.sort(
        key=lambda r: (
            r.get("source", {}).get("platform", ""),
            r.get("source", {}).get("channel_name", ""),
        )
    )

    return routes


@router.post("/routes")
async def add_route(
    route: RouteConfig,
    current_user: User = Depends(require_permission("channels", "write")),
):
    """라우팅 룰 추가"""
    bridge = get_bridge()
    if not bridge:
        raise HTTPException(status_code=503, detail="Bridge not initialized")

    added = await bridge.route_manager.add_route(
        source_platform=route.source_platform,
        source_channel=route.source_channel,
        target_platform=route.target_platform,
        target_channel=route.target_channel,
        target_channel_name=route.target_channel_name,
        source_channel_name=route.source_channel_name,
        message_mode=route.message_mode,
        is_bidirectional=route.is_bidirectional,
        is_enabled=route.is_enabled,
    )

    if not added:
        raise HTTPException(
            status_code=409,
            detail="동일한 Route가 이미 존재합니다.",
        )

    return {"message": "Route added successfully"}


@router.delete("/routes")
async def remove_route(
    route: RouteConfig,
    current_user: User = Depends(require_permission("channels", "write")),
):
    """라우팅 룰 제거"""
    bridge = get_bridge()
    if not bridge:
        raise HTTPException(status_code=503, detail="Bridge not initialized")

    await bridge.route_manager.remove_route(
        source_platform=route.source_platform,
        source_channel=route.source_channel,
        target_platform=route.target_platform,
        target_channel=route.target_channel,
    )

    return {"message": "Route removed successfully"}


@router.patch("/routes/toggle")
async def toggle_route(
    request: RouteToggleRequest,
    current_user: User = Depends(require_permission("channels", "write")),
):
    """라우트 활성/비활성 토글"""
    bridge = get_bridge()
    if not bridge:
        raise HTTPException(status_code=503, detail="Bridge not initialized")

    success = await bridge.route_manager.toggle_route_enabled(
        source_platform=request.source_platform,
        source_channel=request.source_channel,
        target_platform=request.target_platform,
        target_channel=request.target_channel,
        is_enabled=request.is_enabled,
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to toggle route")

    return {
        "message": f"Route {'enabled' if request.is_enabled else 'disabled'} successfully"
    }


@router.get("/channels/{platform}")
async def get_channels(
    platform: str,
    current_user: User = Depends(require_permission("channels", "read")),
):
    """
    특정 플랫폼의 채널 목록 조회

    Args:
        platform: 플랫폼 이름 (slack, teams 등)

    Returns:
        채널 목록 [{"id": "C123", "name": "general", "type": "public"}, ...]

    Raises:
        404: Provider가 없거나 연결되지 않음
        503: Bridge가 초기화되지 않음
    """
    bridge = get_bridge()
    if not bridge:
        raise HTTPException(status_code=503, detail="Bridge not initialized")

    provider = bridge.providers.get(platform)
    if not provider:
        raise HTTPException(
            status_code=404,
            detail=f"Provider '{platform}' not found. Available: {list(bridge.providers.keys())}",
        )

    if not provider.is_connected:
        raise HTTPException(
            status_code=503, detail=f"Provider '{platform}' is not connected"
        )

    # 채널 목록 조회
    channels = await provider.get_channels()

    # Channel 객체를 dict로 변환
    return [
        {
            "id": ch.id,
            "name": ch.name or ch.id,
            "type": ch.type.value,
        }
        for ch in channels
    ]


@router.get("/channels/{platform}/validate/{channel_id}")
async def validate_channel(
    platform: str,
    channel_id: str,
    current_user: User = Depends(require_permission("channels", "read")),
):
    """
    채널 ID 유효성 검증 및 채널 정보 조회

    Args:
        platform: 플랫폼 이름 (slack, teams 등)
        channel_id: 검증할 채널 ID (예: C01234567, 19:xxx@thread.tacv2)

    Returns:
        {
            "valid": true,
            "channel": {"id": "C123", "name": "general", "type": "public"}
        }
        또는
        {
            "valid": false,
            "error": "Channel not found"
        }

    Raises:
        404: Provider가 없거나 연결되지 않음
        503: Bridge가 초기화되지 않음
    """
    bridge = get_bridge()
    if not bridge:
        raise HTTPException(status_code=503, detail="Bridge not initialized")

    provider = bridge.providers.get(platform)
    if not provider:
        raise HTTPException(
            status_code=404,
            detail=f"Provider '{platform}' not found. Available: {list(bridge.providers.keys())}",
        )

    if not provider.is_connected:
        raise HTTPException(
            status_code=503, detail=f"Provider '{platform}' is not connected"
        )

    try:
        # 채널 목록 조회
        channels = await provider.get_channels()

        # 채널 ID로 검색
        for ch in channels:
            if ch.id == channel_id:
                return {
                    "valid": True,
                    "channel": {
                        "id": ch.id,
                        "name": ch.name or ch.id,
                        "type": ch.type.value,
                    },
                }

        # 채널을 찾지 못함
        return {"valid": False, "error": "Channel not found"}

    except Exception as e:
        return {"valid": False, "error": str(e)}


@router.post("/command")
async def send_command(
    command: dict,
    current_user: User = Depends(require_permission("channels", "write")),
):
    """커맨드 실행"""
    bridge = get_bridge()
    if not bridge:
        raise HTTPException(status_code=503, detail="Bridge not initialized")

    cmd = command.get("command", "")
    if not cmd:
        raise HTTPException(status_code=400, detail="Command is required")

    # CommandProcessor를 통해 실행
    # TODO: 실제 커맨드 실행 결과 반환
    return {"success": True, "message": f"Command '{cmd}' executed", "data": {}}


@router.post("/start")
async def start_bridge(
    current_user: User = Depends(require_system_admin()),
):
    """브리지 시작 (system_admin 전용)"""
    bridge = get_bridge()
    if not bridge:
        raise HTTPException(status_code=503, detail="Bridge not initialized")

    if bridge.is_running:
        return {"message": "Bridge is already running"}

    await bridge.start()
    return {"message": "Bridge started successfully"}


@router.post("/stop")
async def stop_bridge(
    current_user: User = Depends(require_system_admin()),
):
    """브리지 중지 (system_admin 전용)"""
    bridge = get_bridge()
    if not bridge:
        raise HTTPException(status_code=503, detail="Bridge not initialized")

    if not bridge.is_running:
        return {"message": "Bridge is not running"}

    await bridge.stop()
    return {"message": "Bridge stopped successfully"}


@router.post("/reload-providers")
async def reload_providers(
    current_user: User = Depends(require_system_admin()),
):
    """
    Provider 재로드 (Hot Reload)

    DB에서 활성화된 Provider를 다시 로드하여 브리지에 등록합니다.
    설정 변경 후 재시작 없이 Provider를 갱신할 때 사용합니다.

    Returns:
        dict: {
            "message": "Providers reloaded successfully",
            "providers": [{"platform": "slack", "connected": True}, ...],
            "removed": 2,
            "added": 3
        }
    """
    from sqlalchemy.orm import Session
    from app.db import get_db_session
    from app.models.account import Account

    bridge = get_bridge()
    if not bridge:
        raise HTTPException(status_code=503, detail="Bridge not initialized")

    # 1. 기존 Provider 제거
    removed_count = 0
    for platform in list(bridge.providers.keys()):
        await bridge.remove_provider(platform)
        removed_count += 1

    # 2. DB에서 활성화된 Provider 조회
    db: Session = next(get_db_session())
    try:
        accounts = (
            db.query(Account)
            .filter(Account.enabled.is_(True), Account.is_valid.is_(True))
            .all()
        )

        # 3. Provider 재등록
        added_count = 0
        providers_status = []

        for account in accounts:
            # Provider 인스턴스 생성
            if account.platform == "slack":
                from app.adapters.slack_provider import SlackProvider

                provider = SlackProvider(
                    bot_token=account.token_decrypted,
                    app_token=account.app_token_decrypted,
                )

            elif account.platform == "teams":
                from app.adapters.teams_provider import TeamsProvider

                provider = TeamsProvider(
                    app_id=account.app_id_decrypted,
                    app_password=account.app_password_decrypted,
                    tenant_id=account.tenant_id_decrypted,
                    team_id=account.team_id_decrypted,
                    account_id=account.id,
                )

            else:
                continue

            # Provider 등록
            success = await bridge.add_provider(provider)
            if success:
                added_count += 1
                providers_status.append(
                    {
                        "platform": provider.platform_name,
                        "connected": provider.is_connected,
                    }
                )

        return {
            "message": "Providers reloaded successfully",
            "providers": providers_status,
            "removed": removed_count,
            "added": added_count,
        }

    finally:
        db.close()


@router.get("/logs")
async def get_logs(
    lines: int = 100,
    current_user: User = Depends(require_permission("dashboard", "read")),
):
    """
    브리지 로그 조회 (인메모리 버퍼)

    최근 로그 항목을 반환합니다.
    """
    from app.services.log_buffer import get_recent_logs

    return {"logs": get_recent_logs(lines)}
