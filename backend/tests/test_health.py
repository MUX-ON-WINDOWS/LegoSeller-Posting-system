from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.services.ai_vision import AIProviderError, _parse_recognition_result


def test_health() -> None:
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_health_with_vercel_api_prefix() -> None:
    response = TestClient(app).get("/api/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_listings_require_login(monkeypatch) -> None:
    monkeypatch.setattr(settings, "auth_username", "test-user")
    monkeypatch.setattr(settings, "auth_password", "test-password")
    monkeypatch.setattr(settings, "auth_secret", "test-secret")

    response = TestClient(app).get("/listings")

    assert response.status_code == 401


def test_login_sets_session_cookie(monkeypatch) -> None:
    monkeypatch.setattr(settings, "auth_username", "test-user")
    monkeypatch.setattr(settings, "auth_password", "test-password")
    monkeypatch.setattr(settings, "auth_secret", "test-secret")

    client = TestClient(app)
    response = client.post(
        "/auth/login",
        json={"username": "test-user", "password": "test-password"},
    )

    assert response.status_code == 200
    assert "legosell_session" in response.cookies
    assert client.get("/auth/me").status_code == 200


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
