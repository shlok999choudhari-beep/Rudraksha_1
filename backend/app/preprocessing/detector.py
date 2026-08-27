"""Document boundary and corner detection using OpenCV."""
from typing import Optional, Tuple
import cv2
import numpy as np
from backend.app.geometry.transform import order_points


def detect_document_corners(
    image: np.ndarray,
    min_area_ratio: float = 0.10,
    max_area_ratio: float = 0.99
) -> Tuple[Optional[np.ndarray], float]:
    """
    Detects the 4 corner points of a document inside an input image.

    Args:
        image: Source BGR image numpy array.
        min_area_ratio: Minimum ratio of document area relative to total image.
        max_area_ratio: Maximum ratio of document area relative to total image.

    Returns:
        Tuple of (corners_4x2, detection_confidence).
        corners_4x2 is np.ndarray of shape (4, 2) in float32 format or None if not found.
    """
    if image is None or image.size == 0:
        return None, 0.0

    orig_h, orig_w = image.shape[:2]
    img_area = orig_h * orig_w

    # Resize to standard height for fast and scale-consistent contour detection
    search_height = 800
    scale = orig_h / float(search_height)
    search_width = int(orig_w / scale)
    resized = cv2.resize(image, (search_width, search_height), interpolation=cv2.INTER_AREA)

    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Strategy 1: Multi-threshold Canny edge detection
    edge_candidates = []
    
    # 1a. Standard Canny + Morphological Closing
    edged1 = cv2.Canny(blurred, 50, 150)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    closed1 = cv2.morphologyEx(edged1, cv2.MORPH_CLOSE, kernel)
    edge_candidates.append(closed1)

    # 1b. Otsu's thresholding edge mask
    _, otsu_thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    edged2 = cv2.Canny(otsu_thresh, 30, 100)
    closed2 = cv2.morphologyEx(edged2, cv2.MORPH_CLOSE, kernel)
    edge_candidates.append(closed2)

    # 1c. Adaptive Thresholding
    adaptive_thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2
    )
    edge_candidates.append(adaptive_thresh)

    best_corners = None
    best_area = 0
    best_confidence = 0.0

    for edge_img in edge_candidates:
        contours, _ = cv2.findContours(edge_img, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]

        for cnt in contours:
            area = cv2.contourArea(cnt)
            total_resized_area = search_height * search_width
            area_ratio = area / total_resized_area

            if area_ratio < min_area_ratio or area_ratio > max_area_ratio:
                continue

            # Approximate contour with polygon
            peri = cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)

            # Check if quadrilateral and convex
            if len(approx) == 4 and cv2.isContourConvex(approx):
                if area > best_area:
                    best_area = area
                    best_corners = approx.reshape(4, 2).astype("float32") * scale
                    best_confidence = min(0.95, 0.60 + (area_ratio * 0.35))
                    break

        if best_corners is not None:
            break

    # Fallback Strategy: If strict 4-point polygon wasn't found, find largest contour and use minAreaRect
    if best_corners is None:
        for edge_img in edge_candidates:
            contours, _ = cv2.findContours(edge_img, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not contours:
                continue
            largest_cnt = max(contours, key=cv2.contourArea)
            area = cv2.contourArea(largest_cnt)
            area_ratio = area / (search_height * search_width)

            if area_ratio >= min_area_ratio:
                # Use minimum bounding rotated rectangle
                rect = cv2.minAreaRect(largest_cnt)
                box = cv2.boxPoints(rect)
                best_corners = box.astype("float32") * scale
                best_confidence = 0.70
                break

    # Final Fallback: Full frame document with small 1% safety margin
    if best_corners is None:
        margin_x = orig_w * 0.01
        margin_y = orig_h * 0.01
        best_corners = np.array([
            [margin_x, margin_y],
            [orig_w - margin_x, margin_y],
            [orig_w - margin_x, orig_h - margin_y],
            [margin_x, orig_h - margin_y]
        ], dtype="float32")
        best_confidence = 0.40  # Low confidence fallback

    return order_points(best_corners), best_confidence
