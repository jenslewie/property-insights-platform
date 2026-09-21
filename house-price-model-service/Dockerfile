FROM ghcr.io/astral-sh/uv:0.12.17 AS uv

FROM python:3.13-slim AS builder

COPY --from=uv /uv /uvx /bin/

ENV UV_LINK_MODE=copy

ARG SERVICE_DIR=house-price-model-service
ARG EVALUATION_METHOD=repeated-kfold

WORKDIR /workspace/${SERVICE_DIR}

COPY ${SERVICE_DIR}/pyproject.toml ${SERVICE_DIR}/uv.lock ./

RUN uv sync --frozen --no-dev --no-cache

COPY data /workspace/data
COPY ${SERVICE_DIR}/app ./app
COPY ${SERVICE_DIR}/training ./training

RUN mkdir -p artifacts && uv run --no-sync python -m training.train --evaluation-method ${EVALUATION_METHOD}


FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

ARG SERVICE_DIR=house-price-model-service

WORKDIR /workspace/${SERVICE_DIR}

COPY --from=builder /workspace/${SERVICE_DIR}/.venv ./.venv
COPY --from=builder /workspace/${SERVICE_DIR}/app ./app
COPY --from=builder /workspace/${SERVICE_DIR}/artifacts ./artifacts

EXPOSE 9000

HEALTHCHECK \
    --interval=30s \
    --timeout=3s \
    --start-period=5s \
    --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:9000/health', timeout=2)"

CMD [".venv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9000"]