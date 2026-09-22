from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError

from app.api.exception_handlers import request_validation_exception_handler
from app.api.health import router as health_router
from app.api.model_info import router as model_info_router
from app.api.predict import router as predict_router
from app.config import get_batch_prediction_limit
from app.model.loader import get_model_bundle


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    get_batch_prediction_limit()
    get_model_bundle()

    yield


app = FastAPI(
    title="House Price Prediction Model API",
    description="API for house price prediction and model information.",
    version="1.0.0",
    lifespan=lifespan,
    exception_handlers={
        RequestValidationError: request_validation_exception_handler,
    },
)

app.include_router(health_router)
app.include_router(model_info_router)
app.include_router(predict_router)
