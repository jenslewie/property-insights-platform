# House Price Model Service

## Overview

FastAPI service that trains and serves `LinearRegression`, `Ridge`, or `Lasso` models for property
price prediction through `POST /api/v1/properties/predict`. Docker builds train the selected model
and package its model artifact and metadata into the runtime image. Input features must use the units
and school-rating scale represented in the training data; the repository dataset does not document
these explicitly.

## Dependencies

The image build uses `data/house-price-dataset.csv` from the repository root. The model service has
no upstream service dependency; `property-estimator-service` calls it to produce estimates.

## Configuration

| Setting                  | Scope          | Compose value    | Purpose                                                                                                 |
| ------------------------ | -------------- | ---------------- | ------------------------------------------------------------------------------------------------------- |
| `MODEL_TYPE`             | Build argument | `ridge`          | Model trained into the image: `linear-regression`, `ridge`, or `lasso`.                                 |
| `MODEL_ALPHA`            | Build argument | Empty            | Optional regularization strength for Ridge or Lasso. Defaults are `0.1` for Ridge and `33.0` for Lasso. |
| `EVALUATION_METHOD`      | Build argument | `repeated-kfold` | Cross-validation strategy used during training.                                                         |
| `BATCH_PREDICTION_LIMIT` | Runtime        | `20`             | Maximum number of properties accepted in one batch.                                                     |

`BATCH_PREDICTION_LIMIT` must be a positive integer. Model and evaluation settings are applied when
the image is built; the prediction limit is applied when the container runs.

## Docker

Run Docker Compose commands from the repository root:

```bash
docker compose up --build house-price-model-service
```

The image trains from the repository dataset during the build and exposes the service on port
`9003`. Its interactive Swagger documentation is at <http://localhost:9003/docs>.

For example, build and run a Lasso model with custom training settings:

```bash
MODEL_TYPE=lasso MODEL_ALPHA=10 EVALUATION_METHOD=kfold \
  docker compose up --build house-price-model-service
```

Stop only the model service:

```bash
docker compose stop house-price-model-service
```

See the [root README](../README.md) for the full platform deployment command.

## Verification

Run from `house-price-model-service/`:

```bash
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
```
