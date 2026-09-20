import math

from fastapi import Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


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

    return JSONResponse(status_code=422, content={"detail": detail})
