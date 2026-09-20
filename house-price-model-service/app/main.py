from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError

from app.api.exception_handlers import request_validation_exception_handler
from app.api.routes import router
from app.config import get_batch_prediction_limit
from app.model.loader import get_model_bundle


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    get_batch_prediction_limit()
    get_model_bundle()

    yield


app = FastAPI(
    title="House Price Prediction Model API",
    description="Regression model API for predicting house prices.",
    version="1.0.0",
    lifespan=lifespan,
    exception_handlers={
        RequestValidationError: request_validation_exception_handler,
    },
)

app.include_router(router)
