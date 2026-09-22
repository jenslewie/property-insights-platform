import math

from fastapi import Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.exceptions import ModelServiceResponseError, ModelServiceUnavailableError


def _json_safe_float(value: float) -> float | str:
    if math.isfinite(value):
        return value

    return str(value)


async def request_validation_exception_handler(
    _request: Request, exception: RequestValidationError
) -> JSONResponse:
    """Return validation errors even when their input contains NaN or infinity."""
    detail = jsonable_encoder(
        exception.errors(),
        custom_encoder={float: _json_safe_float},
    )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, content={"detail": detail}
    )


async def model_service_unavailable_handler(
    _request: Request,
    exception: ModelServiceUnavailableError,
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": str(exception)},
    )


async def model_service_response_handler(
    _request: Request,
    exception: ModelServiceResponseError,
) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_502_BAD_GATEWAY, content={"detail": str(exception)})
