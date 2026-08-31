"""
Machine Readable Zone (MRZ) Module for VeriGuard AI.
Implements ICAO Doc 9303 compliance, 7-3-1 modulus 10 check digit validation,
multi-format parsing (TD1, TD2, TD3), and image-based ROI extraction.
"""
from backend.app.mrz.checksum import (
    compute_check_digit,
    verify_check_digit,
    parse_mrz_date,
    check_date_expiration,
    ICAO_WEIGHTS
)
from backend.app.mrz.parser import (
    parse_mrz,
    parse_td1,
    parse_td2,
    parse_td3,
    MRZParsedResult,
    ChecksumFieldResult
)
from backend.app.mrz.extractor import (
    extract_and_parse_mrz_from_image,
    crop_mrz_region,
    preprocess_mrz_for_ocr,
    MRZExtractionResult
)

__all__ = [
    "compute_check_digit",
    "verify_check_digit",
    "parse_mrz_date",
    "check_date_expiration",
    "ICAO_WEIGHTS",
    "parse_mrz",
    "parse_td1",
    "parse_td2",
    "parse_td3",
    "MRZParsedResult",
    "ChecksumFieldResult",
    "extract_and_parse_mrz_from_image",
    "crop_mrz_region",
    "preprocess_mrz_for_ocr",
    "MRZExtractionResult"
]
