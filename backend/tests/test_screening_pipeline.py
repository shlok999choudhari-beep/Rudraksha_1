"""
Unit and Integration tests for Master Screening Pipeline (Milestone 5) and 4-Layer Risk Engine.
"""
import io
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from backend.app.risk.screener import screen_document_and_identity, MasterScreeningReport
from backend.app.risk.scoring import compute_master_risk_score, MasterRiskAssessment
from backend.app.main import app
from data.synthetic.generate_sample import generate_synthetic_passport, generate_tampered_synthetic_passport

client = TestClient(app)


@pytest.fixture
def genuine_passport():
    """Generates authentic synthetic passport."""
    path = generate_synthetic_passport(tilt_and_place=False, output_filename="test_master_clean.jpg")
    img = cv2.imread(path)
    assert img is not None
    return img


@pytest.fixture
def tampered_passport():
    """Generates synthetic passport with deliberate number tampering."""
    path = generate_tampered_synthetic_passport(tamper_type="number_mismatch")
    img = cv2.imread(path)
    assert img is not None
    return img



@pytest.fixture
def sample_selfie():
    """Generates clean selfie matching the passport photo."""
    img = np.ones((200, 200, 3), dtype=np.uint8) * 220
    img[:, :] = (140, 160, 210)
    cv2.circle(img, (100, 90), 55, (120, 140, 195), -1)
    cv2.circle(img, (80, 80), 8, (60, 40, 30), -1)
    cv2.circle(img, (120, 80), 8, (60, 40, 30), -1)
    cv2.ellipse(img, (100, 105), (10, 15), 0, 0, 180, (90, 80, 130), 2)
    cv2.ellipse(img, (100, 125), (20, 8), 0, 0, 180, (90, 60, 150), -1)
    noise = np.random.normal(0, 4, (200, 200, 3)).astype(np.int16)
    img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    return img


def test_master_risk_score_calculation():
    """Tests 4-layer trust score calculation directly."""
    # Clean authentic input
    clean_assessment = compute_master_risk_score(
        quality_passed=True,
        blur_score=150.0,
        glare_ratio=0.01,
        geometry_tampered=False,
        geometry_score=0.05,
        mrz_valid=True,
        cross_validation_consistent=True,
        discrepancy_score=0.0,
        forensic_tampered=False,
        tamper_score=0.05
    )
    assert isinstance(clean_assessment, MasterRiskAssessment)
    assert clean_assessment.overall_trust_score >= 80.0
    assert clean_assessment.overall_risk_level in ("LOW", "MEDIUM")

    # Tampered input
    tampered_assessment = compute_master_risk_score(
        quality_passed=True,
        blur_score=150.0,
        glare_ratio=0.01,
        geometry_tampered=True,
        geometry_score=0.75,
        mrz_valid=False,
        cross_validation_consistent=False,
        discrepancy_score=0.85,
        forensic_tampered=True,
        tamper_score=0.80
    )
    assert tampered_assessment.overall_trust_score <= 50.0
    assert tampered_assessment.overall_risk_level == "HIGH"
    assert tampered_assessment.screening_decision == "SECONDARY_INSPECTION_REQUIRED"
    assert len(tampered_assessment.critical_violations) > 0



def test_screen_genuine_passport(genuine_passport):
    """Verifies master screening pipeline on authentic document."""
    report = screen_document_and_identity(genuine_passport)
    assert isinstance(report, MasterScreeningReport)
    assert report.risk_assessment.overall_trust_score >= 70.0
    assert report.normalized_document_base64 is not None
    assert report.ela_heatmap_base64 is not None
    assert report.noise_heatmap_base64 is not None


def test_screen_tampered_passport(tampered_passport):
    """Verifies master screening detects security violations on tampered document."""
    report = screen_document_and_identity(tampered_passport)
    assert isinstance(report, MasterScreeningReport)
    assert report.risk_assessment.overall_risk_level in ("HIGH", "MEDIUM")
    assert report.risk_assessment.screening_decision in ("SECONDARY_INSPECTION_REQUIRED", "MANUAL_SUPERVISOR_REVIEW")


def test_screen_with_live_selfie(genuine_passport, sample_selfie):
    """Verifies complete document + biometric identity screening."""
    report = screen_document_and_identity(genuine_passport, sample_selfie)
    assert isinstance(report, MasterScreeningReport)
    assert report.face_verification_report is not None
    assert report.doc_face_crop_base64 is not None
    assert report.live_face_crop_base64 is not None


def test_api_documents_screen_endpoint(genuine_passport, sample_selfie):
    """Tests FastAPI POST /api/documents/screen with document + selfie upload."""
    _, enc_doc = cv2.imencode(".jpg", genuine_passport)
    _, enc_selfie = cv2.imencode(".jpg", sample_selfie)

    bytes_doc = io.BytesIO(enc_doc.tobytes())
    bytes_selfie = io.BytesIO(enc_selfie.tobytes())

    response = client.post(
        "/api/documents/screen",
        files={
            "document_file": ("passport.jpg", bytes_doc, "image/jpeg"),
            "selfie_file": ("selfie.jpg", bytes_selfie, "image/jpeg")
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "screening_id" in data
    assert "risk_assessment" in data
    assert "overall_trust_score" in data["risk_assessment"]
    assert "document_integrity_layer" in data["risk_assessment"]
    assert "data_consistency_layer" in data["risk_assessment"]
    assert "forensic_tampering_layer" in data["risk_assessment"]
    assert "biometric_identity_layer" in data["risk_assessment"]
    assert "normalized_document_base64" in data
