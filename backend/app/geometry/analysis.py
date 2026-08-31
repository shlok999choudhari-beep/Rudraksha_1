"""
Passport Geometry & Layout Analysis Engine.
Measures spatial integrity, margins, photo positioning, MRZ alignment,
and text line spacing against ICAO Doc 9303 TD3 standard templates to detect physical/digital alterations.
"""
import math
import numpy as np
from typing import List, Dict, Tuple, Optional, Any
from pydantic import BaseModel, Field

from backend.app.geometry.template import TD3PassportTemplate, DEFAULT_TD3_TEMPLATE


class BoundingBox(BaseModel):
    """Spatial bounding box in absolute pixels and normalized relative units."""
    x: int
    y: int
    w: int
    h: int
    rel_x: float = Field(..., description="Normalized x (0.0 - 1.0)")
    rel_y: float = Field(..., description="Normalized y (0.0 - 1.0)")
    rel_w: float = Field(..., description="Normalized width (0.0 - 1.0)")
    rel_h: float = Field(..., description="Normalized height (0.0 - 1.0)")
    aspect_ratio: float = Field(..., description="width / height")

    @classmethod
    def from_pixels(cls, x: int, y: int, w: int, h: int, img_w: int, img_h: int):
        img_w = max(img_w, 1)
        img_h = max(img_h, 1)
        ar = w / max(float(h), 1e-6)
        return cls(
            x=int(x),
            y=int(y),
            w=int(w),
            h=int(h),
            rel_x=round(x / img_w, 4),
            rel_y=round(y / img_h, 4),
            rel_w=round(w / img_w, 4),
            rel_h=round(h / img_h, 4),
            aspect_ratio=round(ar, 4)
        )


class GeometricMeasurement(BaseModel):
    """An individual spatial measurement compared against standard template specifications."""
    metric_name: str
    measured_value: float
    expected_value: float
    unit: str = "ratio"  # ratio, px, deg, mm
    deviation: float
    tolerance: float
    is_valid: bool
    severity: str = "NONE"  # NONE, LOW, MEDIUM, HIGH
    detail: Optional[str] = None


class OverlayBox(BaseModel):
    """Rendering payload for UI visual inspection overlays."""
    label: str
    box: Dict[str, int]  # x, y, w, h
    status: str  # valid, warning, anomaly
    color_hex: str


class PassportGeometryReport(BaseModel):
    """Complete Geometric and Layout Verification Report."""
    is_layout_valid: bool = Field(..., description="True if no high-risk layout anomalies detected")
    geometry_risk_score: float = Field(..., description="0.0 (perfect alignment) to 1.0 (severe layout distortion)")
    geometry_risk_level: str = "LOW"  # LOW, MEDIUM, HIGH
    
    # Component locations
    photo_box: Optional[BoundingBox] = None
    mrz_box: Optional[BoundingBox] = None
    text_line_boxes: List[BoundingBox] = []
    
    # Detailed measurements
    measurements: List[GeometricMeasurement] = []
    tampering_flags: List[str] = []
    
    # Summary metrics
    photo_alignment_score: float = 1.0
    text_alignment_score: float = 1.0
    mrz_alignment_score: float = 1.0
    
    # Visual overlay annotations for UI
    overlay_annotations: List[OverlayBox] = []
    recommendation: str = "Layout conforms to ICAO TD3 passport specifications."


def detect_photo_bounding_box(image: np.ndarray) -> Optional[BoundingBox]:
    """
    Locates the photo region in a normalized document image using contour analysis
    across the entire document body (above the MRZ zone).
    """
    try:
        import cv2
        h, w = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image

        # Search across the VIZ/photo body area (above MRZ at 0.72)
        roi_y1 = int(h * 0.12)
        roi_y2 = int(h * 0.72)
        roi_gray = gray[roi_y1:roi_y2, 0:w]

        # Edge detection & contour search
        blurred = cv2.GaussianBlur(roi_gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 40, 120)
        
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        dilated = cv2.dilate(edges, kernel, iterations=2)

        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        candidates = []
        for c in contours:
            (x, y, cw, ch) = cv2.boundingRect(c)
            rel_w = cw / float(w)
            rel_h = ch / float(h)
            ar = cw / float(max(ch, 1))

            # Standard photo is roughly 16%-35% of doc width, 25%-50% of doc height, aspect ratio ~ 0.55 - 1.05
            if 0.16 <= rel_w <= 0.38 and 0.25 <= rel_h <= 0.55 and 0.50 <= ar <= 1.10:
                area = cw * ch
                candidates.append((x, y + roi_y1, cw, ch, area))

        if candidates:
            # Pick largest candidate
            candidates.sort(key=lambda item: item[4], reverse=True)
            bx, by, bw, bh, _ = candidates[0]
            return BoundingBox.from_pixels(bx, by, bw, bh, w, h)

    except Exception:
        pass

    # Fallback to default expected photo coordinates
    h, w = image.shape[:2]
    spec = DEFAULT_TD3_TEMPLATE.PHOTO_SPEC
    return BoundingBox.from_pixels(
        int(spec.x_min * w),
        int(spec.y_min * h),
        int(spec.width * w),
        int(spec.height * h),
        w, h
    )


