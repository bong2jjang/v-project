"""피드백/알림 정적 위젯.

- alert_banner: 상태/공지용 배너 (정보/주의/성공/에러)
"""

from __future__ import annotations

from typing import Any, AsyncIterator, Literal

from pydantic import BaseModel, Field

from ..base import BaseUiTool, UiChunk, UiContext
from ..registry import registry


class AlertBannerParams(BaseModel):
    variant: Literal["info", "warning", "success", "error"] = Field(
        default="info", description="배너 종류 (색/아이콘 결정)"
    )
    title: str = Field(default="알림", description="배너 제목")
    message: str = Field(
        default="메시지를 입력하세요.", description="본문 텍스트"
    )
    dismissible: bool = Field(default=False, description="닫기 버튼 표시")
    cta_label: str | None = Field(default=None, description="액션 버튼 라벨")
    cta_href: str | None = Field(default=None, description="액션 버튼 URL")


class AlertBannerTool(BaseUiTool):
    name = "alert_banner"
    description = "대시보드 상단·섹션에 상태/공지를 강조하는 배너."
    Params = AlertBannerParams
    component = "AlertBanner"
    category = "feedback"
    label = "알림 배너"
    icon = "Bell"
    default_grid = {"w": 12, "h": 1}
    default_args = {
        "variant": "info",
        "title": "안내",
        "message": "이 대시보드는 매일 00시에 갱신됩니다.",
        "dismissible": False,
    }
    palette_order = 10

    def summarize_props(self, props: dict[str, Any]) -> str:
        return (
            f"[alert:{props.get('variant', 'info')}] "
            f"{(props.get('title') or '')[:40]}"
        )

    async def render(
        self, args: dict[str, Any], ctx: UiContext
    ) -> AsyncIterator[UiChunk]:
        params = AlertBannerParams.model_validate(args)
        yield UiChunk(
            kind="component",
            call_id=ctx.call_id,
            component="AlertBanner",
            props=params.model_dump(),
        )


registry.register(AlertBannerTool())
