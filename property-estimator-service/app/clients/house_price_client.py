from typing import overload

import httpx
from pydantic import BaseModel, ConfigDict, ValidationError

from app.exceptions import ModelServiceResponseError, ModelServiceUnavailableError
from app.schemas.property import PropertyFeatures


class PredictionResponse(BaseModel):
    count: int
    predictions: list[float]

    model_config = ConfigDict(
        strict=True,
        allow_inf_nan=False,
        extra="forbid",
    )


class HousePriceClient:
    def __init__(self, http_client: httpx.AsyncClient) -> None:
        self._http_client = http_client

    @overload
    async def predict(
        self,
        properties: PropertyFeatures,
    ) -> float: ...

    @overload
    async def predict(
        self,
        properties: list[PropertyFeatures],
    ) -> list[float]: ...

    async def predict(
        self,
        properties: PropertyFeatures | list[PropertyFeatures],
    ) -> float | list[float]:
        is_batch = isinstance(properties, list)

        if is_batch:
            payload = [property_features.model_dump() for property_features in properties]
            expected_count = len(properties)
        else:
            payload = properties.model_dump()
            expected_count = 1

        try:
            response = await self._http_client.post(
                "/api/v1/predict",
                json=payload,
            )
        except httpx.TransportError as exc:
            raise ModelServiceUnavailableError(
                "Housing price model service is unavailable."
            ) from exc

        if response.status_code != httpx.codes.OK:
            raise ModelServiceResponseError(
                f"Housing price model service returned HTTP {response.status_code}."
            )

        try:
            prediction_response = PredictionResponse.model_validate(response.json())
        except (ValueError, ValidationError) as exc:
            raise ModelServiceResponseError(
                "Housing price model service returned an invalid response."
            ) from exc

        if (
            prediction_response.count != expected_count
            or len(prediction_response.predictions) != expected_count
        ):
            raise ModelServiceResponseError(
                "Housing price model service returned an unexpected prediction count."
            )

        if is_batch:
            return prediction_response.predictions

        return prediction_response.predictions[0]
