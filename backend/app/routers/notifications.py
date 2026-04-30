from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Notification, User
from app.schemas import NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    rows = db.scalars(
        select(Notification)
        .where(Notification.user_id == current.id)
        .order_by(Notification.created_at.desc())
        .limit(100)
    ).all()
    return [NotificationOut.model_validate(n) for n in rows]


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    c = db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == current.id, Notification.is_read.is_(False))
    )
    return {"count": int(c or 0)}


@router.post("/mark-all-read", status_code=204)
def mark_all_read(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    rows = db.scalars(
        select(Notification).where(Notification.user_id == current.id, Notification.is_read.is_(False))
    ).all()
    for n in rows:
        n.is_read = True
    db.commit()


@router.post("/{notification_id}/read", status_code=204)
def mark_one_read(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    n = db.get(Notification, notification_id)
    if not n or n.user_id != current.id:
        raise HTTPException(status_code=404, detail="No encontrado")
    n.is_read = True
    db.commit()
