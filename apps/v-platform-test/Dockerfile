FROM python:3.11-slim

WORKDIR /test-app

# Install platform dependencies
COPY platform/backend/pyproject.toml /platform/backend/pyproject.toml
RUN pip install --no-cache-dir \
    fastapi uvicorn[standard] pydantic pydantic-settings \
    sqlalchemy psycopg2-binary redis \
    python-jose[cryptography] passlib[bcrypt] cryptography \
    structlog slowapi prometheus-client \
    aiosmtplib jinja2 python-multipart email-validator \
    httpx aiohttp bcrypt==4.0.1

# Copy platform source
COPY platform/backend/v_platform /platform/backend/v_platform

# Copy test app
COPY apps/v-platform-test/main.py /test-app/main.py

ENV PYTHONPATH=/test-app:/platform/backend
EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
