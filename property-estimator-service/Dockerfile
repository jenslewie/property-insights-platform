FROM ghcr.io/astral-sh/uv:0.12.17 AS uv


FROM python:3.13-slim AS builder

COPY --from=uv /uv /uvx /bin/

ENV UV_LINK_MODE=copy

ARG SERVICE_DIR=property-estimator-service

WORKDIR /workspace/${SERVICE_DIR}

COPY ${SERVICE_DIR}/pyproject.toml ${SERVICE_DIR}/uv.lock ./

RUN uv sync --frozen --no-dev --no-cache

COPY ${SERVICE_DIR}/app ./app


FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

ARG SERVICE_DIR=property-estimator-service

WORKDIR /workspace/${SERVICE_DIR}

COPY --from=builder /workspace/${SERVICE_DIR}/.venv ./.venv
COPY --from=builder /workspace/${SERVICE_DIR}/app ./app

ENV PATH="/workspace/property-estimator-service/.venv/bin:$PATH"

EXPOSE 9001

HEALTHCHECK \
    --interval=30s \
    --timeout=3s \
    --start-period=5s \
    --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:9001/health', timeout=2)"]

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9001"]
