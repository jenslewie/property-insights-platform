import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
from sklearn.linear_model import LinearRegression


SERVICE_ROOT = Path(__file__).resolve().parents[2]

DEFAULT_ARTIFACTS_DIR = SERVICE_ROOT / "artifacts"


@dataclass(frozen=True)
class ModelBundle:
    model: LinearRegression
    metadata: dict[str, Any]


@lru_cache(maxsize=1)
def get_model_bundle() -> ModelBundle:
    artifacts_dir = Path(os.getenv("MODEL_ARTIFACTS_DIR", str(DEFAULT_ARTIFACTS_DIR)))

    model_path = artifacts_dir / "model.joblib"
    metadata_path = artifacts_dir / "model_metadata.json"

    if not model_path.exists():
        raise FileNotFoundError(
            f"Model artifact not found: {model_path}. Run `uv run python -m training.train` first."
        )

    if not metadata_path.exists():
        raise FileNotFoundError(
            f"Model metadata not found: {metadata_path}. "
            "Run `uv run python -m training.train` first."
        )

    model = joblib.load(model_path)

    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))

    return ModelBundle(model=model, metadata=metadata)
