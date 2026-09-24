# Market Analysis Service

## Overview

Spring Boot service that loads the immutable property CSV at startup to provide property records,
historical market statistics, market-level what-if predictions, and CSV/PDF exports. Historical
statistics use source prices; what-if results are model predictions for every property in the
filtered segment. The dataset does not document feature units or the school-rating scale.

## Dependencies

The image build uses `data/house-price-dataset.csv` from the repository root. Market-level
what-if predictions call `house-price-model-service`. Docker Compose starts the model service and
waits for its health check before starting market analysis.

## Configuration

| Setting                             | Scope   | Compose value                           | Purpose                                                  |
| ----------------------------------- | ------- | --------------------------------------- | -------------------------------------------------------- |
| `MARKET_DATASET_PATH`               | Runtime | `/app/data/house-price-dataset.csv`     | Path to the property dataset copied into the image.      |
| `HOUSE_PRICE_MODEL_URL`             | Runtime | `http://house-price-model-service:9003` | Base URL of the model service for what-if predictions.   |
| `HOUSE_PRICE_MODEL_TIMEOUT_SECONDS` | Runtime | `5`                                     | Timeout for a model request, in seconds.                 |
| `MARKET_CACHE_MAXIMUM_SIZE`         | Runtime | `500`                                   | Maximum cached market summary and distribution entries.  |
| `BATCH_PREDICTION_LIMIT`            | Runtime | `20`                                    | Shared maximum model-input batch size for both services. |

`HOUSE_PRICE_MODEL_TIMEOUT_SECONDS` and `MARKET_CACHE_MAXIMUM_SIZE` must be positive integers.
`BATCH_PREDICTION_LIMIT` must be an integer of at least two. The dataset path and model URL must
not be blank.

## Docker

Run Docker Compose commands from the repository root. Start market analysis and its model
dependency:

```bash
docker compose up --build market-analysis-service
```

The service is available on port `9002`; its health endpoint is at
<http://localhost:9002/health>.

When the service is running, browse its interactive API documentation at
<http://localhost:9002/swagger-ui/index.html>. 

Stop only the market analysis container, leaving the model service running:

```bash
docker compose stop market-analysis-service
```

## Verification

Use JDK 21 and Maven. Run from `market-analysis-service/`:

```bash
mvn verify
```

To apply the Java formatter, run `mvn spotless:apply`. Spotless and Checkstyle checks run during
`mvn verify`.
