import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import NotificationType, TicketPriority, TicketState


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    name: str
    avatar_url: Optional[str]


class GoogleAuthIn(BaseModel):
    credential: str = Field(..., description="Google ID token (JWT) from Sign-In")


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class UserBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: EmailStr
    avatar_url: Optional[str] = None


class TicketCreate(BaseModel):
    title: str = Field(..., max_length=500)
    description: str = ""
    assignee_id: Optional[uuid.UUID] = None
    state: TicketState = TicketState.open
    priority: TicketPriority = TicketPriority.medium


class TicketUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None
    assignee_id: Optional[uuid.UUID] = None
    state: Optional[TicketState] = None
    priority: Optional[TicketPriority] = None


class TicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str
    author_id: uuid.UUID
    assignee_id: Optional[uuid.UUID]
    state: TicketState
    priority: TicketPriority
    created_at: datetime
    updated_at: datetime
    author: UserBrief
    assignee: Optional[UserBrief]


class CommentCreate(BaseModel):
    body: str = Field(..., min_length=1)


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ticket_id: uuid.UUID
    author_id: uuid.UUID
    body: str
    created_at: datetime
    author: UserBrief


class AttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ticket_id: uuid.UUID
    original_filename: str
    content_type: Optional[str]
    size_bytes: int
    created_at: datetime
    uploaded_by: UserBrief


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ticket_id: Optional[uuid.UUID]
    type: NotificationType
    message: str
    is_read: bool
    created_at: datetime


class WSMessage(BaseModel):
    type: str
    payload: Optional[Dict[str, Any]] = None
