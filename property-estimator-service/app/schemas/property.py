from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class PropertyFeatures(BaseModel):
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
        le=date.today().year + 5,
        description="Year the property was built or is expected to be completed.",
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
