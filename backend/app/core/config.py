import os
from pathlib import Path
from urllib.parse import quote

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str = "sqlite:///./data/legosell.db"
    upload_dir: Path = Path("./data/uploads")
    max_uploads_per_listing: int = 20
    cors_origins: list[str] = ["http://localhost:5173"]
    cors_origin_regex: str = (
        r"https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|"
        r"172\.(?:1[6-9]|2\d|3[0-1])\.\d+\.\d+|192\.168\.\d+\.\d+|"
        r"100\.\d+\.\d+\.\d+)(:\d+)?$"
    )
    google_ai_api_key: str | None = None
    google_ai_base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    google_ai_model: str = "gemini-2.5-flash-lite"
    auth_username: str = ""
    auth_password: str = ""
    auth_secret: str = ""
    persistent_storage_configured: bool = True

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
if os.getenv("VERCEL"):
    prefix = "POSTGRES_PRISMA_"
    database_url = None
    for name in (
        "DATABASE_URL",
        "POSTGRES_URL",
        "POSTGRES_URL_NON_POOLING",
        "DATABASE_URL_UNPOOLED",
        "POSTGRES_PRISMA_POSTGRES_URL_NON_POOLING",
        "POSTGRES_PRISMA_DATABASE_URL_UNPOOLED",
        "POSTGRES_PRISMA_POSTGRES_URL",
        "POSTGRES_PRISMA_DATABASE_URL",
        "POSTGRES_PRISMA_URL",
    ):
        candidate = os.getenv(name, "").strip()
        if candidate.startswith(("postgres://", "postgresql://")):
            database_url = candidate
            break
    if not database_url:
        host = (
            os.getenv(f"{prefix}PGHOST")
            or os.getenv(f"{prefix}POSTGRES_HOST")
            or os.getenv("PGHOST")
        )
        user = (
            os.getenv(f"{prefix}PGUSER")
            or os.getenv(f"{prefix}POSTGRES_USER")
            or os.getenv("PGUSER")
        )
        password = (
            os.getenv(f"{prefix}PGPASSWORD")
            or os.getenv(f"{prefix}POSTGRES_PASSWORD")
            or os.getenv("PGPASSWORD")
        )
        database = (
            os.getenv(f"{prefix}PGDATABASE")
            or os.getenv(f"{prefix}POSTGRES_DATABASE")
            or os.getenv("PGDATABASE")
        )
        if host and user and password and database:
            database_url = (
                f"postgresql://{quote(user, safe='')}:{quote(password, safe='')}"
                f"@{host}/{quote(database, safe='')}?sslmode=require"
            )
    if database_url:
        settings.database_url = database_url
    else:
        settings.database_url = "sqlite:///./data/legosell.db"
if settings.database_url.startswith("postgres://"):
    settings.database_url = settings.database_url.replace("postgres://", "postgresql+psycopg://", 1)
elif settings.database_url.startswith("postgresql://"):
    settings.database_url = settings.database_url.replace(
        "postgresql://", "postgresql+psycopg://", 1
    )
settings.persistent_storage_configured = not os.getenv("VERCEL") or settings.database_url.startswith(
    "postgresql+psycopg://"
)
