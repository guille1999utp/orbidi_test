from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def apply_schema_patches() -> None:
    """Alinea tablas creadas antes de nuevos campos (create_all no altera columnas)."""
    if engine.dialect.name != "postgresql":
        return
    stmts = (
        "ALTER TABLE attachments ADD COLUMN IF NOT EXISTS storage_backend VARCHAR(8) NOT NULL DEFAULT 'local'",
        "ALTER TABLE attachments ADD COLUMN IF NOT EXISTS upload_status VARCHAR(16) NOT NULL DEFAULT 'complete'",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES users(id) ON DELETE SET NULL",
    )
    with engine.begin() as conn:
        for sql in stmts:
            conn.execute(text(sql))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