def detect_mrz_bounding_box(image: np.ndarray) -> Optional[BoundingBox]:
    """
    Locates the MRZ band bounding box in a normalized passport image.
    """
    try:
        import cv2
        h, w = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image

        rect_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 5))
        blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, rect_kernel)
        grad_x = cv2.Sobel(blackhat, ddepth=cv2.CV_32F, dx=1, dy=0, ksize=-1)
        grad_x = np.absolute(grad_x)
        (min_val, max_val) = (np.min(grad_x), np.max(grad_x))
        grad_x = (255 * ((grad_x - min_val) / (max_val - min_val + 1e-6))).astype("uint8")

        grad_x = cv2.GaussianBlur(grad_x, (5, 5), 0)
        grad_x = cv2.morphologyEx(grad_x, cv2.MORPH_CLOSE, rect_kernel)
        thresh = cv2.threshold(grad_x, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]

        sq_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 25))
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, sq_kernel)

        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        candidates = []
        for c in contours:
            (x, y, cw, ch) = cv2.boundingRect(c)
            ar = cw / float(max(ch, 1))
            if ar > 3.0 and cw > (w * 0.6) and y > (h * 0.60):
                candidates.append((x, y, cw, ch))

        if candidates:
            candidates.sort(key=lambda item: (item[1], item[2]), reverse=True)
            bx, by, bw, bh = candidates[0]
            return BoundingBox.from_pixels(bx, by, bw, bh, w, h)

    except Exception:
        pass

    # Fallback to default expected MRZ band
    h, w = image.shape[:2]
    spec = DEFAULT_TD3_TEMPLATE.MRZ_SPEC
    return BoundingBox.from_pixels(
        int(spec.x_min * w),
        int(spec.y_min * h),
        int(spec.width * w),
        int(spec.height * h),
        w, h
    )


def extract_text_line_bounding_boxes(
    image: np.ndarray,
    ocr_bboxes: Optional[List[Dict[str, int]]] = None
) -> List[BoundingBox]:
    """
    Extracts text line bounding boxes using OCR results or OpenCV morphological segmentation.
    """
    h, w = image.shape[:2]

    if ocr_bboxes:
        return [
            BoundingBox.from_pixels(b["x"], b["y"], b["w"], b["h"], w, h)
            for b in ocr_bboxes
            if b.get("w", 0) > 10 and b.get("h", 0) > 5
        ]

    boxes = []
    try:
        import cv2
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        
        viz_x1 = int(w * 0.28)
        viz_y1 = int(h * 0.15)
        viz_y2 = int(h * 0.74)
        viz_crop = gray[viz_y1:viz_y2, viz_x1:w]

        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (18, 3))
        thresh = cv2.adaptiveThreshold(viz_crop, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 4)
        dilated = cv2.dilate(thresh, kernel, iterations=2)

        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in contours:
            (x, y, cw, ch) = cv2.boundingRect(c)
            if 30 <= cw <= (w * 0.65) and 8 <= ch <= 50:
                abs_x = x + viz_x1
                abs_y = y + viz_y1
                boxes.append(BoundingBox.from_pixels(abs_x, abs_y, cw, ch, w, h))

        boxes.sort(key=lambda b: b.y)
    except Exception:
        pass

    return boxes


