"""
ICAO Doc 9303 MRZ Parsing Engine.
Supports TD3 (Passports), TD1 (National IDs), and TD2 (Visas / Cards).
"""
import re
import datetime
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

from backend.app.mrz.checksum import (
    compute_check_digit,
    verify_check_digit,
    parse_mrz_date,
    check_date_expiration
)


class ChecksumFieldResult(BaseModel):
    """Result of validating an individual MRZ check digit."""
    field_name: str
    raw_value: str
    check_digit: str
    expected_check_digit: str
    valid: bool


class MRZParsedResult(BaseModel):
    """Complete parsed and validated MRZ record."""
    document_format: str = Field(..., description="TD3, TD1, or TD2")
    document_type: str
    issuing_country: str
    surname: str
    given_names: str
    full_name: str
    document_number: str
    nationality: str
    date_of_birth: Optional[str] = None  # YYYY-MM-DD
    raw_dob: str
    sex: str
    date_of_expiry: Optional[str] = None  # YYYY-MM-DD
    raw_expiry: str
    optional_data: Optional[str] = None
    
    # Validation flags
    is_valid: bool = Field(..., description="True if all check digits and structures are valid")
    is_expired: bool = False
    status: str = "VALID"  # VALID, CHECKSUM_FAILED, EXPIRED, FORMAT_ERROR
    
    # Detailed checksum validations
    checksum_breakdown: List[ChecksumFieldResult] = []
    
    # Errors and Warnings
    errors: List[str] = []
    warnings: List[str] = []
    
    # Raw MRZ lines
    raw_lines: List[str] = []


def sanitize_mrz_line(line: str) -> str:
    """Cleans an MRZ string by stripping whitespace and converting to uppercase."""
    if not line:
        return ""
    # Replace whitespace with filler '<' or remove
    cleaned = re.sub(r'[\r\n\t ]+', '', line).upper()
    return cleaned


def clean_name(name_str: str) -> str:
    """Replaces filler '<' with spaces and trims."""
    return re.sub(r'<+', ' ', name_str).strip()


def parse_name_field(raw_name: str) -> tuple[str, str, str]:
    """
    Parses 'SURNAME<<GIVEN<NAMES<<<<' into (surname, given_names, full_name).
    """
    parts = raw_name.split("<<")
    surname = clean_name(parts[0]) if len(parts) > 0 else ""
    given_names = clean_name(parts[1]) if len(parts) > 1 else ""
    full_name = f"{given_names} {surname}".strip() if given_names else surname
    return surname, given_names, full_name


