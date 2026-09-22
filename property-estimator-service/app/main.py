from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError

from app.api.exception_handlers import (
    model_service_response_handler,
    model_service_unavailable_handler,
    request_validation_exception_handler,
)
from app.api.estimate import router as estimate_router
from app.api.health import router as health_router
from app.clients.house_price_client import HousePriceClient
from app.config import get_settings
from app.exceptions import ModelServiceUnavailableError, ModelServiceResponseError


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()

    async with httpx.AsyncClient(
        base_url=settings.house_price_model_url.rstrip("/"),
        timeout=settings.house_price_model_timeout_seconds,
    ) as http_client:
        app.state.house_price_client = HousePriceClient(http_client)
        yield


app = FastAPI(
    title="Property Estimator API",
    description="API for estimating property prices using the house price prediction model service.",
    version="1.0.0",
    lifespan=lifespan,
    exception_handlers={
        ModelServiceResponseError: model_service_response_handler,
        ModelServiceUnavailableError: model_service_unavailable_handler,
        RequestValidationError: request_validation_exception_handler,
    },
)

app.include_router(health_router)
app.include_router(estimate_router)
