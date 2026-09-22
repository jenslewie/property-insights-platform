from fastapi import APIRouter

from app.model.loader import get_model_bundle
from app.schemas.health import HealthResponse


router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Check service health",
    description="Confirms that the trained model bundle is available to the API.",
    response_description="Current model service health.",
)
def health() -> HealthResponse:
    get_model_bundle()

    return HealthResponse(status="UP")
