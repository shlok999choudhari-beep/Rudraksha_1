"""
Deterministic Document Validation Engine (ICAO Doc 9303 Rules).
Applies rule-based temporal, cryptographic, structural, and format validations.
"""
import re
from datetime import datetime, date
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field


# ICAO Doc 9303 / ISO 3166-1 Alpha-3 Valid Issuing States
VALID_ICAO_COUNTRY_CODES = {
    "AFG", "ALB", "DZA", "AND", "AGO", "ATG", "ARG", "ARM", "AUS", "AUT", "AZE",
    "BHS", "BHR", "BGD", "BRB", "BLR", "BEL", "BLZ", "BEN", "BTN", "BOL", "BIH",
    "BWA", "BRA", "BRN", "BGR", "BFA", "BDI", "KHM", "CMR", "CAN", "CPV", "CAF",
    "TCD", "CHL", "CHN", "COL", "COM", "COG", "COD", "CRI", "CIV", "HRV", "CUB",
    "CYP", "CZE", "DNK", "DJI", "DMA", "DOM", "ECU", "EGY", "SLV", "GNQ", "ERI",
    "EST", "SWZ", "ETH", "FJI", "FIN", "FRA", "GAB", "GMB", "GEO", "DEU", "GHA",
    "GRC", "GRD", "GTM", "GIN", "GNB", "GUY", "HTI", "HND", "HUN", "ISL", "IND",
    "IDN", "IRN", "IRQ", "IRL", "ISR", "ITA", "JAM", "JPN", "JOR", "KAZ", "KEN",
    "KIR", "PRK", "KOR", "KWT", "KGZ", "LAO", "LVA", "LBN", "LSO", "LBR", "LBY",
    "LIE", "LTU", "LUX", "MDG", "MWI", "MYS", "MDV", "MLI", "MLT", "MHL", "MRT",
    "MUS", "MEX", "FSM", "MDA", "MCO", "MNG", "MNE", "MAR", "MOZ", "MMR", "NAM",
    "NRU", "NPL", "NLD", "NZL", "NIC", "NER", "NGA", "MKD", "NOR", "OMN", "PAK",
    "PLW", "PAN", "PNG", "PRY", "PER", "PHL", "POL", "PRT", "QAT", "ROU", "RUS",
    "RWA", "KNA", "LCA", "VCT", "WSM", "SMR", "STP", "SAU", "SEN", "SRB", "SYC",
    "SLE", "SGP", "SVK", "SVN", "SLB", "SOM", "ZAF", "SSD", "ESP", "LKA", "SDN",
    "SUR", "SWE", "CHE", "SYR", "TWN", "TJK", "TZA", "THA", "TLS", "TGO", "TON",
    "TTO", "TUN", "TUR", "TKM", "TUV", "UGA", "UKR", "ARE", "GBR", "USA", "URY",
    "UZB", "VUT", "VAT", "VEN", "VNM", "YEM", "ZMB", "ZWE",
    # Specimen / Test Countries
    "UTO", "UNA", "UNK", "XOM", "XBA", "XCC"
}


class ValidationFinding(BaseModel):
    category: str
    severity: str  # CRITICAL, WARNING, INFO
    field: str
    message: str


class DocumentValidationResult(BaseModel):
    is_valid: bool = True
    has_expired: bool = False
    findings: List[ValidationFinding] = []
    critical_errors: List[str] = []
    warnings: List[str] = []
    summary: str = "All deterministic validation rules passed."


def parse_date_safely(date_str: Optional[str]) -> Optional[date]:
    """Parses ISO or common date string into a date object."""
    if not date_str:
        return None
    cleaned = str(date_str).strip()
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue
    return None


