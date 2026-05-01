from __future__ import annotations

from pathlib import Path

from app.models import Attachment
from app.services import s3_storage


def purge_attachment_blob(att: Attachment) -> None:
    if (att.storage_backend or "").lower() == "s3" and s3_storage.s3_configured():
        try:
            s3_storage.delete_object(att.stored_path)
        except Exception:
            pass
        return
    # Legado: fichero local remoto tras migración; por si quedara rastro en disco
    p = Path(att.stored_path)
    if p.is_file():
        try:
            p.unlink()
        except OSError:
            pass
