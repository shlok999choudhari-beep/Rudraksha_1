"""
Forensic Tamper Detection Aggregator Engine.
Combines Error Level Analysis (ELA), Noise Variance Maps, and Copy-Move Clone Localization
into a unified, explainable tamper assessment report for passport screening.
"""
import base64
import cv2
import numpy as np
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

from backend.app.tampering.ela import analyze_ela, ELAResult
from backend.app.tampering.noise import analyze_noise_inconsistency, NoiseAnalysisResult
from backend.app.tampering.copy_move import analyze_copy_move, CopyMoveResult


class ForensicTamperReport(BaseModel):
    """Complete multi-modal image forensics report."""
    is_tampered: bool = Field(..., description="True if significant image tampering detected")
    tamper_risk_score: float = Field(..., description="0.0 (authentic) to 1.0 (manipulated)")
    tamper_risk_level: str = "LOW"  # LOW, MEDIUM, HIGH
    
    # Forensic sub-module results
    ela_result: ELAResult
    noise_result: NoiseAnalysisResult
    copy_move_result: CopyMoveResult
    
    # Consolidated suspicious tampering regions
    suspicious_regions: List[Dict[str, Any]] = []
    tampering_flags: List[str] = []
    
    # UI Visualization Assets
    annotated_overlay_base64: Optional[str] = None
    recommendation: str = "No significant visual tampering detected."


def generate_composite_tamper_overlay(
    image: np.ndarray,
    suspicious_regions: List[Dict[str, Any]]
) -> str:
    """
    Renders visual bounding box overlays and anomaly labels on the image for the officer UI.
    """
    overlay = image.copy()
    
    color_map = {
        "ELA_COMPRESSION_DISCREPANCY": (0, 0, 255),       # Red
        "NOISE_VARIANCE_INCONSISTENCY": (0, 165, 255),    # Orange
        "COPY_MOVE_CLONE": (255, 0, 255)                 # Magenta
    }

    for region in suspicious_regions:
        x, y, w, h = region["x"], region["y"], region["w"], region["h"]
        t_type = region.get("tamper_type", "TAMPER_ANOMALY")
        color = color_map.get(t_type, (0, 0, 255))
        
        # Bounding box
        cv2.rectangle(overlay, (x, y), (x + w, y + h), color, 2)
        
        # Label badge
        label = t_type.replace("_", " ")[:22]
        cv2.putText(overlay, label, (x, max(y - 8, 15)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1)

    _, buffer = cv2.imencode(".jpg", overlay)
    return f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"


def analyze_document_tampering(image: np.ndarray) -> ForensicTamperReport:
    """
    Runs the complete forensic tamper analysis pipeline on a document image.

    Args:
        image: BGR document image.

    Returns:
        ForensicTamperReport with aggregated risk score, heatmaps, and localized boxes.
    """
    if image is None or image.size == 0:
        raise ValueError("Invalid or empty image provided.")

    # 1. Run Error Level Analysis (ELA)
    ela_res = analyze_ela(image)

    # 2. Run Noise Variance Analysis
    noise_res = analyze_noise_inconsistency(image)

    # 3. Run Copy-Move Clone Analysis
    copy_res = analyze_copy_move(image)

    # 4. Consolidate suspicious regions & flags
    all_regions = []
    flags = []

    if ela_res.has_anomaly:
        flags.append(f"ELA_ANOMALY: High compression discrepancy detected (score: {ela_res.anomaly_score:.2f}).")
        all_regions.extend(ela_res.suspicious_regions)

    if noise_res.has_noise_anomaly:
        flags.append(f"NOISE_INCONSISTENCY: Sensor noise variance discrepancy detected (score: {noise_res.noise_anomaly_score:.2f}).")
        all_regions.extend(noise_res.suspicious_regions)

    if copy_res.is_clone_detected:
        flags.append(f"COPY_MOVE_DETECTED: Duplicated image patches identified ({len(copy_res.cloned_pairs)} clone pairs).")
        all_regions.extend(copy_res.suspicious_regions)

    # 5. Weighted Risk Aggregation
    # Weights: ELA (40%), Noise Variance (35%), Copy-Move (25%)
    weighted_score = (
        (ela_res.anomaly_score * 0.40) +
        (noise_res.noise_anomaly_score * 0.35) +
        (copy_res.clone_anomaly_score * 0.25)
    )

    # If copy-move or high ELA is triggered, boost score
    if copy_res.is_clone_detected:
        weighted_score = max(weighted_score, 0.70)
    if len(ela_res.suspicious_regions) >= 2:
        weighted_score = max(weighted_score, 0.65)

    tamper_score = round(min(1.0, weighted_score), 2)

    # Determine 3-tier risk level
    if tamper_score >= 0.55:
        risk_level = "HIGH"
        recommendation = "Secondary Inspection Required: Strong forensic evidence of image tampering (spliced elements or cloned patches)."
    elif tamper_score >= 0.25 or len(all_regions) > 0:
        risk_level = "MEDIUM"
        recommendation = "Supervisor Review Recommended: Minor compression or noise variance anomaly detected."
    else:
        risk_level = "LOW"
        recommendation = "Standard Clearance: No forensic manipulation detected; compression and sensor noise are uniform."

    is_tampered = (risk_level == "HIGH")

    # Generate composite annotated overlay
    annotated_overlay = generate_composite_tamper_overlay(image, all_regions)

    return ForensicTamperReport(
        is_tampered=is_tampered,
        tamper_risk_score=tamper_score,
        tamper_risk_level=risk_level,
        ela_result=ela_res,
        noise_result=noise_res,
        copy_move_result=copy_res,
        suspicious_regions=all_regions,
        tampering_flags=flags,
        annotated_overlay_base64=annotated_overlay,
        recommendation=recommendation
    )
