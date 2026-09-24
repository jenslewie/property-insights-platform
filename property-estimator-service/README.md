# Property Estimator Service

## Overview

FastAPI orchestration service that estimates one property's value or a batch of properties through
`POST /api/v1/properties/estimate`. It calls the House Price Model Service at
`POST /api/v1/properties/predict`. Inputs must use the units and school-rating scale represented in
the model's training data; the repository dataset does not document these explicitly.

## Dependencies

The service requires `house-price-model-service` to produce estimates. Docker Compose starts the
model service and waits for its health check before starting the estimator.

## Configuration

| Setting                             | Scope   | Compose value                           | Purpose                                    |
| ----------------------------------- | ------- | --------------------------------------- | ------------------------------------------ |
| `HOUSE_PRICE_MODEL_URL`             | Runtime | `http://house-price-model-service:9003` | Base URL of the model service.             |
| `HOUSE_PRICE_MODEL_TIMEOUT_SECONDS` | Runtime | `5`                                     | Timeout for a model request, in seconds.   |
| `BATCH_ESTIMATE_LIMIT`              | Runtime | `20`                                    | Maximum number of properties in one batch. |

`BATCH_ESTIMATE_LIMIT` must be a positive integer. It can be overridden through the environment
used by Docker Compose.

## Docker

Run Docker Compose commands from the repository root. Start the estimator and its model dependency:

```bash
docker compose up --build property-estimator-service
```

The estimator is available on port `9001`; its interactive Swagger documentation is at
<http://localhost:9001/docs>.

Stop only the estimator container, leaving the model service running:

```bash
docker compose stop property-estimator-service
```

## Verification

Run from `property-estimator-service/`:

```bash
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
```
