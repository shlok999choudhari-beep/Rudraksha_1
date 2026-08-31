"""
Error Level Analysis (ELA) Forensic Engine.
Analyzes JPEG recompression discrepancies across image regions to localize
digital modifications, spliced elements, and text/photo alterations.
"""
import io
import cv2
import numpy as np
from PIL import Image, ImageEnhance
from typing import Tuple, List, Dict, Optional, Any
from pydantic import BaseModel, Field


class ELAResult(BaseModel):
    """Structured result of Error Level Analysis."""
    anomaly_score: float = Field(..., description="0.0 (uniform compression) to 1.0 (severe tampering)")
    has_anomaly: bool
    mean_error: float
    max_error: float
    suspicious_regions: List[Dict[str, Any]] = []  # List of bounding boxes (x, y, w, h, score)
    heatmap_base64: Optional[str] = None


def compute_ela_image(
    image: np.ndarray,
    quality: int = 90,
    multiplier: float = 15.0
) -> Tuple[np.ndarray, np.ndarray, float, float]:
    """
    Computes Error Level Analysis difference map.

    Args:
        image: Original BGR or RGB image.
        quality: JPEG compression quality for re-saving (standard 90-95).
        multiplier: Error amplification factor for visual clarity.

    Returns:
        (ela_enhanced_bgr, ela_heatmap_bgr, mean_error, max_error)
    """
    if image is None or image.size == 0:
        raise ValueError("Invalid or empty image provided.")

    # 1. Convert BGR to RGB for PIL processing
    rgb_img = cv2.cvtColor(image, cv2.COLOR_BGR2RGB) if len(image.shape) == 3 else image
    pil_orig = Image.fromarray(rgb_img)

    # 2. Re-compress into memory at standard JPEG quality
    buffer = io.BytesIO()
    pil_orig.save(buffer, format="JPEG", quality=quality)
    buffer.seek(0)
    pil_recompressed = Image.open(buffer)

    # 3. Compute absolute difference between original and recompressed
    arr_orig = np.asarray(pil_orig, dtype=np.float32)
    arr_recomp = np.asarray(pil_recompressed, dtype=np.float32)

    diff = np.abs(arr_orig - arr_recomp)
    
    # Calculate statistical metrics on raw unscaled diff
    mean_error = float(np.mean(diff))
    max_error = float(np.max(diff))

    # 4. Amplify error for visualization
    ela_amplified = np.clip(diff * multiplier, 0, 255).astype(np.uint8)

    # 5. Generate thermal heatmap (Turbo / Jet colormap)
    gray_diff = cv2.cvtColor(ela_amplified, cv2.COLOR_RGB2GRAY) if len(ela_amplified.shape) == 3 else ela_amplified
    
    # Apply Gaussian smoothing to group localized compression noise clusters
    smoothed = cv2.GaussianBlur(gray_diff, (9, 9), 0)
    norm_heatmap = cv2.normalize(smoothed, None, 0, 255, cv2.NORM_MINMAX)
    heatmap_colored = cv2.applyColorMap(norm_heatmap, cv2.COLORMAP_TURBO)

    # Convert amplified ELA back to BGR for OpenCV standard
    ela_bgr = cv2.cvtColor(ela_amplified, cv2.COLOR_RGB2BGR)

    return ela_bgr, heatmap_colored, mean_error, max_error


def detect_ela_suspicious_regions(
    ela_diff_gray: np.ndarray,
    min_intensity: int = 72,
    min_area: int = 250
) -> List[Dict[str, Any]]:
    """
    Identifies localized high-energy error clusters indicating spliced elements.
    """
    h, w = ela_diff_gray.shape[:2]
    
    # Require absolute high-energy difference above noise floor
    _, binary = cv2.threshold(ela_diff_gray, min_intensity, 255, cv2.THRESH_BINARY)

    # Morphological closing to group nearby anomaly pixels
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (11, 11))
    closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    suspicious_boxes = []
    for c in contours:
        area = cv2.contourArea(c)
        if area >= min_area:
            x, y, cw, ch = cv2.boundingRect(c)
            # Exclude full document border artifacts
            if cw < (w * 0.90) and ch < (h * 0.90):
                mask = np.zeros((h, w), dtype=np.uint8)
                cv2.drawContours(mask, [c], -1, 255, -1)
                mean_intensity = float(cv2.mean(ela_diff_gray, mask=mask)[0])
                
                if mean_intensity >= min_intensity:
                    suspicious_boxes.append({
                        "x": int(x),
                        "y": int(y),
                        "w": int(cw),
                        "h": int(ch),
                        "area": int(area),
                        "anomaly_intensity": round(mean_intensity, 2),
                        "tamper_type": "ELA_COMPRESSION_DISCREPANCY"
                    })

    # Sort by anomaly intensity descending
    suspicious_boxes.sort(key=lambda b: b["anomaly_intensity"], reverse=True)
    return suspicious_boxes


def analyze_ela(image: np.ndarray) -> ELAResult:
    """
    High-level Error Level Analysis execution.
    """
    import base64
    ela_bgr, heatmap_bgr, mean_err, max_err = compute_ela_image(image)
    
    gray_diff = cv2.cvtColor(ela_bgr, cv2.COLOR_BGR2GRAY)
    suspicious_boxes = detect_ela_suspicious_regions(gray_diff)

    # Clean authentic documents have low mean error (typically 0.3 - 2.5)
    # Spliced tampered documents have localized high-error spikes and higher mean errors (> 4.5)
    mean_err_score = min(1.0, max(0.0, (mean_err - 3.0) / 6.0))
    cluster_score = min(1.0, len(suspicious_boxes) * 0.35)
    
    anomaly_score = round(min(1.0, (mean_err_score * 0.5) + (cluster_score * 0.5)), 2)
    has_anomaly = (anomaly_score >= 0.35) or (len(suspicious_boxes) > 0)

    # Encode heatmap to base64
    _, buffer = cv2.imencode(".jpg", heatmap_bgr)
    b64_heatmap = base64.b64encode(buffer).decode("utf-8")

    return ELAResult(
        anomaly_score=anomaly_score,
        has_anomaly=has_anomaly,
        mean_error=round(mean_err, 2),
        max_error=round(max_err, 2),
        suspicious_regions=suspicious_boxes,
        heatmap_base64=f"data:image/jpeg;base64,{b64_heatmap}"
    )

