# Property Insights Portal

## Overview

The Next.js portal supports property estimates and market-segment analysis. For Market Analysis,
the Java service is the authority for historical aggregates, model predictions, and export files.
The source is a static CSV sample without geographic or transaction-date fields; it does not
support location comparisons or time trends. The repository does not document all feature units
or the school-rating scale.

## Market Analysis

Open `/market-analysis` to filter the sample using inclusive `min_<field>` and `max_<field>`
bounds. The page reports historical sample-price mean, median, minimum, and maximum alongside
price and feature distributions. These statistics use the CSV `price` values.

The what-if form applies `school_rating_delta` and/or `square_footage_percent` to every property
in the filtered segment. It shows predicted baseline, scenario, and impact mean, median, minimum,
and maximum. These are model predictions and remain separate from historical dashboard values.
An empty segment disables scenario application. Filter and scenario controls edit drafts and
commit their conditions to the URL when applied. The URL supports direct links and browser
back/forward restoration; chart dimension is stored separately. Table search, sorting, and
pagination are local display controls and do not change the applied segment.

The portal sends a JSON body like this to its same-origin price-impact handler:

```json
{
  "filters": { "min_bedrooms": 3 },
  "scenario": {
    "adjustments": {
      "school_rating_delta": 1,
      "square_footage_percent": 5
    }
  }
}
```

### Routes

| Portal route                                 | Purpose                                           |
| -------------------------------------------- | ------------------------------------------------- |
| `POST /api/market-analysis/price-impact`     | Validate and forward market filters and scenario. |
| `GET /api/market-analysis/export?format=csv` | Stream filtered source rows as CSV.               |
| `GET /api/market-analysis/export?format=pdf` | Stream the complete filtered market report.       |

The Java API routes used by the portal are:

| Java route                                     | Purpose                                           |
| ---------------------------------------------- | ------------------------------------------------- |
| `GET /api/v1/properties`                       | Full, unfiltered source list for the local table. |
| `GET /api/v1/market/summary`                   | Filtered historical summary.                      |
| `GET /api/v1/market/distributions/{dimension}` | Filtered historical distributions.                |
| `POST /api/v1/market/price-impact`             | Model-predicted market-level comparison.          |
| `GET /api/v1/market/export?format=csv          | pdf`                                              | Filtered CSV or PDF attachment. |

Both exports send the applied filters and optional scenario. The Java service derives an
`analysisKey` from the complete SHA-256 condition fingerprint and uses its first 8 hex characters
in the filename; the portal preserves that filename. CSV contains the filtered source rows with
no synthetic scenario columns. PDF contains historical aggregates and all filtered rows, plus
scenario assumptions and predicted metrics when a scenario is applied. Equivalent conditions use
the same analysis key across CSV and PDF. The key associates conditions and is not an immutable
model-output snapshot; an 8-character key can theoretically collide.

## Configuration

| Setting                      | Local default           | Compose value                            | Purpose                          |
| ---------------------------- | ----------------------- | ---------------------------------------- | -------------------------------- |
| `PROPERTY_ESTIMATOR_API_URL` | `http://localhost:9001` | `http://property-estimator-service:9001` | Estimate API base URL.           |
| `MARKET_ANALYSIS_API_URL`    | `http://localhost:9002` | `http://market-analysis-service:9002`    | Server-side market API base URL. |

The portal reads `MARKET_ANALYSIS_API_URL` on the server. It does not expose the service URL to
browser code.

For local development, start the Java services and run from `property-insights-portal/`:

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

Check the resolved runtime configuration from the repository root with `docker compose config`.
