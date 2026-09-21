# House Price Model Service

FastAPI service that trains and serves a scikit-learn `LinearRegression` model for house-price
prediction.

The service trains from the repository's housing dataset, stores the fitted model and its metadata
as local artifacts, and loads those artifacts when the API starts.

## Service layout

```text
house-price-model-service/
├── app/
│   ├── api/          # FastAPI routes
│   ├── model/        # Feature definitions, artifact loading, and prediction
│   └── schemas/      # Request and response models
├── artifacts/        # Generated model and metadata
├── tests/            # Training, loading, prediction, and API tests
├── training/         # Model training entry point
├── Dockerfile
└── pyproject.toml

../data/
├── house-price-dataset.csv
└── test-data-for-prediction.csv
```

## Requirements

- Python 3.13
- [uv](https://docs.astral.sh/uv/)
- Docker, when building or running the container image

## Local development

Run the local Python commands in this section from the service directory:

```bash
cd house-price-model-service
```

Install the locked application and development dependencies:

```bash
uv sync --frozen
```

### Train the model

Train with the default dataset at `../data/house-price-dataset.csv`:

```bash
uv run python -m training.train
```

The command evaluates the model using repeated five-fold cross-validation with ten repeats,
retrains it on the full dataset, and writes:

```text
artifacts/model.joblib
artifacts/model_metadata.json
```

The metadata contains the feature names, intercept, coefficients, R², MAE, RMSE, training sample
count, evaluation method, model version, and training timestamp.

Use different input and output locations when needed:

```bash
uv run python -m training.train \
  --data-path /path/to/training-data.csv \
  --artifacts-dir /path/to/artifacts \
  --evaluation-method kfold
```

Use `--evaluation-method repeated-kfold` for the default repeated strategy or `kfold` for a single
shuffled five-fold evaluation.

The training CSV must contain the seven input fields documented under
[Prediction input](#prediction-input) and a `price` target column. It must contain at least ten rows
so every test fold has at least two samples for R² evaluation.

### Run the API

Training must be completed before startup because the application loads the model during its
FastAPI lifespan:

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 9000
```

To load artifacts from another directory, set `MODEL_ARTIFACTS_DIR`:

```bash
MODEL_ARTIFACTS_DIR=/path/to/artifacts \
  uv run uvicorn app.main:app --host 0.0.0.0 --port 9000
```

Interactive API documentation is available at <http://localhost:9000/docs>.

### Configuration

| Environment variable | Default | Description |
| --- | --- | --- |
| `MODEL_ARTIFACTS_DIR` | `artifacts/` | Directory containing the trained model and metadata. |
| `BATCH_PREDICTION_LIMIT` | `20` | Maximum number of properties accepted in one batch request. |

`BATCH_PREDICTION_LIMIT` must be a positive integer. Invalid values prevent the application from
starting. For example, to use a limit of `50` locally:

```bash
BATCH_PREDICTION_LIMIT=50 \
  uv run uvicorn app.main:app --host 0.0.0.0 --port 9000
```

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Confirms that the model bundle can be loaded. |
| `GET` | `/model-info` | Returns model metadata, coefficients, and evaluation metrics. |
| `POST` | `/predict` | Predicts prices for one property or a batch of properties. |

### Health

```bash
curl --fail http://localhost:9000/health
```

```json
{
  "status": "ok",
  "model_loaded": true
}
```

### Model information

```bash
curl --fail http://localhost:9000/model-info
```

The response contains the model type and version, ordered feature names, intercept, coefficient per
feature, cross-validation metrics, evaluation method, training sample count, and training timestamp.

### Prediction input

| Field | Type | Validation |
| --- | --- | --- |
| `square_footage` | integer | Greater than `0` and at most `10,000` |
| `bedrooms` | integer | From `1` to `10` |
| `bathrooms` | number | Greater than `0` and at most `10` |
| `year_built` | integer | From `1900` to five years after the current year |
| `lot_size` | integer | Greater than `0` and at most `100,000` |
| `distance_to_city_center` | number | From `0` to `100` |
| `school_rating` | number | From `0` to `20` |

The supplied task and dataset do not define measurement units or the school rating scale. Inputs
must use the same units and scale as the training data. `year_built` may also represent the expected
completion year for a property that has not yet been completed.

Send one property:

```bash
curl --fail \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{
    "square_footage": 1550,
    "bedrooms": 3,
    "bathrooms": 2.0,
    "year_built": 1997,
    "lot_size": 6800,
    "distance_to_city_center": 4.1,
    "school_rating": 7.6
  }' \
  http://localhost:9000/predict
```

Send a batch by wrapping property objects in a JSON array:

```json
[
  {
    "square_footage": 1550,
    "bedrooms": 3,
    "bathrooms": 2.0,
    "year_built": 1997,
    "lot_size": 6800,
    "distance_to_city_center": 4.1,
    "school_rating": 7.6
  },
  {
    "square_footage": 2200,
    "bedrooms": 4,
    "bathrooms": 2.5,
    "year_built": 2008,
    "lot_size": 9600,
    "distance_to_city_center": 7.0,
    "school_rating": 8.8
  }
]
```

Successful responses contain `count` and `predictions`; every prediction is rounded to two decimal
places. A batch can contain at most `20` properties by default. An empty batch, an oversized batch,
or a property that violates the validation rules returns HTTP `422`.

## Tests and linting

From `house-price-model-service/`:

```bash
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
```

The test suite uses temporary datasets and artifacts; it does not overwrite the trained artifacts in
the service directory.

## Docker

Run Docker commands from the repository root because the image build needs both the service source
and `data/house-price-dataset.csv`.

Build the image:

```bash
docker build \
  --file house-price-model-service/Dockerfile \
  --tag house-price-model-service:latest \
  .
```

The builder stage installs locked production dependencies, trains the model from the repository
dataset, and copies the resulting artifacts into the runtime image. Development dependencies and
source training data are not copied into the runtime image.

Run the image:

```bash
docker run --rm \
  --publish 9000:9000 \
  --env BATCH_PREDICTION_LIMIT=20 \
  house-price-model-service:latest
```

The image exposes port `9000` and includes a health check against `/health`.
Change the environment variable passed to `docker run` to override the default batch limit.

Alternatively, build and start the service with Docker Compose:

```bash
docker compose build house-price-model-service
docker compose up house-price-model-service
```

Compose defaults the batch limit to `20`. Override it through the shell environment or a root
`.env` file, for example:

```bash
BATCH_PREDICTION_LIMIT=50 docker compose up house-price-model-service
```

Stop it with:

```bash
docker compose down
```
