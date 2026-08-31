"""
Automated tests for PDF rasterization and multi-format document/face upload endpoints.
"""
import io
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.preprocessing.image import read_image_with_orientation

client = TestClient(app)


def create_test_pdf_bytes() -> bytes:
    """Generates an in-memory PDF containing a passport-like test image."""
    img = Image.new("RGB", (1250, 880), color=(240, 240, 245))
    pdf_buffer = io.BytesIO()
    img.save(pdf_buffer, format="PDF")
    return pdf_buffer.getvalue()


def create_test_image_bytes() -> bytes:
    """Generates an in-memory JPEG test image."""
    img = Image.new("RGB", (800, 600), color=(200, 220, 240))
    img_buffer = io.BytesIO()
    img.save(img_buffer, format="JPEG")
    return img_buffer.getvalue()


def test_pdf_bytes_decoding():
    """Verifies that PDF bytes are properly rasterized into an OpenCV numpy array."""
    pdf_bytes = create_test_pdf_bytes()
    bgr_img = read_image_with_orientation(pdf_bytes)
    assert bgr_img is not None
    assert len(bgr_img.shape) == 3
    assert bgr_img.shape[2] == 3
    assert bgr_img.shape[0] > 0
    assert bgr_img.shape[1] > 0


def test_upload_pdf_to_preprocess_endpoint():
    """Verifies uploading a PDF to /api/documents/preprocess."""
    pdf_bytes = create_test_pdf_bytes()
    files = {"file": ("passport_scan.pdf", pdf_bytes, "application/pdf")}
    resp = client.post("/api/documents/preprocess", files=files)
    assert resp.status_code == 200
    data = resp.json()
    assert "document_id" in data
    assert data["success"] is True
    assert "image_url" in data
    assert "base64_image" in data


def test_upload_image_to_preprocess_endpoint():
    """Verifies uploading a JPEG to /api/documents/preprocess."""
    img_bytes = create_test_image_bytes()
    files = {"file": ("passport_photo.jpg", img_bytes, "image/jpeg")}
    resp = client.post("/api/documents/preprocess", files=files)
    assert resp.status_code == 200
    data = resp.json()
    assert "document_id" in data
    assert data["success"] is True


def test_face_capture_and_verification_flow():
    """Verifies selfie capture upload and subsequent face verification."""
    # 1. Upload selfie frame
    face_bytes = create_test_image_bytes()
    files = {"file": ("selfie_frame.jpg", face_bytes, "image/jpeg")}
    resp_cap = client.post("/api/face/capture", files=files)
    assert resp_cap.status_code == 200
    cap_data = resp_cap.json()
    assert "capture_id" in cap_data
    capture_id = cap_data["capture_id"]

    # 2. Upload document
    doc_bytes = create_test_image_bytes()
    files_doc = {"file": ("doc.jpg", doc_bytes, "image/jpeg")}
    resp_doc = client.post("/api/documents/preprocess", files=files_doc)
    doc_id = resp_doc.json()["document_id"]

    # 3. Verify Face with JSON payload
    resp_ver = client.post("/api/face/verify", json={
        "document_id": doc_id,
        "capture_id": capture_id
    })
    assert resp_ver.status_code == 200

    # 4. Check Liveness with JSON payload
    resp_live = client.post("/api/face/liveness", json={
        "capture_id": capture_id,
        "challenge": "BLINK_TWICE"
    })
    assert resp_live.status_code == 200


def test_full_screening_with_uploaded_pdf_and_selfie():
    """Verifies end-to-end screening when user uploads a PDF and live selfie."""
    pdf_bytes = create_test_pdf_bytes()
    resp_doc = client.post("/api/documents/preprocess", files={"file": ("doc.pdf", pdf_bytes, "application/pdf")})
    doc_id = resp_doc.json()["document_id"]

    face_bytes = create_test_image_bytes()
    resp_cap = client.post("/api/face/capture", files={"file": ("selfie.jpg", face_bytes, "image/jpeg")})
    cap_id = resp_cap.json()["capture_id"]

    resp_run = client.post("/api/screening/run", json={
        "document_id": doc_id,
        "document_type": "PASSPORT",
        "face_capture_id": cap_id
    })
    assert resp_run.status_code == 200
    res = resp_run.json()
    assert "case_id" in res
    assert "risk" in res
    assert "stages" in res
