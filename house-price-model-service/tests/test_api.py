import math
from pathlib import Path

from fastapi.testclient import TestClient
import pytest

from app.main import app
from app.model.loader import get_model_bundle
from training.train import train_model


SINGLE_PROPERTY = {
    "square_footage": 1050,
    "bedrooms": 2,
    "bathrooms": 1.5,
    "year_built": 1905,
    "lot_size": 1250,
    "distance_to_city_center": 2.0,
    "school_rating": 1.5,
}

SECOND_PROPERTY = {
    "square_footage": 1200,
    "bedrooms": 3,
    "bathrooms": 2.0,
    "year_built": 1920,
    "lot_size": 2000,
    "distance_to_city_center": 3.0,
    "school_rating": 4.0,
}


def test_health_reports_loaded_model(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "UP"}


def test_app_rejects_invalid_batch_limit_at_startup(
    configured_artifacts: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    del configured_artifacts
    monkeypatch.setenv("BATCH_PREDICTION_LIMIT", "0")

    with pytest.raises(
        ValueError,
        match="BATCH_PREDICTION_LIMIT must be a positive integer",
    ):
        with TestClient(app):
            pass


def test_model_info_returns_training_metadata(client: TestClient) -> None:
    response = client.get("/api/v1/model-info")

    assert response.status_code == 200
    body = response.json()
    assert body["model_type"] == "LinearRegression"
    assert body["model_version"] == "1.0.0"
    assert body["model_config"] == {
        "alpha": None,
        "max_iter": None,
        "scaler": None,
    }
    assert body["training_samples"] == 10
    assert body["coefficients"] == pytest.approx(
        {
            "square_footage": 100.0,
            "bedrooms": 1000.0,
            "bathrooms": 2000.0,
            "year_built": 50.0,
            "lot_size": 2.0,
            "distance_to_city_center": -500.0,
            "school_rating": 3000.0,
        }
    )
    assert body["evaluation_method"] == {
        "type": "RepeatedKFold",
        "n_splits": 5,
        "n_repeats": 10,
        "shuffle": None,
        "random_state": 42,
    }
    assert body["performance_metrics"].keys() == {"r2", "mae", "rmse"}
    assert all(
        math.isfinite(summary[value_name])
        for summary in body["performance_metrics"].values()
        for value_name in ("mean", "std")
    )


def test_api_loads_and_serves_regularized_model_pipeline(
    training_csv: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    artifacts_dir = tmp_path / "ridge-artifacts"
    train_model(
        data_path=training_csv,
        artifacts_dir=artifacts_dir,
        model_type="ridge",
        alpha=2.5,
        evaluation_method="kfold",
    )
    monkeypatch.setenv("MODEL_ARTIFACTS_DIR", str(artifacts_dir))
    get_model_bundle.cache_clear()

    try:
        with TestClient(app, raise_server_exceptions=False) as ridge_client:
            model_info_response = ridge_client.get("/api/v1/model-info")
            prediction_response = ridge_client.post("/api/v1/predict", json=SINGLE_PROPERTY)
    finally:
        get_model_bundle.cache_clear()

    assert model_info_response.status_code == 200
    model_info = model_info_response.json()
    assert model_info["model_type"] == "Ridge"
    assert model_info["model_config"] == {
        "alpha": 2.5,
        "max_iter": None,
        "scaler": "StandardScaler",
    }
    assert prediction_response.status_code == 200
    assert prediction_response.json()["count"] == 1
    assert math.isfinite(prediction_response.json()["predictions"][0])


def test_openapi_provides_explicit_endpoint_documentation() -> None:
    schema = app.openapi()
    operations = {
        ("/health", "get"): "Check service health",
        ("/api/v1/model-info", "get"): "Get model information",
        ("/api/v1/predict", "post"): "Predict house prices",
    }

    for (path, method), summary in operations.items():
        operation = schema["paths"][path][method]
        assert operation["summary"] == summary
        assert operation["description"]
        assert operation["responses"]["200"]["description"] != "Successful Response"

    model_info_operation = schema["paths"]["/api/v1/model-info"]["get"]
    assert model_info_operation["description"] == (
        "Returns the loaded model's metadata, feature names, coefficients, and performance metrics."
    )


def test_openapi_provides_response_examples_for_every_endpoint() -> None:
    schemas = app.openapi()["components"]["schemas"]

    assert schemas["HealthResponse"]["example"] == {"status": "UP"}
    assert schemas["ModelInfoResponse"]["example"]
    assert schemas["PredictionResponse"]["example"] == {
        "count": 2,
        "predictions": [250879.73, 364551.64],
    }


def test_openapi_describes_health_and_prediction_response_fields() -> None:
    schemas = app.openapi()["components"]["schemas"]

    assert schemas["HealthResponse"]["properties"]["status"]["description"] == (
        "Current service health status."
    )
    assert {
        field_name: field_schema["description"]
        for field_name, field_schema in schemas["PredictionResponse"]["properties"].items()
    } == {
        "count": "Number of predicted prices returned.",
        "predictions": "Predicted prices in the same order as the request properties.",
    }


def test_openapi_describes_model_information_fields() -> None:
    schemas = app.openapi()["components"]["schemas"]

    assert {
        field_name: field_schema["description"]
        for field_name, field_schema in schemas["ModelInfoResponse"]["properties"].items()
    } == {
        "model_type": "Regression model type.",
        "model_version": "Version of the trained model artifact.",
        "model_config": "Configuration used to train the model.",
        "feature_names": "Input feature names in model order.",
        "intercept": "Regression intercept in the original feature space.",
        "coefficients": "Regression coefficient for each input feature.",
        "performance_metrics": "Cross-validation performance metrics.",
        "evaluation_method": "Cross-validation strategy used for evaluation.",
        "training_samples": "Number of rows used to train the final model.",
        "trained_at": "UTC timestamp when the model artifact was trained.",
    }
    assert {
        field_name: field_schema["description"]
        for field_name, field_schema in schemas["MetricSummary"]["properties"].items()
    } == {
        "mean": "Mean metric value across validation folds.",
        "std": "Population standard deviation across validation folds.",
    }
    assert {
        field_name: field_schema["description"]
        for field_name, field_schema in schemas["PerformanceMetrics"]["properties"].items()
    } == {
        "r2": "Coefficient of determination summary.",
        "mae": "Mean absolute error summary.",
        "rmse": "Root mean squared error summary.",
    }
    assert {
        field_name: field_schema["description"]
        for field_name, field_schema in schemas["EvaluationMethod"]["properties"].items()
    } == {
        "type": "Cross-validation strategy name.",
        "n_splits": "Number of folds per cross-validation run.",
        "n_repeats": "Number of repeated cross-validation runs, when applicable.",
        "shuffle": "Whether samples are shuffled before splitting, when applicable.",
        "random_state": "Random seed used by the cross-validation strategy, when applicable.",
    }
    assert {
        field_name: field_schema["description"]
        for field_name, field_schema in schemas["TrainingConfig"]["properties"].items()
    } == {
        "alpha": "Regularization strength, when applicable.",
        "max_iter": "Maximum optimizer iterations, when applicable.",
        "scaler": "Feature scaler used by the model pipeline, when applicable.",
    }


def test_openapi_describes_validation_error_fields() -> None:
    schemas = app.openapi()["components"]["schemas"]

    assert schemas["HTTPValidationError"]["properties"]["detail"]["description"] == (
        "Validation errors found in the request."
    )
    assert {
        field_name: field_schema["description"]
        for field_name, field_schema in schemas["ValidationError"]["properties"].items()
    } == {
        "loc": "Location of the invalid value in the request.",
        "msg": "Human-readable validation error message.",
        "type": "Machine-readable validation error type.",
        "input": "Invalid input value, when available.",
        "ctx": "Additional validation context, when available.",
    }


def test_openapi_documents_single_and_batch_prediction_requests() -> None:
    request_media_type = app.openapi()["paths"]["/api/v1/predict"]["post"]["requestBody"][
        "content"
    ]["application/json"]

    assert request_media_type["schema"]["title"] == "Payload"
    assert request_media_type["examples"] == {
        "single_property": {
            "summary": "Single property",
            "value": {
                "square_footage": 1550,
                "bedrooms": 3,
                "bathrooms": 2.0,
                "year_built": 1997,
                "lot_size": 6800,
                "distance_to_city_center": 4.1,
                "school_rating": 7.6,
            },
        },
        "property_batch": {
            "summary": "Property batch",
            "value": [
                {
                    "square_footage": 1550,
                    "bedrooms": 3,
                    "bathrooms": 2.0,
                    "year_built": 1997,
                    "lot_size": 6800,
                    "distance_to_city_center": 4.1,
                    "school_rating": 7.6,
                },
                {
                    "square_footage": 2200,
                    "bedrooms": 4,
                    "bathrooms": 2.5,
                    "year_built": 2008,
                    "lot_size": 9600,
                    "distance_to_city_center": 7.0,
                    "school_rating": 8.8,
                },
            ],
        },
    }


def test_openapi_describes_prediction_fields_without_assuming_units() -> None:
    properties = app.openapi()["components"]["schemas"]["HousingFeatures"]["properties"]

    assert {
        field_name: field_schema["description"] for field_name, field_schema in properties.items()
    } == {
        "square_footage": "Total interior floor area of the property.",
        "bedrooms": "Number of bedrooms.",
        "bathrooms": "Number of bathrooms; fractional values are accepted.",
        "year_built": (
            "Year the property was built or is expected to be completed. "
            "Maximum is the current UTC year plus five."
        ),
        "lot_size": "Total land area of the property.",
        "distance_to_city_center": "Distance from the property to the city center.",
        "school_rating": "School rating on the scale used by the training data.",
    }


def test_openapi_documents_prediction_validation_examples() -> None:
    openapi_schema = app.openapi()
    validation_response = openapi_schema["paths"]["/api/v1/predict"]["post"]["responses"]["422"]
    media_type = validation_response["content"]["application/json"]

    assert media_type["schema"] == {"$ref": "#/components/schemas/HTTPValidationError"}
    assert {"HTTPValidationError", "ValidationError"} <= openapi_schema["components"][
        "schemas"
    ].keys()
    assert media_type["examples"] == {
        "empty_batch": {
            "summary": "Empty batch",
            "value": {
                "detail": [
                    {
                        "type": "too_short",
                        "loc": ["body"],
                        "msg": "Batch prediction requires at least one property.",
                    }
                ]
            },
        },
        "batch_limit_exceeded": {
            "summary": "Default batch limit exceeded",
            "value": {
                "detail": [
                    {
                        "type": "too_long",
                        "loc": ["body"],
                        "msg": "Batch prediction supports at most 20 properties.",
                    }
                ]
            },
        },
    }


def test_predict_accepts_single_property(client: TestClient) -> None:
    response = client.post("/api/v1/predict", json=SINGLE_PROPERTY)

    assert response.status_code == 200
    assert response.json() == {"count": 1, "predictions": [211250.0]}


def test_predict_accepts_property_batch(client: TestClient) -> None:
    response = client.post("/api/v1/predict", json=[SINGLE_PROPERTY, SECOND_PROPERTY])

    assert response.status_code == 200
    assert response.json() == {"count": 2, "predictions": [211250.0, 237500.0]}


def test_predict_accepts_batch_at_default_limit(client: TestClient) -> None:
    response = client.post("/api/v1/predict", json=[SINGLE_PROPERTY] * 20)

    assert response.status_code == 200
    assert response.json()["count"] == 20
    assert len(response.json()["predictions"]) == 20


def test_predict_rejects_batch_above_default_limit(client: TestClient) -> None:
    response = client.post("/api/v1/predict", json=[SINGLE_PROPERTY] * 21)

    assert response.status_code == 422
    assert response.json() == {
        "detail": [
            {
                "type": "too_long",
                "loc": ["body"],
                "msg": "Batch prediction supports at most 20 properties.",
            }
        ]
    }


def test_predict_uses_configured_batch_limit(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("BATCH_PREDICTION_LIMIT", "2")

    response = client.post("/api/v1/predict", json=[SINGLE_PROPERTY] * 3)

    assert response.status_code == 422
    assert response.json() == {
        "detail": [
            {
                "type": "too_long",
                "loc": ["body"],
                "msg": "Batch prediction supports at most 2 properties.",
            }
        ]
    }


def test_predict_rejects_empty_batch(client: TestClient) -> None:
    response = client.post("/api/v1/predict", json=[])

    assert response.status_code == 422
    assert response.json() == {
        "detail": [
            {
                "type": "too_short",
                "loc": ["body"],
                "msg": "Batch prediction requires at least one property.",
            }
        ]
    }


def test_predict_rejects_invalid_property(client: TestClient) -> None:
    invalid_property = {**SINGLE_PROPERTY, "square_footage": 0}

    response = client.post("/api/v1/predict", json=invalid_property)

    assert response.status_code == 422
    assert any(
        error["loc"][-1] == "square_footage" and error["type"] == "greater_than"
        for error in response.json()["detail"]
    )


def test_predict_rejects_non_finite_number(client: TestClient) -> None:
    raw_payload = """{
        "square_footage": 1550,
        "bedrooms": 3,
        "bathrooms": 1e400,
        "year_built": 2020,
        "lot_size": 7000,
        "distance_to_city_center": 2.1,
        "school_rating": 8.0
    }"""

    response = client.post(
        "/api/v1/predict",
        content=raw_payload,
        headers={"content-type": "application/json"},
    )

    assert response.status_code == 422
    assert any(
        error["loc"][-1] == "bathrooms" and error["type"] == "finite_number"
        for error in response.json()["detail"]
    )


def test_unversioned_business_routes_are_not_registered(client: TestClient) -> None:
    assert client.get("/model-info").status_code == 404
    assert client.post("/predict", json=SINGLE_PROPERTY).status_code == 404
