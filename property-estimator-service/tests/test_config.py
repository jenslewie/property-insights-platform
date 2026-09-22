import pytest

from app.config import get_settings


def test_settings_use_local_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("HOUSE_PRICE_MODEL_URL", raising=False)
    monkeypatch.delenv("HOUSE_PRICE_MODEL_TIMEOUT_SECONDS", raising=False)
    monkeypatch.delenv("BATCH_ESTIMATE_LIMIT", raising=False)

    settings = get_settings()

    assert settings.house_price_model_url == "http://localhost:9000"
    assert settings.house_price_model_timeout_seconds == 5.0
    assert settings.batch_estimate_limit == 20


def test_settings_read_environment_overrides(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HOUSE_PRICE_MODEL_URL", "http://model-service:9000")
    monkeypatch.setenv("HOUSE_PRICE_MODEL_TIMEOUT_SECONDS", "2.5")
    monkeypatch.setenv("BATCH_ESTIMATE_LIMIT", "8")

    settings = get_settings()

    assert settings.house_price_model_url == "http://model-service:9000"
    assert settings.house_price_model_timeout_seconds == 2.5
    assert settings.batch_estimate_limit == 8


@pytest.mark.parametrize("configured_value", ["0", "-1", "not-an-integer"])
def test_batch_estimate_limit_requires_positive_integer(
    configured_value: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("BATCH_ESTIMATE_LIMIT", configured_value)

    with pytest.raises(
        ValueError,
        match="BATCH_ESTIMATE_LIMIT must be a positive integer",
    ):
        get_settings()
