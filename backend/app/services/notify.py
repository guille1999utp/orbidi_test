from typing import List, Optional, Set
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import Notification, NotificationType, Ticket
from app.schemas import TicketOut
from app.ws_manager import ws_manager


def _add_notification(
    db: Session,
    user_id: UUID,
    ticket_id: Optional[UUID],
    ntype: NotificationType,
    message: str,
) -> None:
    db.add(
        Notification(
            user_id=user_id,
            ticket_id=ticket_id,
            type=ntype,
            message=message,
            is_read=False,
        )
    )


def notify_assigned(db: Session, ticket: Ticket, new_assignee_id: Optional[UUID], actor_id: UUID) -> List[UUID]:
    pings: List[UUID] = []
    if new_assignee_id and new_assignee_id != actor_id:
        _add_notification(
            db,
            new_assignee_id,
            ticket.id,
            NotificationType.assigned,
            f"Te han asignado el ticket: {ticket.title}",
        )
        pings.append(new_assignee_id)
    return pings


def notify_comment(db: Session, ticket: Ticket, comment_author_id: UUID, preview: str) -> List[UUID]:
    targets: Set[UUID] = set()
    if ticket.author_id != comment_author_id:
        targets.add(ticket.author_id)
    if ticket.assignee_id and ticket.assignee_id != comment_author_id:
        targets.add(ticket.assignee_id)
    pings = list(targets)
    for uid in pings:
        _add_notification(
            db,
            uid,
            ticket.id,
            NotificationType.comment,
            f"Nuevo comentario en «{ticket.title}»: {preview[:200]}",
        )
    return pings


_STATE_LABELS = {
    "open": "Abierto",
    "in_progress": "En progreso",
    "review": "En revisión",
    "closed": "Cerrado",
}


def notify_status_change(
    db: Session,
    ticket: Ticket,
    actor_id: UUID,
    old_state: str,
    new_state: str,
) -> List[UUID]:
    old_l = _STATE_LABELS.get(old_state, old_state)
    new_l = _STATE_LABELS.get(new_state, new_state)
    targets: Set[UUID] = {ticket.author_id}
    if ticket.assignee_id:
        targets.add(ticket.assignee_id)
    targets.discard(actor_id)
    msg = f"Estado de «{ticket.title}»: {old_l} → {new_l}"
    pings = list(targets)
    for uid in pings:
        _add_notification(
            db,
            uid,
            ticket.id,
            NotificationType.status_change,
            msg,
        )
    return pings


async def broadcast_ticket_updated(db: Session, ticket_id: UUID) -> None:
    t = db.execute(
        select(Ticket)
        .options(joinedload(Ticket.author), joinedload(Ticket.assignee))
        .where(Ticket.id == ticket_id)
    ).unique().scalar_one_or_none()
    if not t:
        return
    data = TicketOut.model_validate(t).model_dump(mode="json")
    await ws_manager.broadcast_all({"type": "ticket_updated", "payload": {"ticket": data}})


async def ping_users_notification_refresh(user_ids: List[UUID]) -> None:
    for uid in set(user_ids):
        await ws_manager.send_to_user(uid, {"type": "notifications_changed", "payload": {}})
