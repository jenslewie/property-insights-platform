FROM ghcr.io/astral-sh/uv:0.12.17 AS uv


FROM python:3.13-slim AS builder

COPY --from=uv /uv /usr/local/bin/uv

ENV UV_LINK_MODE=copy

WORKDIR /workspace/property-estimator-service

COPY property-estimator-service/pyproject.toml property-estimator-service/uv.lock ./

RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev --no-install-project

COPY property-estimator-service/app ./app


FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/workspace/property-estimator-service/.venv/bin:${PATH}"

WORKDIR /workspace/property-estimator-service

RUN groupadd --system app && useradd --system --gid app --home-dir /nonexistent app

COPY --from=builder --chown=app:app /workspace/property-estimator-service/.venv ./.venv
COPY --from=builder --chown=app:app /workspace/property-estimator-service/app ./app

USER app

EXPOSE 9001

HEALTHCHECK \
    --interval=30s \
    --timeout=3s \
    --start-period=10s \
    --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:9001/health', timeout=2)"]

ENTRYPOINT ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9001"]
