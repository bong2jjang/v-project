"""
CSRF Protection Middleware

Double Submit Cookie 패턴을 사용한 CSRF 공격 방지
"""

import os
import secrets
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class CSRFMiddleware(BaseHTTPMiddleware):
    """
    CSRF 보호 미들웨어

    안전한 HTTP 메서드 (GET, HEAD, OPTIONS, TRACE)는 검증하지 않고,
    변경 메서드 (POST, PUT, PATCH, DELETE)만 CSRF 토큰을 검증합니다.
    """

    # CSRF 검증이 필요 없는 경로
    EXEMPT_PATHS = [
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/refresh",
        "/api/auth/password-reset/request",
        "/api/auth/password-reset/verify",
        "/api/auth/password-reset/confirm",
        "/api/health",
        "/api/bridge",  # Bridge API 전체 exempt
        "/api/teams/webhook",  # Teams Bot Framework webhook
        "/api/teams/notifications",  # Graph API Change Notifications
        "/api/auth/sso",  # SSO 인증 (외부 Provider 콜백)
        "/docs",
        "/redoc",
        "/openapi.json",
    ]

    # 안전한 HTTP 메서드 (검증 불필요)
    SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}

    async def dispatch(self, request: Request, call_next):
        """
        요청 처리 전 CSRF 토큰 검증
        """
        # 테스트 환경에서는 CSRF 검증 비활성화
        if os.getenv("TESTING") == "true":
            return await call_next(request)

        # 안전한 메서드는 통과
        if request.method in self.SAFE_METHODS:
            return await call_next(request)

        # 예외 경로는 통과
        path = request.url.path
        if any(path.startswith(exempt) for exempt in self.EXEMPT_PATHS):
            return await call_next(request)

        # CSRF 토큰 검증
        # 1. Cookie에서 CSRF 토큰 가져오기
        csrf_cookie = request.cookies.get("csrf_token")

        # 2. Header에서 CSRF 토큰 가져오기
        csrf_header = request.headers.get("X-CSRF-Token")

        # 3. 둘 다 있어야 하고, 값이 일치해야 함
        if not csrf_cookie or not csrf_header:
            return JSONResponse(
                status_code=403, content={"detail": "CSRF token missing"}
            )

        if csrf_cookie != csrf_header:
            return JSONResponse(
                status_code=403, content={"detail": "CSRF token mismatch"}
            )

        # 검증 통과 - 요청 처리
        response = await call_next(request)
        return response


def generate_csrf_token() -> str:
    """
    CSRF 토큰 생성

    Returns:
        32 바이트 랜덤 토큰 (URL-safe base64)
    """
    return secrets.token_urlsafe(32)
