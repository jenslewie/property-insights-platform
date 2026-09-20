import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, r2_score, root_mean_squared_error
from sklearn.model_selection import KFold, cross_val_predict

from app.model.features import FEATURE_NAMES, TARGET_NAME


REPO_ROOT = Path(__file__).resolve().parents[2]
SERVICE_ROOT = Path(__file__).resolve().parents[1]

DEFAULT_DATA_PATH = REPO_ROOT / "data" / "house-price-dataset.csv"
DEFAULT_ARTIFACTS_DIR = SERVICE_ROOT / "artifacts"


def validate_dataset(dataframe: pd.DataFrame) -> None:
    if dataframe.empty:
        raise ValueError("Dataset must not be empty.")

    required_columns = set(FEATURE_NAMES) | {TARGET_NAME}

    missing_columns = sorted(required_columns - set(dataframe.columns))

    if missing_columns:
        raise ValueError(f"Dataset is missing required columns: {missing_columns}")


def train_model(
    data_path: Path = DEFAULT_DATA_PATH,
    artifacts_dir: Path = DEFAULT_ARTIFACTS_DIR,
) -> dict[str, Any]:
    dataframe = pd.read_csv(data_path)

    validate_dataset(dataframe)

    X = dataframe[list(FEATURE_NAMES)]
    y = dataframe[TARGET_NAME]

    cv = KFold(n_splits=5, shuffle=True, random_state=42)

    evaluation_model = LinearRegression()

    out_of_fold_predictions = cross_val_predict(evaluation_model, X, y, cv=cv)

    metrics = {
        "r2": float(r2_score(y, out_of_fold_predictions)),
        "mae": float(mean_absolute_error(y, out_of_fold_predictions)),
        "rmse": float(root_mean_squared_error(y, out_of_fold_predictions)),
    }

    model = LinearRegression()
    model.fit(X, y)

    coefficients = {
        feature_name: float(coefficient)
        for feature_name, coefficient in zip(FEATURE_NAMES, model.coef_, strict=True)
    }

    metadata = {
        "model_type": type(model).__name__,
        "model_version": "1.0",
        "feature_names": list(FEATURE_NAMES),
        "intercept": float(model.intercept_),
        "coefficients": coefficients,
        "performance_metrics": metrics,
        "evaluation_method": "5-fold cross-validation",
        "training_samples": len(dataframe),
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }

    artifacts_dir.mkdir(parents=True, exist_ok=True)

    model_path = artifacts_dir / "model.joblib"
    metadata_path = artifacts_dir / "model_metadata.json"

    joblib.dump(model, model_path)

    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    return metadata


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train the house price regression model.")

    parser.add_argument("--data-path", type=Path, default=DEFAULT_DATA_PATH)

    parser.add_argument("--artifacts-dir", type=Path, default=DEFAULT_ARTIFACTS_DIR)

    return parser.parse_args()


def main() -> None:
    args = parse_arguments()

    metadata = train_model(data_path=args.data_path, artifacts_dir=args.artifacts_dir)

    print("Model training completed.")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