def parse_td3(line1: str, line2: str) -> MRZParsedResult:
    """
    Parses ICAO Doc 9303 TD3 (Passport) format: 2 lines of 44 characters.
    """
    errors: List[str] = []
    warnings: List[str] = []
    checksums: List[ChecksumFieldResult] = []

    # Format verification
    if len(line1) != 44 or len(line2) != 44:
        errors.append(f"TD3 requires exactly 2 lines of 44 chars. Got line1={len(line1)}, line2={len(line2)}.")

    # Pad lines if shorter to prevent index errors
    l1 = line1.ljust(44, '<')[:44]
    l2 = line2.ljust(44, '<')[:44]

    doc_type = l1[0:2].replace('<', '')
    issuing_country = l1[2:5].replace('<', '')
    raw_name = l1[5:44]
    surname, given_names, full_name = parse_name_field(raw_name)

    # Line 2 fields
    doc_number = l2[0:9].replace('<', '')
    doc_num_check = l2[9]
    nationality = l2[10:13].replace('<', '')
    raw_dob = l2[13:19]
    dob_check = l2[19]
    sex = l2[20].replace('<', 'X')
    raw_expiry = l2[21:27]
    expiry_check = l2[27]
    optional_data = l2[28:42].replace('<', '')
    optional_check = l2[42]
    composite_check = l2[43]

    # Validate Document Number Checksum
    doc_num_data = l2[0:9]
    valid_doc_num = verify_check_digit(doc_num_data, doc_num_check)
    expected_doc_check = compute_check_digit(doc_num_data)
    checksums.append(ChecksumFieldResult(
        field_name="Document Number",
        raw_value=doc_number,
        check_digit=doc_num_check,
        expected_check_digit=expected_doc_check,
        valid=valid_doc_num
    ))
    if not valid_doc_num:
        errors.append(f"Document number checksum failed. Expected '{expected_doc_check}', got '{doc_num_check}'.")

    # Validate DOB
    valid_dob_chk = verify_check_digit(raw_dob, dob_check)
    expected_dob_chk = compute_check_digit(raw_dob)
    checksums.append(ChecksumFieldResult(
        field_name="Date of Birth",
        raw_value=raw_dob,
        check_digit=dob_check,
        expected_check_digit=expected_dob_chk,
        valid=valid_dob_chk
    ))
    if not valid_dob_chk:
        errors.append(f"Date of birth checksum failed. Expected '{expected_dob_chk}', got '{dob_check}'.")

    dob_valid, parsed_dob, dob_err = parse_mrz_date(raw_dob, is_birth_date=True)
    if not dob_valid:
        errors.append(f"Invalid Date of Birth: {dob_err}")

    # Validate Expiry
    valid_exp_chk = verify_check_digit(raw_expiry, expiry_check)
    expected_exp_chk = compute_check_digit(raw_expiry)
    checksums.append(ChecksumFieldResult(
        field_name="Date of Expiry",
        raw_value=raw_expiry,
        check_digit=expiry_check,
        expected_check_digit=expected_exp_chk,
        valid=valid_exp_chk
    ))
    if not valid_exp_chk:
        errors.append(f"Date of expiry checksum failed. Expected '{expected_exp_chk}', got '{expiry_check}'.")

    exp_valid, parsed_exp, exp_err = parse_mrz_date(raw_expiry, is_birth_date=False)
    is_expired = False
    if not exp_valid:
        errors.append(f"Invalid Date of Expiry: {exp_err}")
    else:
        exp_info = check_date_expiration(parsed_exp)
        is_expired = exp_info["is_expired"]
        if is_expired:
            warnings.append(f"Document is EXPIRED ({exp_info['days_until_expiry']} days ago).")
        elif exp_info["expiring_soon"]:
            warnings.append(f"Document is EXPIRING SOON in {exp_info['days_until_expiry']} days.")

    # Validate Optional data check digit if present
    if optional_check != '<' and optional_check.isdigit():
        valid_opt_chk = verify_check_digit(l2[28:42], optional_check)
        expected_opt_chk = compute_check_digit(l2[28:42])
        checksums.append(ChecksumFieldResult(
            field_name="Optional Data",
            raw_value=optional_data,
            check_digit=optional_check,
            expected_check_digit=expected_opt_chk,
            valid=valid_opt_chk
        ))
        if not valid_opt_chk:
            warnings.append(f"Optional data check digit mismatch.")

    # Composite Check Digit calculation (TD3: l2[0:10] + l2[13:20] + l2[21:43])
    composite_data = l2[0:10] + l2[13:20] + l2[21:43]
    valid_comp_chk = verify_check_digit(composite_data, composite_check)
    expected_comp_chk = compute_check_digit(composite_data)
    checksums.append(ChecksumFieldResult(
        field_name="Composite Checksum",
        raw_value="Composite",
        check_digit=composite_check,
        expected_check_digit=expected_comp_chk,
        valid=valid_comp_chk
    ))
    if not valid_comp_chk:
        errors.append(f"Composite check digit failed. Expected '{expected_comp_chk}', got '{composite_check}'.")

    all_checksums_valid = all(c.valid for c in checksums)
    overall_valid = all_checksums_valid and (len(errors) == 0)

    status = "VALID"
    if not overall_valid:
        status = "CHECKSUM_FAILED" if not all_checksums_valid else "FORMAT_ERROR"
    elif is_expired:
        status = "EXPIRED"

    return MRZParsedResult(
        document_format="TD3",
        document_type=doc_type or "P",
        issuing_country=issuing_country,
        surname=surname,
        given_names=given_names,
        full_name=full_name,
        document_number=doc_number,
        nationality=nationality,
        date_of_birth=parsed_dob.isoformat() if parsed_dob else None,
        raw_dob=raw_dob,
        sex=sex,
        date_of_expiry=parsed_exp.isoformat() if parsed_exp else None,
        raw_expiry=raw_expiry,
        optional_data=optional_data or None,
        is_valid=overall_valid,
        is_expired=is_expired,
        status=status,
        checksum_breakdown=checksums,
        errors=errors,
        warnings=warnings,
        raw_lines=[line1, line2]
    )


