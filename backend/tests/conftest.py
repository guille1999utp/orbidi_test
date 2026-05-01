"""Parches para arrancar la app en tests sin ejecutar migraciones DDL ni migración S3 reales."""

from __future__ import annotations

import pytest


@pytest.fixture
def client(monkeypatch):
    # Impide create_all y parches SQL al abrir lifespan (no requiere Postgres).
    monkeypatch.setattr("app.database.apply_schema_patches", lambda: None)

    def _noop_create_all(*_a, **_kw):
        return None

    import app.database as db

    monkeypatch.setattr(db.Base.metadata, "create_all", _noop_create_all)

    monkeypatch.setattr(
        "app.main.attachment_migration.migrate_local_attachments_to_s3",
        lambda: (0, 0),
    )

    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c
