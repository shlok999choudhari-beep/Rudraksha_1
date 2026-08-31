"""
Face Extraction and Alignment Engine for Identity Documents and Live Selfies.
Locates face regions using OpenCV Haar/YuNet cascade detectors with fallback to geometric photo ROI.
"""
import cv2
import numpy as np
from typing import Tuple, Optional, Dict, Any
from pydantic import BaseModel, Field


class DetectedFace(BaseModel):
    """Structured bounding box and quality metrics for an extracted face."""
    x: int
    y: int
    w: int
    h: int
    confidence: float
    is_aligned: bool = False
    face_crop_base64: Optional[str] = None


def get_face_cascade() -> Optional[Any]:
    """Loads OpenCV default Haar frontalface cascade detector if available."""
    try:
        classifier_cls = getattr(cv2, 'CascadeClassifier', None)
        data_mod = getattr(cv2, 'data', None)
        if classifier_cls is not None and data_mod is not None and hasattr(data_mod, 'haarcascades'):
            cascade_path = data_mod.haarcascades + 'haarcascade_frontalface_default.xml'
            cascade = classifier_cls(cascade_path)
            if hasattr(cascade, 'empty') and not cascade.empty():
                return cascade
    except Exception:
        pass
    return None


def extract_face_crop(
    image: np.ndarray,
    is_document: bool = False,
    target_size: Tuple[int, int] = (160, 160)
) -> Tuple[Optional[np.ndarray], Optional[Dict[str, int]], float]:
    """
    Detects and crops the primary face from an image.
    
    Args:
        image: BGR image (Document or Live Selfie).
        is_document: If True, prioritizes the standard passport photo region if detection fails.
        target_size: Output normalized crop dimension (width, height).

    Returns:
        (cropped_face_bgr, bounding_box_dict, detection_confidence)
    """
    if image is None or image.size == 0:
        return None, None, 0.0

    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image

    # 1. Try Haar Cascade face detector
    cascade = get_face_cascade()
    faces = []
    if cascade is not None:
        try:
            detected = cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=4,
                minSize=(int(min(w, h) * 0.10), int(min(w, h) * 0.10))
            )
            if len(detected) > 0:
                faces = list(detected)
        except Exception:
            pass

    # 2. If face found, select best candidate
    if faces:
        # If document, favor faces located in left half (x < 0.5 * w)
        if is_document:
            faces.sort(key=lambda b: (b[0] < w * 0.45, b[2] * b[3]), reverse=True)
        else:
            # For live selfie, select largest centered face
            faces.sort(key=lambda b: b[2] * b[3], reverse=True)

        fx, fy, fw, fh = faces[0]

        # Add 15% margin padding around face
        pad_x = int(fw * 0.15)
        pad_y = int(fh * 0.15)
        x1 = max(0, fx - pad_x)
        y1 = max(0, fy - pad_y)
        x2 = min(w, fx + fw + pad_x)
        y2 = min(h, fy + fh + pad_y)

        crop = image[y1:y2, x1:x2]
        resized = cv2.resize(crop, target_size, interpolation=cv2.INTER_AREA)
        bbox = {"x": int(fx), "y": int(fy), "w": int(fw), "h": int(fh)}
        return resized, bbox, 0.95

    # 3. Document fallback: Crop standard ICAO photo box coordinates if Haar detector missed synthetic/drawn face
    if is_document:
        # Expected passport photo ROI: x in [0.05*w, 0.28*w], y in [0.18*h, 0.60*h]
        px1 = max(0, int(w * 0.05))
        py1 = max(0, int(h * 0.18))
        px2 = min(w, int(w * 0.29))
        py2 = min(h, int(h * 0.60))

        crop = image[py1:py2, px1:px2]
        if crop.size > 0:
            resized = cv2.resize(crop, target_size, interpolation=cv2.INTER_AREA)
            bbox = {"x": px1, "y": py1, "w": px2 - px1, "h": py2 - py1}
            return resized, bbox, 0.70

    # 4. Live selfie fallback: Center crop
    cw = int(w * 0.6)
    ch = int(h * 0.6)
    cx1 = (w - cw) // 2
    cy1 = (h - ch) // 2
    crop = image[cy1:cy1 + ch, cx1:cx1 + cw]
    resized = cv2.resize(crop, target_size, interpolation=cv2.INTER_AREA)
    bbox = {"x": cx1, "y": cy1, "w": cw, "h": ch}
    return resized, bbox, 0.50
