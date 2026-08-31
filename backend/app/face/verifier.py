"""
Unified Face Verification and Liveness Analysis Orchestrator.
Combines 1:1 facial embedding matching and passive anti-spoofing presentation attack detection.
"""
import base64
import cv2
import numpy as np
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from backend.app.face.extractor import extract_face_crop
from backend.app.face.matcher import verify_face_match, FaceMatchResult
from backend.app.face.liveness import evaluate_passive_liveness, LivenessResult


class FaceVerificationReport(BaseModel):
    """Complete Face Verification and Passive Anti-Spoofing Screening Report."""
    is_verified: bool = Field(..., description="True if face matches AND passes passive liveness")
    face_similarity_score: float = Field(..., description="0.0 to 1.0 similarity")
    match_status: str  # MATCH, MISMATCH, UNCERTAIN
    is_live: bool
    liveness_score: float
    spoof_type: str
    
    # Risk Metrics
    face_risk_score: float = Field(..., description="0.0 (authentic match) to 1.0 (impersonation/spoof)")
    face_risk_level: str = "LOW"  # LOW, MEDIUM, HIGH
    
    # Detailed sub-results
    match_details: FaceMatchResult
    liveness_details: LivenessResult
    
    # Visual Crops for UI rendering
    doc_face_crop_base64: Optional[str] = None
    live_face_crop_base64: Optional[str] = None
    
    # Flags and guidance
    tampering_flags: List[str] = []
    recommendation: str = "Identity verified successfully."


def encode_image_to_base64(img: np.ndarray) -> Optional[str]:
    """Encodes BGR image to base64 data URI."""
    if img is None or img.size == 0:
        return None
    success, buffer = cv2.imencode(".jpg", img)
    if not success:
        return None
    b64_str = base64.b64encode(buffer).decode("utf-8")
    return f"data:image/jpeg;base64,{b64_str}"


def verify_identity_and_liveness(
    doc_image: np.ndarray,
    live_image: np.ndarray
) -> FaceVerificationReport:
    """
    Executes full face verification and anti-spoofing pipeline:
    1. Extracts and normalizes document face photo.
    2. Extracts live selfie face crop.
    3. Computes 1:1 embedding match and cosine similarity.
    4. Evaluates passive presentation attack detection (Moire / Screen / Print).
    5. Calculates calibrated risk level and generates UI evidence thumbnails.

    Args:
        doc_image: Passport / ID document image.
        live_image: Live camera selfie capture.

    Returns:
        FaceVerificationReport with similarity, liveness, risk score, and crops.
    """
    flags = []

    # 1. Extract Face Crops
    doc_crop, doc_bbox, doc_conf = extract_face_crop(doc_image, is_document=True)
    live_crop, live_bbox, live_conf = extract_face_crop(live_image, is_document=False)

    if doc_crop is None:
        flags.append("DOCUMENT_PHOTO_MISSING: Could not detect or extract face from document image.")
    if live_crop is None:
        flags.append("LIVE_FACE_MISSING: No live human face detected in camera viewport (subject out of frame).")

    # If live face is missing, immediately fail verification with 0.0 similarity & High Risk
    if live_crop is None or doc_crop is None:
        match_result = FaceMatchResult(
            match_status="MISMATCH",
            similarity_score=0.0,
            cosine_distance=1.0,
            is_match=False,
            confidence=0.0,
            details="No live human face detected in camera viewport." if live_crop is None else "No document portrait detected."
        )
        liveness_result = LivenessResult(
            is_live=False,
            liveness_score=0.0,
            spoof_type="NO_FACE",
            confidence=1.0,
            details="Subject not detected in camera frame."
        )
        return FaceVerificationReport(
            is_verified=False,
            face_similarity_score=0.0,
            match_status="MISMATCH",
            is_live=False,
            liveness_score=0.0,
            spoof_type="NO_FACE",
            face_risk_score=1.0,
            face_risk_level="HIGH",
            match_details=match_result,
            liveness_details=liveness_result,
            doc_face_crop_base64=encode_image_to_base64(doc_crop) if doc_crop is not None else None,
            live_face_crop_base64=None,
            tampering_flags=flags,
            recommendation="Verification Failed: Subject out of frame. Please ensure the applicant is positioned clearly in front of the camera."
        )

    # 2. 1:1 Similarity Matching
    match_result = verify_face_match(doc_crop, live_crop)
    if match_result.match_status == "MISMATCH":
        flags.append(f"FACE_MISMATCH: Live person does not match document photo ({match_result.similarity_score:.1%} match).")
    elif match_result.match_status == "UNCERTAIN":
        flags.append(f"FACE_SIMILARITY_BORDERLINE: Moderate similarity ({match_result.similarity_score:.1%}), manual review recommended.")

    # 3. Passive Liveness Assessment on live selfie
    liveness_result = evaluate_passive_liveness(live_crop)
    if not liveness_result.is_live:
        flags.append(f"LIVENESS_FAILED_{liveness_result.spoof_type}: {liveness_result.details}")

    # 4. Calculate Combined Face Risk Score
    mismatch_risk = 1.0 - match_result.similarity_score
    spoof_risk = 1.0 - liveness_result.liveness_score

    risk_score = round(min(1.0, (mismatch_risk * 0.60) + (spoof_risk * 0.40)), 2)
    if not liveness_result.is_live:
        risk_score = max(risk_score, 0.75)
    if match_result.match_status == "MISMATCH":
        risk_score = max(risk_score, 0.80)

    if risk_score >= 0.60:
        risk_level = "HIGH"
        recommendation = "Secondary Inspection Required: Identity mismatch or presentation spoof attack detected."
    elif risk_score >= 0.35:
        risk_level = "MEDIUM"
        recommendation = "Supervisor Review Recommended: Borderline face match or suboptimal selfie lighting."
    else:
        risk_level = "LOW"
        recommendation = "Standard Clearance: Live identity verified against document photograph."

    is_verified = (risk_level == "LOW") and match_result.is_match and liveness_result.is_live

    return FaceVerificationReport(
        is_verified=is_verified,
        face_similarity_score=match_result.similarity_score,
        match_status=match_result.match_status,
        is_live=liveness_result.is_live,
        liveness_score=liveness_result.liveness_score,
        spoof_type=liveness_result.spoof_type,
        face_risk_score=risk_score,
        face_risk_level=risk_level,
        match_details=match_result,
        liveness_details=liveness_result,
        doc_face_crop_base64=encode_image_to_base64(doc_crop),
        live_face_crop_base64=encode_image_to_base64(live_crop),
        tampering_flags=flags,
        recommendation=recommendation
    )
