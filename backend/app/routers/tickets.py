from __future__ import annotations

import uuid
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import asc, desc, or_, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_current_user
from app.models import Attachment, Comment, Ticket, TicketPriority, TicketState, User, utcnow
from app.schemas import CommentCreate, CommentOut, TicketCreate, TicketOut, TicketUpdate
from app.services import notify as notify_svc
from app.services.attachment_storage import purge_attachment_blob

router = APIRouter(prefix="/tickets", tags=["tickets"])


def _load_ticket(db: Session, ticket_id: uuid.UUID) -> Optional[Ticket]:
    return db.execute(
        select(Ticket)
        .options(joinedload(Ticket.author), joinedload(Ticket.assignee))
        .where(Ticket.id == ticket_id)
    ).unique().scalar_one_or_none()


@router.get("", response_model=List[TicketOut])
def list_tickets(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    state: Optional[TicketState] = None,
    priority: Optional[TicketPriority] = None,
    assignee_id: Optional[uuid.UUID] = None,
    q: Optional[str] = None,
    sort: Literal["created_at", "updated_at", "title", "priority"] = "updated_at",
    order: Literal["asc", "desc"] = "desc",
):
    stmt = select(Ticket).options(joinedload(Ticket.author), joinedload(Ticket.assignee))
    if state is not None:
        stmt = stmt.where(Ticket.state == state)
    if priority is not None:
        stmt = stmt.where(Ticket.priority == priority)
    if assignee_id is not None:
        stmt = stmt.where(Ticket.assignee_id == assignee_id)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Ticket.title.ilike(like), Ticket.description.ilike(like)))
    col = getattr(Ticket, sort)
    stmt = stmt.order_by(asc(col) if order == "asc" else desc(col))
    rows = db.execute(stmt).unique().scalars().all()
    return [TicketOut.model_validate(t) for t in rows]


@router.post("", response_model=TicketOut, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    body: TicketCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    t = Ticket(
        title=body.title,
        description=body.description,
        author_id=current.id,
        assignee_id=body.assignee_id,
        state=body.state,
        priority=body.priority,
    )
    db.add(t)
    db.flush()

    pings: list[uuid.UUID] = []
    if body.assignee_id:
        pings.extend(notify_svc.notify_assigned(db, t, body.assignee_id, current.id))

    db.commit()
    full = _load_ticket(db, t.id)
    await notify_svc.broadcast_ticket_updated(db, t.id)
    await notify_svc.ping_users_notification_refresh(pings)
    return TicketOut.model_validate(full)


@router.get("/{ticket_id}", response_model=TicketOut)
def get_ticket(
    ticket_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    t = _load_ticket(db, ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    return TicketOut.model_validate(t)


@router.patch("/{ticket_id}", response_model=TicketOut)
async def update_ticket(
    ticket_id: uuid.UUID,
    body: TicketUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")

    old_assignee = t.assignee_id
    old_state = t.state.value

    if body.title is not None:
        t.title = body.title
    if body.description is not None:
        t.description = body.description
    if body.assignee_id is not None:
        t.assignee_id = body.assignee_id
    if body.state is not None:
        t.state = body.state
    if body.priority is not None:
        t.priority = body.priority

    t.updated_at = utcnow()

    pings: list[uuid.UUID] = []
    if body.assignee_id is not None and t.assignee_id != old_assignee:
        pings.extend(notify_svc.notify_assigned(db, t, t.assignee_id, current.id))

    new_state_val = t.state.value
    if body.state is not None and new_state_val != old_state:
        pings.extend(notify_svc.notify_status_change(db, t, current.id, old_state, new_state_val))

    db.commit()
    full = _load_ticket(db, ticket_id)
    await notify_svc.broadcast_ticket_updated(db, ticket_id)
    await notify_svc.ping_users_notification_refresh(pings)
    return TicketOut.model_validate(full)


@router.get("/{ticket_id}/comments", response_model=List[CommentOut])
def list_comments(
    ticket_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not db.get(Ticket, ticket_id):
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    rows = db.scalars(
        select(Comment)
        .options(joinedload(Comment.author))
        .where(Comment.ticket_id == ticket_id)
        .order_by(Comment.created_at.asc())
    ).all()
    return [CommentOut.model_validate(c) for c in rows]


@router.post("/{ticket_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
async def add_comment(
    ticket_id: uuid.UUID,
    body: CommentCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    c = Comment(ticket_id=ticket_id, author_id=current.id, body=body.body)
    t.updated_at = utcnow()
    db.add(c)
    db.flush()
    pings = notify_svc.notify_comment(db, t, current.id, body.body)
    db.commit()
    c = db.execute(
        select(Comment).options(joinedload(Comment.author)).where(Comment.id == c.id)
    ).unique().scalar_one()
    await notify_svc.broadcast_ticket_updated(db, ticket_id)
    await notify_svc.ping_users_notification_refresh(pings)
    return CommentOut.model_validate(c)


@router.delete("/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ticket(
    ticket_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    t = db.get(Ticket, ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    atts = db.scalars(select(Attachment).where(Attachment.ticket_id == ticket_id)).all()
    for a in atts:
        purge_attachment_blob(a)
    db.delete(t)
    db.commit()
    from app.ws_manager import ws_manager

    await ws_manager.broadcast_all(
        {"type": "ticket_deleted", "payload": {"ticket_id": str(ticket_id)}}
    )
