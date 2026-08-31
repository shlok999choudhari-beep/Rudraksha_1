"""
Unit and Integration Tests for PostgreSQL/SQLite Database Layer and Authentication.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.main import app
from backend.app.db.session import engine, SessionLocal, Base
from backend.app.db.models import User, ScreeningCase, AuditLog, WatchlistItem
from backend.app.db.auth import hash_password, verify_password, generate_session_token
from backend.app.db.init_db import init_database, seed_database

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    """Initializes and seeds the database before tests."""
    init_database()
    seed_database()


def test_password_hashing_and_verification():
    """Tests PBKDF2 password hashing and constant-time verification."""
    password = "secretBorderPassword2026!"
    pwd_hash, salt = hash_password(password)

    assert pwd_hash is not None
    assert len(pwd_hash) == 64  # SHA256 hex length
    assert salt is not None
    assert len(salt) > 0

    # Verify correct password matches
    assert verify_password(password, pwd_hash, salt) is True

    # Verify wrong password fails
    assert verify_password("wrongPassword", pwd_hash, salt) is False


def test_database_seeded_personas():
    """Verifies that all 4 operational personas are properly seeded in the database."""
    with SessionLocal() as db:
        officer = db.query(User).filter(User.email == "officer@veriguard.gov").first()
        assert officer is not None
        assert officer.role == "OFFICER"
        assert verify_password("borderguard2026", officer.password_hash, officer.salt) is True

        supervisor = db.query(User).filter(User.email == "supervisor@veriguard.gov").first()
        assert supervisor is not None
        assert supervisor.role == "SUPERVISOR"

        auditor = db.query(User).filter(User.email == "auditor@veriguard.gov").first()
        assert auditor is not None
        assert auditor.role == "AUDITOR"

        admin = db.query(User).filter(User.email == "admin@veriguard.gov").first()
        assert admin is not None
        assert admin.role == "ADMIN"


def test_database_backed_login_api():
    """Tests /api/auth/login endpoint against the database."""
    # 1. Valid Officer Login
    resp_ok = client.post("/api/auth/login", json={
        "email": "officer@veriguard.gov",
        "password": "borderguard2026"
    })
    assert resp_ok.status_code == 200
    data = resp_ok.json()
    assert "token" in data
    assert data["user"]["email"] == "officer@veriguard.gov"
    assert data["user"]["role"] == "OFFICER"

    # 2. Invalid Password
    resp_invalid = client.post("/api/auth/login", json={
        "email": "officer@veriguard.gov",
        "password": "wrongPassword123"
    })
    assert resp_invalid.status_code == 401

    # 3. Non-existent User
    resp_not_found = client.post("/api/auth/login", json={
        "email": "nobody@veriguard.gov",
        "password": "borderguard2026"
    })
    assert resp_not_found.status_code == 401


def test_database_case_persistence():
    """Verifies that running a screening saves relational records to the database."""
    resp_run = client.post("/api/screening/run", json={"document_type": "PASSPORT"})
    assert resp_run.status_code == 200
    case_data = resp_run.json()
    case_id = case_data["case_id"]

    with SessionLocal() as db:
        saved_case = db.query(ScreeningCase).filter(ScreeningCase.id == case_id).first()
        assert saved_case is not None
        assert saved_case.status in ["COMPLETED", "APPROVED", "FLAGGED", "ESCALATED", "REVIEWED"]
        assert saved_case.quality is not None
        assert saved_case.mrz is not None
        assert saved_case.tamper is not None
        assert saved_case.biometric is not None
        assert saved_case.risk_assessment is not None


def test_database_audit_logs_query():
    """Verifies that audit events are recorded in the database."""
    with SessionLocal() as db:
        logs_count = db.query(AuditLog).count()
        assert logs_count > 0
        latest_log = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).first()
        assert latest_log is not None
        assert latest_log.action in ["USER_LOGIN", "SCREENING_COMPLETED", "CASE_REVIEWED", "CASE_ESCALATED"]


def test_watchlist_database_lookup():
    """Verifies watchlist records in database."""
    with SessionLocal() as db:
        wl = db.query(WatchlistItem).filter(WatchlistItem.document_number == "P88910023").first()
        assert wl is not None
        assert wl.alert_level == "CRITICAL"
