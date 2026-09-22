from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, status

from app.config import get_settings
from app.dependencies import get_estimate_service
from app.schemas.estimate import ErrorResponse, EstimateRequest, EstimateResult, HTTPValidationError
from app.services.estimate_service import EstimateService


router = APIRouter(
    prefix="/api/v1",
    tags=["Estimate"],
)

ESTIMATE_REQUEST_EXAMPLES = {
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

ESTIMATE_VALIDATION_RESPONSE_EXAMPLES = {
    "empty_batch": {
        "summary": "Empty batch",
        "value": {
            "detail": [
                {
                    "type": "too_short",
                    "loc": ["body"],
                    "msg": "Batch estimate requires at least one property.",
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
                    "msg": "Batch estimate supports at most 20 properties.",
                }
            ]
        },
    },
}

MODEL_SERVICE_INVALID_RESPONSE_EXAMPLES = {
    "invalid_response": {
        "summary": "Invalid model service response",
        "value": {
            "detail": "Housing price model service returned an invalid response.",
        },
    }
}

MODEL_SERVICE_UNAVAILABLE_RESPONSE_EXAMPLES = {
    "service_unavailable": {
        "summary": "Model service unavailable",
        "value": {
            "detail": "Housing price model service is unavailable.",
        },
    }
}


@router.post(
    "/estimate",
    response_model=EstimateResult,
    status_code=status.HTTP_200_OK,
    summary="Estimate property prices",
    description=(
        "Accepts one property or a batch of properties and returns estimated prices. "
        "Batch requests use the configured estimate limit, which defaults to 20 properties."
    ),
    response_description="Estimated property prices in request order.",
    responses={
        status.HTTP_422_UNPROCESSABLE_CONTENT: {
            "model": HTTPValidationError,
            "description": "Validation Error",
            "content": {
                "application/json": {
                    "examples": ESTIMATE_VALIDATION_RESPONSE_EXAMPLES,
                }
            },
        },
        status.HTTP_502_BAD_GATEWAY: {
            "model": ErrorResponse,
            "description": "Invalid response from housing price model service",
            "content": {
                "application/json": {
                    "examples": MODEL_SERVICE_INVALID_RESPONSE_EXAMPLES,
                }
            },
        },
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "model": ErrorResponse,
            "description": "Housing price model service unavailable",
            "content": {
                "application/json": {
                    "examples": MODEL_SERVICE_UNAVAILABLE_RESPONSE_EXAMPLES,
                }
            },
        },
    },
)
async def estimate(
    properties: Annotated[
        EstimateRequest,
        Body(openapi_examples=ESTIMATE_REQUEST_EXAMPLES),
    ],
    estimate_service: EstimateService = Depends(get_estimate_service),
) -> EstimateResult:
    if isinstance(properties, list):
        if not properties:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=[
                    {
                        "type": "too_short",
                        "loc": ["body"],
                        "msg": "Batch estimate requires at least one property.",
                    }
                ],
            )

        batch_estimate_limit = get_settings().batch_estimate_limit
        if len(properties) > batch_estimate_limit:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=[
                    {
                        "type": "too_long",
                        "loc": ["body"],
                        "msg": f"Batch estimate supports at most {batch_estimate_limit} properties.",
                    }
                ],
            )

    return await estimate_service.estimate(properties)
