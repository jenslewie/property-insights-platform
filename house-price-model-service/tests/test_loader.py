from pathlib import Path

import pytest

from app.model.loader import get_model_bundle


@pytest.fixture(autouse=True)
def clear_model_cache() -> None:
    get_model_bundle.cache_clear()


def test_get_model_bundle_reports_missing_model(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("MODEL_ARTIFACTS_DIR", str(tmp_path))

    with pytest.raises(FileNotFoundError, match="Model artifact not found"):
        get_model_bundle()


def test_get_model_bundle_reports_missing_metadata(
    trained_artifacts: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (trained_artifacts / "model_metadata.json").unlink()
    monkeypatch.setenv("MODEL_ARTIFACTS_DIR", str(trained_artifacts))

    with pytest.raises(FileNotFoundError, match="Model metadata not found"):
        get_model_bundle()


def test_get_model_bundle_loads_configured_artifacts(configured_artifacts: Path) -> None:
    bundle = get_model_bundle()

    assert bundle.metadata["model_type"] == "LinearRegression"
    assert bundle.metadata["training_samples"] == 10
    assert bundle.model.n_features_in_ == 7
