# Multi-stage build for Light-Zowe Architecture
# Stage 1: Builder - 의존성 설치
FROM python:3.11-slim AS builder

WORKDIR /build

# 시스템 패키지 설치 (빌드용)
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 설치 (전역)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Stage 2: Runtime - 최종 이미지
FROM python:3.11-slim

WORKDIR /app

# 시스템 패키지 설치 (런타임용)
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Builder 스테이지에서 설치한 Python 패키지 복사
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# 비-루트 사용자 생성 (먼저 생성)
RUN useradd -m -u 1000 appuser

# 애플리케이션 코드 복사 및 소유권 설정
COPY --chown=appuser:appuser . .

# 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# 포트 노출
EXPOSE 8000

# 비-루트 사용자로 전환 (보안 강화)
USER appuser

# 애플리케이션 실행
# Light-Zowe 아키텍처: WebSocket Bridge + Provider Pattern
# AsyncIO 동시성으로 충분한 성능 제공
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
