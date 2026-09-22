from pydantic import BaseModel, ConfigDict, Field


class MetricSummary(BaseModel):
    mean: float = Field(description="Mean metric value across validation folds.")
    std: float = Field(description="Population standard deviation across validation folds.")


class PerformanceMetrics(BaseModel):
    r2: MetricSummary = Field(description="Coefficient of determination summary.")
    mae: MetricSummary = Field(description="Mean absolute error summary.")
    rmse: MetricSummary = Field(description="Root mean squared error summary.")


class EvaluationMethod(BaseModel):
    type: str = Field(description="Cross-validation strategy name.")
    n_splits: int = Field(description="Number of folds per cross-validation run.")
    n_repeats: int | None = Field(
        default=None,
        description="Number of repeated cross-validation runs, when applicable.",
    )
    shuffle: bool | None = Field(
        default=None,
        description="Whether samples are shuffled before splitting, when applicable.",
    )
    random_state: int | None = Field(
        default=None,
        description="Random seed used by the cross-validation strategy, when applicable.",
    )


class TrainingConfig(BaseModel):
    alpha: float | None = Field(
        default=None,
        description="Regularization strength, when applicable.",
    )
    max_iter: int | None = Field(
        default=None,
        description="Maximum optimizer iterations, when applicable.",
    )
    scaler: str | None = Field(
        default=None,
        description="Feature scaler used by the model pipeline, when applicable.",
    )


class ModelInfoResponse(BaseModel):
    model_type: str = Field(description="Regression model type.")
    model_version: str = Field(description="Version of the trained model artifact.")

    training_config: TrainingConfig = Field(
        alias="model_config",
        description="Configuration used to train the model.",
    )

    feature_names: list[str] = Field(description="Input feature names in model order.")

    intercept: float = Field(description="Regression intercept in the original feature space.")
    coefficients: dict[str, float] = Field(
        description="Regression coefficient for each input feature."
    )

    performance_metrics: PerformanceMetrics = Field(
        description="Cross-validation performance metrics."
    )
    evaluation_method: EvaluationMethod = Field(
        description="Cross-validation strategy used for evaluation."
    )

    training_samples: int = Field(description="Number of rows used to train the final model.")
    trained_at: str = Field(description="UTC timestamp when the model artifact was trained.")

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
