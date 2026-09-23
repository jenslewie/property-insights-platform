import asyncio

from fastapi.testclient import TestClient
import httpx
import pytest

from app.clients.house_price_client import HousePriceClient
from app.dependencies import get_estimate_service
from app.main import app
from app.schemas.estimate import BatchEstimateResponse, EstimateRequest, EstimateResponse
from app.services.estimate_service import EstimateService


PROPERTY = {
    "square_footage": 1550,
    "bedrooms": 3,
    "bathrooms": 2.0,
    "year_built": 1997,
    "lot_size": 6800,
    "distance_to_city_center": 4.1,
    "school_rating": 7.6,
}

SECOND_PROPERTY = {
    "square_footage": 2200,
    "bedrooms": 4,
    "bathrooms": 2.5,
    "year_built": 2008,
    "lot_size": 9600,
    "distance_to_city_center": 7.0,
    "school_rating": 8.8,
}


class StubEstimateService:
    async def estimate(self, properties: EstimateRequest) -> EstimateResponse:
        assert not isinstance(properties, list)
        return EstimateResponse(property=properties, predicted_price=250_879.73)


def override_estimate_service() -> StubEstimateService:
    return StubEstimateService()


class StubBatchEstimateService:
    async def estimate(self, properties: EstimateRequest) -> BatchEstimateResponse:
        assert isinstance(properties, list)
        prices = [250_879.73, 364_551.64]
        estimates = [
            EstimateResponse(property=property_features, predicted_price=price)
            for property_features, price in zip(properties, prices, strict=True)
        ]
        return BatchEstimateResponse(count=len(estimates), estimates=estimates)


def override_with_batch_service() -> StubBatchEstimateService:
    return StubBatchEstimateService()


def test_estimate_action_is_exposed_at_versioned_singular_path() -> None:
    app.dependency_overrides[get_estimate_service] = override_estimate_service

    try:
        with TestClient(app) as client:
            response = client.post("/api/v1/properties/estimate", json=PROPERTY)
            legacy_response = client.post("/api/v1/estimates", json=PROPERTY)
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {
        "property": PROPERTY,
        "predicted_price": 250_879.73,
    }
    assert legacy_response.status_code == 404


def test_estimate_accepts_property_batch() -> None:
    app.dependency_overrides[get_estimate_service] = override_with_batch_service

    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/properties/estimate",
                json=[PROPERTY, SECOND_PROPERTY],
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {
        "count": 2,
        "estimates": [
            {
                "property": PROPERTY,
                "predicted_price": 250_879.73,
            },
            {
                "property": SECOND_PROPERTY,
                "predicted_price": 364_551.64,
            },
        ],
    }


def test_estimate_rejects_invalid_property() -> None:
    app.dependency_overrides[get_estimate_service] = override_estimate_service

    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/properties/estimate",
                json={**PROPERTY, "square_footage": 0},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
    assert response.json()["detail"][0]["type"] == "greater_than"
    assert response.json()["detail"][0]["loc"] == ["body", "PropertyFeatures", "square_footage"]