def parse_td1(line1: str, line2: str, line3: str) -> MRZParsedResult:
    """
    Parses ICAO Doc 9303 TD1 (National ID) format: 3 lines of 30 characters.
    """
    errors: List[str] = []
    warnings: List[str] = []
    checksums: List[ChecksumFieldResult] = []

    if len(line1) != 30 or len(line2) != 30 or len(line3) != 30:
        errors.append(f"TD1 requires 3 lines of 30 chars. Got ({len(line1)}, {len(line2)}, {len(line3)}).")

    l1 = line1.ljust(30, '<')[:30]
    l2 = line2.ljust(30, '<')[:30]
    l3 = line3.ljust(30, '<')[:30]

    doc_type = l1[0:2].replace('<', '')
    issuing_country = l1[2:5].replace('<', '')
    doc_number = l1[5:14].replace('<', '')
    doc_num_check = l1[14]
    opt_data1 = l1[15:30].replace('<', '')

    raw_dob = l2[0:6]
    dob_check = l2[6]
    sex = l2[7].replace('<', 'X')
    raw_expiry = l2[8:14]
    expiry_check = l2[14]
    nationality = l2[15:18].replace('<', '')
    opt_data2 = l2[18:29].replace('<', '')
    composite_check = l2[29]

    raw_name = l3[0:30]
    surname, given_names, full_name = parse_name_field(raw_name)

    # Document Number Checksum
    valid_doc_num = verify_check_digit(l1[5:14], doc_num_check)
    expected_doc_check = compute_check_digit(l1[5:14])
    checksums.append(ChecksumFieldResult(
        field_name="Document Number",
        raw_value=doc_number,
        check_digit=doc_num_check,
        expected_check_digit=expected_doc_check,
        valid=valid_doc_num
    ))
    if not valid_doc_num:
        errors.append(f"Document number checksum failed.")

    # DOB Checksum
    valid_dob_chk = verify_check_digit(raw_dob, dob_check)
    expected_dob_chk = compute_check_digit(raw_dob)
    checksums.append(ChecksumFieldResult(
        field_name="Date of Birth",
        raw_value=raw_dob,
        check_digit=dob_check,
        expected_check_digit=expected_dob_chk,
        valid=valid_dob_chk
    ))
    if not valid_dob_chk:
        errors.append("Date of birth checksum failed.")

    dob_valid, parsed_dob, dob_err = parse_mrz_date(raw_dob, is_birth_date=True)
    if not dob_valid:
        errors.append(f"Invalid Date of Birth: {dob_err}")

    # Expiry Checksum
    valid_exp_chk = verify_check_digit(raw_expiry, expiry_check)
    expected_exp_chk = compute_check_digit(raw_expiry)
    checksums.append(ChecksumFieldResult(
        field_name="Date of Expiry",
        raw_value=raw_expiry,
        check_digit=expiry_check,
        expected_check_digit=expected_exp_chk,
        valid=valid_exp_chk
    ))
    if not valid_exp_chk:
        errors.append("Date of expiry checksum failed.")

    exp_valid, parsed_exp, exp_err = parse_mrz_date(raw_expiry, is_birth_date=False)
    is_expired = False
    if not exp_valid:
        errors.append(f"Invalid Date of Expiry: {exp_err}")
    else:
        exp_info = check_date_expiration(parsed_exp)
        is_expired = exp_info["is_expired"]
        if is_expired:
            warnings.append(f"Document is EXPIRED ({exp_info['days_until_expiry']} days ago).")

    # Composite check digit (TD1: Line1[5:30] + Line2[0:7] + Line2[8:15] + Line2[18:29])
    composite_data = l1[5:30] + l2[0:7] + l2[8:15] + l2[18:29]
    valid_comp_chk = verify_check_digit(composite_data, composite_check)
    expected_comp_chk = compute_check_digit(composite_data)
    checksums.append(ChecksumFieldResult(
        field_name="Composite Checksum",
        raw_value="Composite",
        check_digit=composite_check,
        expected_check_digit=expected_comp_chk,
        valid=valid_comp_chk
    ))
    if not valid_comp_chk:
        errors.append("Composite checksum failed.")

    all_checksums_valid = all(c.valid for c in checksums)
    overall_valid = all_checksums_valid and (len(errors) == 0)

    status = "VALID"
    if not overall_valid:
        status = "CHECKSUM_FAILED" if not all_checksums_valid else "FORMAT_ERROR"
    elif is_expired:
        status = "EXPIRED"

    return MRZParsedResult(
        document_format="TD1",
        document_type=doc_type or "I",
        issuing_country=issuing_country,
        surname=surname,
        given_names=given_names,
        full_name=full_name,
        document_number=doc_number,
        nationality=nationality,
        date_of_birth=parsed_dob.isoformat() if parsed_dob else None,
        raw_dob=raw_dob,
        sex=sex,
        date_of_expiry=parsed_exp.isoformat() if parsed_exp else None,
        raw_expiry=raw_expiry,
        optional_data=f"{opt_data1} {opt_data2}".strip() or None,
        is_valid=overall_valid,
        is_expired=is_expired,
        status=status,
        checksum_breakdown=checksums,
        errors=errors,
        warnings=warnings,
        raw_lines=[line1, line2, line3]
    )


