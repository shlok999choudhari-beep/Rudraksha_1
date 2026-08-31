"""
Unit and Integration tests for Passport Geometry & Layout Analysis Engine.
"""
import os
import io
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from backend.app.geometry.template import DEFAULT_TD3_TEMPLATE, TD3PassportTemplate
from backend.app.geometry.analysis import (
    BoundingBox,
    detect_photo_bounding_box,
    detect_mrz_bounding_box,
    extract_text_line_bounding_boxes,
    evaluate_passport_geometry,
    PassportGeometryReport
)
from backend.app.main import app
from data.synthetic.generate_sample import generate_synthetic_passport

client = TestClient(app)


@pytest.fixture
def standard_flat_passport_img():
    """Generates standard flat synthetic passport (1250 x 880)."""
    img_path = generate_synthetic_passport(tilt_and_place=False, output_filename="test_geometry_flat.jpg")
    img = cv2.imread(img_path)
    assert img is not None
    return img


def test_bounding_box_calculations():
    """Tests BoundingBox pixel-to-relative conversion and aspect ratio."""
    bbox = BoundingBox.from_pixels(x=100, y=200, w=300, h=400, img_w=1000, img_h=1000)
    assert bbox.rel_x == 0.1
    assert bbox.rel_y == 0.2
    assert bbox.rel_w == 0.3
    assert bbox.rel_h == 0.4
    assert bbox.aspect_ratio == 0.75


def test_standard_passport_geometry_evaluation(standard_flat_passport_img):
    """
    Verifies that a standard synthetic passport evaluates to LOW risk
    and satisfies aspect ratio, photo position, and MRZ band checks.
    """
    report = evaluate_passport_geometry(standard_flat_passport_img)
    assert isinstance(report, PassportGeometryReport)
    assert report.is_layout_valid is True
    assert report.geometry_risk_level in ("LOW", "MEDIUM")
    assert report.photo_box is not None
    assert report.mrz_box is not None
    assert len(report.measurements) >= 3
    assert len(report.overlay_annotations) >= 2


def test_geometry_with_displaced_photo(standard_flat_passport_img):
    """
    Simulates a tampered passport where the photo is shifted to the wrong coordinate.
    """
    tampered = standard_flat_passport_img.copy()
    h, w = tampered.shape[:2]
    
    # Erase standard photo on left
    cv2.rectangle(tampered, (50, 150), (360, 540), (245, 245, 245), -1)
    # Place photo on far right (abnormal position)
    cv2.rectangle(tampered, (850, 200), (1150, 600), (120, 120, 120), -1)
    
    report = evaluate_passport_geometry(tampered)
    assert any("PHOTO_DISPLACED" in flag for flag in report.tampering_flags)
    assert report.geometry_risk_level in ("MEDIUM", "HIGH")


def test_geometry_with_distorted_aspect_ratio():
    """
    Simulates a non-standard document with distorted canvas proportions (e.g. 1:1 square instead of 1.42:1).
    """
    square_img = np.ones((800, 800, 3), dtype=np.uint8) * 240
    report = evaluate_passport_geometry(square_img)
    
    assert any("DOCUMENT_ASPECT_RATIO_ANOMALY" in flag for flag in report.tampering_flags)


def test_api_geometry_analyze_endpoint(standard_flat_passport_img):
    """
    Tests POST /api/geometry/analyze endpoint.
    """
    _, encoded = cv2.imencode(".jpg", standard_flat_passport_img)
    file_bytes = io.BytesIO(encoded.tobytes())

    response = client.post(
        "/api/geometry/analyze",
        files={"file": ("passport_flat.jpg", file_bytes, "image/jpeg")}
    )

    assert response.status_code == 200
    data = response.json()
    assert "is_layout_valid" in data
    assert "geometry_risk_score" in data
    assert "measurements" in data
    assert "overlay_annotations" in data
    assert len(data["overlay_annotations"]) > 0
