import argparse
import json
from datetime import datetime, timezone
from math import isfinite
from pathlib import Path
from statistics import fmean, pstdev
from typing import Any

import joblib
import pandas as pd
from sklearn.linear_model import Lasso, LinearRegression, Ridge
from sklearn.model_selection import KFold, RepeatedKFold, cross_validate
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.model.features import FEATURE_NAMES, TARGET_NAME


REPO_ROOT = Path(__file__).resolve().parents[2]
SERVICE_ROOT = Path(__file__).resolve().parents[1]

DEFAULT_DATA_PATH = REPO_ROOT / "data" / "house-price-dataset.csv"
DEFAULT_ARTIFACTS_DIR = SERVICE_ROOT / "artifacts"

DEFAULT_MODEL_TYPE = "linear-regression"
DEFAULT_EVALUATION_METHOD = "repeated-kfold"

DEFAULT_LASSO_ALPHA = 33.0
DEFAULT_RIDGE_ALPHA = 0.1

SUPPORTED_MODEL_TYPES = ("lasso", "linear-regression", "ridge")
SUPPORTED_EVALUATION_METHODS = ("kfold", "repeated-kfold")

MIN_TRAINING_ROWS = 10

SCORING = {
    "r2": "r2",
    "mae": "neg_mean_absolute_error",
    "rmse": "neg_root_mean_squared_error",
}


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


def create_model(model_type: str, alpha: float | None = None) -> tuple[Any, dict[str, Any]]:
    if model_type == "linear-regression":
        if alpha is not None:
            raise ValueError("Alpha is not supported for linear regression.")

        model = LinearRegression()
        config = {"type": "LinearRegression"}
        return model, config

    if model_type == "lasso":
        resolved_alpha = alpha if alpha is not None else DEFAULT_LASSO_ALPHA

        if not isfinite(resolved_alpha) or resolved_alpha <= 0:
            raise ValueError("Alpha must be a finite number greater than 0 for Lasso.")

        model = Pipeline(
            [
                ("scaler", StandardScaler()),
                ("regressor", Lasso(alpha=resolved_alpha, max_iter=10_000)),
            ]
        )
        config = {
            "type": "Lasso",
            "alpha": resolved_alpha,
            "max_iter": 10_000,
            "scaler": "StandardScaler",
        }
        return model, config

    if model_type == "ridge":
        resolved_alpha = alpha if alpha is not None else DEFAULT_RIDGE_ALPHA

        if not isfinite(resolved_alpha) or resolved_alpha <= 0:
            raise ValueError("Alpha must be a finite number greater than 0 for Ridge.")

        model = Pipeline(
            [
                ("scaler", StandardScaler()),
                ("regressor", Ridge(alpha=resolved_alpha)),
            ]
        )
        config = {"type": "Ridge", "alpha": resolved_alpha, "scaler": "StandardScaler"}
        return model, config

    raise ValueError(f"Unsupported model type: {model_type}")


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
    results = cross_validate(model, X, y, cv=cv, scoring=SCORING)

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


def extract_model_parameters(model: Any) -> tuple[float, dict[str, float]]:
    if isinstance(model, Pipeline):
        scaler = model.named_steps["scaler"]
        regressor = model.named_steps["regressor"]

        coefficients_array = regressor.coef_ / scaler.scale_

        intercept = float(
            regressor.intercept_ - (regressor.coef_ * scaler.mean_ / scaler.scale_).sum()
        )
    else:
        coefficients_array = model.coef_
        intercept = float(model.intercept_)

    coefficients = {
        feature_name: float(coefficient)
        for feature_name, coefficient in zip(FEATURE_NAMES, coefficients_array, strict=True)
    }

    return intercept, coefficients


def train_model(
    data_path: Path = DEFAULT_DATA_PATH,
    artifacts_dir: Path = DEFAULT_ARTIFACTS_DIR,
    model_type: str = DEFAULT_MODEL_TYPE,
    alpha: float | None = None,
    evaluation_method: str = DEFAULT_EVALUATION_METHOD,
) -> dict[str, Any]:
    dataframe = pd.read_csv(data_path)

    validate_dataset(dataframe)

    X = dataframe[list(FEATURE_NAMES)]
    y = dataframe[TARGET_NAME]

    model, model_config = create_model(model_type, alpha)
    cv, evaluation_config = create_cross_validator(evaluation_method)

    metrics = evaluate_model(model, X, y, cv)

    model.fit(X, y)

    intercept, coefficients = extract_model_parameters(model)

    metadata = {
        "model_type": model_config["type"],
        "model_version": "1.0.0",
        "model_config": model_config,
        "feature_names": list(FEATURE_NAMES),
        "intercept": intercept,
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
        "--model-type",
        choices=SUPPORTED_MODEL_TYPES,
        default=DEFAULT_MODEL_TYPE,
        help=f"Regression model used for training. Default: {DEFAULT_MODEL_TYPE}",
    )

    parser.add_argument(
        "--alpha",
        type=float,
        default=None,
        help="Regularization strength for Ridge or Lasso. Not supported for LinearRegression.",
    )

    parser.add_argument(
        "--evaluation-method",
        choices=SUPPORTED_EVALUATION_METHODS,
        default=DEFAULT_EVALUATION_METHOD,
        help=f"Cross-validation strategy used for model evaluation. Default: {DEFAULT_EVALUATION_METHOD}",
    )

    return parser.parse_args()


def main() -> None:
    args = parse_arguments()

    metadata = train_model(
        data_path=args.data_path,
        artifacts_dir=args.artifacts_dir,
        model_type=args.model_type,
        alpha=args.alpha,
        evaluation_method=args.evaluation_method,
    )

    print("Model training completed.")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
