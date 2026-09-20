from pathlib import Path

from app.model.predictor import predict_prices
from app.schemas.prediction import HousingFeatures


def test_predict_prices_uses_model_feature_order_and_rounds_to_cents(
    configured_artifacts: Path,
) -> None:
    del configured_artifacts
    items = [
        HousingFeatures(
            school_rating=1.25,
            distance_to_city_center=0.123456,
            lot_size=1001,
            year_built=1901,
            bathrooms=1.25,
            bedrooms=1,
            square_footage=1001,
        ),
        HousingFeatures(
            school_rating=4.0,
            distance_to_city_center=3.0,
            lot_size=2000,
            year_built=1920,
            bathrooms=2.0,
            bedrooms=3,
            square_footage=1200,
        ),
    ]

    assert predict_prices(items) == [204340.27, 237500.0]
