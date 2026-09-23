from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic_core import PydanticCustomError


class HousingFeatures(BaseModel):
    square_footage: int = Field(
        gt=0,
        le=10_000,
        description="Total interior floor area of the property.",
    )
    bedrooms: int = Field(
        ge=1,
        le=10,
        description="Number of bedrooms.",
    )
    bathrooms: float = Field(
        gt=0,
        le=10,
        description="Number of bathrooms; fractional values are accepted.",
    )
    year_built: int = Field(
        ge=1900,
        description=(
            "Year the property was built or is expected to be completed. "
            "Maximum is the current UTC year plus five."
        ),
    )
    lot_size: int = Field(
        gt=0,
        le=100_000,
        description="Total land area of the property.",
    )
    distance_to_city_center: float = Field(
        ge=0,
        le=100,
        description=("Distance from the property to the city center."),
    )
    school_rating: float = Field(
        ge=0,
        le=20,
        description="School rating on the scale used by the training data.",
    )

    model_config = ConfigDict(
        allow_inf_nan=False,
        json_schema_extra={
            "example": {
                "square_footage": 1550,
                "bedrooms": 3,
                "bathrooms": 2.0,
                "year_built": 1997,
                "lot_size": 6800,
                "distance_to_city_center": 4.1,
                "school_rating": 7.6,
            }
        },
    )

    @field_validator("year_built")
    @classmethod
    def validate_year_built(cls, value: int) -> int:
        maximum = datetime.now(timezone.utc).year + 5
        if value > maximum:
            raise PydanticCustomError(
                "less_than_equal",
                "Input should be less than or equal to {le}",
                {"le": maximum},
            )
        return value


class ValidationError(BaseModel):
    loc: list[str | int] = Field(description="Location of the invalid value in the request.")
    msg: str = Field(description="Human-readable validation error message.")
    type: str = Field(description="Machine-readable validation error type.")
    input: Any = Field(default=None, description="Invalid input value, when available.")
    ctx: dict[str, Any] | None = Field(
        default=None,
        description="Additional validation context, when available.",
    )


class HTTPValidationError(BaseModel):
    detail: list[ValidationError] = Field(description="Validation errors found in the request.")


class PredictionResponse(BaseModel):
    count: int = Field(description="Number of predicted prices returned.")
    predictions: list[float] = Field(
        description="Predicted prices in the same order as the request properties."
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "count": 2,
                "predictions": [250879.73, 364551.64],
            }
        }
    )
