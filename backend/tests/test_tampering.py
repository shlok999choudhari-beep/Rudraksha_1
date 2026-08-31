"""
Unit and Integration tests for Forensic Tamper Detection Engine
(Error Level Analysis - ELA, Noise Variance Inconsistency, Copy-Move Clones).
"""
import io
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from backend.app.tampering.ela import compute_ela_image, analyze_ela, detect_ela_suspicious_regions
from backend.app.tampering.noise import extract_noise_residual, compute_local_noise_variance_map, analyze_noise_inconsistency
from backend.app.tampering.copy_move import detect_copy_move_clones, analyze_copy_move
from backend.app.tampering.detector import analyze_document_tampering, ForensicTamperReport
from backend.app.main import app
from data.synthetic.generate_sample import generate_synthetic_passport

client = TestClient(app)


@pytest.fixture
def clean_synthetic_passport():
    """Generates authentic synthetic passport."""
    path = generate_synthetic_passport(tilt_and_place=False, output_filename="test_tamper_clean.jpg")
    img = cv2.imread(path)
    assert img is not None
    return img


@pytest.fixture
def spliced_synthetic_passport(clean_synthetic_passport):
    """
    Creates a spliced/tampered passport with a high-contrast pasted patch
    and an altered text area with different compression noise.
    """
    tampered = clean_synthetic_passport.copy()
    h, w = tampered.shape[:2]
    
    # 1. Paste an external noisy patch over the photo region
    noisy_patch = np.random.randint(0, 255, (200, 200, 3), dtype=np.uint8)
    tampered[200:400, 100:300] = noisy_patch

    # 2. Overwrite text field with artificial high-contrast block
    cv2.rectangle(tampered, (400, 250), (700, 310), (0, 0, 0), -1)
    cv2.putText(tampered, "FORGED 99999", (410, 290), cv2.FONT_HERSHEY_DUPLEX, 0.9, (255, 255, 255), 2)
    
    return tampered


@pytest.fixture
def copy_move_cloned_image():
    """
    Creates an image containing an exact duplicated texture patch.
    """
    img = np.ones((600, 800, 3), dtype=np.uint8) * 230
    
    # Create a distinctive texture pattern (simulating a circular seal / stamp)
    stamp = np.zeros((100, 100, 3), dtype=np.uint8)
    cv2.circle(stamp, (50, 50), 40, (0, 0, 200), 4)
    cv2.putText(stamp, "SEAL", (20, 55), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 200), 2)
    for i in range(10, 90, 15):
        cv2.line(stamp, (i, 20), (i, 80), (100, 50, 150), 1)

    # Place original at (100, 100)
    img[100:200, 100:200] = stamp
    # Place duplicated clone at (450, 350)
    img[350:450, 450:550] = stamp
    
    return img


def test_compute_ela_image(clean_synthetic_passport):
    """Verifies that ELA returns valid difference map, heatmap, and stats."""
    ela_bgr, heatmap, mean_err, max_err = compute_ela_image(clean_synthetic_passport)
    assert ela_bgr.shape == clean_synthetic_passport.shape
    assert heatmap.shape == clean_synthetic_passport.shape
    assert mean_err >= 0.0
    assert max_err >= mean_err


def test_analyze_ela_on_clean_and_spliced(clean_synthetic_passport, spliced_synthetic_passport):
    """Verifies ELA detects higher anomaly score on spliced document."""
    clean_ela = analyze_ela(clean_synthetic_passport)
    spliced_ela = analyze_ela(spliced_synthetic_passport)
    
    assert clean_ela.anomaly_score <= 0.60
    assert spliced_ela.anomaly_score > clean_ela.anomaly_score
    assert len(spliced_ela.suspicious_regions) > 0


def test_noise_variance_analysis(clean_synthetic_passport, spliced_synthetic_passport):
    """Verifies noise variance extraction and outlier detection."""
    clean_noise = analyze_noise_inconsistency(clean_synthetic_passport)
    spliced_noise = analyze_noise_inconsistency(spliced_synthetic_passport)
    
    assert clean_noise.global_noise_variance >= 0.0
    assert spliced_noise.has_noise_anomaly is True or spliced_noise.noise_anomaly_score > clean_noise.noise_anomaly_score


def test_copy_move_clones_detection(copy_move_cloned_image):
    """Verifies ORB feature clustering detects duplicated stamp regions."""
    result = analyze_copy_move(copy_move_cloned_image)
    assert result.is_clone_detected is True
    assert len(result.cloned_pairs) >= 1
    assert result.clone_anomaly_score >= 0.5


def test_full_document_tampering_pipeline(clean_synthetic_passport, spliced_synthetic_passport):
    """Verifies end-to-end multi-modal tamper report aggregation."""
    clean_report = analyze_document_tampering(clean_synthetic_passport)
    assert isinstance(clean_report, ForensicTamperReport)
    assert clean_report.tamper_risk_level in ("LOW", "MEDIUM")
    
    tampered_report = analyze_document_tampering(spliced_synthetic_passport)
    assert isinstance(tampered_report, ForensicTamperReport)
    assert tampered_report.tamper_risk_score > clean_report.tamper_risk_score
    assert len(tampered_report.tampering_flags) > 0
    assert tampered_report.annotated_overlay_base64.startswith("data:image/jpeg;base64,")


def test_api_tampering_endpoints(clean_synthetic_passport):
    """Tests FastAPI /api/tampering/analyze, /ela, and /noise endpoints."""
    _, encoded = cv2.imencode(".jpg", clean_synthetic_passport)
    file_bytes = io.BytesIO(encoded.tobytes())

    # Test full analyze endpoint
    response = client.post(
        "/api/tampering/analyze",
        files={"file": ("clean.jpg", file_bytes, "image/jpeg")}
    )
    assert response.status_code == 200
    data = response.json()
    assert "tamper_risk_score" in data
    assert "ela_result" in data
    assert "noise_result" in data
    assert "copy_move_result" in data

    # Test ELA endpoint
    file_bytes.seek(0)
    ela_resp = client.post(
        "/api/tampering/ela",
        files={"file": ("clean.jpg", file_bytes, "image/jpeg")}
    )
    assert ela_resp.status_code == 200
    assert "heatmap_base64" in ela_resp.json()

    # Test Noise endpoint
    file_bytes.seek(0)
    noise_resp = client.post(
        "/api/tampering/noise",
        files={"file": ("clean.jpg", file_bytes, "image/jpeg")}
    )
    assert noise_resp.status_code == 200
    assert "noise_heatmap_base64" in noise_resp.json()
