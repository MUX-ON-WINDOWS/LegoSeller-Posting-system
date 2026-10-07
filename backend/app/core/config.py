import os
from pathlib import Path

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

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
if not os.getenv("DATABASE_URL") and os.getenv("POSTGRES_URL"):
    settings.database_url = os.environ["POSTGRES_URL"]
if settings.database_url.startswith("postgres://"):
    settings.database_url = settings.database_url.replace("postgres://", "postgresql+psycopg://", 1)
elif settings.database_url.startswith("postgresql://"):
    settings.database_url = settings.database_url.replace(
        "postgresql://", "postgresql+psycopg://", 1
    )
if os.getenv("VERCEL") and not settings.database_url.startswith("postgresql+psycopg://"):
    raise RuntimeError(
        "Persistentie vereist op Vercel: configureer DATABASE_URL of POSTGRES_URL "
        "met een PostgreSQL-database."
    )
