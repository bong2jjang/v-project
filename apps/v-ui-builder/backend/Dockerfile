FROM python:3.11-slim

WORKDIR /app

COPY apps/v-ui-builder/backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/v-ui-builder/backend /app
COPY platform/backend/v_platform /platform/backend/v_platform

ENV PYTHONPATH=/app:/platform/backend
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
