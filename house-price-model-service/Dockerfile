FROM ghcr.io/astral-sh/uv:0.12.17 AS uv


FROM python:3.13-slim AS builder

COPY --from=uv /uv /usr/local/bin/uv

ENV UV_LINK_MODE=copy

ARG MODEL_TYPE=ridge
ARG MODEL_ALPHA
ARG EVALUATION_METHOD=repeated-kfold

WORKDIR /workspace/house-price-model-service

COPY house-price-model-service/pyproject.toml house-price-model-service/uv.lock ./

RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev --no-install-project

COPY data /workspace/data
COPY house-price-model-service/app ./app
COPY house-price-model-service/training ./training

RUN mkdir -p artifacts && \
    if [ -z "${MODEL_ALPHA}" ]; then \
        uv run --no-sync python -m training.train \
            --model-type "${MODEL_TYPE}" \
            --evaluation-method "${EVALUATION_METHOD}"; \
    else \
        uv run --no-sync python -m training.train \
            --model-type "${MODEL_TYPE}" \
            --alpha "${MODEL_ALPHA}" \
            --evaluation-method "${EVALUATION_METHOD}"; \
    fi


FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/workspace/house-price-model-service/.venv/bin:${PATH}"

WORKDIR /workspace/house-price-model-service

RUN groupadd --system app && useradd --system --gid app --home-dir /nonexistent app

COPY --from=builder --chown=app:app /workspace/house-price-model-service/.venv ./.venv
COPY --from=builder --chown=app:app /workspace/house-price-model-service/app ./app
COPY --from=builder --chown=app:app /workspace/house-price-model-service/artifacts ./artifacts

USER app

EXPOSE 9003

HEALTHCHECK \
    --interval=30s \
    --timeout=3s \
    --start-period=10s \
    --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:9003/health', timeout=2)"]

ENTRYPOINT ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9003"]
