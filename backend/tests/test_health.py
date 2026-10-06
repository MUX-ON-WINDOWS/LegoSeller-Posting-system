from fastapi.testclient import TestClient

from app.main import app
from app.services.ai_vision import AIProviderError, _parse_recognition_result


def test_health() -> None:
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_health_with_vercel_api_prefix() -> None:
    response = TestClient(app).get("/api/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_cors_allows_private_network_frontend() -> None:
    response = TestClient(app).get(
        "/health",
        headers={"Origin": "http://10.163.129.43:5173"},
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://10.163.129.43:5173"


def test_ai_parser_accepts_single_item_array() -> None:
    result = _parse_recognition_result('[{"set_number": "60367", "set_name": "Airport"}]')

    assert result["set_number"] == "60367"


def test_ai_parser_rejects_multiple_items() -> None:
    try:
        _parse_recognition_result('[{"set_number": "60367"}, {"set_number": "60400"}]')
    except AIProviderError as error:
        assert str(error) == "Google AI Studio gaf geen herkenningsobject terug."
    else:
        raise AssertionError("Expected AIProviderError")
