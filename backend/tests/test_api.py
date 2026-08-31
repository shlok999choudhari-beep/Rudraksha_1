"""Integration tests for VeriGuard AI FastAPI endpoints."""
import os
import io
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def test_root_endpoint():
    """Test root status landing endpoint."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "VeriGuard AI Screening Backend"
    assert data["status"] == "online"


def test_health_endpoint():
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["components"]["mrz_engine"] == "operational"


def test_preprocess_endpoint():
    """Test document upload and preprocessing endpoint."""
    img = np.zeros((600, 800, 3), dtype=np.uint8)
    img[:, :] = (80, 80, 80)
    cv2.rectangle(img, (100, 50), (700, 550), (240, 240, 240), -1)
    cv2.putText(img, "TEST DOC", (250, 250), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (10, 10, 10), 2)

    _, encoded = cv2.imencode(".jpg", img)
    file_bytes = io.BytesIO(encoded.tobytes())

    response = client.post(
        "/api/documents/preprocess",
        files={"file": ("test_doc.jpg", file_bytes, "image/jpeg")},
        data={"target_width": "800", "enhance_contrast": "false"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "document_id" in data
    assert "quality" in data
    assert "image_url" in data
    assert data["base64_image"].startswith("data:image/jpeg;base64,")


def test_mrz_parse_endpoint():
    """Test MRZ parsing endpoint."""
    mrz_lines = [
        "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<",
        "L898902C36UTO7408122F1204159ZE184226B<<<<<10"
    ]
    response = client.post("/api/mrz/parse", json={"mrz_lines": mrz_lines})
    assert response.status_code == 200
    data = response.json()
    assert data["document_format"] == "TD3"
    assert data["document_number"] == "L898902C3"
    assert data["surname"] == "ERIKSSON"
    assert data["is_valid"] is True


def test_cross_validate_endpoint():
    """Test VIZ vs MRZ cross-validation endpoint."""
    payload = {
        "viz": {
            "surname": "ERIKSSON",
            "given_names": "ANNA MARIA",
            "document_number": "L898902C3",
            "date_of_birth": "12 AUG 1974",
            "date_of_expiry": "15 APR 2032",
            "sex": "F"
        },
        "mrz_lines": [
            "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<",
            "L898902C36UTO7408122F3204153ZE184226B<<<<<16"
        ]
    }
    response = client.post("/api/documents/cross-validate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_consistent"] is True
    assert data["risk_level"] == "LOW"



def test_sample_synthetic_endpoint():
    """Test synthetic test document generation endpoint."""
    response = client.get("/api/documents/sample-synthetic")
    assert response.status_code == 200
    data = response.json()
    assert "sample_url" in data


def test_sample_synthetic_tampered_endpoint():
    """Test tampered synthetic test document generation endpoint."""
    response = client.get("/api/documents/sample-synthetic-tampered?tamper_type=number_mismatch")
    assert response.status_code == 200
    data = response.json()
    assert "tamper_type" in data
