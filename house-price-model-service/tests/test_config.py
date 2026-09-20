import pytest

from app.config import get_batch_prediction_limit


@pytest.mark.parametrize("configured_value", ["0", "-1", "not-an-integer"])
def test_batch_prediction_limit_requires_positive_integer(
    configured_value: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("BATCH_PREDICTION_LIMIT", configured_value)

    with pytest.raises(
        ValueError,
        match="BATCH_PREDICTION_LIMIT must be a positive integer",
    ):
        get_batch_prediction_limit()
