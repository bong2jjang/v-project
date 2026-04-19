"""정적(수동) 위젯 UiTool 모음.

각 모듈은 `BaseUiTool` 을 상속해 카테고리/라벨/아이콘을 지정하고
`registry.register()` 로 자동 등록한다. 이 패키지가 import 되는 순간
전체 정적 위젯이 팔레트 카탈로그에 노출된다.
"""

from __future__ import annotations

from . import charts  # noqa: F401
from . import feedback  # noqa: F401
from . import kpi  # noqa: F401
from . import layout  # noqa: F401
from . import table  # noqa: F401

__all__ = ["charts", "feedback", "kpi", "layout", "table"]
