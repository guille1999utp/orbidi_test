import os
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Siempre el .env junto a esta carpeta (backend/), no depende del cwd de uvicorn.
_BACKEND_DIR = Path(__file__).resolve().parent.parent
_ENV_PATH = _BACKEND_DIR / ".env"


def _default_uploads_dir() -> str:
    """Local: ./uploads. Vercel/serverless: solo /tmp es escribible."""
    explicit = os.environ.get("UPLOADS_DIR", "").strip()
    if explicit:
        return explicit
    if os.environ.get("VERCEL"):
        return "/tmp/ticketing-uploads"
    return "uploads"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_PATH,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql://ticket:ticket@localhost:5432/ticketing"
    google_client_id: str = ""
    jwt_secret: str = "change-me-in-production-use-long-random-string"
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 168
    frontend_url: str = "http://localhost:3000"
    uploads_dir: str = Field(default_factory=_default_uploads_dir)
    max_upload_bytes: int = 10 * 1024 * 1024

    aws_access_key_id: str = Field(
        default="",
        validation_alias=AliasChoices("AWS_ACCESS_KEY_ID", "aws_access_key_id"),
    )
    aws_secret_access_key: str = Field(
        default="",
        validation_alias=AliasChoices("AWS_SECRET_ACCESS_KEY", "aws_secret_access_key"),
    )
    aws_region: str = Field(
        default="us-east-1",
        validation_alias=AliasChoices("AWS_REGION", "aws_region"),
    )
    aws_s3_bucket_name: str = Field(
        default="",
        validation_alias=AliasChoices("AWS_S3_BUCKET_NAME", "aws_s3_bucket_name"),
    )
    s3_presign_put_expires: int = 900
    s3_presign_get_expires: int = 3600


settings = Settings()
