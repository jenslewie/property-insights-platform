from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

import app.schemas.prediction as prediction


def test_year_limit_moves_forward_without_restarting_model(monkeypatch: pytest.MonkeyPatch) -> None:
    current_year = datetime.now(timezone.utc).year

    class FrozenDateTime:
        instant = datetime(current_year, 12, 31, 23, 59, tzinfo=timezone.utc)

        @classmethod
        def now(cls, tz: timezone) -> datetime:
            assert tz is timezone.utc
            return cls.instant

    monkeypatch.setattr(prediction, "datetime", FrozenDateTime, raising=False)
    property_data = {
        "square_footage": 1050,
        "bedrooms": 2,
        "bathrooms": 1.5,
        "year_built": current_year + 6,
        "lot_size": 1250,
        "distance_to_city_center": 2.0,
        "school_rating": 1.5,
    }

    with pytest.raises(ValidationError) as error:
        prediction.HousingFeatures.model_validate(property_data)
    assert error.value.errors()[0]["type"] == "less_than_equal"
    assert error.value.errors()[0]["ctx"] == {"le": current_year + 5}

    FrozenDateTime.instant = datetime(current_year + 1, 1, 1, tzinfo=timezone.utc)
    assert prediction.HousingFeatures.model_validate(property_data).year_built == current_year + 6
