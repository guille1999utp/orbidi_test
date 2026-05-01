from __future__ import annotations

import os
import re
import uuid

from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import Attachment, Ticket, User, utcnow
from app.schemas import (
    AttachmentOut,
    AttachmentPresignIn,
    AttachmentPresignOut,
    DownloadUrlOut,
)
from app.services import s3_storage
from app.services.attachment_storage import purge_attachment_blob

router = APIRouter(tags=["attachments"])


def _is_s3_attachment(att: Attachment) -> bool:
    return (att.storage_backend or "").lower() == "s3"


def _safe_name(name: str) -> str:
    base = os.path.basename(name) or "file"
    base = re.sub(r"[^a-zA-Z0-9._-]", "_", base)[:200]
    return base or "file"


def _require_s3() -> None:
    if not s3_storage.s3_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=s3_storage.attachments_disabled_detail(),
        )


@router.post("/tickets/{ticket_id}/attachments/presign", response_model=AttachmentPresignOut)
def create_presigned_upload(
    ticket_id: uuid.UUID,
    body: AttachmentPresignIn,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _require_s3()
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    if body.size_bytes is not None and body.size_bytes > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Tamaño máximo {settings.max_upload_bytes // (1024 * 1024)} MB",
        )

    att_id = uuid.uuid4()
    safe = _safe_name(body.filename)
    key = f"attachments/{ticket_id}/{att_id}/{safe}"
    ct = (body.content_type or "application/octet-stream").strip() or "application/octet-stream"

    att = Attachment(
        id=att_id,
        ticket_id=ticket_id,
        uploaded_by_id=current.id,
        original_filename=body.filename,
        stored_path=key,
        storage_backend="s3",
        upload_status="pending",
        content_type=ct,
        size_bytes=0,
    )
    ticket.updated_at = utcnow()
    db.add(att)
    db.commit()

    upload_url, headers = s3_storage.presign_put(key, ct)
    return AttachmentPresignOut(attachment_id=att_id, upload_url=upload_url, headers=headers)


@router.post("/attachments/{attachment_id}/finalize-s3", response_model=AttachmentOut)
async def finalize_s3_upload(
    attachment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _require_s3()
    att = db.get(Attachment, attachment_id)
    if not att or not _is_s3_attachment(att):
        raise HTTPException(status_code=404, detail="Adjunto no encontrado")
    if att.upload_status != "pending":
        raise HTTPException(status_code=409, detail="La subida ya estaba finalizada")
    if att.uploaded_by_id != current.id:
        raise HTTPException(status_code=403, detail="No autorizado")
    try:
        sz = s3_storage.head_object_size(att.stored_path)
    except ClientError as e:
        err = e.response.get("Error") or {}
        code = err.get("Code", "")
        if code in ("404", "NoSuchKey", "NotFound"):
            db.delete(att)
            db.commit()
            raise HTTPException(status_code=400, detail="No hay archivo en S3; vuelve a subir")
        raise HTTPException(status_code=502, detail="Error al comprobar el objeto en S3") from e
    if sz > settings.max_upload_bytes:
        try:
            s3_storage.delete_object(att.stored_path)
        except ClientError:
            pass
        db.delete(att)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Tamaño máximo {settings.max_upload_bytes // (1024 * 1024)} MB",
        )

    att.size_bytes = sz
    att.upload_status = "complete"
    t = db.get(Ticket, att.ticket_id)
    if t:
        t.updated_at = utcnow()
    db.commit()
    att = db.execute(
        select(Attachment).options(joinedload(Attachment.uploaded_by)).where(Attachment.id == att.id)
    ).unique().scalar_one()
    from app.services import notify as notify_svc

    await notify_svc.broadcast_ticket_updated(db, att.ticket_id)
    return AttachmentOut.model_validate(att)


@router.post("/tickets/{ticket_id}/attachments", response_model=AttachmentOut)
async def upload_attachment(
    ticket_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """El binario pasa por el servidor en memoria y se sube solo a S3 (no se escribe en disco)."""
    _require_s3()
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")

    raw = await file.read()
    if len(raw) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Tamaño máximo {settings.max_upload_bytes // (1024 * 1024)} MB",
        )

    store_name = f"{uuid.uuid4().hex}_{_safe_name(file.filename or 'upload')}"
    key = f"attachments/{ticket_id}/{store_name}"
    s3_storage.put_object_bytes(key, raw, file.content_type)
    att = Attachment(
        ticket_id=ticket_id,
        uploaded_by_id=current.id,
        original_filename=file.filename or store_name,
        stored_path=key,
        storage_backend="s3",
        upload_status="complete",
        content_type=file.content_type,
        size_bytes=len(raw),
    )

    ticket.updated_at = utcnow()
    db.add(att)
    db.commit()

    att = db.execute(
        select(Attachment).options(joinedload(Attachment.uploaded_by)).where(Attachment.id == att.id)
    ).unique().scalar_one()
    from app.services import notify as notify_svc

    await notify_svc.broadcast_ticket_updated(db, ticket_id)
    return AttachmentOut.model_validate(att)


@router.get("/tickets/{ticket_id}/attachments", response_model=list[AttachmentOut])
def list_attachments(
    ticket_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    rows = db.scalars(
        select(Attachment)
        .options(joinedload(Attachment.uploaded_by))
        .where(Attachment.ticket_id == ticket_id)
        .order_by(Attachment.created_at.desc())
    ).all()
    return [AttachmentOut.model_validate(a) for a in rows]


@router.get("/attachments/{attachment_id}/download-url", response_model=DownloadUrlOut)
def attachment_download_url(
    attachment_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _require_s3()
    att = db.get(Attachment, attachment_id)
    if not att:
        raise HTTPException(status_code=404, detail="Adjunto no encontrado")
    if att.upload_status != "complete":
        raise HTTPException(status_code=409, detail="Subida incompleta")
    if not _is_s3_attachment(att):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Este adjunto no está en S3. Reinicia el backend con S3 configurado para migrar, "
                "o elimina el adjunto y súbelo de nuevo."
            ),
        )
    url = s3_storage.presign_get(att.stored_path, att.original_filename, att.content_type)
    return DownloadUrlOut(url=url, auth_required=False)


@router.get("/attachments/{attachment_id}/file")
def download_attachment(
    attachment_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _require_s3()
    att = db.get(Attachment, attachment_id)
    if not att:
        raise HTTPException(status_code=404, detail="Adjunto no encontrado")
    if att.upload_status != "complete":
        raise HTTPException(status_code=409, detail="Subida incompleta")
    if not _is_s3_attachment(att):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Este adjunto no está en S3. Reinicia el backend con S3 configurado o vuelve a subir el archivo."
            ),
        )
    url = s3_storage.presign_get(att.stored_path, att.original_filename, att.content_type)
    return RedirectResponse(url=url, status_code=307)


@router.delete("/attachments/{attachment_id}", status_code=204)
async def delete_attachment(
    attachment_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    att = db.get(Attachment, attachment_id)
    if not att:
        raise HTTPException(status_code=404, detail="Adjunto no encontrado")
    if _is_s3_attachment(att):
        _require_s3()
    tid = att.ticket_id
    purge_attachment_blob(att)
    t = db.get(Ticket, tid)
    if t:
        t.updated_at = utcnow()
    db.delete(att)
    db.commit()
    from app.services import notify as notify_svc

    await notify_svc.broadcast_ticket_updated(db, tid)