def parse_td2(line1: str, line2: str) -> MRZParsedResult:
    """
    Parses ICAO Doc 9303 TD2 (Visa / ID) format: 2 lines of 36 characters.
    """
    errors: List[str] = []
    warnings: List[str] = []
    checksums: List[ChecksumFieldResult] = []

    if len(line1) != 36 or len(line2) != 36:
        errors.append(f"TD2 requires 2 lines of 36 chars. Got ({len(line1)}, {len(line2)}).")

    l1 = line1.ljust(36, '<')[:36]
    l2 = line2.ljust(36, '<')[:36]

    doc_type = l1[0:2].replace('<', '')
    issuing_country = l1[2:5].replace('<', '')
    raw_name = l1[5:36]
    surname, given_names, full_name = parse_name_field(raw_name)

    doc_number = l2[0:9].replace('<', '')
    doc_num_check = l2[9]
    nationality = l2[10:13].replace('<', '')
    raw_dob = l2[13:19]
    dob_check = l2[19]
    sex = l2[20].replace('<', 'X')
    raw_expiry = l2[21:27]
    expiry_check = l2[27]
    optional_data = l2[28:35].replace('<', '')
    composite_check = l2[35]

    # Document Number Checksum
    valid_doc_num = verify_check_digit(l2[0:9], doc_num_check)
    expected_doc_check = compute_check_digit(l2[0:9])
    checksums.append(ChecksumFieldResult(
        field_name="Document Number",
        raw_value=doc_number,
        check_digit=doc_num_check,
        expected_check_digit=expected_doc_check,
        valid=valid_doc_num
    ))
    if not valid_doc_num:
        errors.append("Document number checksum failed.")

    # DOB Checksum
    valid_dob_chk = verify_check_digit(raw_dob, dob_check)
    expected_dob_chk = compute_check_digit(raw_dob)
    checksums.append(ChecksumFieldResult(
        field_name="Date of Birth",
        raw_value=raw_dob,
        check_digit=dob_check,
        expected_check_digit=expected_dob_chk,
        valid=valid_dob_chk
    ))
    if not valid_dob_chk:
        errors.append("Date of birth checksum failed.")

    dob_valid, parsed_dob, dob_err = parse_mrz_date(raw_dob, is_birth_date=True)
    if not dob_valid:
        errors.append(f"Invalid Date of Birth: {dob_err}")

    # Expiry Checksum
    valid_exp_chk = verify_check_digit(raw_expiry, expiry_check)
    expected_exp_chk = compute_check_digit(raw_expiry)
    checksums.append(ChecksumFieldResult(
        field_name="Date of Expiry",
        raw_value=raw_expiry,
        check_digit=expiry_check,
        expected_check_digit=expected_exp_chk,
        valid=valid_exp_chk
    ))
    if not valid_exp_chk:
        errors.append("Date of expiry checksum failed.")

    exp_valid, parsed_exp, exp_err = parse_mrz_date(raw_expiry, is_birth_date=False)
    is_expired = False
    if not exp_valid:
        errors.append(f"Invalid Date of Expiry: {exp_err}")
    else:
        exp_info = check_date_expiration(parsed_exp)
        is_expired = exp_info["is_expired"]
        if is_expired:
            warnings.append(f"Document is EXPIRED ({exp_info['days_until_expiry']} days ago).")

    # Composite check digit (TD2: l2[0:10] + l2[13:20] + l2[21:35])
    composite_data = l2[0:10] + l2[13:20] + l2[21:35]
    valid_comp_chk = verify_check_digit(composite_data, composite_check)
    expected_comp_chk = compute_check_digit(composite_data)
    checksums.append(ChecksumFieldResult(
        field_name="Composite Checksum",
        raw_value="Composite",
        check_digit=composite_check,
        expected_check_digit=expected_comp_chk,
        valid=valid_comp_chk
    ))
    if not valid_comp_chk:
        errors.append("Composite checksum failed.")

    all_checksums_valid = all(c.valid for c in checksums)
    overall_valid = all_checksums_valid and (len(errors) == 0)

    status = "VALID"
    if not overall_valid:
        status = "CHECKSUM_FAILED" if not all_checksums_valid else "FORMAT_ERROR"
    elif is_expired:
        status = "EXPIRED"

    return MRZParsedResult(
        document_format="TD2",
        document_type=doc_type or "V",
        issuing_country=issuing_country,
        surname=surname,
        given_names=given_names,
        full_name=full_name,
        document_number=doc_number,
        nationality=nationality,
        date_of_birth=parsed_dob.isoformat() if parsed_dob else None,
        raw_dob=raw_dob,
        sex=sex,
        date_of_expiry=parsed_exp.isoformat() if parsed_exp else None,
        raw_expiry=raw_expiry,
        optional_data=optional_data or None,
        is_valid=overall_valid,
        is_expired=is_expired,
        status=status,
        checksum_breakdown=checksums,
        errors=errors,
        warnings=warnings,
        raw_lines=[line1, line2]
    )


