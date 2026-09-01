"""
Explainable 360° Trust & Risk Decision Engine for VeriGuard AI.
Integrates Image Quality, Deterministic Document Validity, ICAO VIZ<->MRZ Consistency,
Forensic Tampering Signals, and Biometric Verification into clear, actionable,
bullet-point explainable intelligence for border control officers.
"""
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field


class ExplainableDecisionReport(BaseModel):
    risk_level: str = "LOW"            # LOW, MEDIUM, HIGH, INCONCLUSIVE
    risk_score: float = Field(..., description="0.0 (Safe / Low Risk) to 100.0 (High Risk / Forgery)")
    trust_score: float = Field(..., description="0.0 (Fraudulent) to 100.0 (Verified Authentic)")
    decision: str = "APPROVED_FOR_CLEARANCE"
    
    # Explainable Bullets
    risk_reasons: List[str] = []
    advisory_notes: List[str] = []
    recommended_action: str = "CLEAR: Document and identity verified for border passage."

    # Subsystem Confidence Breakdown
    quality_status: str = "PASS"
    document_validity_status: str = "PASS"
    identity_consistency_status: str = "PASS"
    forensic_integrity_status: str = "PASS"
    biometric_status: str = "PASS"


def evaluate_screening_decision(
    quality_res: Any,
    doc_validation_res: Any,
    cross_val_res: Any,
    forensics_res: Any,
    face_verified: Optional[bool] = None,
    face_similarity: Optional[float] = None,
    face_live: Optional[bool] = None
) -> ExplainableDecisionReport:
    """
    Synthesizes multi-modal screening evidence into an explainable decision report.
    """
    reasons: List[str] = []
    advisory: List[str] = []
    
    # Base risk score: 0 (No risk) to 100 (Maximum risk)
    accumulated_risk = 0.0

    # -------------------------------------------------------------
    # 1. Quality Gate Check
    # -------------------------------------------------------------
    quality_status = getattr(quality_res, "quality_verdict", "PASS")
    is_quality_acceptable = getattr(quality_res, "is_acceptable", True)
    
    if not is_quality_acceptable:
        for f in getattr(quality_res, "quality_flags", []):
            reasons.append(f"Image Quality Defect: {f}")
        
        return ExplainableDecisionReport(
            risk_level="INCONCLUSIVE",
            risk_score=50.0,
            trust_score=0.0,
            decision="RESCAN_REQUIRED",
            risk_reasons=reasons,
            advisory_notes=["Document could not be evaluated reliably due to optical capture defects."],
            recommended_action="RESCAN: Request traveler or operator recapture document with clear focus.",
            quality_status=quality_status,
            document_validity_status="UNEVALUATED",
            identity_consistency_status="UNEVALUATED",
            forensic_integrity_status="UNEVALUATED",
            biometric_status="UNEVALUATED"
        )

    # -------------------------------------------------------------
    # 2. Deterministic Document Validity & Expiration
    # -------------------------------------------------------------
    doc_validity_status = "PASS"
    if not getattr(doc_validation_res, "is_valid", True):
        doc_validity_status = "FAIL"
        accumulated_risk += 45.0
        for err in getattr(doc_validation_res, "critical_errors", []):
            reasons.append(f"Document Rule Violation: {err}")

    for w in getattr(doc_validation_res, "warnings", []):
        advisory.append(f"Document Notice: {w}")

    # -------------------------------------------------------------
    # 3. ICAO VIZ <-> MRZ Cross-Validation
    # -------------------------------------------------------------
    identity_status = "PASS"
    is_consistent = getattr(cross_val_res, "is_consistent", True)
    if not is_consistent:
        identity_status = "MISMATCH"
        accumulated_risk += 40.0
        details = getattr(cross_val_res, "field_details", {})
        for field_name, f_res in details.items():
            if not f_res.is_match and f_res.discrepancy_reason:
                reasons.append(f"Identity Data Mismatch: {f_res.discrepancy_reason}")

    # -------------------------------------------------------------
    # 4. Forensic Tamper Analysis (ELA, Noise, Copy-Move, Metadata)
    # -------------------------------------------------------------
    forensic_status = "PASS"
    tamper_score = getattr(forensics_res, "tamper_risk_score", 0.0)
    is_tampered = getattr(forensics_res, "is_tampered", False)

    # Check for ELA anomaly
    ela_score = getattr(getattr(forensics_res, "ela_result", None), "anomaly_score", 0.0)
    if ela_score >= 0.15:
        accumulated_risk += 25.0
        forensic_status = "TAMPER_DETECTED"
        reasons.append(f"Compression Anomaly: ELA detected re-compression boundary indicative of altered text/photo (score: {ela_score:.2f}).")

    # Check for Copy-Move cloned regions
    clones = getattr(getattr(forensics_res, "copy_move_result", None), "cloned_pairs", [])
    if len(clones) > 0:
        accumulated_risk += 35.0
        forensic_status = "TAMPER_DETECTED"
        reasons.append(f"Clone Forgery: {len(clones)} duplicated / copied stamp or texture clusters localized on canvas.")

    # Check for Metadata editing software
    meta_flags = getattr(forensics_res, "tampering_flags", [])
    for mf in meta_flags:
        if "software" in mf.lower() or "photoshop" in mf.lower() or "gimp" in mf.lower():
            accumulated_risk += 20.0
            reasons.append(f"Metadata Anomaly: {mf}")

    # -------------------------------------------------------------
    # 5. Biometric Face Verification
    # -------------------------------------------------------------
    biometric_status = "PASS"
    if face_verified is not None:
        if not face_verified:
            biometric_status = "MISMATCH"
            accumulated_risk += 40.0
            reasons.append(f"Biometric Mismatch: Live selfie face did not match document portrait (similarity: {face_similarity:.2f}).")
        if face_live is False:
            biometric_status = "SPOOF_ALERT"
            accumulated_risk += 50.0
            reasons.append("Biometric Presentation Attack: Live face presentation liveness check failed (potential screen/printed photo spoof).")

    # -------------------------------------------------------------
    # Final Risk Calibration & Action Recommendation
    # -------------------------------------------------------------
    total_risk = min(100.0, max(0.0, accumulated_risk))
    trust_score = round(100.0 - total_risk, 1)

    if total_risk >= 35.0 or len(reasons) > 0:
        if total_risk >= 50.0:
            risk_level = "HIGH"
            decision = "SECONDARY_INSPECTION_REQUIRED"
            recommendation = "SECONDARY INSPECTION: Route traveler to interview; significant forgery or identity discrepancy detected."
        else:
            risk_level = "MEDIUM"
            decision = "MANUAL_SUPERVISOR_REVIEW"
            recommendation = "SUPERVISOR REVIEW: Inspect document manually to resolve flagged advisories before granting clearance."
    else:
        risk_level = "LOW"
        decision = "APPROVED_FOR_CLEARANCE"
        recommendation = "CLEAR: Document and identity verified for border passage."

    return ExplainableDecisionReport(
        risk_level=risk_level,
        risk_score=round(total_risk, 1),
        trust_score=trust_score,
        decision=decision,
        risk_reasons=reasons,
        advisory_notes=advisory,
        recommended_action=recommendation,
        quality_status=quality_status,
        document_validity_status=doc_validity_status,
        identity_consistency_status=identity_status,
        forensic_integrity_status=forensic_status,
        biometric_status=biometric_status
    )
