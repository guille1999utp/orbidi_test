import os

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_uploads_dir() -> str:
    """Local: ./uploads. Vercel/serverless: solo /tmp es escribible."""
    explicit = os.environ.get("UPLOADS_DIR", "").strip()
    if explicit:
        return explicit
    if os.environ.get("VERCEL"):
        return "/tmp/ticketing-uploads"
    return "uploads"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql://ticket:ticket@localhost:5432/ticketing"
    google_client_id: str = ""
    jwt_secret: str = "change-me-in-production-use-long-random-string"
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 168
    frontend_url: str = "http://localhost:3000"
    uploads_dir: str = Field(default_factory=_default_uploads_dir)
    max_upload_bytes: int = 10 * 1024 * 1024


settings = Settings()
