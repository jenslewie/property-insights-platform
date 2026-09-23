from typing import Annotated

from fastapi import APIRouter, Body, HTTPException, status

from app.config import get_batch_prediction_limit
from app.model.predictor import predict_prices
from app.schemas.prediction import HTTPValidationError, HousingFeatures, PredictionResponse


router = APIRouter(prefix="/api/v1", tags=["Prediction"])

PREDICTION_REQUEST_EXAMPLES = {
    "single_property": {
        "summary": "Single property",
        "value": {
            "square_footage": 1550,
            "bedrooms": 3,
            "bathrooms": 2.0,
            "year_built": 1997,
            "lot_size": 6800,
            "distance_to_city_center": 4.1,
            "school_rating": 7.6,
        },
    },
    "property_batch": {
        "summary": "Property batch",
        "value": [
            {
                "square_footage": 1550,
                "bedrooms": 3,
                "bathrooms": 2.0,
                "year_built": 1997,
                "lot_size": 6800,
                "distance_to_city_center": 4.1,
                "school_rating": 7.6,
            },
            {
                "square_footage": 2200,
                "bedrooms": 4,
                "bathrooms": 2.5,
                "year_built": 2008,
                "lot_size": 9600,
                "distance_to_city_center": 7.0,
                "school_rating": 8.8,
            },
        ],
    },
}

PREDICTION_VALIDATION_RESPONSE_EXAMPLES = {
    "empty_batch": {
        "summary": "Empty batch",
        "value": {
            "detail": [
                {
                    "type": "too_short",
                    "loc": ["body"],
                    "msg": "Batch prediction requires at least one property.",
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
                    "msg": "Batch prediction supports at most 20 properties.",
                }
            ]
        },
    },
}


@router.post(
    "/properties/predict",
    response_model=PredictionResponse,
    status_code=status.HTTP_200_OK,
    summary="Predict house prices",
    description=(
        "Accepts one property or a batch of properties. Batch requests use the "
        "configured prediction limit, which defaults to 20 properties."
    ),
    response_description="Predicted house prices in request order.",
    responses={
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "model": HTTPValidationError,
            "description": "Validation Error",
            "content": {
                "application/json": {
                    "examples": PREDICTION_VALIDATION_RESPONSE_EXAMPLES,
                }
            },
        }
    },
)
def predict(
    payload: Annotated[
        HousingFeatures | list[HousingFeatures],
        Body(openapi_examples=PREDICTION_REQUEST_EXAMPLES),
    ],
) -> PredictionResponse:
    if isinstance(payload, list):
        items = payload
    else:
        items = [payload]

    if not items:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=[
                {
                    "type": "too_short",
                    "loc": ["body"],
                    "msg": "Batch prediction requires at least one property.",
                }
            ],
        )

    batch_prediction_limit = get_batch_prediction_limit()

    if len(items) > batch_prediction_limit:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=[
                {
                    "type": "too_long",
                    "loc": ["body"],
                    "msg": f"Batch prediction supports at most {batch_prediction_limit} properties.",
                }
            ],
        )

    predictions = predict_prices(items)

    return PredictionResponse(count=len(predictions), predictions=predictions)
