"""
OCR and VIZ-to-MRZ Cross-Validation Engine.
Detects discrepancies between Human-Readable (Visual Inspection Zone - VIZ) fields
and Machine Readable Zone (MRZ) data to detect document alteration, forgery, and tampering.
"""
import re
import difflib
import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from backend.app.mrz.parser import MRZParsedResult


class FieldComparisonResult(BaseModel):
    """Result of comparing a single field between VIZ and MRZ."""
    field_name: str
    viz_value: Optional[str] = None
    mrz_value: Optional[str] = None
    match: bool
    similarity_score: float = Field(..., description="0.0 to 1.0 similarity")
    severity: str = "LOW"  # NONE, LOW, MEDIUM, HIGH, CRITICAL
    discrepancy_detail: Optional[str] = None


class VIZDataPayload(BaseModel):
    """Extracted Human-Readable Visual Inspection Zone fields."""
    surname: Optional[str] = None
    given_names: Optional[str] = None
    full_name: Optional[str] = None
    document_number: Optional[str] = None
    date_of_birth: Optional[str] = None
    date_of_expiry: Optional[str] = None
    nationality: Optional[str] = None
    issuing_country: Optional[str] = None
    sex: Optional[str] = None


class CrossValidationReport(BaseModel):
    """Complete cross-validation and discrepancy analysis report."""
    is_consistent: bool = Field(..., description="True if no high/critical discrepancies detected")
    discrepancy_score: float = Field(..., description="0.0 (identical) to 1.0 (severe tampering)")
    risk_level: str = "LOW"  # LOW, MEDIUM, HIGH, CRITICAL
    field_comparisons: List[FieldComparisonResult] = []
    tampering_flags: List[str] = []
    recommendation: str = "Standard clearance"


def normalize_text(text: Optional[str]) -> str:
    """Normalizes string by removing punctuation, extra spaces, and uppercasing."""
    if not text:
        return ""
    cleaned = re.sub(r'[^A-Za-z0-9]', '', str(text)).upper()
    return cleaned


def compute_string_similarity(str1: str, str2: str) -> float:
    """Computes normalized Levenshtein sequence ratio between two strings."""
    s1 = normalize_text(str1)
    s2 = normalize_text(str2)
    if not s1 and not s2:
        return 1.0
    if not s1 or not s2:
        return 0.0
    if s1 == s2:
        return 1.0
    return difflib.SequenceMatcher(None, s1, s2).ratio()


def normalize_date_for_comparison(date_val: Optional[str]) -> str:
    """
    Attempts to parse common date formats into a standard comparable YYMMDD or YYYYMMDD string.
    Supports '12 JUL 1985', '1985-07-12', '12/07/1985', '850712'.
    """
    if not date_val:
        return ""
    d_str = str(date_val).strip()

    # If already 6-digit YYMMDD
    if len(d_str) == 6 and d_str.isdigit():
        return d_str

    # ISO Format YYYY-MM-DD
    iso_match = re.match(r'^(\d{4})-(\d{2})-(\d{2})$', d_str)
    if iso_match:
        y, m, d = iso_match.groups()
        return f"{y[2:]}{m}{d}"

    # Slash/Dot formats DD/MM/YYYY or YYYY/MM/DD
    parts = re.split(r'[-/.\s]+', d_str)
    if len(parts) == 3:
        p1, p2, p3 = parts
        months_map = {
            'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
            'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
            'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
        }
        # Check if month is a word e.g. "12 JUL 1985"
        if p2.upper() in months_map:
            day = p1.zfill(2)
            month = months_map[p2.upper()]
            year = p3[-2:]
            return f"{year}{month}{day}"

    # Return pure digits stripped
    digits = re.sub(r'\D', '', d_str)
    return digits[-6:] if len(digits) >= 6 else digits


