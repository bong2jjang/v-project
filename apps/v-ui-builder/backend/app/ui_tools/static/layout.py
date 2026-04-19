"""레이아웃 & 텍스트 정적 위젯.

- title_block: 섹션 제목
- section_header: 구분선 + 아이콘 + 액션
- description_text: 마크다운 설명
- divider: 구분선
- callout_box: 정보/주의/성공/에러 박스
"""

from __future__ import annotations

from typing import Any, AsyncIterator, Literal

from pydantic import BaseModel, Field

from ..base import BaseUiTool, UiChunk, UiContext
from ..registry import registry


# ── title_block ──
class TitleBlockParams(BaseModel):
    text: str = Field(default="Untitled", description="표시할 제목 텍스트")
    level: Literal["h1", "h2", "h3", "h4"] = Field(
        default="h2", description="제목 수준"
    )
    align: Literal["left", "center"] = Field(
        default="left", description="가로 정렬"
    )


class TitleBlockTool(BaseUiTool):
    name = "title_block"
    description = "섹션 제목을 표시하는 정적 타이틀 블록."
    Params = TitleBlockParams
    component = "TitleBlock"
    category = "layout"
    label = "타이틀"
    icon = "Heading"
    default_grid = {"w": 12, "h": 1}
    default_args = {"text": "Untitled", "level": "h2", "align": "left"}
    palette_order = 10

    def summarize_props(self, props: dict[str, Any]) -> str:
        return f"[title] {(props.get('text') or '')[:40]}"

    async def render(
        self, args: dict[str, Any], ctx: UiContext
    ) -> AsyncIterator[UiChunk]:
        params = TitleBlockParams.model_validate(args)
        yield UiChunk(
            kind="component",
            call_id=ctx.call_id,
            component="TitleBlock",
            props=params.model_dump(),
        )


# ── section_header ──
class SectionHeaderParams(BaseModel):
    text: str = Field(default="섹션", description="섹션 이름")
    icon: str | None = Field(default=None, description="Lucide 아이콘 이름")
    action_label: str | None = Field(default=None, description="우측 링크 버튼 라벨")
    action_href: str | None = Field(default=None, description="우측 링크 URL")


class SectionHeaderTool(BaseUiTool):
    name = "section_header"
    description = "아이콘과 액션 버튼을 갖춘 섹션 헤더."
    Params = SectionHeaderParams
    component = "SectionHeader"
    category = "layout"
    label = "섹션 헤더"
    icon = "Bookmark"
    default_grid = {"w": 12, "h": 1}
    default_args = {"text": "새 섹션", "icon": "LayoutGrid"}
    palette_order = 20

    def summarize_props(self, props: dict[str, Any]) -> str:
        return f"[section] {(props.get('text') or '')[:40]}"

    async def render(
        self, args: dict[str, Any], ctx: UiContext
    ) -> AsyncIterator[UiChunk]:
        params = SectionHeaderParams.model_validate(args)
        yield UiChunk(
            kind="component",
            call_id=ctx.call_id,
            component="SectionHeader",
            props=params.model_dump(),
        )


# ── description_text ──
class DescriptionTextParams(BaseModel):
    markdown: str = Field(
        default="여기에 설명을 입력하세요.",
        description="마크다운 본문 (제목/목록/강조 지원)",
    )
    max_lines: int | None = Field(
        default=None, ge=1, le=50, description="접힘 시 표시할 최대 줄 수"
    )


class DescriptionTextTool(BaseUiTool):
    name = "description_text"
    description = "대시보드 설명 블록 — 마크다운 본문을 렌더링."
    Params = DescriptionTextParams
    component = "DescriptionText"
    category = "layout"
    label = "설명 텍스트"
    icon = "FileText"
    default_grid = {"w": 6, "h": 2}
    default_args = {"markdown": "이 섹션은 **매출 추이** 를 보여줍니다."}
    palette_order = 30

    def summarize_props(self, props: dict[str, Any]) -> str:
        raw = (props.get("markdown") or "").strip().replace("\n", " ")
        return f"[desc] {raw[:60]}"

    async def render(
        self, args: dict[str, Any], ctx: UiContext
    ) -> AsyncIterator[UiChunk]:
        params = DescriptionTextParams.model_validate(args)
        yield UiChunk(
            kind="component",
            call_id=ctx.call_id,
            component="DescriptionText",
            props=params.model_dump(),
        )


# ── divider ──
class DividerParams(BaseModel):
    style: Literal["solid", "dashed", "dotted"] = Field(
        default="solid", description="선 스타일"
    )
    thickness: int = Field(default=1, ge=1, le=8, description="선 두께(px)")
    spacing: int = Field(default=16, ge=0, le=64, description="위/아래 여백(px)")


class DividerTool(BaseUiTool):
    name = "divider"
    description = "수평 구분선."
    Params = DividerParams
    component = "Divider"
    category = "layout"
    label = "구분선"
    icon = "Minus"
    default_grid = {"w": 12, "h": 1}
    default_args = {"style": "solid", "thickness": 1}
    palette_order = 40

    def summarize_props(self, props: dict[str, Any]) -> str:
        return f"[divider] {props.get('style', 'solid')}"

    async def render(
        self, args: dict[str, Any], ctx: UiContext
    ) -> AsyncIterator[UiChunk]:
        params = DividerParams.model_validate(args)
        yield UiChunk(
            kind="component",
            call_id=ctx.call_id,
            component="Divider",
            props=params.model_dump(),
        )


# ── callout_box ──
class CalloutBoxParams(BaseModel):
    variant: Literal["info", "warning", "success", "error"] = Field(
        default="info", description="박스 종류 (색상/아이콘 결정)"
    )
    title: str = Field(default="참고", description="박스 제목")
    body: str = Field(
        default="설명 내용을 입력하세요.", description="본문 텍스트(마크다운 허용)"
    )


class CalloutBoxTool(BaseUiTool):
    name = "callout_box"
    description = "정보/주의/성공/에러 상태를 강조하는 박스."
    Params = CalloutBoxParams
    component = "CalloutBox"
    category = "layout"
    label = "강조 박스"
    icon = "MessageSquare"
    default_grid = {"w": 6, "h": 2}
    default_args = {
        "variant": "info",
        "title": "참고",
        "body": "이 대시보드는 어제 00시 기준 데이터입니다.",
    }
    palette_order = 50

    def summarize_props(self, props: dict[str, Any]) -> str:
        return (
            f"[callout:{props.get('variant','info')}] "
            f"{(props.get('title') or '')[:40]}"
        )

    async def render(
        self, args: dict[str, Any], ctx: UiContext
    ) -> AsyncIterator[UiChunk]:
        params = CalloutBoxParams.model_validate(args)
        yield UiChunk(
            kind="component",
            call_id=ctx.call_id,
            component="CalloutBox",
            props=params.model_dump(),
        )


registry.register(TitleBlockTool())
registry.register(SectionHeaderTool())
registry.register(DescriptionTextTool())
registry.register(DividerTool())
registry.register(CalloutBoxTool())
