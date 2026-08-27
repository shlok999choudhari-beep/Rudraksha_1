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
    assert data["components"]["preprocessing"] == "operational"


def test_preprocess_endpoint():
    """Test document upload and preprocessing endpoint."""
    # Create synthetic test image in memory
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


def test_sample_synthetic_endpoint():
    """Test synthetic test document generation endpoint."""
    response = client.get("/api/documents/sample-synthetic")
    assert response.status_code == 200
    data = response.json()
    assert "sample_url" in data
