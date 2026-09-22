from fastapi import APIRouter

from app.schemas.health import HealthResponse


router = APIRouter(
    tags=["Health"],
)


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Check service health",
    description=(
        "Reports whether the property estimator process is running. "
        "This check does not call the house price model service."
    ),
    response_description="Current property estimator health.",
)
async def health() -> HealthResponse:
    return HealthResponse(status="UP")
