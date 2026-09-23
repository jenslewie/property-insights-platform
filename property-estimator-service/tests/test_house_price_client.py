import asyncio
import json
from collections.abc import Awaitable, Callable

import httpx
import pytest

from app.clients.house_price_client import HousePriceClient
from app.exceptions import ModelServiceResponseError, ModelServiceUnavailableError
from app.schemas.property import PropertyFeatures


PROPERTY = PropertyFeatures(
    square_footage=1550,
    bedrooms=3,
    bathrooms=2.0,
    year_built=1997,
    lot_size=6800,
    distance_to_city_center=4.1,
    school_rating=7.6,
)
SECOND_PROPERTY = PropertyFeatures(
    square_footage=2200,
    bedrooms=4,
    bathrooms=2.5,
    year_built=2008,
    lot_size=9600,
    distance_to_city_center=7.0,
    school_rating=8.8,
)

RequestHandler = Callable[[httpx.Request], Awaitable[httpx.Response]]


async def call_predict(
    properties: PropertyFeatures | list[PropertyFeatures],
    handler: RequestHandler,
) -> float | list[float]:
    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(
        base_url="http://model-service",
        transport=transport,
    ) as http_client:
        return await HousePriceClient(http_client).predict(properties)


def test_predict_sends_single_property_to_versioned_model_action() -> None:
    captured_request: httpx.Request | None = None

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal captured_request
        captured_request = request
        return httpx.Response(
            200,
            json={"count": 1, "predictions": [250_879.73]},
        )

    prediction = asyncio.run(call_predict(PROPERTY, handler))

    assert prediction == 250_879.73
    assert captured_request is not None
    assert captured_request.method == "POST"
    assert captured_request.url.path == "/api/v1/properties/predict"
    assert json.loads(captured_request.content) == PROPERTY.model_dump()


def test_predict_preserves_batch_payload_and_prediction_order() -> None:
    captured_request: httpx.Request | None = None

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal captured_request
        captured_request = request
        return httpx.Response(
            200,
            json={"count": 2, "predictions": [250_879.73, 364_551.64]},
        )

    prediction = asyncio.run(call_predict([PROPERTY, SECOND_PROPERTY], handler))

    assert prediction == [250_879.73, 364_551.64]
    assert captured_request is not None
    assert json.loads(captured_request.content) == [
        PROPERTY.model_dump(),
        SECOND_PROPERTY.model_dump(),
    ]


@pytest.mark.parametrize(
    "exception_type",
    [httpx.ReadTimeout, httpx.ConnectError, httpx.RemoteProtocolError],
)
def test_predict_maps_transport_errors_to_service_unavailable(
    exception_type: type[httpx.TransportError],
) -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        raise exception_type("transport failed", request=request)

    with pytest.raises(ModelServiceUnavailableError, match="unavailable"):
        asyncio.run(call_predict(PROPERTY, handler))


def test_predict_maps_http_error_to_bad_gateway() -> None:
    async def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, json={"detail": "model unavailable"})

    with pytest.raises(ModelServiceResponseError, match="HTTP 503"):
        asyncio.run(call_predict(PROPERTY, handler))


@pytest.mark.parametrize("status_code", [201, 302])
def test_predict_rejects_non_200_response(status_code: int) -> None:
    async def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status_code,
            json={"count": 1, "predictions": [250_879.73]},
        )

    with pytest.raises(ModelServiceResponseError, match=f"HTTP {status_code}"):
        asyncio.run(call_predict(PROPERTY, handler))


def test_predict_rejects_malformed_json() -> None:
    async def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"not-json")

    with pytest.raises(ModelServiceResponseError, match="invalid response"):
        asyncio.run(call_predict(PROPERTY, handler))


@pytest.mark.parametrize(
    "response_body",
    [
        {"count": "1", "predictions": [250_879.73]},
        {"count": 1, "predictions": ["250879.73"]},
        {"count": 1, "predictions": [True]},
    ],
)
def test_predict_rejects_response_type_coercion(response_body: dict[str, object]) -> None:
    async def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=response_body)

    with pytest.raises(ModelServiceResponseError, match="invalid response"):
        asyncio.run(call_predict(PROPERTY, handler))


def test_predict_rejects_unexpected_response_fields() -> None:
    async def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "count": 1,
                "predictions": [250_879.73],
                "unexpected": "field",
            },
        )

    with pytest.raises(ModelServiceResponseError, match="invalid response"):
        asyncio.run(call_predict(PROPERTY, handler))


@pytest.mark.parametrize(
    "response_body",
    [
        {"count": 2, "predictions": [250_879.73]},
        {"count": 1, "predictions": [250_879.73, 364_551.64]},
    ],
)
def test_predict_rejects_response_count_mismatch(
    response_body: dict[str, int | list[float]],
) -> None:
    async def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=response_body)

    with pytest.raises(ModelServiceResponseError, match="unexpected prediction count"):
        asyncio.run(call_predict(PROPERTY, handler))


@pytest.mark.parametrize("number_token", ["NaN", "Infinity", "-Infinity"])
def test_predict_rejects_non_finite_prediction(number_token: str) -> None:
    async def handler(_request: httpx.Request) -> httpx.Response:
        content = f'{{"count":1,"predictions":[{number_token}]}}'.encode()
        return httpx.Response(200, content=content)

    with pytest.raises(ModelServiceResponseError, match="invalid response"):
        asyncio.run(call_predict(PROPERTY, handler))
