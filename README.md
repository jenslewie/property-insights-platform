# Property Insights Platform

Monorepo for the Property Insights Platform.

## Services

- [House Price Model Service](house-price-model-service/README.md) — FastAPI service for
  training and serving house-price predictions.
- [Property Estimator Service](property-estimator-service/README.md) — FastAPI orchestration
  service for single-property and batch price estimates.
- [Property Insights Portal](property-insights-portal/README.md) — Next.js portal for property
  estimation and market analysis.

Build and start the current services from the repository root:

```bash
docker compose up --build
```
