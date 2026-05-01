from __future__ import annotations

from functools import lru_cache
from typing import Any, Optional

import boto3
from botocore.client import BaseClient
from botocore.config import Config

from app.config import settings


def s3_configured() -> bool:
    return bool(
        settings.aws_s3_bucket_name.strip()
        and settings.aws_access_key_id.strip()
        and settings.aws_secret_access_key.strip()
    )


def s3_bucket_expected() -> bool:
    """Hay bucket en `.env`: no debemos usar carpeta local para adjuntos nuevos."""
    return bool(settings.aws_s3_bucket_name.strip())


def s3_not_ready_detail() -> str:
    return (
        "Hay AWS_S3_BUCKET_NAME pero faltan credenciales válidas. "
        "Revisa AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY en backend/.env y reinicia uvicorn."
    )


def attachments_disabled_detail() -> str:
    """Mensaje único para API cuando los adjuntos no pueden usarse sin S3."""
    if s3_bucket_expected():
        return s3_not_ready_detail()
    return (
        "Los adjuntos solo están disponibles con Amazon S3. "
        "Configura en backend/.env: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, "
        "AWS_REGION y AWS_S3_BUCKET_NAME. Reinicia uvicorn después de guardar."
    )


@lru_cache
def _client() -> BaseClient:
    return boto3.client(
        "s3",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
    )


def put_object_bytes(key: str, body: bytes, content_type: Optional[str]) -> int:
    extra: dict[str, Any] = {}
    if content_type:
        extra["ContentType"] = content_type
    _client().put_object(Bucket=settings.aws_s3_bucket_name, Key=key, Body=body, **extra)
    return len(body)


def delete_object(key: str) -> None:
    if not key:
        return
    _client().delete_object(Bucket=settings.aws_s3_bucket_name, Key=key)


def head_object_size(key: str) -> int:
    r = _client().head_object(Bucket=settings.aws_s3_bucket_name, Key=key)
    return int(r["ContentLength"])


def presign_put(key: str, content_type: Optional[str], expires_in: Optional[int] = None) -> tuple[str, dict[str, str]]:
    """Returns (url, headers the client must send with PUT)."""
    exp = min(max((expires_in or settings.s3_presign_put_expires), 60), 604800)
    params: dict[str, Any] = {"Bucket": settings.aws_s3_bucket_name, "Key": key}
    if content_type:
        params["ContentType"] = content_type
    url = _client().generate_presigned_url(
        "put_object",
        Params=params,
        HttpMethod="PUT",
        ExpiresIn=exp,
    )
    headers: dict[str, str] = {}
    if content_type:
        headers["Content-Type"] = content_type
    return url, headers


def presign_get(key: str, filename: str, content_type: Optional[str], expires_in: Optional[int] = None) -> str:
    exp = min(max((expires_in or settings.s3_presign_get_expires), 60), 604800)
    params: dict[str, Any] = {
        "Bucket": settings.aws_s3_bucket_name,
        "Key": key,
        "ResponseContentDisposition": f'attachment; filename="{filename}"',
    }
    if content_type:
        params["ResponseContentType"] = content_type
    return _client().generate_presigned_url(
        "get_object",
        Params=params,
        ExpiresIn=exp,
    )


def clear_s3_client_cache() -> None:
    """Útil en tests."""
    _client.cache_clear()
