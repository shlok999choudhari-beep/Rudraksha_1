"""
Image Quality Assessment & Screening Gate.
Evaluates physical capture fidelity (blur, illumination, resolution) to prevent
poor camera captures from being falsely classified as malicious document fraud.
"""
import cv2
import numpy as np
from typing import Dict, Any
from pydantic import BaseModel, Field


class QualityGateResult(BaseModel):
    is_acceptable: bool = Field(..., description="True if image quality is sufficient for screening")
    quality_verdict: str = "PASS"  # PASS, WARNING, RESCAN_REQUIRED
    blur_score: float
    glare_score: float
    resolution_w: int
    resolution_h: int
    quality_flags: list = []
    recommendation: str = "Image capture quality is optimal."


def assess_capture_quality(image: np.ndarray) -> QualityGateResult:
    """
    Assesses image capture fidelity.
    """
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    
    # 1. Blur evaluation via variance of Laplacian
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    
    # 2. Glare / overexposure evaluation
    overexposed_pixels = np.sum(gray > 250)
    total_pixels = float(h * w)
    glare_ratio = float(overexposed_pixels / total_pixels)

    flags = []
    verdict = "PASS"
    is_acceptable = True
    recommendation = "Image quality is suitable for forensic analysis."

    # Minimum resolution check
    if w < 700 or h < 500:
        flags.append("LOW_RESOLUTION: Image dimensions are too small for reliable optical inspection.")
        verdict = "RESCAN_REQUIRED"
        is_acceptable = False
        recommendation = "RESCAN REQUIRED: Please upload a higher resolution document capture."

    # Severe blur check
    elif laplacian_var < 35.0:
        flags.append(f"SEVERE_BLUR: Image is out of focus (sharpness score: {laplacian_var:.1f}).")
        verdict = "RESCAN_REQUIRED"
        is_acceptable = False
        recommendation = "RESCAN REQUIRED: Image is blurry. Please hold the camera steady and recapture."

    # Mild blur warning
    elif laplacian_var < 75.0:
        flags.append(f"MILD_BLUR: Marginal focus sharpness (score: {laplacian_var:.1f}).")
        verdict = "WARNING"
        recommendation = "Proceed with caution: document focus is marginal."

    # Glare warning
    if glare_ratio > 0.08:
        flags.append(f"SPECULAR_GLARE: Overexposed reflection detected ({glare_ratio*100:.1f}% area).")
        if verdict != "RESCAN_REQUIRED":
            verdict = "WARNING"

    return QualityGateResult(
        is_acceptable=is_acceptable,
        quality_verdict=verdict,
        blur_score=round(laplacian_var, 1),
        glare_score=round(glare_ratio, 3),
        resolution_w=w,
        resolution_h=h,
        quality_flags=flags,
        recommendation=recommendation
    )
