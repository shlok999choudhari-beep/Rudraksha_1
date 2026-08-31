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
    Detects and crops the primary face from an image using YOLO / Haar cascade / ROI.
    
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

    # 1. Use YOLO Face Engine
    from backend.app.face.yolo_face import yolo_face_detector
    report = yolo_face_detector.detect_faces(image, is_document=is_document)

    if report.primary_face is not None:
        pf = report.primary_face
        fx, fy, fw, fh = pf.x, pf.y, pf.w, pf.h

        # Add 15% margin padding around face
        pad_x = int(fw * 0.15)
        pad_y = int(fh * 0.15)
        x1 = max(0, fx - pad_x)
        y1 = max(0, fy - pad_y)
        x2 = min(w, fx + fw + pad_x)
        y2 = min(h, fy + fh + pad_y)

        crop = image[y1:y2, x1:x2]
        if crop.size > 0:
            resized = cv2.resize(crop, target_size, interpolation=cv2.INTER_AREA)
            bbox = {"x": int(fx), "y": int(fy), "w": int(fw), "h": int(fh)}
            return resized, bbox, pf.confidence

    # 2. Geometric ICAO Fallback for Document
    if is_document:
        px1 = max(0, int(w * 0.05))
        py1 = max(0, int(h * 0.18))
        px2 = min(w, int(w * 0.29))
        py2 = min(h, int(h * 0.60))

        crop = image[py1:py2, px1:px2]
        if crop.size > 0:
            resized = cv2.resize(crop, target_size, interpolation=cv2.INTER_AREA)
            bbox = {"x": px1, "y": py1, "w": px2 - px1, "h": py2 - py1}
            return resized, bbox, 0.70

    # 3. Live selfie fallback: Center crop
    cw = int(w * 0.6)
    ch = int(h * 0.6)
    cx1 = (w - cw) // 2
    cy1 = (h - ch) // 2
    crop = image[cy1:cy1 + ch, cx1:cx1 + cw]
    resized = cv2.resize(crop, target_size, interpolation=cv2.INTER_AREA)
    bbox = {"x": cx1, "y": cy1, "w": cw, "h": ch}
    return resized, bbox, 0.50


def extract_document_faces(
    image: np.ndarray,
    target_size: Tuple[int, int] = (160, 160)
) -> Dict[str, Any]:
    """
    Extracts both Primary Portrait Face and Secondary Ghost/Watermark Face.
    """
    from backend.app.face.yolo_face import yolo_face_detector
    report = yolo_face_detector.detect_faces(image, is_document=True)

    result = {
        "primary_crop": None,
        "primary_bbox": None,
        "primary_conf": 0.0,
        "ghost_crop": None,
        "ghost_bbox": None,
        "has_ghost_photo": report.ghost_face is not None,
        "backend": report.inference_backend,
        "latency_ms": report.latency_ms
    }

    if report.primary_face:
        pf = report.primary_face
        crop = image[max(0, pf.y):min(image.shape[0], pf.y + pf.h), max(0, pf.x):min(image.shape[1], pf.x + pf.w)]
        if crop.size > 0:
            result["primary_crop"] = cv2.resize(crop, target_size, interpolation=cv2.INTER_AREA)
            result["primary_bbox"] = {"x": pf.x, "y": pf.y, "w": pf.w, "h": pf.h}
            result["primary_conf"] = pf.confidence

    if report.ghost_face:
        gf = report.ghost_face
        crop = image[max(0, gf.y):min(image.shape[0], gf.y + gf.h), max(0, gf.x):min(image.shape[1], gf.x + gf.w)]
        if crop.size > 0:
            result["ghost_crop"] = cv2.resize(crop, target_size, interpolation=cv2.INTER_AREA)
            result["ghost_bbox"] = {"x": gf.x, "y": gf.y, "w": gf.w, "h": gf.h}

    return result
