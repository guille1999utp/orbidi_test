from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from typing import Optional

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.deps import ws_user_from_token
from app.routers import attachments, auth, notifications, tickets, users
from app.ws_manager import ws_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    try:
        Path(settings.uploads_dir).mkdir(parents=True, exist_ok=True)
    except OSError as e:
        # Vercel y otros entornos de solo lectura: usar UPLOADS_DIR=/tmp/... en variables de entorno
        import logging

        logging.getLogger(__name__).warning("No se pudo crear uploads_dir=%s: %s", settings.uploads_dir, e)
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
    return {"status": "ok"}


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
