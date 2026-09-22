import asyncio

from app.schemas.property import PropertyFeatures
from app.services.estimate_service import EstimateService


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


class StubHousePriceClient:
    async def predict(
        self,
        properties: PropertyFeatures | list[PropertyFeatures],
    ) -> float | list[float]:
        if isinstance(properties, list):
            return [250_879.73, 364_551.64]
        return 250_879.73


def test_estimate_maps_single_prediction_to_property() -> None:
    service = EstimateService(StubHousePriceClient())  # type: ignore[arg-type]

    result = asyncio.run(service.estimate(PROPERTY))

    assert result.model_dump() == {
        "property": PROPERTY.model_dump(),
        "predicted_price": 250_879.73,
    }


def test_estimate_preserves_batch_order_and_count() -> None:
    service = EstimateService(StubHousePriceClient())  # type: ignore[arg-type]

    result = asyncio.run(service.estimate([PROPERTY, SECOND_PROPERTY]))

    assert result.model_dump() == {
        "count": 2,
        "estimates": [
            {
                "property": PROPERTY.model_dump(),
                "predicted_price": 250_879.73,
            },
            {
                "property": SECOND_PROPERTY.model_dump(),
                "predicted_price": 364_551.64,
            },
        ],
    }
