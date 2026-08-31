"""
4-Layer Trust & Risk Scoring Engine for Border Control & Identity Screening.
Calibrates holistic document trust from Physical Integrity, ICAO Data Consistency,
Forensic Tamper Security, and Biometric Identity Authenticity.
"""
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class ScoringLayerBreakdown(BaseModel):
    """Breakdown of an individual risk/trust scoring layer."""
    layer_name: str
    trust_score: float = Field(..., description="0.0 to 100.0 (Higher is more trustworthy)")
    risk_level: str = "LOW"  # LOW, MEDIUM, HIGH, CRITICAL
    weight: float = 0.25
    summary: str
    flags: List[str] = []


class MasterRiskAssessment(BaseModel):
    """Holistic multi-layer trust and risk screening decision."""
    overall_trust_score: float = Field(..., description="0.0 (Fraudulent) to 100.0 (Verified Authentic)")
    overall_risk_level: str = "LOW"  # LOW, MEDIUM, HIGH, CRITICAL
    screening_decision: str = "APPROVED_FOR_CLEARANCE"  # APPROVED_FOR_CLEARANCE, MANUAL_SUPERVISOR_REVIEW, SECONDARY_INSPECTION_REQUIRED
    
    # 4 Core Scoring Layers
    document_integrity_layer: ScoringLayerBreakdown
    data_consistency_layer: ScoringLayerBreakdown
    forensic_tampering_layer: ScoringLayerBreakdown
    biometric_identity_layer: ScoringLayerBreakdown
    
    # Aggregated Findings
    critical_violations: List[str] = []
    warning_flags: List[str] = []
    recommendation: str = "Document and identity verified for border clearance."


