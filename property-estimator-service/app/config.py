import os
from dataclasses import dataclass


DEFAULT_BATCH_ESTIMATE_LIMIT = 20


@dataclass(frozen=True)
class Settings:
    house_price_model_url: str
    house_price_model_timeout_seconds: float
    batch_estimate_limit: int


def get_settings() -> Settings:
    configured_batch_estimate_limit = os.getenv(
        "BATCH_ESTIMATE_LIMIT",
        str(DEFAULT_BATCH_ESTIMATE_LIMIT),
    )

    try:
        batch_estimate_limit = int(configured_batch_estimate_limit)
    except ValueError as error:
        raise ValueError("BATCH_ESTIMATE_LIMIT must be a positive integer") from error

    if batch_estimate_limit < 1:
        raise ValueError("BATCH_ESTIMATE_LIMIT must be a positive integer")

    return Settings(
        house_price_model_url=os.getenv(
            "HOUSE_PRICE_MODEL_URL",
            "http://localhost:9003",
        ),
        house_price_model_timeout_seconds=float(
            os.getenv(
                "HOUSE_PRICE_MODEL_TIMEOUT_SECONDS",
                "5",
            )
        ),
        batch_estimate_limit=batch_estimate_limit,
    )
