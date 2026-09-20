import json
import math
from pathlib import Path

import joblib
import pandas as pd
import pytest

from app.model.features import FEATURE_NAMES
from training.train import train_model, validate_dataset


def test_validate_dataset_rejects_empty_dataframe() -> None:
    with pytest.raises(ValueError, match="Dataset must not be empty"):
        validate_dataset(pd.DataFrame())


def test_validate_dataset_reports_missing_required_columns(training_csv: Path) -> None:
    dataframe = pd.read_csv(training_csv).drop(columns=["price"])

    with pytest.raises(ValueError, match=r"Dataset is missing required columns: \['price'\]"):
        validate_dataset(dataframe)


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
    assert metadata["model_version"] == "1.0"
    assert metadata["feature_names"] == list(FEATURE_NAMES)
    assert metadata["training_samples"] == 8
    assert metadata["evaluation_method"] == "5-fold cross-validation"
    assert all(math.isfinite(value) for value in metadata["performance_metrics"].values())

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
