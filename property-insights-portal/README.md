# Property Insights Portal

## Overview

The Property Insights Portal is a Next.js web application for property valuation and market analysis.

It provides two main capabilities:

* **Property Estimator** — estimate single or multiple property values, visualize prediction results, review estimate history, and compare selected properties side by side.
* **Market Analysis** — explore property-market data through summary metrics, distributions, filtering and sorting, run market-level what-if scenarios using the prediction model, and export analysis results as CSV or PDF.

The portal acts as the presentation layer and communicates with the backend services through REST APIs. Property valuation is powered by the house-price prediction model, while market statistics, scenario analysis, and exports are provided by the Market Analysis service.


## Routes

| Portal route                                 | Purpose                                           |
| -------------------------------------------- | ------------------------------------------------- |
| `POST /api/market-analysis/price-impact`     | Validate and forward market filters and scenario. |
| `GET /api/market-analysis/export?format=csv` | Stream filtered source rows as CSV.               |
| `GET /api/market-analysis/export?format=pdf` | Stream the complete filtered market report.       |

The Java API routes used by the portal are:

| Java route                                             | Purpose                                           |
| ------------------------------------------------------ | ------------------------------------------------- |
| `GET /api/v1/properties`                               | Full, unfiltered source list for the local table. |
| `GET /api/v1/market/summary`                           | Filtered historical summary.                      |
| `GET /api/v1/market/distributions/{dimension}`         | Filtered historical distributions.                |
| `POST /api/v1/market/price-impact`                     | Model-predicted market-level comparison.          |
| `GET /api/v1/market/export?format=csv` or `format=pdf` | Filtered CSV or PDF attachment.                   |


## Configuration

| Setting                      | Local default           | Compose value                            | Purpose                          |
| ---------------------------- | ----------------------- | ---------------------------------------- | -------------------------------- |
| `PROPERTY_ESTIMATOR_API_URL` | `http://localhost:9001` | `http://property-estimator-service:9001` | Estimate API base URL.           |
| `MARKET_ANALYSIS_API_URL`    | `http://localhost:9002` | `http://market-analysis-service:9002`    | Server-side market API base URL. |

The portal reads `MARKET_ANALYSIS_API_URL` on the server. It does not expose the service URL to
browser code.

For local development, start the backend services and run from `property-insights-portal/`:

```bash
npm run dev
```

## Docker Compose

From the repository root, start the portal and its healthy service dependencies:

```bash
docker compose up --build property-insights-portal
```

The portal is available at <http://localhost:9000>. Stop only the portal with
`docker compose stop property-insights-portal`.

## Verification

Run from `property-insights-portal/`:

```bash
npm test
npm run lint
npm run format:check
npm run build
```
