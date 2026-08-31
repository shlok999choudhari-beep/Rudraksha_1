"""
Unit and Integration tests for Face Verification & Passive Liveness Engine.
"""
import io
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from backend.app.face.extractor import extract_face_crop
from backend.app.face.matcher import (
    extract_facial_embedding_vector,
    compute_cosine_similarity,
    verify_face_match,
    FaceMatchResult
)
from backend.app.face.liveness import (
    evaluate_passive_liveness,
    compute_fft_moire_pattern_score,
    compute_skin_chroma_diversity_score,
    LivenessResult
)
from backend.app.face.verifier import verify_identity_and_liveness, FaceVerificationReport
from backend.app.main import app
from data.synthetic.generate_sample import generate_synthetic_passport

client = TestClient(app)


@pytest.fixture
def sample_face_a():
    """Generates a synthetic face image A with natural skin texture."""
    img = np.ones((200, 200, 3), dtype=np.uint8) * 220
    # Add warm skin tone in BGR (B=140, G=160, R=210)
    img[:, :] = (140, 160, 210)
    # Head & facial contours
    cv2.circle(img, (100, 90), 55, (120, 140, 195), -1)
    cv2.circle(img, (80, 80), 8, (60, 40, 30), -1)  # Left eye
    cv2.circle(img, (120, 80), 8, (60, 40, 30), -1) # Right eye
    cv2.ellipse(img, (100, 105), (10, 15), 0, 0, 180, (90, 80, 130), 2) # Nose
    cv2.ellipse(img, (100, 125), (20, 8), 0, 0, 180, (90, 60, 150), -1) # Mouth
    
    # Add natural subtle skin texture gradient
    noise = np.random.normal(0, 5, (200, 200, 3)).astype(np.int16)
    img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    return img


@pytest.fixture
def sample_face_b():
    """Generates a distinctly different synthetic face B (different features/proportions)."""
    img = np.ones((200, 200, 3), dtype=np.uint8) * 180
    img[:, :] = (110, 130, 170)
    cv2.circle(img, (100, 100), 45, (90, 110, 150), -1)
    cv2.circle(img, (75, 95), 14, (30, 30, 30), -1)   # Larger eyes
    cv2.circle(img, (125, 95), 14, (30, 30, 30), -1)
    cv2.line(img, (85, 140), (115, 140), (40, 40, 80), 4) # Straight wide mouth
    return img


@pytest.fixture
def simulated_screen_replay_spoof(sample_face_a):
    """
    Simulates a screen replay presentation attack by injecting high-frequency periodic grid spikes (Moire pattern).
    """
    spoof = sample_face_a.copy()
    h, w = spoof.shape[:2]
    # Add periodic screen grid lines every 4 pixels
    for y in range(0, h, 4):
        spoof[y, :, :] = np.clip(spoof[y, :, :].astype(np.int16) + 50, 0, 255).astype(np.uint8)
    for x in range(0, w, 4):
        spoof[:, x, :] = np.clip(spoof[:, x, :].astype(np.int16) + 50, 0, 255).astype(np.uint8)
    return spoof


def test_face_extraction_and_fallback(sample_face_a):
    """Verifies face crop extraction on live selfie and document."""
    crop, bbox, conf = extract_face_crop(sample_face_a, is_document=False)
    assert crop is not None
    assert crop.shape == (160, 160, 3)
    assert bbox is not None
    assert conf >= 0.50


def test_facial_embedding_extraction(sample_face_a):
    """Verifies 512-dim normalized feature embedding extraction."""
    vec = extract_facial_embedding_vector(sample_face_a)
    assert isinstance(vec, np.ndarray)
    assert vec.ndim == 1
    assert len(vec) > 100
    # Unit vector magnitude check
    norm = np.linalg.norm(vec)
    assert abs(norm - 1.0) < 1e-3


def test_face_matching_same_person(sample_face_a):
    """Verifies that the same person (with slight noise/lighting variance) yields MATCH."""
    # Create slight variation of Face A
    variant_a = sample_face_a.copy()
    noise = np.random.normal(0, 3, variant_a.shape).astype(np.int16)
    variant_a = np.clip(variant_a.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    result = verify_face_match(sample_face_a, variant_a)
    assert isinstance(result, FaceMatchResult)
    assert result.is_match is True
    assert result.match_status == "MATCH"
    assert result.similarity_score >= 0.70


def test_face_matching_different_person(sample_face_a, sample_face_b):
    """Verifies that two distinct faces yield lower similarity / MISMATCH."""
    result = verify_face_match(sample_face_a, sample_face_b)
    assert isinstance(result, FaceMatchResult)
    assert result.similarity_score < 0.70


def test_passive_liveness_on_natural_face(sample_face_a):
    """Verifies natural face with skin texture passes passive liveness."""
    liveness = evaluate_passive_liveness(sample_face_a)
    assert isinstance(liveness, LivenessResult)
    assert liveness.is_live is True
    assert liveness.spoof_type == "GENUINE_LIVE_FACE"
    assert liveness.liveness_score >= 0.60


def test_passive_liveness_on_screen_replay(simulated_screen_replay_spoof):
    """Verifies periodic grid pattern triggers screen replay spoof detection."""
    liveness = evaluate_passive_liveness(simulated_screen_replay_spoof)
    assert liveness.moire_score > 0.35


def test_full_identity_verification_orchestration(sample_face_a, sample_face_b):
    """Verifies end-to-end identity matching + liveness pipeline."""
    # 1. Matching case
    report_match = verify_identity_and_liveness(sample_face_a, sample_face_a)
    assert isinstance(report_match, FaceVerificationReport)
    assert report_match.is_verified is True
    assert report_match.face_risk_level == "LOW"
    assert report_match.doc_face_crop_base64 is not None

    # 2. Impersonation mismatch case
    report_mismatch = verify_identity_and_liveness(sample_face_a, sample_face_b)
    assert report_mismatch.face_risk_score > report_match.face_risk_score


def test_api_face_verify_endpoints(sample_face_a):
    """Tests FastAPI /api/face/verify and /api/face/liveness endpoints."""
    _, encoded = cv2.imencode(".jpg", sample_face_a)
    bytes_a = io.BytesIO(encoded.tobytes())
    bytes_b = io.BytesIO(encoded.tobytes())

    # Test /api/face/verify
    response = client.post(
        "/api/face/verify",
        files={
            "doc_file": ("doc_face.jpg", bytes_a, "image/jpeg"),
            "live_file": ("live_face.jpg", bytes_b, "image/jpeg")
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "is_verified" in data
    assert "face_similarity_score" in data
    assert "liveness_score" in data
    assert "doc_face_crop_base64" in data

    # Test /api/face/liveness
    bytes_a.seek(0)
    live_resp = client.post(
        "/api/face/liveness",
        files={"file": ("selfie.jpg", bytes_a, "image/jpeg")}
    )
    assert live_resp.status_code == 200
    assert "is_live" in live_resp.json()


def test_yolo_face_extraction(sample_face_a):
    """Tests YOLOFaceDetector and multi-face extraction."""
    from backend.app.face.yolo_face import YOLOFaceDetector
    from backend.app.face.extractor import extract_document_faces

    detector = YOLOFaceDetector()
    report = detector.detect_faces(sample_face_a, is_document=False)
    assert report is not None
    assert report.total_faces_detected >= 1
    assert report.primary_face is not None
    assert report.primary_face.confidence > 0.0

    # Test document multi-face extraction
    doc_res = extract_document_faces(sample_face_a)
    assert doc_res["primary_crop"] is not None
    assert doc_res["primary_bbox"] is not None

