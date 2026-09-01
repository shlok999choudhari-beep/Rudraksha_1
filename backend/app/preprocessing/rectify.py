"""
Document Rectification & Auto-Deskew Engine.
Corrects camera perspective tilt, planar skew, and slight rotations
prior to OCR and MRZ extraction.
"""
import cv2
import numpy as np
from typing import Tuple, Optional


def estimate_skew_angle(image: np.ndarray) -> float:
    """
    Estimates the dominant planar skew/rotation angle in degrees using Hough line analysis.
    Returns angle in degrees (e.g. +2.5 for clockwise tilt, -2.5 for counter-clockwise).
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image.copy()
    
    # 1. Edge detection
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    
    # 2. Probabilistic Hough Transform to find line segments
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=100, minLineLength=80, maxLineGap=10)
    
    if lines is None or len(lines) == 0:
        return 0.0

    angles = []
    for line in lines:
        coords = line.ravel()
        if len(coords) < 4:
            continue
        x1, y1, x2, y2 = coords[:4]
        dx = x2 - x1
        dy = y2 - y1
        if dx == 0:
            continue
        angle = np.degrees(np.arctan2(dy, dx))
        
        # Consider lines within +/- 25 degrees of horizontal
        if -25.0 <= angle <= 25.0:
            angles.append(angle)

    if not angles:
        return 0.0

    median_angle = float(np.median(angles))
    return median_angle


def deskew_image(image: np.ndarray, max_angle: float = 20.0) -> Tuple[np.ndarray, float]:
    """
    Detects and corrects rotational skew in the image.
    """
    angle = estimate_skew_angle(image)
    
    # If angle is negligible (< 0.2 deg), don't interpolate
    if abs(angle) < 0.25 or abs(angle) > max_angle:
        return image, 0.0

    h, w = image.shape[:2]
    center = (w / 2.0, h / 2.0)
    
    # Rotation matrix
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    deskewed = cv2.warpAffine(
        image, M, (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE
    )
    
    return deskewed, angle


def rectify_document_geometry(image: np.ndarray) -> Tuple[np.ndarray, Dict[str, Any]]:
    """
    Full geometry rectification pipeline:
    1. Deskew rotational tilt
    2. Returns rectified image and metadata
    """
    deskewed, angle = deskew_image(image)
    
    metadata = {
        "deskew_angle_applied": round(angle, 2),
        "is_rectified": abs(angle) >= 0.25
    }
    
    return deskewed, metadata
