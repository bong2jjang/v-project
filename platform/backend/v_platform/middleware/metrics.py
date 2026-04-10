"""Prometheus 메트릭 미들웨어"""

import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from v_platform.api.metrics import http_request_duration_seconds, http_requests_total


class MetricsMiddleware(BaseHTTPMiddleware):
    """HTTP 요청 메트릭을 수집하는 미들웨어"""

    async def dispatch(self, request: Request, call_next):
        """
        HTTP 요청을 처리하고 메트릭을 기록

        Args:
            request: HTTP 요청
            call_next: 다음 미들웨어/핸들러

        Returns:
            HTTP 응답
        """
        # 메트릭 엔드포인트는 측정 제외
        if request.url.path == "/metrics":
            return await call_next(request)

        start_time = time.time()

        # 요청 처리
        response = await call_next(request)

        # 처리 시간 계산
        duration = time.time() - start_time

        # 메트릭 기록
        http_requests_total.labels(
            method=request.method,
            endpoint=request.url.path,
            status=response.status_code,
        ).inc()

        http_request_duration_seconds.labels(
            method=request.method,
            endpoint=request.url.path,
        ).observe(duration)

        return response
