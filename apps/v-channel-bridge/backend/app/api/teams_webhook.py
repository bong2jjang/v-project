"""
Teams Webhook Endpoint

Microsoft Bot Framework 에서 전달되는 Teams Activity를 수신하고
TeamsProvider의 handle_activity() 로 전달합니다.

인증:
  Bot Framework는 각 요청에 서명된 JWT를 Authorization 헤더에 담아 전송합니다.
  BotFrameworkAdapter.process_activity()가 토큰 검증을 담당하므로
  별도의 수동 검증 없이 adapter에게 위임합니다.
"""

import structlog
from fastapi import APIRouter, HTTPException, Request, Response
from botbuilder.core import TurnContext
from botbuilder.schema import Activity

from app.services.websocket_bridge import get_bridge

logger = structlog.get_logger()

router = APIRouter(prefix="/api/teams", tags=["teams"])


@router.post("/webhook")
async def teams_webhook(request: Request):
    """
    Teams Bot Framework Webhook 엔드포인트

    Bot Framework Service가 Teams 채널의 Activity를 이 엔드포인트로 POST 합니다.
    TeamsProvider의 BotFrameworkAdapter가 JWT 인증을 수행하고
    handle_activity()를 통해 메시지를 처리합니다.
    """
    # TeamsProvider 조회
    bridge = get_bridge()
    if not bridge:
        raise HTTPException(status_code=503, detail="Bridge not initialized")

    teams_provider = bridge.providers.get("teams")
    if not teams_provider:
        # Teams Provider가 없으면 200 OK 반환 (Bot Framework 재시도 방지)
        logger.warning("Teams Provider not registered, ignoring activity")
        return Response(status_code=200)

    # 요청 본문 파싱
    body = await request.json()
    activity = Activity().deserialize(body)

    # Authorization 헤더 추출
    auth_header = request.headers.get("Authorization", "")

    # BotFrameworkAdapter를 통한 처리 (JWT 검증 포함)
    async def _on_turn(turn_context: TurnContext):
        await teams_provider.handle_activity(turn_context.activity)

    try:
        invoke_response = await teams_provider.adapter.process_activity(
            activity, auth_header, _on_turn
        )

        if invoke_response:
            return Response(
                content=str(invoke_response.body),
                status_code=invoke_response.status,
                media_type="application/json",
            )

        return Response(status_code=200)

    except Exception as e:
        logger.error("Error processing Teams webhook", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
