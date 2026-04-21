"""DashboardChatService — 대시보드 캔버스를 대화로 조작하기 위한 별도 채팅.

프로젝트 채팅(`ChatService`)과는 다음이 다르다:
- 노출 도구가 `dashboard_ops_registry` (add/update/remove/reflow) 로 한정.
- 시스템 프롬프트에 "현재 대시보드 레이아웃 JSON" + "선택된 위젯 상세 props" 주입.
- 메시지는 `scope='dashboard', dashboard_id=...` 로 영속화 → 프로젝트 채팅과 분리.
- 파일/아티팩트 스냅샷 로직은 돌리지 않는다 (대시보드는 UI 위젯 조작 전용).

LLM 이 tool_call 을 방출하면 대응 ops 를 실행해 `dashboard_widget_added/updated/
removed/layout_changed` SSE 이벤트로 프론트에 실시간 반영한다.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, AsyncIterator
from uuid import UUID

from sqlalchemy.orm import Session

from app.llm.base import ChatMessage, LLMChunk
from app.llm.registry import get_provider
from app.models import (
    UIBuilderDashboardWidget,
    UIBuilderMessage,
    UIBuilderProject,
)
from app.schemas.dashboard import WidgetRead
from app.ui_tools import registry as ui_tool_registry
from app.ui_tools.dashboard_ops import (
    DashboardOpsContext,
    dashboard_ops_registry,
)
from app.ui_tools.errors import format_tool_error

from .dashboard_service import DashboardService
from .project_service import ProjectService

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """당신은 대시보드 캔버스를 직접 편집하는 도구형 어시스턴트입니다.

규칙:
1. 반드시 제공된 도구(dashboard_add_widget / dashboard_update_widget /
   dashboard_remove_widget / dashboard_reflow) 중 하나로 동작을 수행하세요.
2. 새 위젯을 추가할 때는 `dashboard_add_widget` 의 `tool` 인자에 재사용할 UI 도구
   이름(stock, weather, data_table 등)을 지정하고 `args` 로 해당 도구의 render 인자를
   전달합니다.
3. 위젯 수정 시 `widget_id` 는 현재 레이아웃 JSON 의 위젯 id 를 그대로 사용하세요.
4. `dashboard_add_widget` 와 `dashboard_update_widget` 는 **프리뷰 제안 모드** 입니다.
   도구 호출 결과는 채팅창 프리뷰 카드로만 표시되며 사용자가 "캔버스에 추가/반영"
   버튼을 눌러야 실제 대시보드에 반영됩니다. 같은 턴에 같은 위젯을 다시 제안하지 마세요.
5. 코드를 작성하거나 파일 펜스를 쓰지 마세요. 설명은 1~2줄 이내로 제한.
6. 사용자의 의도를 도구 호출로 옮길 수 없으면 도구를 호출하지 말고 짧게 되물어
   주세요.

