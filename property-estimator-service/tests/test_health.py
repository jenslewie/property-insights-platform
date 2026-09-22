from fastapi.testclient import TestClient

from app.main import app


def test_health_is_exposed_without_api_version_prefix() -> None:
    with TestClient(app) as client:
        response = client.get("/health")
        versioned_response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "UP"}
    assert versioned_response.status_code == 404


def test_health_response_has_an_openapi_example() -> None:
    schema = app.openapi()["components"]["schemas"]["HealthResponse"]

    assert schema["example"] == {"status": "UP"}


def test_openapi_describes_health_operation_and_response() -> None:
    schema = app.openapi()
    operation = schema["paths"]["/health"]["get"]

    assert operation["summary"] == "Check service health"
    assert operation["description"] == (
        "Reports whether the property estimator process is running. "
        "This check does not call the house price model service."
    )
    assert operation["responses"]["200"]["description"] == ("Current property estimator health.")
    assert (
        schema["components"]["schemas"]["HealthResponse"]["properties"]["status"]["description"]
        == "Current service health status."
    )