def cross_validate_viz_and_mrz(
    viz: VIZDataPayload,
    mrz: MRZParsedResult
) -> CrossValidationReport:
    """
    Cross-validates extracted Visual Inspection Zone (VIZ) data against MRZ fields.
    Flags document number alterations, date mismatches, and name discrepancies.

    Args:
        viz: Extracted human-readable text fields.
        mrz: Parsed ICAO 9303 MRZ record.

    Returns:
        CrossValidationReport with field comparisons, risk score, and tamper flags.
    """
    comparisons: List[FieldComparisonResult] = []
    tampering_flags: List[str] = []
    severity_weights = []

    if mrz is None:
        return CrossValidationReport(
            is_consistent=False,
            discrepancy_score=0.70,
            risk_level="HIGH",
            field_comparisons=[],
            tampering_flags=["MRZ_DATA_MISSING: Machine Readable Zone could not be read or parsed."],
            summary="Cross-validation incomplete: MRZ data not detected."
        )

    # 1. Document Number Validation (CRITICAL)
    if viz.document_number:
        doc_viz = normalize_text(viz.document_number)
        doc_mrz = normalize_text(mrz.document_number)
        sim = compute_string_similarity(doc_viz, doc_mrz)
        is_match = (doc_viz == doc_mrz) or (sim >= 0.9 and len(doc_viz) == len(doc_mrz))
        
        severity = "NONE" if is_match else "CRITICAL"
        detail = None
        if not is_match:
            detail = f"VIZ document number '{viz.document_number}' does not match MRZ '{mrz.document_number}'."
            tampering_flags.append("DOCUMENT_NUMBER_MISMATCH: Potential visual number alteration or counterfeit.")
            severity_weights.append(1.0)
        else:
            severity_weights.append(0.0)

        comparisons.append(FieldComparisonResult(
            field_name="Document Number",
            viz_value=viz.document_number,
            mrz_value=mrz.document_number,
            match=is_match,
            similarity_score=sim,
            severity=severity,
            discrepancy_detail=detail
        ))

    # 2. Date of Birth Validation (HIGH)
    if viz.date_of_birth:
        viz_dob_norm = normalize_date_for_comparison(viz.date_of_birth)
        mrz_dob_norm = normalize_date_for_comparison(mrz.raw_dob)
        is_match = (viz_dob_norm == mrz_dob_norm) or (viz_dob_norm[-4:] == mrz_dob_norm[-4:])
        sim = 1.0 if is_match else compute_string_similarity(viz_dob_norm, mrz_dob_norm)

        severity = "NONE" if is_match else "HIGH"
        detail = None
        if not is_match:
            detail = f"VIZ Date of Birth '{viz.date_of_birth}' contradicts MRZ '{mrz.date_of_birth or mrz.raw_dob}'."
            tampering_flags.append("DOB_MISMATCH: Visual birthdate altered or forged.")
            severity_weights.append(0.8)
        else:
            severity_weights.append(0.0)

        comparisons.append(FieldComparisonResult(
            field_name="Date of Birth",
            viz_value=viz.date_of_birth,
            mrz_value=mrz.date_of_birth or mrz.raw_dob,
            match=is_match,
            similarity_score=sim,
            severity=severity,
            discrepancy_detail=detail
        ))

    # 3. Date of Expiry Validation (HIGH)
    if viz.date_of_expiry:
        viz_exp_norm = normalize_date_for_comparison(viz.date_of_expiry)
        mrz_exp_norm = normalize_date_for_comparison(mrz.raw_expiry)
        is_match = (viz_exp_norm == mrz_exp_norm) or (viz_exp_norm[-4:] == mrz_exp_norm[-4:])
        sim = 1.0 if is_match else compute_string_similarity(viz_exp_norm, mrz_exp_norm)

        severity = "NONE" if is_match else "HIGH"
        detail = None
        if not is_match:
            detail = f"VIZ Expiry '{viz.date_of_expiry}' contradicts MRZ Expiry '{mrz.date_of_expiry or mrz.raw_expiry}'."
            tampering_flags.append("EXPIRY_DATE_MISMATCH: Expiration date modified.")
            severity_weights.append(0.8)
        else:
            severity_weights.append(0.0)

        comparisons.append(FieldComparisonResult(
            field_name="Date of Expiry",
            viz_value=viz.date_of_expiry,
            mrz_value=mrz.date_of_expiry or mrz.raw_expiry,
            match=is_match,
            similarity_score=sim,
            severity=severity,
            discrepancy_detail=detail
        ))

    # 4. Name Validation (Surname & Given Names) (MEDIUM / HIGH)
    if viz.surname or viz.full_name:
        viz_surname = normalize_text(viz.surname) if viz.surname else ""
        mrz_surname = normalize_text(mrz.surname)
        
        # Check surname similarity
        if viz_surname:
            sim = compute_string_similarity(viz_surname, mrz_surname)
            is_match = sim >= 0.85
            severity = "NONE" if is_match else ("MEDIUM" if sim >= 0.6 else "HIGH")
            detail = None
            if not is_match:
                detail = f"Surname discrepancy: VIZ='{viz.surname}', MRZ='{mrz.surname}' (similarity: {sim:.2f})."
                tampering_flags.append(f"NAME_MISMATCH: Surname difference detected (VIZ: {viz.surname} vs MRZ: {mrz.surname}).")
                severity_weights.append(0.6 if sim >= 0.6 else 0.8)
            else:
                severity_weights.append(0.0)

            comparisons.append(FieldComparisonResult(
                field_name="Surname",
                viz_value=viz.surname,
                mrz_value=mrz.surname,
                match=is_match,
                similarity_score=sim,
                severity=severity,
                discrepancy_detail=detail
            ))

    # 5. Sex / Gender Check (LOW / MEDIUM)
    if viz.sex:
        v_sex = viz.sex.strip().upper()[:1]
        m_sex = mrz.sex.strip().upper()[:1]
        is_match = (v_sex == m_sex) or (m_sex == 'X')
        severity = "NONE" if is_match else "MEDIUM"
        detail = None
        if not is_match:
            detail = f"Gender mismatch: VIZ='{viz.sex}', MRZ='{mrz.sex}'."
            tampering_flags.append("GENDER_MISMATCH: Discrepancy between printed gender and MRZ.")
            severity_weights.append(0.4)
        else:
            severity_weights.append(0.0)

        comparisons.append(FieldComparisonResult(
            field_name="Sex / Gender",
            viz_value=viz.sex,
            mrz_value=mrz.sex,
            match=is_match,
            similarity_score=1.0 if is_match else 0.0,
            severity=severity,
            discrepancy_detail=detail
        ))

    # Calculate overall risk and discrepancy score
    if not severity_weights:
        discrepancy_score = 0.0
    else:
        discrepancy_score = min(1.0, max(severity_weights))

    # Check if MRZ had inherent checksum failures
    if not mrz.is_valid:
        tampering_flags.append(f"MRZ_CHECKSUM_INVALID: One or more ICAO 9303 check digits failed.")
        discrepancy_score = max(discrepancy_score, 0.85)

    if mrz.is_expired:
        tampering_flags.append("DOCUMENT_EXPIRED: The presented document has expired.")
        discrepancy_score = max(discrepancy_score, 0.70)

    # Determine risk level & recommendation
    if discrepancy_score >= 0.8:
        risk_level = "CRITICAL" if any(c.severity == "CRITICAL" for c in comparisons) else "HIGH"
        recommendation = "Secondary Inspection Required: Document shows potential tampering or identity inconsistency."
    elif discrepancy_score >= 0.4:
        risk_level = "MEDIUM"
        recommendation = "Supervisor Review Recommended: Minor text or formatting discrepancy detected."
    else:
        risk_level = "LOW"
        recommendation = "Standard Clearance: VIZ and MRZ data are consistent and check digits are valid."

    is_consistent = (risk_level == "LOW")

    return CrossValidationReport(
        is_consistent=is_consistent,
        discrepancy_score=round(discrepancy_score, 2),
        risk_level=risk_level,
        field_comparisons=comparisons,
        tampering_flags=tampering_flags,
        recommendation=recommendation
    )
