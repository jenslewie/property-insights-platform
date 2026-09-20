import os


DEFAULT_BATCH_PREDICTION_LIMIT = 20


def get_batch_prediction_limit() -> int:
    configured_value = os.getenv("BATCH_PREDICTION_LIMIT", str(DEFAULT_BATCH_PREDICTION_LIMIT))

    try:
        limit = int(configured_value)
    except ValueError as error:
        raise ValueError("BATCH_PREDICTION_LIMIT must be a positive integer") from error

    if limit < 1:
        raise ValueError("BATCH_PREDICTION_LIMIT must be a positive integer")

    return limit
