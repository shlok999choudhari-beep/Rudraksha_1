"""
Cross-Validation Engine for ICAO TD3 Document Screening.
Field-by-field cross-matching between Human-Readable Visual Inspection Zone (VIZ)
and Machine-Readable Zone (MRZ) with date format normalization.
"""
import re
from datetime import datetime
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


MONTH_MAP = {
    "JAN": "01", "FEB": "02", "MAR": "03", "APR": "04", "MAY": "05", "JUN": "06",
    "JUL": "07", "AUG": "08", "SEP": "09", "OCT": "10", "NOV": "11", "DEC": "12",
    "JANVIER": "01", "FEVRIER": "02", "MARS": "03", "AVRIL": "04", "MAI": "05", "JUIN": "06",
    "JUILLET": "07", "AOUT": "08", "SEPTEMBRE": "09", "OCTOBRE": "10", "NOVEMBRE": "11", "DECEMBRE": "12"
}


def normalize_date_string(date_str: str) -> Optional[str]:
    """
    Normalizes human-readable date formats (e.g. '15 AUG 1998', '15/08/1998', '15-08-1998')
    into standard ISO format 'YYYY-MM-DD'.
    """
    if not date_str:
        return None
    
    cleaned = date_str.upper().strip()
    
    # Format: 15 AUG 1998 or 15-AUG-1998
    m_alpha = re.search(r"(\d{1,2})[\s\-\/\.]*([A-Z]{3,10})[\s\-\/\.]*(\d{2,4})", cleaned)
    if m_alpha:
        day = m_alpha.group(1).zfill(2)
        month_name = m_alpha.group(2)
        year = m_alpha.group(3)
        if len(year) == 2:
            year = "20" + year if int(year) < 50 else "19" + year
        month = MONTH_MAP.get(month_name[:3], "01")
        return f"{year}-{month}-{day}"

    # Format: DD/MM/YYYY or YYYY-MM-DD
    m_num = re.search(r"(\d{4})[\-\/\.](\d{1,2})[\-\/\.](\d{1,2})", cleaned)
    if m_num:
        return f"{m_num.group(1)}-{m_num.group(2).zfill(2)}-{m_num.group(3).zfill(2)}"

    m_dmy = re.search(r"(\d{1,2})[\-\/\.](\d{1,2})[\-\/\.](\d{2,4})", cleaned)
    if m_dmy:
        day = m_dmy.group(1).zfill(2)
        month = m_dmy.group(2).zfill(2)
        year = m_dmy.group(3)
        if len(year) == 2:
            year = "20" + year if int(year) < 50 else "19" + year
        return f"{year}-{month}-{day}"

class VIZDataPayload(BaseModel):
    document_number: str = ""
    surname: str = ""
    given_names: str = ""
    nationality: str = ""
    date_of_birth: str = ""
    date_of_expiry: str = ""
    sex: str = ""


class FieldComparisonResult(BaseModel):
    field_name: str
    viz_value: str
    mrz_value: str
    is_match: bool
    similarity: float = 1.0
    discrepancy_reason: Optional[str] = None


def normalize_text(text: Optional[str]) -> str:
    if not text:
        return ""
    return re.sub(r"[^A-Z0-9]", "", text.upper().strip())


def compute_string_similarity(s1: str, s2: str) -> float:
    if not s1 and not s2:
        return 1.0
    if not s1 or not s2:
        return 0.0
    n1, n2 = normalize_text(s1), normalize_text(s2)
    if n1 == n2:
        return 1.0
    if n1 in n2 or n2 in n1:
        return 0.9
    return 0.0


def normalize_date_for_comparison(date_str: str) -> Optional[str]:
    return normalize_date_string(date_str)


class CrossValidationReport(BaseModel):
    is_consistent: bool = True
    overall_match_ratio: float = 1.0
    field_details: Dict[str, FieldComparisonResult] = {}
    mismatched_fields: List[str] = []
    discrepancy_score: float = 0.0  # 0.0 (consistent) to 1.0 (severe identity mismatch)


