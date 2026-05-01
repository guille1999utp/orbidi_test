"""JWT de acceso (sin base de datos)."""

from __future__ import annotations

import uuid

import pytest

from app.config import settings
from app.security import create_access_token, decode_token


@pytest.fixture(autouse=True)
def jwt_settings(monkeypatch):
    monkeypatch.setattr(settings, "jwt_secret", "unit-test-secret-key-min-32-chars")
    monkeypatch.setattr(settings, "jwt_algorithm", "HS256")
    monkeypatch.setattr(settings, "jwt_expire_hours", 24)


def test_create_and_decode_roundtrip() -> None:
    uid = uuid.uuid4()
    token = create_access_token(uid)
    assert isinstance(token, str)
    assert decode_token(token) == uid


def test_decode_invalid_token() -> None:
    assert decode_token("not-a-jwt") is None


def test_decode_wrong_secret(monkeypatch) -> None:
    uid = uuid.uuid4()
    token = create_access_token(uid)
    monkeypatch.setattr(settings, "jwt_secret", "other-secret-also-32-characters-x")
    assert decode_token(token) is None
