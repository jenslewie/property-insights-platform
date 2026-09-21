from collections.abc import Iterator
from pathlib import Path

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.model.loader import get_model_bundle
from training.train import train_model


TRAINING_RECORDS = (
    {
        "square_footage": 1000,
        "bedrooms": 1,
        "bathrooms": 1.0,
        "year_built": 1900,
        "lot_size": 1000,
        "distance_to_city_center": 0.0,
        "school_rating": 1.0,
        "price": 203000,
    },
    {
        "square_footage": 1100,
        "bedrooms": 1,
        "bathrooms": 1.0,
        "year_built": 1900,
        "lot_size": 1000,
        "distance_to_city_center": 0.0,
        "school_rating": 1.0,
        "price": 213000,
    },
    {
        "square_footage": 1000,
        "bedrooms": 2,
        "bathrooms": 1.0,
        "year_built": 1900,
        "lot_size": 1000,
        "distance_to_city_center": 0.0,
        "school_rating": 1.0,
        "price": 204000,
    },
    {
        "square_footage": 1000,
        "bedrooms": 1,
        "bathrooms": 1.75,
        "year_built": 1900,
        "lot_size": 1000,
        "distance_to_city_center": 0.0,
        "school_rating": 1.0,
        "price": 204500,
    },
    {
        "square_footage": 1000,
        "bedrooms": 1,
        "bathrooms": 1.0,
        "year_built": 1910,
        "lot_size": 1000,
        "distance_to_city_center": 0.0,
        "school_rating": 1.0,
        "price": 203500,
    },
    {
        "square_footage": 1000,
        "bedrooms": 1,
        "bathrooms": 1.0,
        "year_built": 1900,
        "lot_size": 2000,
        "distance_to_city_center": 0.0,
        "school_rating": 1.0,
        "price": 205000,
    },
    {
        "square_footage": 1000,
        "bedrooms": 1,
        "bathrooms": 1.0,
        "year_built": 1900,
        "lot_size": 1000,
        "distance_to_city_center": 1.0,
        "school_rating": 1.0,
        "price": 202500,
    },
    {
        "square_footage": 1000,
        "bedrooms": 1,
        "bathrooms": 1.0,
        "year_built": 1900,
        "lot_size": 1000,
        "distance_to_city_center": 0.0,
        "school_rating": 2.0,
        "price": 206000,
    },
    {
        "square_footage": 1200,
        "bedrooms": 3,
        "bathrooms": 2.0,
        "year_built": 1920,
        "lot_size": 2000,
        "distance_to_city_center": 3.0,
        "school_rating": 4.0,
        "price": 237500,
    },
    {
        "square_footage": 1300,
        "bedrooms": 2,
        "bathrooms": 2.5,
        "year_built": 1930,
        "lot_size": 2500,
        "distance_to_city_center": 4.0,
        "school_rating": 5.0,
        "price": 251500,
    },
)


@pytest.fixture
def training_csv(tmp_path: Path) -> Path:
    path = tmp_path / "training.csv"
    pd.DataFrame(TRAINING_RECORDS).to_csv(path, index=False)
    return path


@pytest.fixture
def trained_artifacts(training_csv: Path, tmp_path: Path) -> Path:
    artifacts_dir = tmp_path / "artifacts"
    train_model(data_path=training_csv, artifacts_dir=artifacts_dir)
    return artifacts_dir


@pytest.fixture
def configured_artifacts(
    trained_artifacts: Path, monkeypatch: pytest.MonkeyPatch
) -> Iterator[Path]:
    monkeypatch.setenv("MODEL_ARTIFACTS_DIR", str(trained_artifacts))
    get_model_bundle.cache_clear()

    yield trained_artifacts

    get_model_bundle.cache_clear()


@pytest.fixture
def client(configured_artifacts: Path) -> Iterator[TestClient]:
    del configured_artifacts

    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
