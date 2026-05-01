"""Ayudas de configuración S3 (sin llamar a AWS)."""

from __future__ import annotations

import pytest

from app.config import settings
from app.services import s3_storage


@pytest.fixture(autouse=True)
def clear_s3_cache():
    s3_storage.clear_s3_client_cache()
    yield
    s3_storage.clear_s3_client_cache()


def test_s3_configured_false_when_empty(monkeypatch):
    monkeypatch.setattr(settings, "aws_s3_bucket_name", "")
    monkeypatch.setattr(settings, "aws_access_key_id", "")
    monkeypatch.setattr(settings, "aws_secret_access_key", "")
    assert s3_storage.s3_configured() is False


def test_s3_configured_true_when_all_set(monkeypatch):
    monkeypatch.setattr(settings, "aws_s3_bucket_name", "mi-bucket")
    monkeypatch.setattr(settings, "aws_access_key_id", "AKIAKEY")
    monkeypatch.setattr(settings, "aws_secret_access_key", "secret")
    assert s3_storage.s3_configured() is True


def test_s3_bucket_expected_when_name_only(monkeypatch):
    monkeypatch.setattr(settings, "aws_s3_bucket_name", "solo-nombre")
    assert s3_storage.s3_bucket_expected() is True
