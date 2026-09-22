from app.clients.house_price_client import HousePriceClient
from app.schemas.estimate import (
    BatchEstimateResponse,
    EstimateRequest,
    EstimateResponse,
    EstimateResult,
)
from app.schemas.property import PropertyFeatures


class EstimateService:
    def __init__(self, house_price_client: HousePriceClient) -> None:
        self._house_price_client = house_price_client

    async def estimate(self, properties: EstimateRequest) -> EstimateResult:
        if isinstance(properties, list):
            return await self._estimate_batch(properties)

        return await self._estimate_single(properties)

    async def _estimate_single(self, property_features: PropertyFeatures) -> EstimateResponse:
        predicted_price = await self._house_price_client.predict(property_features)

        return EstimateResponse(
            property=property_features,
            predicted_price=predicted_price,
        )

    async def _estimate_batch(self, properties: list[PropertyFeatures]) -> BatchEstimateResponse:
        predictions = await self._house_price_client.predict(properties)

        estimates = [
            EstimateResponse(
                property=property_features,
                predicted_price=predicted_price,
            )
            for property_features, predicted_price in zip(
                properties,
                predictions,
                strict=True,
            )
        ]

        return BatchEstimateResponse(
            count=len(estimates),
            estimates=estimates,
        )
