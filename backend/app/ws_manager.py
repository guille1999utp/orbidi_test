from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from typing import Any, DefaultDict, Dict, List, Set, Tuple
from uuid import UUID

from fastapi import WebSocket


class WSManager:
    def __init__(self) -> None:
        self._by_user: DefaultDict[UUID, Set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, user_id: UUID, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._by_user[user_id].add(ws)

    def disconnect(self, user_id: UUID, ws: WebSocket) -> None:
        if user_id in self._by_user:
            self._by_user[user_id].discard(ws)
            if not self._by_user[user_id]:
                del self._by_user[user_id]

    async def broadcast_all(self, message: Dict[str, Any]) -> None:
        text = json.dumps(message, default=str)
        dead: List[Tuple[UUID, WebSocket]] = []
        for uid, conns in list(self._by_user.items()):
            for ws in list(conns):
                try:
                    await ws.send_text(text)
                except Exception:
                    dead.append((uid, ws))
        for uid, ws in dead:
            self.disconnect(uid, ws)

    async def send_to_user(self, user_id: UUID, message: Dict[str, Any]) -> None:
        text = json.dumps(message, default=str)
        async with self._lock:
            sockets = list(self._by_user.get(user_id, ()))
        for ws in sockets:
            try:
                await ws.send_text(text)
            except Exception:
                self.disconnect(user_id, ws)


ws_manager = WSManager()
