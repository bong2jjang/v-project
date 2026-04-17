"""v-ui-builder — AI UI Builder (Chat-driven component builder with instant preview)

사용자가 LLM과 대화하며 React 컴포넌트/페이지를 생성하고 Sandpack iframe으로
즉시 미리보기하는 v-platform 앱.

참조 경험: Gemini Canvas, Claude Artifacts, Bolt.new
설계 문서: docusaurus/docs/design/V_UI_BUILDER_DESIGN.md
"""

import logging
import structlog
from contextlib import asynccontextmanager

from v_platform.app import PlatformApp
from v_platform.services.websocket_manager import manager
from v_platform.services.event_broadcaster import EventBroadcaster
import v_platform.services.event_broadcaster as broadcaster_module

logging.basicConfig(level=logging.INFO, format="%(levelname)-8s %(name)s %(message)s")
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(fastapi_app):
    logger.info("Starting v-ui-builder")
    platform.init_platform()

    broadcaster = EventBroadcaster(manager, None)
    broadcaster_module.broadcaster = broadcaster
    await broadcaster.start()

    logger.info("v-ui-builder ready")

    yield

    if broadcaster_module.broadcaster:
        await broadcaster_module.broadcaster.stop()
    logger.info("v-ui-builder stopped")


platform = PlatformApp(
    app_name="v-ui-builder",
    version="0.1.0",
    description="AI UI Builder — chat-driven UI creation with instant Sandpack preview",
    lifespan=lifespan,
)

# ── 앱 전용 라우터 등록 (P1.1 단계에서 추가) ──
# from app.api import projects, chat, artifacts, llm_settings
# platform.register_app_routers(
#     projects.router,
#     chat.router,
#     artifacts.router,
#     llm_settings.router,
# )

app = platform.fastapi


@app.get("/")
async def root():
    return {
        "app": "v-ui-builder",
        "platform": "v-platform",
        "version": "0.1.0",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