def evaluate_passport_geometry(
    image: np.ndarray,
    ocr_bboxes: Optional[List[Dict[str, int]]] = None,
    template: TD3PassportTemplate = DEFAULT_TD3_TEMPLATE
) -> PassportGeometryReport:
    """
    Runs comprehensive spatial and layout analysis on a normalized document image.
    """
    h, w = image.shape[:2]
    measurements: List[GeometricMeasurement] = []
    tampering_flags: List[str] = []
    overlays: List[OverlayBox] = []

    # 1. Document Aspect Ratio Check
    doc_ar = round(w / float(max(h, 1)), 4)
    doc_ar_dev = abs(doc_ar - template.STANDARD_ASPECT_RATIO)
    doc_ar_valid = doc_ar_dev <= template.ASPECT_RATIO_TOLERANCE
    doc_ar_severity = "NONE" if doc_ar_valid else ("LOW" if doc_ar_dev <= 0.08 else "MEDIUM")
    
    if not doc_ar_valid:
        tampering_flags.append(f"DOCUMENT_ASPECT_RATIO_ANOMALY: Measured {doc_ar:.3f} vs expected {template.STANDARD_ASPECT_RATIO:.3f}.")

    measurements.append(GeometricMeasurement(
        metric_name="Document Aspect Ratio",
        measured_value=doc_ar,
        expected_value=template.STANDARD_ASPECT_RATIO,
        unit="ratio (W/H)",
        deviation=round(doc_ar_dev, 4),
        tolerance=template.ASPECT_RATIO_TOLERANCE,
        is_valid=doc_ar_valid,
        severity=doc_ar_severity,
        detail="Standard ICAO TD3 passport width-to-height proportion (125mm x 88mm)."
    ))

    # 2. Photo Placement & Aspect Ratio Check
    photo_box = detect_photo_bounding_box(image)
    photo_score = 1.0

    if photo_box:
        # Photo Aspect Ratio
        expected_photo_ar = template.PHOTO_SPEC.aspect_ratio
        photo_ar_dev = abs(photo_box.aspect_ratio - expected_photo_ar)
        photo_ar_valid = photo_ar_dev <= template.PHOTO_SPEC.tolerance
        photo_ar_severity = "NONE" if photo_ar_valid else ("MEDIUM" if photo_ar_dev <= 0.15 else "HIGH")

        if not photo_ar_valid:
            tampering_flags.append(f"PHOTO_ASPECT_RATIO_DISTORTED: Ratio {photo_box.aspect_ratio:.2f} deviates from standard {expected_photo_ar:.2f}.")
            photo_score -= 0.35

        measurements.append(GeometricMeasurement(
            metric_name="Photo Box Aspect Ratio",
            measured_value=photo_box.aspect_ratio,
            expected_value=round(expected_photo_ar, 3),
            unit="ratio (W/H)",
            deviation=round(photo_ar_dev, 4),
            tolerance=template.PHOTO_SPEC.tolerance,
            is_valid=photo_ar_valid,
            severity=photo_ar_severity,
            detail="Standard 35mm x 45mm photo proportion."
        ))

        # Photo X-Position (Left Margin)
        photo_x_dev = abs(photo_box.rel_x - template.PHOTO_SPEC.x_min)
        photo_x_valid = photo_x_dev <= template.PHOTO_SPEC.tolerance
        photo_x_severity = "NONE" if photo_x_valid else "HIGH"

        if not photo_x_valid:
            tampering_flags.append(f"PHOTO_DISPLACED_X: Photo left offset {photo_box.rel_x:.3f} deviates from expected {template.PHOTO_SPEC.x_min:.3f}.")
            photo_score -= 0.40

        measurements.append(GeometricMeasurement(
            metric_name="Photo Left Offset",
            measured_value=photo_box.rel_x,
            expected_value=template.PHOTO_SPEC.x_min,
            unit="rel_x",
            deviation=round(photo_x_dev, 4),
            tolerance=template.PHOTO_SPEC.tolerance,
            is_valid=photo_x_valid,
            severity=photo_x_severity,
            detail="Normalized distance of photo from left document border."
        ))

        status = "valid" if (photo_ar_valid and photo_x_valid) else "anomaly"
        color = "#10B981" if status == "valid" else "#EF4444"
        overlays.append(OverlayBox(
            label="Photo Box",
            box={"x": photo_box.x, "y": photo_box.y, "w": photo_box.w, "h": photo_box.h},
            status=status,
            color_hex=color
        ))

    # 3. MRZ Band Geometry Check
    mrz_box = detect_mrz_bounding_box(image)
    mrz_score = 1.0

    if mrz_box:
        mrz_y_dev = abs(mrz_box.rel_y - template.MRZ_SPEC.y_min)
        mrz_y_valid = mrz_y_dev <= template.MRZ_SPEC.tolerance
        mrz_y_severity = "NONE" if mrz_y_valid else "HIGH"

        if not mrz_y_valid:
            tampering_flags.append(f"MRZ_BAND_DISPLACED: MRZ vertical position {mrz_box.rel_y:.3f} deviates from expected {template.MRZ_SPEC.y_min:.3f}.")
            mrz_score -= 0.40

        measurements.append(GeometricMeasurement(
            metric_name="MRZ Band Vertical Position",
            measured_value=mrz_box.rel_y,
            expected_value=template.MRZ_SPEC.y_min,
            unit="rel_y",
            deviation=round(mrz_y_dev, 4),
            tolerance=template.MRZ_SPEC.tolerance,
            is_valid=mrz_y_valid,
            severity=mrz_y_severity,
            detail="Distance of MRZ band from top edge (lower ~25% of card)."
        ))

        mrz_w_dev = abs(mrz_box.rel_w - template.MRZ_SPEC.width)
        mrz_w_valid = mrz_w_dev <= template.MRZ_SPEC.tolerance
        mrz_w_severity = "NONE" if mrz_w_valid else "MEDIUM"

        measurements.append(GeometricMeasurement(
            metric_name="MRZ Width Coverage",
            measured_value=mrz_box.rel_w,
            expected_value=template.MRZ_SPEC.width,
            unit="rel_w",
            deviation=round(mrz_w_dev, 4),
            tolerance=template.MRZ_SPEC.tolerance,
            is_valid=mrz_w_valid,
            severity=mrz_w_severity,
            detail="MRZ span across horizontal width of document."
        ))

        status = "valid" if (mrz_y_valid and mrz_w_valid) else "anomaly"
        color = "#10B981" if status == "valid" else "#EF4444"
        overlays.append(OverlayBox(
            label="MRZ Zone",
            box={"x": mrz_box.x, "y": mrz_box.y, "w": mrz_box.w, "h": mrz_box.h},
            status=status,
            color_hex=color
        ))

    # 4. Text Line Alignment & Vertical Pitch Regularity
    text_boxes = extract_text_line_bounding_boxes(image, ocr_bboxes)
    text_score = 1.0

    if len(text_boxes) >= 3:
        y_centers = [b.y + b.h / 2.0 for b in text_boxes]
        pitches = [y_centers[i+1] - y_centers[i] for i in range(len(y_centers)-1)]
        valid_pitches = [p for p in pitches if 15 <= p <= (h * 0.18)]

        if valid_pitches:
            mean_pitch = float(np.mean(valid_pitches))
            std_pitch = float(np.std(valid_pitches))
            rel_mean_pitch = mean_pitch / float(h)
            
            pitch_regularity_valid = (std_pitch / max(mean_pitch, 1e-6)) < 0.40
            pitch_severity = "NONE" if pitch_regularity_valid else "HIGH"

            if not pitch_regularity_valid:
                tampering_flags.append(f"UNEVEN_LINE_PITCH: Irregular vertical spacing detected across text fields (std={std_pitch:.1f}px).")
                text_score -= 0.40

            measurements.append(GeometricMeasurement(
                metric_name="Text Line Pitch Regularity",
                measured_value=round(mean_pitch, 1),
                expected_value=round(template.NOMINAL_LINE_PITCH * h, 1),
                unit="pixels",
                deviation=round(std_pitch, 2),
                tolerance=round(template.LINE_PITCH_TOLERANCE * h, 1),
                is_valid=pitch_regularity_valid,
                severity=pitch_severity,
                detail="Evenness of vertical spacing between consecutive text fields."
            ))

        for idx, tb in enumerate(text_boxes[:8]):
            overlays.append(OverlayBox(
                label=f"Text Line {idx+1}",
                box={"x": tb.x, "y": tb.y, "w": tb.w, "h": tb.h},
                status="valid",
                color_hex="#3B82F6"
            ))

    component_scores = [photo_score, mrz_score, text_score]
    min_score = min(component_scores)
    risk_score = round(1.0 - min_score, 2)
    
    if any(m.severity == "HIGH" for m in measurements) or risk_score >= 0.5:
        risk_level = "HIGH"
        recommendation = "Secondary Layout Inspection Required: Physical photo placement or text alignment contradicts ICAO TD3 template."
    elif any(m.severity == "MEDIUM" for m in measurements) or risk_score >= 0.25:
        risk_level = "MEDIUM"
        recommendation = "Supervisor Review Recommended: Minor spatial deviation or line spacing irregularity detected."
    else:
        risk_level = "LOW"
        recommendation = "Standard Clearance: Document margins, photo geometry, and text alignment conform to ICAO TD3 standards."

    is_layout_valid = (risk_level == "LOW")

    return PassportGeometryReport(
        is_layout_valid=is_layout_valid,
        geometry_risk_score=risk_score,
        geometry_risk_level=risk_level,
        photo_box=photo_box,
        mrz_box=mrz_box,
        text_line_boxes=text_boxes,
        measurements=measurements,
        tampering_flags=tampering_flags,
        photo_alignment_score=round(max(0.0, photo_score), 2),
        text_alignment_score=round(max(0.0, text_score), 2),
        mrz_alignment_score=round(max(0.0, mrz_score), 2),
        overlay_annotations=overlays,
        recommendation=recommendation
    )
