"""Validación Pydantic de esquemas de API (sin base de datos)."""

from __future__ import annotations

import uuid

import pytest
from pydantic import ValidationError

from app.models import TicketPriority, TicketState
from app.schemas import AttachmentPresignIn, CommentCreate, GoogleAuthIn, TicketCreate, TicketUpdate


def test_ticket_create_defaults() -> None:
    row = TicketCreate(title="Hola")
    assert row.description == ""
    assert row.state is TicketState.open
    assert row.priority is TicketPriority.medium
    assert row.assignee_id is None


def test_ticket_create_title_max_length() -> None:
    with pytest.raises(ValidationError):
        TicketCreate(title="x" * 501)


def test_ticket_create_accepts_optional_fields() -> None:
    aid = uuid.uuid4()
    row = TicketCreate(
        title="T",
        description="D",
        assignee_id=aid,
        state=TicketState.review,
        priority=TicketPriority.urgent,
    )
    assert row.assignee_id == aid
    assert row.state is TicketState.review
    assert row.priority is TicketPriority.urgent


def test_ticket_update_empty_valid() -> None:
    """PATCH puede ir vacío (el router valida rutas)."""
    TicketUpdate()


def test_ticket_update_partial() -> None:
    u = TicketUpdate(state=TicketState.closed)
    assert u.title is None
    assert u.state is TicketState.closed


def test_comment_create_min_length() -> None:
    with pytest.raises(ValidationError):
        CommentCreate(body="")


def test_google_auth_in_requires_credential() -> None:
    with pytest.raises(ValidationError):
        GoogleAuthIn.model_validate({})


def test_attachment_presign_invalid_size() -> None:
    with pytest.raises(ValidationError):
        AttachmentPresignIn(filename="a.bin", size_bytes=0)
