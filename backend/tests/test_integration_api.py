"""Tests for Frontend Integration Endpoints (Auth, Dashboard, Screening Run, Review, Audit)."""
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_auth_login_and_me():
    # Valid login
    resp = client.post("/api/auth/login", json={"email": "officer@veriguard.gov", "password": "borderguard2026"})
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert data["user"]["role"] == "OFFICER"
    assert data["user"]["name"] == "Insp. Priya Sharma"

    # Invalid login
    resp_invalid = client.post("/api/auth/login", json={"email": "officer@veriguard.gov", "password": "wrongpassword"})
    assert resp_invalid.status_code == 401

    # Get Me profile
    resp_me = client.get("/api/auth/me")
    assert resp_me.status_code == 200
    assert resp_me.json()["email"] == "officer@veriguard.gov"


def test_dashboard_statistics_and_analytics():
    # Dashboard Statistics
    resp_stats = client.get("/api/dashboard/statistics?range=7d")
    assert resp_stats.status_code == 200
    stats = resp_stats.json()
    assert "total_screened" in stats
    assert "low_risk" in stats
    assert "trend" in stats
    assert "risk_distribution" in stats

    # Analytics Aggregates
    resp_ana = client.get("/api/analytics?range=30d")
    assert resp_ana.status_code == 200
    ana = resp_ana.json()
    assert "top_risk_reasons" in ana
    assert "processing_time_series" in ana
    assert "cases_by_document_type" in ana


def test_screening_run_and_review_lifecycle():
    # Run screening with synthetic genuine document
    resp_run = client.post("/api/screening/run", json={"document_type": "PASSPORT"})
    assert resp_run.status_code == 200
    case = resp_run.json()
    case_id = case["case_id"]
    assert "stages" in case
    assert len(case["stages"]) == 9
    assert "risk" in case
    assert "mrz" in case
    assert "tampering" in case
    assert "cross_check" in case

    # Query Case History
    resp_hist = client.get("/api/screening/history?page=1&page_size=10")
    assert resp_hist.status_code == 200
    hist = resp_hist.json()
    assert hist["total"] >= 1
    assert any(item["case_id"] == case_id for item in hist["items"])

    # Retrieve Case By ID
    resp_case = client.get(f"/api/screening/{case_id}")
    assert resp_case.status_code == 200
    assert resp_case.json()["case_id"] == case_id

    # Submit Officer Review
    resp_rev = client.post("/api/screening/review", json={
        "case_id": case_id,
        "action": "ESCALATE",
        "reason": "Escalated for secondary forensic review"
    })
    assert resp_rev.status_code == 200
    assert resp_rev.json()["status"] == "ESCALATED"
    assert len(resp_rev.json()["review"]["notes"]) >= 1


def test_audit_logs():
    resp_audit = client.get("/api/audit/logs")
    assert resp_audit.status_code == 200
    audit_data = resp_audit.json()
    assert "items" in audit_data
    assert audit_data["total"] > 0
