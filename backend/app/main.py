from __future__ import annotations

from contextlib import asynccontextmanager
import logging
from typing import Optional

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config import settings
from app.database import Base, SessionLocal, apply_schema_patches, engine
from app.deps import ws_user_from_token
from app.routers import attachments, auth, notifications, tickets, users
from app.services import attachment_migration, s3_storage
from app.ws_manager import ws_manager

_log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    apply_schema_patches()
    if s3_storage.s3_configured():
        migrated, missing = attachment_migration.migrate_local_attachments_to_s3()
        if migrated or missing:
            _log.info("Adjuntos: migrados=%s sin_fichero=%s", migrated, missing)
    yield


app = FastAPI(title="Ticketing API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://127.0.0.1:3000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(tickets.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(attachments.router, prefix="/api")


@app.get("/api/health")
def health():
    if s3_storage.s3_configured():
        mode = "s3"
        message = None
    elif s3_storage.s3_bucket_expected():
        mode = "misconfigured"
        message = s3_storage.s3_not_ready_detail()
    else:
        mode = "unavailable"
        message = s3_storage.attachments_disabled_detail()
    return {
        "status": "ok",
        "attachment_storage": mode,
        "attachments_message": message,
    }


@app.websocket("/api/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(default=None),
):
    db: Session = SessionLocal()
    user = None
    try:
        user = ws_user_from_token(token, db)
        if not user:
            await websocket.close(code=4401)
            return
        await ws_manager.connect(user.id, websocket)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if user:
            ws_manager.disconnect(user.id, websocket)
        db.close()
