# Market Analysis Service

## Overview

Spring Boot service that reads the property dataset to serve property records, filtered market
statistics, price impact comparisons, and CSV and PDF exports. The price impact endpoint compares
the model-predicted price for a property before and after feature changes. Property features must use
the units and school-rating scale represented in the model's training data; the repository dataset
does not document these explicitly.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/properties` | List all source property records. |
| `GET` | `/api/v1/properties/statistics/summary` | Return filtered market summary statistics. |
| `GET` | `/api/v1/properties/statistics/distributions/{dimension}` | Return a filtered distribution for one property dimension. |
| `POST` | `/api/v1/properties/price-impact` | Compare predicted prices for baseline and changed features. |
| `GET` | `/api/v1/properties/export?type=data&format=csv` | Download filtered property records as CSV. |
| `GET` | `/api/v1/properties/export?type=report&format=pdf` | Download the filtered market analysis report as PDF. |

The export endpoint currently accepts only the `data`/`csv` and `report`/`pdf` combinations. Both
exports accept the same market filter query parameters as the statistics endpoints.

## Dependencies

The image build uses `data/house-price-dataset.csv` from the repository root. Price impact
comparisons call `house-price-model-service` at `POST /api/v1/properties/predict`. Docker Compose
starts the model service and waits for its health check before starting market analysis.

## Configuration

| Setting                             | Scope   | Compose value                           | Purpose                                                   |
| ----------------------------------- | ------- | --------------------------------------- | --------------------------------------------------------- |
| `MARKET_DATASET_PATH`               | Runtime | `/app/data/house-price-dataset.csv`     | Path to the property dataset copied into the image.      |
| `HOUSE_PRICE_MODEL_URL`             | Runtime | `http://house-price-model-service:9003` | Base URL of the model service for price impact requests.  |
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
