"""Endpoint /api/health (app completa con lifespan parcheado en conftest)."""

from __future__ import annotations


def test_health_returns_ok(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["attachment_storage"] in ("s3", "misconfigured", "unavailable")
    assert "attachments_message" in data
