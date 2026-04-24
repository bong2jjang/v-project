"""레거시 API 경로 → WS 경로 307 리다이렉트 미들웨어 — 설계 §6.4.

v0.2~v0.3 호환 기간 동안 구 URL 요청을 새 워크스페이스 경로로 307 전환한다.

지원 패턴:
  /api/tickets/{id}   → /api/ws/{workspace_id}/tickets/{id}

DB 에서 리소스의 workspace_id 를 조회한 뒤 리다이렉트하므로,
존재하지 않는 리소스 또는 workspace_id 미설정 건은 통과(pass-through)한다.

최소 2 릴리즈 후 이 미들웨어 제거 예정.
"""

from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import RedirectResponse, Response
from v_platform.core.database import SessionLocal

from app.models.ticket import Ticket

# (pattern, resource_type) — 일치하면 DB 조회 후 리다이렉트 시도
_LEGACY_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"^/api/tickets/([^/]+)$"), "ticket"),
]


def _lookup_workspace_id(db: Session, resource_type: str, resource_id: str) -> str | None:
    if resource_type == "ticket":
        return db.execute(
            select(Ticket.workspace_id).where(Ticket.id == resource_id)
        ).scalar_one_or_none()
    return None


class LegacyRedirectMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path
        for pattern, resource_type in _LEGACY_PATTERNS:
            m = pattern.match(path)
            if m:
                resource_id = m.group(1)
                workspace_id = self._get_workspace_id(resource_type, resource_id)
                if workspace_id:
                    new_path = f"/api/ws/{workspace_id}/tickets/{resource_id}"
                    if request.url.query:
                        new_path = f"{new_path}?{request.url.query}"
                    return RedirectResponse(url=new_path, status_code=307)
        return await call_next(request)

    @staticmethod
    def _get_workspace_id(resource_type: str, resource_id: str) -> str | None:
        with SessionLocal() as db:
            return _lookup_workspace_id(db, resource_type, resource_id)
