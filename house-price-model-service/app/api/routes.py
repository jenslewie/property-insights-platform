from typing import Annotated

from fastapi import APIRouter, Body, HTTPException

from app.config import get_batch_prediction_limit
from app.model.loader import get_model_bundle
from app.model.predictor import predict_prices
from app.schemas.health import HealthResponse
from app.schemas.model_info import ModelInfoResponse
from app.schemas.prediction import HousingFeatures, PredictionResponse

router = APIRouter()

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


@router.get(
    "/health",
    response_model=HealthResponse,
    tags=["Health"],
    summary="Check service health",
    description="Confirms that the trained model bundle is available to the API.",
    response_description="Current model service health.",
)
def health() -> HealthResponse:
    get_model_bundle()

    return HealthResponse(status="ok", model_loaded=True)


@router.get(
    "/model-info",
    response_model=ModelInfoResponse,
    tags=["Model"],
    summary="Get model information",
    description=(
        "Returns the loaded model's metadata, feature names, coefficients, and evaluation metrics."
    ),
    response_description="Metadata for the loaded regression model.",
)
def model_info() -> ModelInfoResponse:
    bundle = get_model_bundle()

    return ModelInfoResponse.model_validate(bundle.metadata)


@router.post(
    "/predict",
    response_model=PredictionResponse,
    tags=["Prediction"],
    summary="Predict house prices",
    description=(
        "Accepts one property or a batch of properties. Batch requests use the "
        "configured prediction limit, which defaults to 20 properties."
    ),
    response_description="Predicted house prices in request order.",
    openapi_extra={
        "responses": {
            "422": {
                "content": {
                    "application/json": {
                        "examples": PREDICTION_VALIDATION_RESPONSE_EXAMPLES,
                    }
                }
            }
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
            status_code=422,
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
            status_code=422,
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