사용 가능한 재사용 UI 도구:
{ui_tools_doc}
"""


def _to_sse(event: str, data: dict[str, Any]) -> bytes:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n".encode()


_OP_LABEL: dict[str, str] = {
    "dashboard_add_widget": "위젯 추가",
    "dashboard_update_widget": "위젯 수정",
    "dashboard_remove_widget": "위젯 제거",
    "dashboard_reflow": "레이아웃 재배치",
}


def _summarize_dashboard_errors(records: list[dict[str, Any]]) -> str:
    """에러 기록만 한 줄씩 요약 — LLM 응답 유무와 무관하게 항상 노출."""
    lines: list[str] = []
    for r in records:
        if r.get("status") != "error":
            continue
        tool_name = r.get("tool") or "dashboard_op"
        label = _OP_LABEL.get(tool_name, tool_name)
        err = r.get("error") or "알 수 없는 오류"
        lines.append(f"⚠️ {label} 실패: {err}")
    return "\n".join(lines)


def _summarize_dashboard_successes(records: list[dict[str, Any]]) -> str:
    """성공 기록만 한 줄씩 요약 — LLM 이 content 를 비운 턴의 빈 버블 방지용."""
    lines: list[str] = []
    for r in records:
        if r.get("status") != "ok":
            continue
        tool_name = r.get("tool") or "dashboard_op"
        label = _OP_LABEL.get(tool_name, tool_name)
        detail: str = ""
        for ev in r.get("events") or []:
            name = ev.get("event") or ""
            data = ev.get("data") or {}
            if name in ("dashboard_widget_added", "dashboard.widget_added"):
                w = data.get("widget") or {}
                comp = w.get("component") or w.get("tool") or "위젯"
                detail = f"`{comp}` 추가"
                break
            if name in ("dashboard_widget_updated", "dashboard.widget_updated"):
                w = data.get("widget") or {}
                comp = w.get("component") or w.get("tool") or "위젯"
                detail = f"`{comp}` 갱신"
                break
            if name in ("dashboard_widget_proposed", "dashboard.widget_proposed"):
                p = data.get("proposal") or {}
                comp = p.get("component") or p.get("tool") or "위젯"
                kind = p.get("kind") or ""
                action = "추가" if kind == "add" else "수정"
                detail = f"`{comp}` {action} 제안"
                break
            if name in ("dashboard_widget_removed", "dashboard.widget_removed"):
                wid = data.get("widget_id") or "?"
                detail = f"위젯 {wid} 제거"
                break
            if name in ("dashboard_layout_changed", "dashboard.layout_changed"):
                items = data.get("layout") or []
                detail = f"{len(items)}개 위젯 재배치"
                break
        lines.append(f"✅ {label} 완료" + (f" — {detail}" if detail else ""))
    return "\n".join(lines)


def _widget_summary(widget: UIBuilderDashboardWidget) -> dict[str, Any]:
    """레이아웃 JSON 용 한 위젯 요약 — props 는 summarize_props 결과만 실어 토큰 절약."""
    summary: str = ""
    if ui_tool_registry.has(widget.tool):
        try:
            summary = ui_tool_registry.get(widget.tool).summarize_props(
                widget.props or {}
            )
        except Exception:  # noqa: BLE001
            summary = ""
    return {
        "id": str(widget.id),
        "tool": widget.tool,
        "component": widget.component,
        "summary": summary,
        "grid": {
            "x": widget.grid_x,
            "y": widget.grid_y,
            "w": widget.grid_w,
            "h": widget.grid_h,
        },
    }


class DashboardChatService:
    def __init__(self, db: Session):
        self.db = db
        self.projects = ProjectService(db)
        self.dashboards = DashboardService(db)

    # ── history / context ──
    def _history(
        self, project_id: UUID, dashboard_id: UUID
    ) -> list[ChatMessage]:
        rows = (
            self.db.query(UIBuilderMessage)
            .filter(
                UIBuilderMessage.project_id == project_id,
                UIBuilderMessage.scope == "dashboard",
                UIBuilderMessage.dashboard_id == dashboard_id,
            )
            .order_by(UIBuilderMessage.created_at.asc())
            .all()
        )
        return [ChatMessage(role=r.role, content=r.content) for r in rows]

    def _ui_tools_doc(self) -> str:
        lines: list[str] = []
        for schema in ui_tool_registry.all_openai():
            fn = schema.get("function") or {}
            name = fn.get("name")
            desc = fn.get("description")
            if name:
                lines.append(f"- `{name}` — {desc}")
        return "\n".join(lines) if lines else "(없음)"

    def _layout_block(
        self,
        widgets: list[UIBuilderDashboardWidget],
        selected_ids: list[str],
    ) -> str:
        layout = [_widget_summary(w) for w in widgets]
        selected_props: list[dict[str, Any]] = []
        sel_set = set(selected_ids)
        for w in widgets:
            if str(w.id) in sel_set:
                selected_props.append(
                    {"id": str(w.id), "tool": w.tool, "props": w.props or {}}
                )
        lines = [
            "",
            "---",
            "# 현재 대시보드 레이아웃",
            "```json",
            json.dumps(layout, ensure_ascii=False, indent=2),
            "```",
        ]
        if selected_props:
            lines += [
                "",
                "# 선택된 위젯 상세 (사용자가 포커스한 위젯)",
                "```json",
                json.dumps(selected_props, ensure_ascii=False, indent=2),
                "```",
            ]
        return "\n".join(lines)

    # ── tool dispatch ──
    async def _dispatch_tool_call(
        self,
        chunk: LLMChunk,
        ctx: DashboardOpsContext,
        ui_calls_accum: list[dict[str, Any]],
    ) -> AsyncIterator[bytes]:
        call_id = chunk.tool_call_id or f"call_{len(ui_calls_accum)}"
        tool_name = chunk.tool_name or ""
        args = chunk.tool_args or {}

        record: dict[str, Any] = {
            "call_id": call_id,
            "tool": tool_name,
            "args": args,
            "status": "loading",
            "error": None,
            "events": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        if not dashboard_ops_registry.has(tool_name):
            record["status"] = "error"
            record["error"] = f"등록되지 않은 대시보드 도구 `{tool_name}`"
            ui_calls_accum.append(record)
            yield _to_sse(
                "dashboard_op_error",
                {"op": tool_name, "error": record["error"]},
            )
            return

        tool = dashboard_ops_registry.get(tool_name)
        try:
            async for emitted in tool.execute(args, ctx):
                event = str(emitted.get("event") or "dashboard_op_error")
                data = emitted.get("data") or {}
                record["events"].append({"event": event, "data": data})
                if event == "dashboard_op_error" or event == "dashboard.op_error":
                    record["status"] = "error"
                    record["error"] = format_tool_error(data.get("error"))
                    data = {**data, "error": record["error"]}
                else:
                    record["status"] = "ok"
                # 프리뷰 제안은 레코드에도 평탄화해 프론트가 재구성 쉽게 하도록.
                if event in (
                    "dashboard.widget_proposed",
                    "dashboard_widget_proposed",
                ):
                    proposal = data.get("proposal")
                    if isinstance(proposal, dict):
                        record["proposal"] = proposal
                # SSE event name 은 underscore 형태로 통일
                sse_name = event.replace(".", "_")
                yield _to_sse(sse_name, data)
        except Exception as exc:  # noqa: BLE001
            logger.exception("dashboard op %s failed", tool_name)
            record["status"] = "error"
            record["error"] = format_tool_error(exc)
            yield _to_sse(
                "dashboard_op_error",
                {"op": tool_name, "error": record["error"]},
            )

        ui_calls_accum.append(record)

    # ── main stream ──
    async def stream(
        self,
        project_id: UUID,
        user_id: int,
        prompt: str,
        selected_widget_ids: list[str] | None = None,
        model: str | None = None,
    ) -> AsyncIterator[bytes]:
        project: UIBuilderProject = self.projects.get_owned(
            project_id, user_id, expected_type="genui"
        )
        dashboard = self.dashboards.get_for_project(project_id, user_id)
        widgets = self.dashboards.list_widgets(dashboard.id, user_id)

        # 사용자 메시지 선 영속화 (scope=dashboard)
        user_msg = UIBuilderMessage(
            project_id=project.id,
            role="user",
            content=prompt,
            scope="dashboard",
            dashboard_id=dashboard.id,
        )
        self.db.add(user_msg)
        self.db.commit()

        history = self._history(project.id, dashboard.id)
        system_prompt = SYSTEM_PROMPT.format(
            ui_tools_doc=self._ui_tools_doc()
        ) + self._layout_block(widgets, selected_widget_ids or [])

        provider = get_provider(project.llm_provider)
        tools_schema = dashboard_ops_registry.all_openai() or None

        ops_ctx = DashboardOpsContext(
            user_id=user_id,
            project_id=project.id,
            dashboard_id=dashboard.id,
            db=self.db,
        )

        assistant_buf: list[str] = []
        ui_calls_accum: list[dict[str, Any]] = []
        try:
            async for chunk in provider.stream(
                messages=history,
                system_prompt=system_prompt,
                file_context=[],
                model=model or project.llm_model,
                tools=tools_schema,
            ):
                if chunk.kind == "content" and chunk.delta:
                    assistant_buf.append(chunk.delta)
                    yield _to_sse("content", {"delta": chunk.delta})
                elif chunk.kind == "tool_call":
                    async for sse in self._dispatch_tool_call(
                        chunk, ops_ctx, ui_calls_accum
                    ):
                        yield sse
                elif chunk.kind == "done":
                    break
                # dashboard chat 에서는 artifact_* 는 무시(코드 생성 경로 아님)
        except Exception as exc:  # noqa: BLE001
            yield _to_sse("error", {"message": str(exc)})
            return

        # 에러는 LLM 이 텍스트를 생성했든 아니든 사용자에게 항상 원인을 알려준다.
        error_text = _summarize_dashboard_errors(ui_calls_accum)
        if error_text:
            prefix = "\n\n" if "".join(assistant_buf).strip() else ""
            yield _to_sse("content", {"delta": prefix + error_text})
            assistant_buf.append(prefix + error_text)

        # 성공 호출만 있고 LLM 이 content 를 비운 경우에만 보조 요약을 덧붙인다.
        if ui_calls_accum and not "".join(assistant_buf).strip():
            success_text = _summarize_dashboard_successes(ui_calls_accum)
            if success_text:
                yield _to_sse("content", {"delta": success_text})
                assistant_buf.append(success_text)

        assistant_content = "".join(assistant_buf)
        assistant_msg = UIBuilderMessage(
            project_id=project.id,
            role="assistant",
            content=assistant_content,
            ui_calls=ui_calls_accum,
            scope="dashboard",
            dashboard_id=dashboard.id,
        )
        self.db.add(assistant_msg)
        self.db.commit()
        self.db.refresh(assistant_msg)

        yield _to_sse("done", {"message_id": str(assistant_msg.id)})


__all__ = ["DashboardChatService", "WidgetRead"]
