import base64
import hashlib
import hmac
import time

from fastapi import Depends, HTTPException, Request, status

from app.core.config import settings

AUTH_COOKIE = "legosell_session"
SESSION_TTL_SECONDS = 60 * 60 * 24 * 7


def _sign(value: str) -> str:
    return hmac.new(
        settings.auth_secret.encode("utf-8"),
        value.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def create_session(username: str) -> str:
    payload = f"{username}:{int(time.time())}"
    encoded = base64.urlsafe_b64encode(payload.encode("utf-8")).decode("ascii")
    return f"{encoded}.{_sign(encoded)}"


def is_valid_session(token: str | None) -> bool:
    if not token or "." not in token:
        return False
    encoded, signature = token.split(".", 1)
    if not hmac.compare_digest(signature, _sign(encoded)):
        return False
    try:
        payload = base64.urlsafe_b64decode(encoded.encode("ascii")).decode("utf-8")
        username, issued_at = payload.rsplit(":", 1)
        return (
            hmac.compare_digest(username, settings.auth_username)
            and time.time() - int(issued_at) < SESSION_TTL_SECONDS
        )
    except (ValueError, UnicodeDecodeError):
        return False


def require_auth(request: Request) -> None:
    if not settings.auth_secret or not settings.auth_password:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AUTH_SECRET en AUTH_PASSWORD zijn niet ingesteld.",
        )
    if not is_valid_session(request.cookies.get(AUTH_COOKIE)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Niet ingelogd.")
