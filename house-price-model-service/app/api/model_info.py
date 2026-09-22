from fastapi import APIRouter

from app.model.loader import get_model_bundle
from app.schemas.model_info import ModelInfoResponse


router = APIRouter(prefix="/api/v1", tags=["Model"])


@router.get(
    "/model-info",
    response_model=ModelInfoResponse,
    summary="Get model information",
    description=(
        "Returns the loaded model's metadata, feature names, coefficients, and performance metrics."
    ),
    response_description="Metadata for the loaded regression model.",
)
def model_info() -> ModelInfoResponse:
    bundle = get_model_bundle()

    return ModelInfoResponse.model_validate(bundle.metadata)
