# Property Insights Portal

## Overview

Next.js portal for property value estimates and the planned market analysis application. The
estimator supports single-property and batch requests; market analysis is currently a placeholder.
Property inputs must follow the units and school-rating scale represented in the model's training
data; the repository dataset does not document these explicitly.

## Dependencies

The portal's `/api/estimates` route forwards estimate requests to
`property-estimator-service` at `POST /api/v1/properties/estimate`. Docker Compose configures the
service URL and waits for the estimator to become healthy before starting the portal.

## Configuration

| Setting                      | Scope   | Compose value                            | Purpose                            |
| ---------------------------- | ------- | ---------------------------------------- | ---------------------------------- |
| `PROPERTY_ESTIMATOR_API_URL` | Runtime | `http://property-estimator-service:9001` | Base URL of the estimator service. |

## Docker

Run Docker Compose commands from the repository root. Start the portal and its declared
dependencies:

```bash
docker compose up --build property-insights-portal
```

The portal is available at <http://localhost:9000>. The estimator API's interactive documentation
is available at <http://localhost:9001/docs>.

If the estimator and model services are already running, start only the portal:

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
