from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.property import PropertyFeatures


EstimateRequest = PropertyFeatures | list[PropertyFeatures]


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


class ErrorResponse(BaseModel):
    detail: str = Field(description="Human-readable error detail.")


class EstimateResponse(BaseModel):
    property: PropertyFeatures = Field(description="Property features supplied in the request.")
    predicted_price: float = Field(description="Price predicted by the house price model service.")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "property": {
                    "square_footage": 1550,
                    "bedrooms": 3,
                    "bathrooms": 2.0,
                    "year_built": 1997,
                    "lot_size": 6800,
                    "distance_to_city_center": 4.1,
                    "school_rating": 7.6,
                },
                "predicted_price": 250_879.73,
            }
        }
    )


class BatchEstimateResponse(BaseModel):
    count: int = Field(description="Number of property estimates returned.")
    estimates: list[EstimateResponse] = Field(
        description="Property estimates in the same order as the request."
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "count": 2,
                "estimates": [
                    {
                        "property": {
                            "square_footage": 1550,
                            "bedrooms": 3,
                            "bathrooms": 2.0,
                            "year_built": 1997,
                            "lot_size": 6800,
                            "distance_to_city_center": 4.1,
                            "school_rating": 7.6,
                        },
                        "predicted_price": 250_879.73,
                    },
                    {
                        "property": {
                            "square_footage": 2200,
                            "bedrooms": 4,
                            "bathrooms": 2.5,
                            "year_built": 2008,
                            "lot_size": 9600,
                            "distance_to_city_center": 7.0,
                            "school_rating": 8.8,
                        },
                        "predicted_price": 364_551.64,
                    },
                ],
            }
        }
    )


EstimateResult = EstimateResponse | BatchEstimateResponse
