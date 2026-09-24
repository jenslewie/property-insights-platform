# Property Insights Portal

## Overview

The Next.js portal supports single-property and batch value estimates, market segment
analysis, price-impact scenarios, and filtered CSV/PDF exports. The market analysis page
uses the Java `market-analysis-service` API for summary statistics and distributions;
the portal does not recalculate those aggregates from model predictions.

The market sample contains property features and historical sample prices, but no
geography or transaction dates. It cannot support location comparisons or time trends.
The repository does not document all feature units or the school-rating scale, so read
the values using the supplied dataset's conventions.

## Market analysis

Open `/market-analysis` to explore inclusive minimum/maximum filters for square footage,
bedrooms, bathrooms, year built, lot size, distance to city center, school rating, and
price. Active filters and the selected feature-distribution dimension are shareable in
the URL. The page shows historical sample-price mean, median, minimum, and maximum, plus
price and feature distributions with accessible bucket data.

The property table applies those same segment bounds locally. Its text search, numeric
sort, and pagination only change the visible table rows. Price-impact scenarios compare
a selected property's seven features with edited values; their prices are model
predictions, separate from the historical sample statistics. CSV and PDF exports use the
active segment bounds. Table search, sort, and pagination are not included in exports.

The portal's same-origin handlers are:

| Portal route                                             | Purpose                                               |
| -------------------------------------------------------- | ----------------------------------------------------- |
| `POST /api/market-analysis/price-impact`                 | Validates and forwards `{baseline, changes}` to Java. |
| `GET /api/market-analysis/export?type=data&format=csv`   | Streams filtered property CSV.                        |
| `GET /api/market-analysis/export?type=report&format=pdf` | Streams the filtered market report PDF.               |

The Java service endpoints used by the portal are:

| Java route                                                    | Purpose                                                           |
| ------------------------------------------------------------- | ----------------------------------------------------------------- |
| `GET /api/v1/properties`                                      | Full sample property list for the local table.                    |
| `GET /api/v1/properties/statistics/summary`                   | Filtered sample counts and historical price statistics.           |
| `GET /api/v1/properties/statistics/distributions/{dimension}` | Filtered price or feature buckets.                                |
| `POST /api/v1/properties/price-impact`                        | Predicted baseline and scenario prices for `{baseline, changes}`. |
| `GET /api/v1/properties/export?type=data&format=csv`          | Filtered CSV attachment.                                          |
| `GET /api/v1/properties/export?type=report&format=pdf`        | Filtered PDF report attachment.                                   |

The summary, distribution, and export routes accept the active numeric bounds as query
parameters. Supported feature dimensions are `square_footage`, `bedrooms`, `bathrooms`,
`year_built`, `lot_size`, `distance_to_city_center`, and `school_rating`.

## Configuration

| Setting                      | Local default           | Compose value                            | Purpose                                               |
| ---------------------------- | ----------------------- | ---------------------------------------- | ----------------------------------------------------- |
| `PROPERTY_ESTIMATOR_API_URL` | `http://localhost:9001` | `http://property-estimator-service:9001` | Base URL for estimate requests.                       |
| `MARKET_ANALYSIS_API_URL`    | `http://localhost:9002` | `http://market-analysis-service:9002`    | Base URL for market analysis, scenarios, and exports. |

For local development, start the Java services and run the portal from
`property-insights-portal/`:

```bash
npm run dev
```

The default market-analysis URL is `http://localhost:9002`. Set
`MARKET_ANALYSIS_API_URL` when the service uses a different address.

## Docker

Run Compose commands from the repository root. Starting the portal waits for the
estimator and market-analysis services to become healthy:

```bash
docker compose up --build property-insights-portal
```

The portal is available at <http://localhost:9000>. The estimator API documentation is
available at <http://localhost:9001/docs>; the market-analysis OpenAPI UI is at
<http://localhost:9002/swagger-ui/index.html>.

If the services are already running, start only the portal:

```bash
docker compose up -d --build --no-deps property-insights-portal
```

Stop only the portal container:

```bash
docker compose stop property-insights-portal
```

See the [root README](../README.md) for the full platform deployment command.

## Verification

Run from `property-insights-portal/`:

```bash
npm test
npm run lint
npm run format:check
npm run build
```

Validate the rendered Compose configuration from the repository root:

```bash
docker compose config
```
