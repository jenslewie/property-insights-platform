# Market Analysis Service

## Overview

Spring Boot service that reads the property dataset to serve property records, filtered market
summaries and distributions, and CSV and PDF exports. Its what-if endpoint compares model predictions
for a property before and after feature changes. Property features must use the units and
school-rating scale represented in the model's training data; the repository dataset does not
document these explicitly.

## Dependencies

The image build uses `data/house-price-dataset.csv` from the repository root. What-if comparisons
call `house-price-model-service` for predictions. Docker Compose starts the model service and waits
for its health check before starting market analysis.

## Configuration

| Setting                             | Scope   | Compose value                           | Purpose                                                   |
| ----------------------------------- | ------- | --------------------------------------- | --------------------------------------------------------- |
| `MARKET_DATASET_PATH`               | Runtime | `/app/data/house-price-dataset.csv`     | Path to the property dataset copied into the image.      |
| `HOUSE_PRICE_MODEL_URL`             | Runtime | `http://house-price-model-service:9003` | Base URL of the model service for what-if requests.       |
| `HOUSE_PRICE_MODEL_TIMEOUT_SECONDS` | Runtime | `5`                                     | Timeout for a model request, in seconds.                  |
| `MARKET_CACHE_MAXIMUM_SIZE`         | Runtime | `500`                                   | Maximum cached market summary and distribution entries.  |

`HOUSE_PRICE_MODEL_TIMEOUT_SECONDS` and `MARKET_CACHE_MAXIMUM_SIZE` must be positive integers.
The dataset path and model URL must not be blank.

## Docker

Run Docker Compose commands from the repository root. Start market analysis and its model
dependency:

```bash
docker compose up --build market-analysis-service
```

The service is available on port `9002`; its health endpoint is at
<http://localhost:9002/health>.

When the service is running, browse its interactive API documentation at
<http://localhost:9002/swagger-ui/index.html>. The generated OpenAPI JSON is available at
<http://localhost:9002/v3/api-docs>.

Stop only the market analysis container, leaving the model service running:

```bash
docker compose stop market-analysis-service
```

See the [root README](../README.md) for the full platform deployment command.

## Verification

Use JDK 21 and Maven. Run from `market-analysis-service/`:

```bash
mvn test
mvn spotless:check
mvn checkstyle:check
```

To apply the Java formatter, run `mvn spotless:apply`. Both checks also run during `mvn verify`.
