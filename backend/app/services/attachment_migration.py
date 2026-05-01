"""Migra adjuntos legados (fichero en disco) a S3 al arrancar el servidor."""

from __future__ import annotations

import logging
import os
import re
from pathlib import Path

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Attachment
from app.services import s3_storage

_log = logging.getLogger(__name__)


def _safe_name(name: str) -> str:
    base = os.path.basename(name) or "file"
    base = re.sub(r"[^a-zA-Z0-9._-]", "_", base)[:200]
    return base or "file"


def migrate_local_attachments_to_s3() -> tuple[int, int]:
    """Sube a S3 cada adjunto cuyo backend no sea s3 y exista el fichero local. Devuelve (migrados, omitidos_sin_fichero)."""
    if not s3_storage.s3_configured():
        return (0, 0)

    migrated = 0
    missing = 0

    with SessionLocal() as db:
        atts = list(db.scalars(select(Attachment)).all())
        for att in atts:
            if (att.storage_backend or "").lower() == "s3":
                continue
            p = Path(att.stored_path)
            if not p.is_file():
                missing += 1
                _log.warning(
                    "Adjunto %s (ticket %s): no hay fichero en %s; no se puede migrar a S3",
                    att.id,
                    att.ticket_id,
                    att.stored_path,
                )
                continue
            try:
                body = p.read_bytes()
            except OSError as e:
                missing += 1
                _log.warning("No se pudo leer %s: %s", att.stored_path, e)
                continue

            key = f"attachments/{att.ticket_id}/{att.id}/{_safe_name(att.original_filename)}"
            try:
                s3_storage.put_object_bytes(key, body, att.content_type)
            except Exception as e:
                _log.exception("Error subiendo adjunto %s a S3: %s", att.id, e)
                continue

            att.stored_path = key
            att.storage_backend = "s3"
            att.upload_status = "complete"
            att.size_bytes = len(body)
            try:
                p.unlink()
            except OSError:
                pass
            migrated += 1

        db.commit()

    if migrated:
        _log.info("Migración a S3: %d adjunto(s) movidos desde disco", migrated)
    if missing:
        _log.info("Migración a S3: %d adjunto(s) sin fichero local (ommitted)", missing)

    return migrated, missing
