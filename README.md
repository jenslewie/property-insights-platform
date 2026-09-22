# Property Insights Platform

Monorepo for the Property Insights Platform.

## Services

- [House Price Model Service](house-price-model-service/README.md) — FastAPI service for
  training and serving house-price predictions.
- [Property Estimator Service](property-estimator-service/README.md) — FastAPI orchestration
  service for single-property and batch price estimates.

A frontend and one additional backend service are planned as the platform is developed.

Build and start the current services from the repository root:

```bash
docker compose up --build
```
