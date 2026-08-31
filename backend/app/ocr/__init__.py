"""
OCR & Visual Inspection Zone (VIZ) Cross-Validation Module.
Provides Surya & PaddleOCR document layout recognition, text line extraction,
and field-specific VIZ-to-MRZ discrepancy detection.
"""
from backend.app.ocr.cross_validation import (
    cross_validate_viz_and_mrz,
    VIZDataPayload,
    CrossValidationReport,
    FieldComparisonResult,
    compute_string_similarity,
    normalize_date_for_comparison,
    normalize_text
)
from backend.app.ocr.surya_engine import (
    surya_engine,
    SuryaOCREngine,
    TextLineBBox,
    OCRDocumentLayoutResult
)

__all__ = [
    "cross_validate_viz_and_mrz",
    "VIZDataPayload",
    "CrossValidationReport",
    "FieldComparisonResult",
    "compute_string_similarity",
    "normalize_date_for_comparison",
    "normalize_text",
    "surya_engine",
    "SuryaOCREngine",
    "TextLineBBox",
    "OCRDocumentLayoutResult"
]