def test_estimate_rejects_non_finite_request_number() -> None:
    app.dependency_overrides[get_estimate_service] = override_estimate_service

    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/properties/estimate",
                content=(
                    b'{"square_footage":1550,"bedrooms":3,"bathrooms":1e400,'
                    b'"year_built":1997,"lot_size":6800,'
                    b'"distance_to_city_center":4.1,"school_rating":7.6}'
                ),
                headers={"content-type": "application/json"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
    assert response.json()["detail"][0]["type"] == "finite_number"


def test_estimate_rejects_empty_batch() -> None:
    app.dependency_overrides[get_estimate_service] = override_with_batch_service

    try:
        with TestClient(app) as client:
            response = client.post("/api/v1/properties/estimate", json=[])
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
    assert response.json() == {
        "detail": [
            {
                "type": "too_short",
                "loc": ["body"],
                "msg": "Batch estimate requires at least one property.",
            }
        ]
    }


def test_estimate_rejects_batch_above_configured_limit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("BATCH_ESTIMATE_LIMIT", "2")
    app.dependency_overrides[get_estimate_service] = override_with_batch_service

    try:
        with TestClient(app) as client:
            response = client.post("/api/v1/properties/estimate", json=[PROPERTY] * 3)
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
    assert response.json() == {
        "detail": [
            {
                "type": "too_long",
                "loc": ["body"],
                "msg": "Batch estimate supports at most 2 properties.",
            }
        ]
    }


def test_estimate_maps_model_protocol_error_to_service_unavailable() -> None:
    async def handle_request(request: httpx.Request) -> httpx.Response:
        raise httpx.RemoteProtocolError("peer disconnected", request=request)

    http_client = httpx.AsyncClient(
        base_url="http://model-service",
        transport=httpx.MockTransport(handle_request),
    )
    estimate_service = EstimateService(HousePriceClient(http_client))
    app.dependency_overrides[get_estimate_service] = lambda: estimate_service

    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            response = client.post("/api/v1/properties/estimate", json=PROPERTY)
    finally:
        app.dependency_overrides.clear()
        asyncio.run(http_client.aclose())

    assert response.status_code == 503
    assert response.json() == {
        "detail": "Housing price model service is unavailable.",
    }


def test_estimate_maps_non_finite_model_prediction_to_bad_gateway() -> None:
    async def handle_request(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            content=b'{"count":1,"predictions":[NaN]}',
            headers={"content-type": "application/json"},
        )

    http_client = httpx.AsyncClient(
        base_url="http://model-service",
        transport=httpx.MockTransport(handle_request),
    )
    estimate_service = EstimateService(HousePriceClient(http_client))
    app.dependency_overrides[get_estimate_service] = lambda: estimate_service

    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            response = client.post("/api/v1/properties/estimate", json=PROPERTY)
    finally:
        app.dependency_overrides.clear()
        asyncio.run(http_client.aclose())

    assert response.status_code == 502
    assert response.json() == {
        "detail": "Housing price model service returned an invalid response.",
    }


def test_openapi_documents_estimate_operation_and_request_examples() -> None:
    operation = app.openapi()["paths"]["/api/v1/properties/estimate"]["post"]

    assert operation["summary"] == "Estimate property prices"
    assert operation["description"] == (
        "Accepts one property or a batch of properties and returns estimated prices. "
        "Batch requests use the configured estimate limit, which defaults to 20 properties."
    )
    assert operation["responses"]["200"]["description"] == (
        "Estimated property prices in request order."
    )
    request_media_type = operation["requestBody"]["content"]["application/json"]
    assert request_media_type["examples"] == {
        "single_property": {
            "summary": "Single property",
            "value": PROPERTY,
        },
        "property_batch": {
            "summary": "Property batch",
            "value": [PROPERTY, SECOND_PROPERTY],
        },
    }


def test_openapi_documents_estimate_response_examples() -> None:
    schemas = app.openapi()["components"]["schemas"]

    assert schemas["EstimateResponse"]["example"] == {
        "property": PROPERTY,
        "predicted_price": 250_879.73,
    }
    assert schemas["BatchEstimateResponse"]["example"] == {
        "count": 2,
        "estimates": [
            {
                "property": PROPERTY,
                "predicted_price": 250_879.73,
            },
            {
                "property": SECOND_PROPERTY,
                "predicted_price": 364_551.64,
            },
        ],
    }


def test_openapi_describes_property_and_estimate_response_fields() -> None:
    schemas = app.openapi()["components"]["schemas"]

    assert schemas["PropertyFeatures"]["properties"]["school_rating"]["description"] == (
        "School rating on the scale used by the training data."
    )
    assert {
        field_name: field_schema["description"]
        for field_name, field_schema in schemas["EstimateResponse"]["properties"].items()
    } == {
        "property": "Property features supplied in the request.",
        "predicted_price": "Price predicted by the house price model service.",
    }
    assert {
        field_name: field_schema["description"]
        for field_name, field_schema in schemas["BatchEstimateResponse"]["properties"].items()
    } == {
        "count": "Number of property estimates returned.",
        "estimates": "Property estimates in the same order as the request.",
    }


def test_openapi_describes_estimate_error_fields() -> None:
    schemas = app.openapi()["components"]["schemas"]

    assert schemas["ErrorResponse"]["properties"]["detail"]["description"] == (
        "Human-readable error detail."
    )
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


def test_openapi_documents_model_service_error_responses() -> None:
    responses = app.openapi()["paths"]["/api/v1/properties/estimate"]["post"]["responses"]

    assert responses["502"]["content"]["application/json"] == {
        "schema": {"$ref": "#/components/schemas/ErrorResponse"},
        "examples": {
            "invalid_response": {
                "summary": "Invalid model service response",
                "value": {"detail": "Housing price model service returned an invalid response."},
            }
        },
    }
    assert responses["503"]["content"]["application/json"] == {
        "schema": {"$ref": "#/components/schemas/ErrorResponse"},
        "examples": {
            "service_unavailable": {
                "summary": "Model service unavailable",
                "value": {"detail": "Housing price model service is unavailable."},
            }
        },
    }


def test_openapi_documents_estimate_validation_examples() -> None:
    openapi_schema = app.openapi()
    validation_response = openapi_schema["paths"]["/api/v1/properties/estimate"]["post"][
        "responses"
    ]["422"]
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
                        "msg": "Batch estimate requires at least one property.",
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
                        "msg": "Batch estimate supports at most 20 properties.",
                    }
                ]
            },
        },
    }
