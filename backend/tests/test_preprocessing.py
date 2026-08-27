"""Unit tests for document image preprocessing pipeline."""
import os
import cv2
import numpy as np
import pytest

from backend.app.preprocessing.image import (
    preprocess_document,
    read_image_with_orientation,
    STANDARD_TARGET_WIDTH,
    STANDARD_TARGET_HEIGHT
)
from backend.app.preprocessing.quality import check_image_quality
from backend.app.geometry.transform import order_points, four_point_transform


def test_order_points():
    """Test that points are ordered in top-left, top-right, bottom-right, bottom-left order."""
    # Scrambled coordinates for a 100x100 box
    unordered = np.array([
        [100, 100],  # BR
        [0, 0],      # TL
        [100, 0],    # TR
        [0, 100]     # BL
    ], dtype="float32")

    ordered = order_points(unordered)
    np.testing.assert_array_equal(ordered[0], [0, 0])      # TL
    np.testing.assert_array_equal(ordered[1], [100, 0])    # TR
    np.testing.assert_array_equal(ordered[2], [100, 100])  # BR
    np.testing.assert_array_equal(ordered[3], [0, 100])    # BL


def test_quality_check_sharp_and_blurry():
    """Test blur detection on sharp vs blurred images."""
    sharp_img = np.zeros((400, 600, 3), dtype=np.uint8)
    # Add sharp high-frequency edges
    cv2.rectangle(sharp_img, (50, 50), (350, 250), (255, 255, 255), 5)
    cv2.putText(sharp_img, "TEST SHARPNESS", (60, 150), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)

    sharp_report = check_image_quality(sharp_img)
    assert not sharp_report.is_blurry
    assert sharp_report.blur_score > 100.0

    # Blur the image heavily
    blurred_img = cv2.GaussianBlur(sharp_img, (31, 31), 0)
    blurred_report = check_image_quality(blurred_img)
    assert blurred_report.is_blurry
    assert blurred_report.blur_score < 50.0


def test_four_point_transform():
    """Test 4-point perspective warp transformation."""
    canvas = np.zeros((500, 500, 3), dtype=np.uint8)
    # Draw a rotated rectangle
    pts = np.array([
        [100, 150],
        [400, 100],
        [450, 350],
        [150, 400]
    ], dtype="float32")

    warped, (w, h) = four_point_transform(canvas, pts, target_width=300, target_height=200)
    assert warped.shape == (200, 300, 3)
    assert (w, h) == (300, 200)


def test_end_to_end_preprocessing(tmp_path):
    """Test full document preprocessing pipeline."""
    test_img = np.zeros((800, 1000, 3), dtype=np.uint8)
    test_img[:, :] = (50, 50, 50)  # Desk background
    # White document canvas in center
    cv2.rectangle(test_img, (150, 100), (850, 700), (240, 240, 240), -1)
    cv2.putText(test_img, "PASSPORT", (300, 200), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (20, 20, 20), 2)

    input_file = str(tmp_path / "test_input.jpg")
    output_file = str(tmp_path / "test_output.jpg")
    cv2.imwrite(input_file, test_img)

    res = preprocess_document(input_file, output_path=output_file)

    assert res.success is True
    assert os.path.exists(output_file)
    assert res.processed_size["width"] == STANDARD_TARGET_WIDTH
    assert res.processed_size["height"] == STANDARD_TARGET_HEIGHT
    assert res.processed_image.shape == (STANDARD_TARGET_HEIGHT, STANDARD_TARGET_WIDTH, 3)
