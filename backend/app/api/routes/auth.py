from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.core.auth import AUTH_COOKIE, create_session, require_auth
from app.core.config import settings
from app.schemas.auth import LoginRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(credentials: LoginRequest, response: Response) -> dict[str, str]:
    if not settings.auth_username or not settings.auth_password or not settings.auth_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AUTH_USERNAME, AUTH_PASSWORD en AUTH_SECRET zijn niet ingesteld.",
        )
    if credentials.username != settings.auth_username or credentials.password != settings.auth_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Onjuiste inloggegevens.")

    response.set_cookie(
        AUTH_COOKIE,
        create_session(credentials.username),
        httponly=True,
        secure=settings.app_env == "production",
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
    )
    return {"username": settings.auth_username}


@router.get("/me", dependencies=[Depends(require_auth)])
def current_user() -> dict[str, str]:
    return {"username": settings.auth_username}


@router.post("/logout")
def logout(response: Response) -> dict[str, str]:
    response.delete_cookie(AUTH_COOKIE)
    return {"status": "ok"}
