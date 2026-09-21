import json
import math
from pathlib import Path

import joblib
import pandas as pd
import pytest

from app.model.features import FEATURE_NAMES
from training.train import create_model, evaluate_model, train_model, validate_dataset


def test_validate_dataset_rejects_empty_dataframe() -> None:
    with pytest.raises(ValueError, match="Dataset must not be empty"):
        validate_dataset(pd.DataFrame())


def test_validate_dataset_reports_missing_required_columns(training_csv: Path) -> None:
    dataframe = pd.read_csv(training_csv).drop(columns=["price"])

    with pytest.raises(ValueError, match=r"Dataset is missing required columns: \['price'\]"):
        validate_dataset(dataframe)


def test_train_model_rejects_dataset_with_fewer_than_ten_rows(
    training_csv: Path, tmp_path: Path
) -> None:
    undersized_csv = tmp_path / "undersized.csv"
    pd.read_csv(training_csv).head(9).to_csv(undersized_csv, index=False)

    with pytest.raises(ValueError, match="Dataset must contain at least 10 rows"):
        train_model(data_path=undersized_csv, artifacts_dir=tmp_path / "output")


def test_evaluate_model_aggregates_cross_validation_scores(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cross_validation_results = {
        "test_r2": pd.Series([0.2, 0.6]),
        "test_mae": pd.Series([-2.0, -4.0]),
        "test_rmse": pd.Series([-3.0, -7.0]),
    }
    monkeypatch.setattr(
        "training.train.cross_validate",
        lambda *_args, **_kwargs: cross_validation_results,
    )

    metrics = evaluate_model(
        model=object(),
        X=pd.DataFrame(),
        y=pd.Series(dtype=float),
        cv=object(),
    )

    assert metrics["r2"] == pytest.approx({"mean": 0.4, "std": 0.2})
    assert metrics["mae"] == pytest.approx({"mean": 3.0, "std": 1.0})
    assert metrics["rmse"] == pytest.approx({"mean": 5.0, "std": 2.0})


@pytest.mark.parametrize("model_type", ["lasso", "ridge"])
@pytest.mark.parametrize("alpha", [0.0, -1.0, float("nan"), float("inf")])
def test_create_model_rejects_non_positive_or_non_finite_alpha(
    model_type: str, alpha: float
) -> None:
    with pytest.raises(ValueError, match="Alpha must be a finite number greater than 0"):
        create_model(model_type, alpha)


def test_create_model_rejects_alpha_for_linear_regression() -> None:
    with pytest.raises(ValueError, match="Alpha is not supported for linear regression"):
        create_model("linear-regression", 0.1)


def test_create_model_rejects_unsupported_model_type() -> None:
    with pytest.raises(ValueError, match="Unsupported model type: random-forest"):
        create_model("random-forest")


def test_train_model_writes_usable_artifacts_and_complete_metadata(
    training_csv: Path, tmp_path: Path
) -> None:
    artifacts_dir = tmp_path / "output"

    metadata = train_model(data_path=training_csv, artifacts_dir=artifacts_dir)

    model_path = artifacts_dir / "model.joblib"
    metadata_path = artifacts_dir / "model_metadata.json"
    assert model_path.is_file()
    assert metadata_path.is_file()
    assert json.loads(metadata_path.read_text(encoding="utf-8")) == metadata

    assert metadata["model_type"] == "LinearRegression"
    assert metadata["model_version"] == "1.0.0"
    assert metadata["feature_names"] == list(FEATURE_NAMES)
    assert metadata["training_samples"] == 10
    assert metadata["evaluation_method"] == {
        "type": "RepeatedKFold",
        "n_splits": 5,
        "n_repeats": 10,
        "random_state": 42,
    }
    assert metadata["performance_metrics"].keys() == {"r2", "mae", "rmse"}
    for metric in metadata["performance_metrics"].values():
        assert metric.keys() == {"mean", "std"}
        assert math.isfinite(metric["mean"])
        assert math.isfinite(metric["std"])
        assert metric["std"] >= 0

    model = joblib.load(model_path)
    sample = pd.DataFrame(
        [
            {
                "square_footage": 1050,
                "bedrooms": 2,
                "bathrooms": 1.5,
                "year_built": 1905,
                "lot_size": 1250,
                "distance_to_city_center": 2.0,
                "school_rating": 1.5,
            }
        ],
        columns=list(FEATURE_NAMES),
    )
    assert float(model.predict(sample)[0]) == pytest.approx(211250.0)


def test_train_model_supports_kfold_evaluation(training_csv: Path, tmp_path: Path) -> None:
    metadata = train_model(
        data_path=training_csv,
        artifacts_dir=tmp_path / "output",
        evaluation_method="kfold",
    )

    assert metadata["evaluation_method"] == {
        "type": "KFold",
        "n_splits": 5,
        "shuffle": True,
        "random_state": 42,
    }


@pytest.mark.parametrize(
    ("model_type", "alpha", "expected_config"),
    [
        (
            "lasso",
            None,
            {
                "type": "Lasso",
                "alpha": 33.0,
                "max_iter": 10_000,
                "scaler": "StandardScaler",
            },
        ),
        (
            "lasso",
            2.5,
            {
                "type": "Lasso",
                "alpha": 2.5,
                "max_iter": 10_000,
                "scaler": "StandardScaler",
            },
        ),
        (
            "ridge",
            None,
            {"type": "Ridge", "alpha": 0.1, "scaler": "StandardScaler"},
        ),
        (
            "ridge",
            2.5,
            {"type": "Ridge", "alpha": 2.5, "scaler": "StandardScaler"},
        ),
    ],
)
def test_train_model_supports_regularized_models_and_reports_original_scale_parameters(
    training_csv: Path,
    tmp_path: Path,
    model_type: str,
    alpha: float | None,
    expected_config: dict[str, object],
) -> None:
    artifacts_dir = tmp_path / model_type

    metadata = train_model(
        data_path=training_csv,
        artifacts_dir=artifacts_dir,
        model_type=model_type,
        alpha=alpha,
        evaluation_method="kfold",
    )

    assert metadata["model_type"] == expected_config["type"]
    assert metadata["model_config"] == expected_config

    features = pd.read_csv(training_csv)[list(FEATURE_NAMES)]
    reported_predictions = features.dot(pd.Series(metadata["coefficients"])) + metadata["intercept"]
    model = joblib.load(artifacts_dir / "model.joblib")

    assert model.predict(features) == pytest.approx(reported_predictions.to_numpy())


def test_train_model_rejects_unsupported_evaluation_method(
    training_csv: Path, tmp_path: Path
) -> None:
    with pytest.raises(ValueError, match="Unsupported evaluation method: leave-one-out"):
        train_model(
            data_path=training_csv,
            artifacts_dir=tmp_path / "output",
            evaluation_method="leave-one-out",
        )
