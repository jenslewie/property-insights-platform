from pydantic import BaseModel, ConfigDict


class PerformanceMetrics(BaseModel):
    r2: float
    mae: float
    rmse: float


class ModelInfoResponse(BaseModel):
    model_type: str
    model_version: str
    feature_names: list[str]

    intercept: float
    coefficients: dict[str, float]

    performance_metrics: PerformanceMetrics
    evaluation_method: str

    training_samples: int
    trained_at: str

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "model_type": "LinearRegression",
                "model_version": "1.0",
                "feature_names": [
                    "square_footage",
                    "bedrooms",
                    "bathrooms",
                    "year_built",
                    "lot_size",
                    "distance_to_city_center",
                    "school_rating",
                ],
                "intercept": 12345.67,
                "coefficients": {
                    "square_footage": 100.23,
                    "bedrooms": 2500.12,
                    "bathrooms": 5000.34,
                    "year_built": 200.12,
                    "lot_size": 3.21,
                    "distance_to_city_center": -2100.32,
                    "school_rating": 8500.45,
                },
                "performance_metrics": {"r2": 0.98, "mae": 6000.2, "rmse": 8000.4},
                "evaluation_method": "5-fold cross-validation",
                "training_samples": 50,
                "trained_at": "2026-09-20T03:11:38.322937+00:00",
            }
        }
    )