def validate_document_rules(
    doc_number: str,
    surname: str,
    given_names: str,
    nationality: str,
    date_of_birth: Optional[str],
    date_of_expiry: Optional[str],
    sex: Optional[str],
    mrz_valid: bool = True,
    current_reference_date: Optional[date] = None
) -> DocumentValidationResult:
    """
    Applies deterministic integrity and format validation checks across document fields.
    """
    today = current_reference_date or date.today()
    findings: List[ValidationFinding] = []
    critical: List[str] = []
    warnings: List[str] = []
    has_expired = False

    # 1. Mandatory Field Presence
    if not doc_number or len(doc_number.strip()) < 5:
        msg = "Missing or invalid document number."
        findings.append(ValidationFinding(category="MANDATORY_FIELD", severity="CRITICAL", field="document_number", message=msg))
        critical.append(msg)

    if not surname or len(surname.strip()) < 2:
        msg = "Missing primary identifier (Surname)."
        findings.append(ValidationFinding(category="MANDATORY_FIELD", severity="CRITICAL", field="surname", message=msg))
        critical.append(msg)

    # 2. Expiration Check
    exp_date = parse_date_safely(date_of_expiry)
    if exp_date:
        if exp_date < today:
            has_expired = True
            msg = f"Document is EXPIRED (expired on {exp_date.isoformat()}, today is {today.isoformat()})."
            findings.append(ValidationFinding(category="DOCUMENT_VALIDITY", severity="CRITICAL", field="date_of_expiry", message=msg))
            critical.append(msg)
        elif (exp_date - today).days < 180:
            msg = f"Passport is nearing expiration (validity < 6 months remaining: {exp_date.isoformat()})."
            findings.append(ValidationFinding(category="DOCUMENT_VALIDITY", severity="WARNING", field="date_of_expiry", message=msg))
            warnings.append(msg)

    # 3. Temporal Consistency Checks (DOB vs Expiry vs Today)
    dob_date = parse_date_safely(date_of_birth)
    if dob_date:
        if dob_date > today:
            msg = f"Invalid Date of Birth: DOB ({dob_date.isoformat()}) cannot be in the future."
            findings.append(ValidationFinding(category="TEMPORAL_LOGIC", severity="CRITICAL", field="date_of_birth", message=msg))
            critical.append(msg)
        
        # Holder Age Check
        age_years = (today - dob_date).days / 365.25
        if age_years > 115:
            msg = f"Implausible holder age ({int(age_years)} years old)."
            findings.append(ValidationFinding(category="TEMPORAL_LOGIC", severity="WARNING", field="date_of_birth", message=msg))
            warnings.append(msg)

        # DOB vs Expiry logic
        if exp_date and exp_date <= dob_date:
            msg = f"Temporal conflict: Date of Expiry ({exp_date.isoformat()}) is before Date of Birth ({dob_date.isoformat()})."
            findings.append(ValidationFinding(category="TEMPORAL_LOGIC", severity="CRITICAL", field="date_of_expiry", message=msg))
            critical.append(msg)

    # 4. Nationality / Issuing State Code Validation
    nat_clean = re.sub(r"[^A-Z]", "", nationality.upper().strip()) if nationality else ""
    if nat_clean and len(nat_clean) == 3:
        if nat_clean not in VALID_ICAO_COUNTRY_CODES:
            msg = f"Unrecognized ICAO Doc 9303 country code: '{nat_clean}'."
            findings.append(ValidationFinding(category="FORMAT_VALIDATION", severity="WARNING", field="nationality", message=msg))
            warnings.append(msg)

    # 5. Document Number Format Rule
    doc_clean = re.sub(r"[^A-Z0-9]", "", doc_number.upper().strip()) if doc_number else ""
    if doc_clean:
        if len(set(doc_clean)) == 1:
            msg = f"Suspicious dummy document number with identical characters: '{doc_clean}'."
            findings.append(ValidationFinding(category="FORMAT_VALIDATION", severity="CRITICAL", field="document_number", message=msg))
            critical.append(msg)

    # 6. Cryptographic MRZ Checksums Check
    if not mrz_valid:
        msg = "ICAO Doc 9303 MRZ 7-3-1 Modulo-10 cryptographic checksum failure."
        findings.append(ValidationFinding(category="CRYPTOGRAPHIC_CHECKSUM", severity="CRITICAL", field="mrz", message=msg))
        critical.append(msg)

    # Compile result
    is_valid = (len(critical) == 0 and not has_expired)
    summary = "Document passes all deterministic validation rules." if is_valid else f"Failed validation: {len(critical)} critical issues found."

    return DocumentValidationResult(
        is_valid=is_valid,
        has_expired=has_expired,
        findings=findings,
        critical_errors=critical,
        warnings=warnings,
        summary=summary
    )
