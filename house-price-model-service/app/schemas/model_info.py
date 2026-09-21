from pydantic import BaseModel, ConfigDict, Field


class MetricSummary(BaseModel):
    mean: float
    std: float


class PerformanceMetrics(BaseModel):
    r2: MetricSummary
    mae: MetricSummary
    rmse: MetricSummary


class EvaluationMethod(BaseModel):
    type: str
    n_splits: int
    n_repeats: int | None = None
    shuffle: bool | None = None
    random_state: int | None = None


class TrainingConfig(BaseModel):
    alpha: float | None = None
    max_iter: int | None = None
    scaler: str | None = None


class ModelInfoResponse(BaseModel):
    model_type: str
    model_version: str

    training_config: TrainingConfig = Field(alias="model_config")

    feature_names: list[str]

    intercept: float
    coefficients: dict[str, float]

    performance_metrics: PerformanceMetrics
    evaluation_method: EvaluationMethod

    training_samples: int
    trained_at: str

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "model_type": "Ridge",
                "model_version": "1.0.0",
                "model_config": {"alpha": 1.0, "scaler": "standard"},
                "feature_names": [
                    "square_footage",
                    "bedrooms",
                    "bathrooms",
                    "year_built",
                    "lot_size",
                    "distance_to_city_center",
                    "school_rating",
                ],
                "intercept": -299786.6105325343,
                "coefficients": {
                    "square_footage": -102.91639966468526,
                    "bedrooms": -8447.783942891525,
                    "bathrooms": 7436.933883438714,
                    "year_built": 112.38404466144576,
                    "lot_size": 39.29876441817834,
                    "distance_to_city_center": 16810.213682632897,
                    "school_rating": 21062.08340875214,
                },
                "performance_metrics": {
                    "r2": {"mean": 0.9693933993479346, "std": 0.06606456287395827},
                    "mae": {"mean": 7496.85654161174, "std": 1971.034619217675},
                    "rmse": {"mean": 10517.38293102776, "std": 3737.1815814746037},
                },
                "evaluation_method": {
                    "type": "RepeatedKFold",
                    "n_splits": 5,
                    "n_repeats": 10,
                    "random_state": 42,
                },
                "training_samples": 50,
                "trained_at": "2026-09-20T16:36:58.253679+00:00",
            }
        }
    )