def cross_validate_viz_and_mrz(viz_data: Any, mrz_data: Any) -> CrossValidationReport:
    """
    Performs field-by-field cross validation between VIZ and MRZ across 6 critical identity fields.
    """
    details: Dict[str, FieldComparisonResult] = {}
    mismatches: List[str] = []

    # 1. Document Number
    v_doc = str(getattr(viz_data, "document_number", "") or "").strip().upper().replace(" ", "")
    m_doc = str(getattr(mrz_data, "document_number", "") or "").strip().upper().replace(" ", "")
    doc_match = (v_doc == m_doc) if (v_doc and m_doc) else False
    details["document_number"] = FieldComparisonResult(
        field_name="Document Number",
        viz_value=v_doc,
        mrz_value=m_doc,
        is_match=doc_match,
        discrepancy_reason=None if doc_match else f"VIZ '{v_doc}' does not match MRZ '{m_doc}'"
    )
    if not doc_match:
        mismatches.append("document_number")

    # 2. Surname
    v_sur = str(getattr(viz_data, "surname", "") or "").strip().upper()
    m_sur = str(getattr(mrz_data, "surname", "") or "").strip().upper()
    sur_match = (v_sur == m_sur or v_sur in m_sur or m_sur in v_sur) if (v_sur and m_sur) else False
    details["surname"] = FieldComparisonResult(
        field_name="Surname",
        viz_value=v_sur,
        mrz_value=m_sur,
        is_match=sur_match,
        discrepancy_reason=None if sur_match else f"VIZ surname '{v_sur}' != MRZ '{m_sur}'"
    )
    if not sur_match:
        mismatches.append("surname")

    # 3. Given Names
    v_giv = str(getattr(viz_data, "given_names", "") or "").strip().upper()
    m_giv = str(getattr(mrz_data, "given_names", "") or "").strip().upper()
    giv_match = (v_giv == m_giv or v_giv in m_giv or m_giv in v_giv) if (v_giv and m_giv) else False
    details["given_names"] = FieldComparisonResult(
        field_name="Given Names",
        viz_value=v_giv,
        mrz_value=m_giv,
        is_match=giv_match,
        discrepancy_reason=None if giv_match else f"VIZ given name '{v_giv}' != MRZ '{m_giv}'"
    )
    if not giv_match:
        mismatches.append("given_names")

    # 4. Nationality
    v_nat = str(getattr(viz_data, "nationality", "") or "").strip().upper()
    m_nat = str(getattr(mrz_data, "nationality", "") or "").strip().upper()
    nat_match = ("IND" in v_nat and "IND" in m_nat) or (v_nat == m_nat) if (v_nat and m_nat) else True
    details["nationality"] = FieldComparisonResult(
        field_name="Nationality",
        viz_value=v_nat,
        mrz_value=m_nat,
        is_match=nat_match,
        discrepancy_reason=None if nat_match else f"VIZ nationality '{v_nat}' != MRZ '{m_nat}'"
    )
    if not nat_match:
        mismatches.append("nationality")

    # 5. Date of Birth
    v_dob_raw = str(getattr(viz_data, "date_of_birth", "") or "")
    m_dob_raw = str(getattr(mrz_data, "date_of_birth", "") or "")
    v_dob_norm = normalize_date_string(v_dob_raw) or v_dob_raw
    m_dob_norm = normalize_date_string(m_dob_raw) or m_dob_raw
    dob_match = (v_dob_norm == m_dob_norm) if (v_dob_norm and m_dob_norm) else False
    details["date_of_birth"] = FieldComparisonResult(
        field_name="Date of Birth",
        viz_value=v_dob_raw,
        mrz_value=m_dob_raw,
        is_match=dob_match,
        discrepancy_reason=None if dob_match else f"VIZ DOB '{v_dob_norm}' != MRZ DOB '{m_dob_norm}'"
    )
    if not dob_match:
        mismatches.append("date_of_birth")

    # 6. Date of Expiry
    v_exp_raw = str(getattr(viz_data, "date_of_expiry", "") or "")
    m_exp_raw = str(getattr(mrz_data, "date_of_expiry", "") or "")
    v_exp_norm = normalize_date_string(v_exp_raw) or v_exp_raw
    m_exp_norm = normalize_date_string(m_exp_raw) or m_exp_raw
    exp_match = (v_exp_norm == m_exp_norm) if (v_exp_norm and m_exp_norm) else False
    details["date_of_expiry"] = FieldComparisonResult(
        field_name="Date of Expiry",
        viz_value=v_exp_raw,
        mrz_value=m_exp_raw,
        is_match=exp_match,
        discrepancy_reason=None if exp_match else f"VIZ Expiry '{v_exp_norm}' != MRZ Expiry '{m_exp_norm}'"
    )
    if not exp_match:
        mismatches.append("date_of_expiry")

    # Calculate overall consistency
    total_fields = len(details)
    matched_fields = sum(1 for d in details.values() if d.is_match)
    match_ratio = matched_fields / float(total_fields)
    is_consistent = (len(mismatches) == 0)
    discrepancy_score = 1.0 - match_ratio

    return CrossValidationReport(
        is_consistent=is_consistent,
        overall_match_ratio=round(match_ratio, 3),
        field_details=details,
        mismatched_fields=mismatches,
        discrepancy_score=round(discrepancy_score, 3)
    )
