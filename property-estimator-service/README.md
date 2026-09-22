# Property Estimator Service

FastAPI orchestration service that accepts property details, calls the House Price Model Service,
and returns each property together with its estimated price. Both single-property and batch
requests use the same `POST /api/v1/estimate` action.

## Service layout

```text
property-estimator-service/
├── app/
│   ├── api/          # FastAPI routes and exception handlers
│   ├── clients/      # House Price Model Service client
│   ├── schemas/      # Request and response models
│   └── services/     # Estimate orchestration
├── tests/            # Configuration, client, service, and API tests
├── Dockerfile
└── pyproject.toml
```

## Requirements

- Python 3.13
- [uv](https://docs.astral.sh/uv/)
- A running House Price Model Service
- Docker, when building or running the container image

## Local development

Run local Python commands from the service directory:

```bash
cd property-estimator-service
uv sync --frozen
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 9001
```

By default, the service calls the model service at <http://localhost:9000>. Interactive API
documentation is available at <http://localhost:9001/docs>.

### Configuration

| Environment variable | Default | Description |
| --- | --- | --- |
| `HOUSE_PRICE_MODEL_URL` | `http://localhost:9000` | Base URL of the House Price Model Service. |
| `HOUSE_PRICE_MODEL_TIMEOUT_SECONDS` | `5` | Timeout for a model prediction request. |
| `BATCH_ESTIMATE_LIMIT` | `20` | Maximum number of properties accepted in one batch. |

`BATCH_ESTIMATE_LIMIT` must be a positive integer. Invalid values prevent application startup.

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Reports whether the estimator process is running. |
| `POST` | `/api/v1/estimate` | Estimates the price of one property or a batch of properties. |

### Health

```bash
curl --fail http://localhost:9001/health
```

```json
{
  "status": "UP"
}
```

### Estimate a property

```bash
curl --fail \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{
    "square_footage": 1550,
    "bedrooms": 3,
    "bathrooms": 2.0,
    "year_built": 1997,
    "lot_size": 6800,
    "distance_to_city_center": 4.1,
    "school_rating": 7.6
  }' \
  http://localhost:9001/api/v1/estimate
```

```json
{
  "property": {
    "square_footage": 1550,
    "bedrooms": 3,
    "bathrooms": 2.0,
    "year_built": 1997,
    "lot_size": 6800,
    "distance_to_city_center": 4.1,
    "school_rating": 7.6
  },
  "predicted_price": 250879.73
}
```

Send a batch by using a JSON array of property objects. The response contains `count` and an
`estimates` array in request order. The estimator forwards the array to
`POST /api/v1/predict` on the model service rather than issuing one request per property.

The request fields and validation bounds match the model service contract. The dataset and task do
not define measurement units or the school-rating scale, so callers must use the same units and
scale as the model training data.

### Error responses

| Status | Meaning |
| --- | --- |
| `422` | The property is invalid, the batch is empty, or the configured batch limit is exceeded. |
| `502` | The model service returned an error or an invalid/inconsistent response. |
| `503` | The model service could not be reached, timed out, or had a transport/protocol failure. |

Error responses use a JSON object with a human-readable `detail` field. A `502` response can look
like this:

```json
{
  "detail": "Housing price model service returned an invalid response."
}
```

A `503` response can look like this:

```json
{
  "detail": "Housing price model service is unavailable."
}
```

## Tests and linting

From `property-estimator-service/`:

```bash
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
```

## Docker

Run Docker commands from the repository root:

```bash
docker build \
  --file property-estimator-service/Dockerfile \
  --tag property-estimator-service:latest \
  .
```

For the complete local stack, build and start both services with:

```bash
docker compose up --build
```

The model service is exposed on port `9000` and the estimator on port `9001`. Compose configures
the estimator to call the model container and applies the same batch limit to both services. The
model image trains and packages its model artifact during the image build using the locked model
service dependencies.
