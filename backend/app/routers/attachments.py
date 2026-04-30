from __future__ import annotations

import os
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import Attachment, Ticket, User, utcnow
from app.schemas import AttachmentOut

router = APIRouter(tags=["attachments"])


def _safe_name(name: str) -> str:
    base = os.path.basename(name) or "file"
    base = re.sub(r"[^a-zA-Z0-9._-]", "_", base)[:200]
    return base or "file"


@router.post("/tickets/{ticket_id}/attachments", response_model=AttachmentOut)
async def upload_attachment(
    ticket_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")

    body = await file.read()
    if len(body) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Tamaño máximo {settings.max_upload_bytes // (1024 * 1024)} MB",
        )

    root = Path(settings.uploads_dir) / str(ticket_id)
    root.mkdir(parents=True, exist_ok=True)
    store_name = f"{uuid.uuid4().hex}_{_safe_name(file.filename or 'upload')}"
    full_path = root / store_name
    rel = str(full_path).replace("\\", "/")

    full_path.write_bytes(body)

    att = Attachment(
        ticket_id=ticket_id,
        uploaded_by_id=current.id,
        original_filename=file.filename or store_name,
        stored_path=rel,
        content_type=file.content_type,
        size_bytes=len(body),
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


@router.get("/attachments/{attachment_id}/file")
def download_attachment(
    attachment_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    att = db.get(Attachment, attachment_id)
    if not att:
        raise HTTPException(status_code=404, detail="Adjunto no encontrado")
    path = Path(att.stored_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Fichero no disponible")
    return FileResponse(
        path,
        filename=att.original_filename,
        media_type=att.content_type or "application/octet-stream",
    )


@router.delete("/attachments/{attachment_id}", status_code=204)
async def delete_attachment(
    attachment_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    att = db.get(Attachment, attachment_id)
    if not att:
        raise HTTPException(status_code=404, detail="Adjunto no encontrado")
    tid = att.ticket_id
    path = Path(att.stored_path)
    t = db.get(Ticket, tid)
    if t:
        t.updated_at = utcnow()
    db.delete(att)
    db.commit()
    if path.is_file():
        try:
            path.unlink()
        except OSError:
            pass
    from app.services import notify as notify_svc

    await notify_svc.broadcast_ticket_updated(db, tid)
