"""
Master Screening Pipeline Orchestrator for VeriGuard AI.
Executes the end-to-end multi-modal screening pipeline:
Preprocessing -> Geometry -> Surya OCR -> ICAO 9303 Checksums -> VIZ Cross-Check -> Forensics -> Biometrics.
"""
import uuid
import datetime
import base64
import cv2
import numpy as np
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

from backend.app.preprocessing import preprocess_document, PreprocessingResult
from backend.app.geometry import evaluate_passport_geometry, PassportGeometryReport
from backend.app.ocr import surya_engine, cross_validate_viz_and_mrz, OCRDocumentLayoutResult, CrossValidationReport
from backend.app.mrz.parser import MRZParsedResult
from backend.app.tampering import analyze_document_tampering, ForensicTamperReport
from backend.app.face import verify_identity_and_liveness, FaceVerificationReport
from backend.app.risk.scoring import compute_master_risk_score, MasterRiskAssessment


class PreprocessingSummary(BaseModel):
    """Clean JSON-serializable summary of document preprocessing & quality checks."""
    success: bool
    quality_passed: bool
    blur_score: float
    glare_ratio: float
    original_size: Dict[str, int]
    processed_size: Dict[str, int]
    detection_confidence: float


class MasterScreeningReport(BaseModel):
    """Complete, exhaustive screening verdict and multi-modal forensics report."""
    screening_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())
    
    # 4-Layer Master Risk Decision
    risk_assessment: MasterRiskAssessment
    
    # Detailed Pipeline Sub-Reports
    preprocessing_report: PreprocessingSummary
    geometry_report: PassportGeometryReport
    ocr_layout_report: OCRDocumentLayoutResult
    mrz_parsed_result: Optional[MRZParsedResult] = None
    cross_validation_report: CrossValidationReport
    forensic_tamper_report: ForensicTamperReport
    face_verification_report: Optional[FaceVerificationReport] = None
    
    # Visual Evidence & Heatmaps
    normalized_document_base64: Optional[str] = None
    annotated_evidence_base64: Optional[str] = None
    ela_heatmap_base64: Optional[str] = None
    noise_heatmap_base64: Optional[str] = None
    doc_face_crop_base64: Optional[str] = None
    live_face_crop_base64: Optional[str] = None


def screen_document_and_identity(
    doc_image: np.ndarray,
    live_image: Optional[np.ndarray] = None
) -> MasterScreeningReport:
    """
    Executes complete 7-stage document screening and identity verification.

    Args:
        doc_image: Input raw or scanned passport image.
        live_image: Optional live selfie camera capture.

    Returns:
        MasterScreeningReport with 4-layer risk assessment, sub-reports, and evidence overlays.
    """
    if doc_image is None or doc_image.size == 0:
        raise ValueError("Invalid document image provided.")

    # -------------------------------------------------------------------------
    # Stage 1: Document Preprocessing & Perspective Warping
    # -------------------------------------------------------------------------
    prep_res = preprocess_document(doc_image)
    normalized_canvas = prep_res.processed_image if prep_res.processed_image is not None else doc_image

    prep_summary = PreprocessingSummary(
        success=prep_res.success,
        quality_passed=prep_res.quality_report.is_valid,
        blur_score=round(prep_res.quality_report.blur_score, 2),
        glare_ratio=round(prep_res.quality_report.glare_ratio, 4),
        original_size=prep_res.original_size,
        processed_size=prep_res.processed_size,
        detection_confidence=round(prep_res.detection_confidence, 2)
    )

    # -------------------------------------------------------------------------
    # Stage 2: Passport Geometry & Layout Analysis
    # -------------------------------------------------------------------------
    geom_report = evaluate_passport_geometry(normalized_canvas)

    # -------------------------------------------------------------------------
    # Stage 3: Surya OCR & Document Layout Recognition
    # -------------------------------------------------------------------------
    ocr_res = surya_engine.detect_and_read_text(normalized_canvas)
    mrz_parsed = ocr_res.mrz_parsed_result

    # -------------------------------------------------------------------------
    # Stage 4: VIZ <-> MRZ Cross-Validation
    # -------------------------------------------------------------------------
    cross_val_report = cross_validate_viz_and_mrz(ocr_res.viz_data, mrz_parsed)

    # -------------------------------------------------------------------------
    # Stage 5: Forensic Image Tamper Detection (ELA + Noise + Clones)
    # -------------------------------------------------------------------------
    tamper_report = analyze_document_tampering(normalized_canvas)

    # -------------------------------------------------------------------------
    # Stage 6: Biometric Face Matching & Passive Liveness (if selfie provided)
    # -------------------------------------------------------------------------
    face_report = None
    if live_image is not None and live_image.size > 0:
        face_report = verify_identity_and_liveness(normalized_canvas, live_image)

    # -------------------------------------------------------------------------
    # Stage 7: 4-Layer Master Trust & Risk Scoring
    # -------------------------------------------------------------------------
    risk_assessment = compute_master_risk_score(
        quality_passed=prep_res.quality_report.is_valid,
        blur_score=prep_res.quality_report.blur_score,
        glare_ratio=prep_res.quality_report.glare_ratio,
        geometry_tampered=(not geom_report.is_layout_valid),
        geometry_score=geom_report.geometry_risk_score,
        mrz_valid=(mrz_parsed is not None and mrz_parsed.is_valid),
        cross_validation_consistent=cross_val_report.is_consistent,
        discrepancy_score=cross_val_report.discrepancy_score,
        forensic_tampered=tamper_report.is_tampered,
        tamper_score=tamper_report.tamper_risk_score,
        face_verified=(face_report.is_verified if face_report else None),
        face_similarity=(face_report.face_similarity_score if face_report else None),
        face_live=(face_report.is_live if face_report else None)
    )



    # -------------------------------------------------------------------------
    # Visual Overlay & Base64 Encoding
    # -------------------------------------------------------------------------
    _, norm_buf = cv2.imencode(".jpg", normalized_canvas)
    b64_norm = f"data:image/jpeg;base64,{base64.b64encode(norm_buf).decode('utf-8')}"

    return MasterScreeningReport(
        risk_assessment=risk_assessment,
        preprocessing_report=prep_summary,
        geometry_report=geom_report,
        ocr_layout_report=ocr_res,
        mrz_parsed_result=mrz_parsed,
        cross_validation_report=cross_val_report,
        forensic_tamper_report=tamper_report,
        face_verification_report=face_report,
        normalized_document_base64=b64_norm,
        annotated_evidence_base64=tamper_report.annotated_overlay_base64,
        ela_heatmap_base64=tamper_report.ela_result.heatmap_base64,
        noise_heatmap_base64=tamper_report.noise_result.noise_heatmap_base64,
        doc_face_crop_base64=face_report.doc_face_crop_base64 if face_report else None,
        live_face_crop_base64=face_report.live_face_crop_base64 if face_report else None
    )