def compute_master_risk_score(
    quality_passed: bool,
    blur_score: float,
    glare_ratio: float,
    geometry_tampered: bool,
    geometry_score: float,
    mrz_valid: bool,
    cross_validation_consistent: bool,
    discrepancy_score: float,
    forensic_tampered: bool,
    tamper_score: float,
    face_verified: Optional[bool] = None,
    face_similarity: Optional[float] = None,
    face_live: Optional[bool] = None
) -> MasterRiskAssessment:
    """
    Computes a weighted, multi-layer trust and risk score across all 4 analytical pillars.
    """
    critical_violations = []
    warning_flags = []

    # =========================================================================
    # Layer 1: Document Physical & Geometric Integrity (25%)
    # =========================================================================
    l1_trust = 100.0
    l1_flags = []
    
    if not quality_passed:
        l1_trust -= 20.0
        l1_flags.append("SUBOPTIMAL_IMAGE_QUALITY: Excessive blur or illumination glare.")
        warning_flags.append("Image resolution or capture lighting suboptimal.")
    
    if geometry_tampered:
        l1_trust -= 45.0
        l1_flags.append(f"LAYOUT_GEOMETRY_ANOMALY: Passport dimensions, photo placement, or pitch deviation ({geometry_score:.2f}).")
        critical_violations.append("Physical layout dimensions deviate from ICAO TD3 reference standards.")
    else:
        l1_trust -= min(25.0, geometry_score * 30.0)

    l1_trust = max(0.0, min(100.0, l1_trust))
    l1_level = "HIGH" if l1_trust < 50 else ("MEDIUM" if l1_trust < 75 else "LOW")
    
    l1_layer = ScoringLayerBreakdown(
        layer_name="Document Physical & Geometric Integrity",
        trust_score=round(l1_trust, 1),
        risk_level=l1_level,
        weight=0.25,
        summary=f"Physical aspect ratio, margins, photo box, and line pitch ({l1_level} risk).",
        flags=l1_flags
    )

    # =========================================================================
    # Layer 2: ICAO 9303 Data Consistency & Cross-Validation (30%)
    # =========================================================================
    l2_trust = 100.0
    l2_flags = []

    if not mrz_valid:
        l2_trust -= 50.0
        l2_flags.append("ICAO_CHECKSUM_FAILED: Repeating weights 7-3-1 modulo 10 check digit mismatch.")
        critical_violations.append("ICAO Doc 9303 MRZ cryptographic checksum failed.")

    if not cross_validation_consistent:
        l2_trust -= 40.0
        l2_flags.append("VIZ_MRZ_MISMATCH: Visual printed text differs from encoded MRZ data.")
        critical_violations.append("Mismatch between Human-Readable (VIZ) and Machine-Readable (MRZ) fields.")
    else:
        l2_trust -= min(20.0, discrepancy_score * 30.0)

    l2_trust = max(0.0, min(100.0, l2_trust))
    l2_level = "HIGH" if l2_trust < 50 else ("MEDIUM" if l2_trust < 80 else "LOW")

    l2_layer = ScoringLayerBreakdown(
        layer_name="ICAO Data Consistency & Cross-Check",
        trust_score=round(l2_trust, 1),
        risk_level=l2_level,
        weight=0.30,
        summary=f"Doc 9303 check digits and VIZ-to-MRZ field cross-referencing ({l2_level} risk).",
        flags=l2_flags
    )

    # =========================================================================
    # Layer 3: Forensic Tamper & Clone Security (25%)
    # =========================================================================
    l3_trust = 100.0
    l3_flags = []

    if forensic_tampered or tamper_score >= 0.55:
        l3_trust -= 60.0
        l3_flags.append(f"FORENSIC_TAMPER_DETECTED: ELA recompression or sensor noise inconsistency (score: {tamper_score:.2f}).")
        critical_violations.append("Digital image manipulation detected (spliced photo or altered text patch).")
    elif tamper_score >= 0.25:
        l3_trust -= (tamper_score * 50.0)
        l3_flags.append("SUSPICIOUS_FORENSIC_NOISE: Minor localized compression discrepancy.")
        warning_flags.append("Minor digital compression noise detected.")

    l3_trust = max(0.0, min(100.0, l3_trust))
    l3_level = "HIGH" if l3_trust < 50 else ("MEDIUM" if l3_trust < 75 else "LOW")

    l3_layer = ScoringLayerBreakdown(
        layer_name="Forensic Tampering & Clone Detection",
        trust_score=round(l3_trust, 1),
        risk_level=l3_level,
        weight=0.25,
        summary=f"Error Level Analysis, sensor noise maps, and copy-move clone localization ({l3_level} risk).",
        flags=l3_flags
    )

    # =========================================================================
    # Layer 4: Biometric Identity & Passive Anti-Spoofing (20%)
    # =========================================================================
    l4_trust = 100.0
    l4_flags = []

    if face_similarity is not None:
        if face_similarity < 0.50:
            l4_trust -= 60.0
            l4_flags.append(f"FACE_MISMATCH: Live selfie does not match document photo ({face_similarity:.1%}).")
            critical_violations.append("Facial recognition mismatch: Live traveler does not match passport photo.")
        elif face_similarity < 0.70:
            l4_trust -= 25.0
            l4_flags.append(f"BORDERLINE_FACE_MATCH: Moderate facial similarity ({face_similarity:.1%}).")
            warning_flags.append("Moderate facial similarity, manual supervisor verification recommended.")

        if face_live is False:
            l4_trust -= 50.0
            l4_flags.append("PRESENTATION_ATTACK_DETECTED: Screen replay or 2D printed photo attack.")
            critical_violations.append("Biometric presentation attack detected (spoof attempt).")
    else:
        # No selfie provided (document-only screening mode)
        l4_trust = 95.0
        l4_flags.append("BIOMETRIC_CHECK_OMITTED: Document-only screening mode.")

    l4_trust = max(0.0, min(100.0, l4_trust))
    l4_level = "HIGH" if l4_trust < 50 else ("MEDIUM" if l4_trust < 75 else "LOW")

    l4_layer = ScoringLayerBreakdown(
        layer_name="Biometric Identity & Anti-Spoofing",
        trust_score=round(l4_trust, 1),
        risk_level=l4_level,
        weight=0.20,
        summary=f"1:1 face embedding match and passive presentation attack detection ({l4_level} risk).",
        flags=l4_flags
    )

    # =========================================================================
    # Composite Master Decision
    # =========================================================================
    overall_trust = (
        (l1_trust * 0.25) +
        (l2_trust * 0.30) +
        (l3_trust * 0.25) +
        (l4_trust * 0.20)
    )
    overall_trust = round(max(0.0, min(100.0, overall_trust)), 1)

    if len(critical_violations) > 0 or overall_trust < 50.0:
        overall_risk = "HIGH"
        decision = "SECONDARY_INSPECTION_REQUIRED"
        recommendation = f"DENY CLEARANCE / ESCALATE: {len(critical_violations)} critical security violation(s) detected. Physical inspection required."
    elif len(warning_flags) > 0 or overall_trust < 78.0:
        overall_risk = "MEDIUM"
        decision = "MANUAL_SUPERVISOR_REVIEW"
        recommendation = "SUPERVISOR REVIEW RECOMMENDED: Minor discrepancies or borderline metrics observed."
    else:
        overall_risk = "LOW"
        decision = "APPROVED_FOR_CLEARANCE"
        recommendation = "CLEARANCE APPROVED: Document is authentic, geometry is valid, and identity is verified."

    return MasterRiskAssessment(
        overall_trust_score=overall_trust,
        overall_risk_level=overall_risk,
        screening_decision=decision,
        document_integrity_layer=l1_layer,
        data_consistency_layer=l2_layer,
        forensic_tampering_layer=l3_layer,
        biometric_identity_layer=l4_layer,
        critical_violations=critical_violations,
        warning_flags=warning_flags,
        recommendation=recommendation
    )
