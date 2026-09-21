import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from statistics import fmean, pstdev
from typing import Any

import joblib
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import KFold, RepeatedKFold, cross_validate

from app.model.features import FEATURE_NAMES, TARGET_NAME


REPO_ROOT = Path(__file__).resolve().parents[2]
SERVICE_ROOT = Path(__file__).resolve().parents[1]

DEFAULT_DATA_PATH = REPO_ROOT / "data" / "house-price-dataset.csv"
DEFAULT_ARTIFACTS_DIR = SERVICE_ROOT / "artifacts"

DEFAULT_EVALUATION_METHOD = "repeated-kfold"
MIN_TRAINING_ROWS = 10


def validate_dataset(dataframe: pd.DataFrame) -> None:
    if dataframe.empty:
        raise ValueError("Dataset must not be empty.")

    if len(dataframe) < MIN_TRAINING_ROWS:
        raise ValueError(
            f"Dataset must contain at least {MIN_TRAINING_ROWS} rows for "
            "5-fold cross-validation with R2 evaluation."
        )

    required_columns = set(FEATURE_NAMES) | {TARGET_NAME}

    missing_columns = sorted(required_columns - set(dataframe.columns))

    if missing_columns:
        raise ValueError(f"Dataset is missing required columns: {missing_columns}")


def create_cross_validator(evaluation_method: str) -> tuple[Any, dict[str, Any]]:
    if evaluation_method == "kfold":
        cv = KFold(n_splits=5, shuffle=True, random_state=42)
        config = {"type": "KFold", "n_splits": 5, "shuffle": True, "random_state": 42}
        return cv, config

    if evaluation_method == "repeated-kfold":
        cv = RepeatedKFold(n_splits=5, n_repeats=10, random_state=42)
        config = {"type": "RepeatedKFold", "n_splits": 5, "n_repeats": 10, "random_state": 42}
        return cv, config

    raise ValueError(f"Unsupported evaluation method: {evaluation_method}")


def evaluate_model(model: Any, X: pd.DataFrame, y: pd.Series, cv: Any) -> dict[str, Any]:
    results = cross_validate(
        model,
        X,
        y,
        cv=cv,
        scoring={
            "r2": "r2",
            "mae": "neg_mean_absolute_error",
            "rmse": "neg_root_mean_squared_error",
        },
    )

    r2_scores = results["test_r2"]
    mae_scores = -results["test_mae"]
    rmse_scores = -results["test_rmse"]

    return {
        "r2": {
            "mean": float(fmean(r2_scores)),
            "std": float(pstdev(r2_scores)),
        },
        "mae": {
            "mean": float(fmean(mae_scores)),
            "std": float(pstdev(mae_scores)),
        },
        "rmse": {
            "mean": float(fmean(rmse_scores)),
            "std": float(pstdev(rmse_scores)),
        },
    }


def train_model(
    data_path: Path = DEFAULT_DATA_PATH,
    artifacts_dir: Path = DEFAULT_ARTIFACTS_DIR,
    evaluation_method: str = DEFAULT_EVALUATION_METHOD,
) -> dict[str, Any]:
    dataframe = pd.read_csv(data_path)

    validate_dataset(dataframe)

    X = dataframe[list(FEATURE_NAMES)]
    y = dataframe[TARGET_NAME]

    cv, evaluation_config = create_cross_validator(evaluation_method)

    evaluation_model = LinearRegression()

    metrics = evaluate_model(evaluation_model, X, y, cv)

    model = LinearRegression()
    model.fit(X, y)

    coefficients = {
        feature_name: float(coefficient)
        for feature_name, coefficient in zip(FEATURE_NAMES, model.coef_, strict=True)
    }

    metadata = {
        "model_type": type(model).__name__,
        "model_version": "1.0.0",
        "feature_names": list(FEATURE_NAMES),
        "intercept": float(model.intercept_),
        "coefficients": coefficients,
        "performance_metrics": metrics,
        "evaluation_method": evaluation_config,
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

    parser.add_argument(
        "--evaluation-method",
        choices=["kfold", "repeated-kfold"],
        default=DEFAULT_EVALUATION_METHOD,
        help=f"Cross-validation strategy used for model evaluation. Default: {DEFAULT_EVALUATION_METHOD}",
    )

    return parser.parse_args()


def main() -> None:
    args = parse_arguments()

    metadata = train_model(
        data_path=args.data_path,
        artifacts_dir=args.artifacts_dir,
        evaluation_method=args.evaluation_method,
    )

    print("Model training completed.")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