def parse_mrz(raw_text_or_lines: str | List[str]) -> MRZParsedResult:
    """
    Auto-detects MRZ format (TD3, TD1, TD2) and parses fields with ICAO 9303 validation.

    Args:
        raw_text_or_lines: Raw MRZ string (multi-line or newline-delimited) or list of lines.

    Returns:
        MRZParsedResult with parsed fields, check digits, and validation status.
    """
    if isinstance(raw_text_or_lines, str):
        lines = [line.strip() for line in raw_text_or_lines.strip().splitlines() if line.strip()]
    else:
        lines = [line.strip() for line in raw_text_or_lines if line.strip()]

    # Filter out empty or non-MRZ lines
    cleaned_lines = [sanitize_mrz_line(l) for l in lines]
    cleaned_lines = [l for l in cleaned_lines if len(l) >= 25]

    if len(cleaned_lines) == 2:
        # Check TD3 (44 chars) or TD2 (36 chars)
        l1, l2 = cleaned_lines[0], cleaned_lines[1]
        is_td3 = l1.startswith("P<") or len(l1) >= 40 or len(l2) >= 40
        if is_td3:
            return parse_td3(l1.ljust(44, '<')[:44], l2.ljust(44, '<')[:44])
        else:
            return parse_td2(l1.ljust(36, '<')[:36], l2.ljust(36, '<')[:36])
    elif len(cleaned_lines) == 3:
        # TD1 format (3x30)
        return parse_td1(cleaned_lines[0], cleaned_lines[1], cleaned_lines[2])
    elif len(cleaned_lines) >= 4:
        # Try extracting the last 2 or 3 lines that match MRZ patterns
        # Look for '<' patterns
        mrz_candidates = [l for l in cleaned_lines if '<' in l]
        if len(mrz_candidates) >= 2:
            return parse_mrz(mrz_candidates[-2:])
        elif len(mrz_candidates) >= 3:
            return parse_mrz(mrz_candidates[-3:])

    # Fallback error result
    return MRZParsedResult(
        document_format="UNKNOWN",
        document_type="UNKNOWN",
        issuing_country="UNKNOWN",
        surname="",
        given_names="",
        full_name="",
        document_number="",
        nationality="",
        raw_dob="",
        sex="",
        raw_expiry="",
        is_valid=False,
        status="FORMAT_ERROR",
        errors=[f"Unrecognized MRZ layout with {len(cleaned_lines)} detected lines."],
        raw_lines=lines
    )
