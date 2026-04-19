"""Generative UI (방안 C) — tool 기반 컴포넌트 렌더링 프로토콜.

- `BaseUiTool`  : 모든 도구가 상속할 추상 인터페이스
- `UiChunk`     : 스트림 청크 (loading/component/patch/error)
- `UiContext`   : 런타임 컨텍스트 (user_id, project_id, db 등)
- `registry`    : name → tool 인스턴스 싱글톤

새 도구 추가 시 `apps/v-ui-builder/backend/app/ui_tools/<name>.py` 에
`BaseUiTool` 상속 클래스를 만들고 `registry.register(...)` 로 등록.
"""

from __future__ import annotations

from .base import BaseUiTool, UiChunk, UiContext
from .registry import registry
from .echo import EchoUiTool  # noqa: F401 — 등록만을 위한 import
from .weather import WeatherUiTool  # noqa: F401
from .stock import StockUiTool  # noqa: F401
from .data_table import DataTableUiTool  # noqa: F401
from .dashboard_ops import dashboard_ops_registry  # noqa: F401 — 대시보드 ops 등록

__all__ = [
    "BaseUiTool",
    "UiChunk",
    "UiContext",
    "registry",
    "dashboard_ops_registry",
]
