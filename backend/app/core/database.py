from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session


def init_db() -> None:
    from app.models import listing  # noqa: F401

    if settings.database_url.startswith("sqlite:///"):
        database_path = settings.database_url.removeprefix("sqlite:///")
        from pathlib import Path

        Path(database_path).parent.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    if "listings" in inspect(engine).get_table_names():
        columns = {column["name"] for column in inspect(engine).get_columns("listings")}
        if "theme" not in columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE listings ADD COLUMN theme VARCHAR(100)"))
        if "description" not in columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE listings ADD COLUMN description VARCHAR(4000)"))
        for column in ("retail_price_cents", "vinted_price_cents", "marktplaats_price_cents"):
            if column not in columns:
                with engine.begin() as connection:
                    connection.execute(text(f"ALTER TABLE listings ADD COLUMN {column} INTEGER"))
