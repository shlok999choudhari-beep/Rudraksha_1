"""
Unit tests for OCR / VIZ to MRZ Cross-Validation Engine.
"""
import pytest
from backend.app.mrz.checksum import compute_check_digit
from backend.app.mrz.parser import parse_td3
from backend.app.ocr.cross_validation import (
    cross_validate_viz_and_mrz,
    VIZDataPayload,
    normalize_text,
    compute_string_similarity,
    normalize_date_for_comparison
)


@pytest.fixture
def valid_active_mrz_record():
    doc_num = "L898902C3"
    doc_chk = compute_check_digit(doc_num)  # '6'
    dob = "740812"
    dob_chk = compute_check_digit(dob)  # '2'
    expiry = "320415"  # 15 Apr 2032
    exp_chk = compute_check_digit(expiry)  # '3'
    opt = "ZE184226B<<<<<"
    opt_chk = compute_check_digit(opt)  # '1'
    composite_data = f"{doc_num}{doc_chk}{dob}{dob_chk}{expiry}{exp_chk}{opt}{opt_chk}"
    composite_chk = compute_check_digit(composite_data)

    line1 = "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<"
    line2 = f"{doc_num}{doc_chk}UTO{dob}{dob_chk}F{expiry}{exp_chk}{opt}{opt_chk}{composite_chk}"
    return parse_td3(line1, line2)


def test_cross_validation_matching(valid_active_mrz_record):
    """Verifies that completely matching VIZ and active MRZ produces LOW risk."""
    viz = VIZDataPayload(
        surname="ERIKSSON",
        given_names="ANNA MARIA",
        document_number="L898902C3",
        date_of_birth="12 AUG 1974",
        date_of_expiry="15 APR 2032",
        sex="F"
    )

    report = cross_validate_viz_and_mrz(viz, valid_active_mrz_record)
    assert report.is_consistent is True
    assert report.risk_level == "LOW"
    assert len(report.mismatched_fields) == 0
    assert report.discrepancy_score == 0.0


def test_cross_validation_altered_document_number(valid_active_mrz_record):
    """Verifies that mismatched document number triggers risk mismatch."""
    viz = VIZDataPayload(
        surname="ERIKSSON",
        document_number="X99999999",  # Altered!
        date_of_birth="12 AUG 1974",
        date_of_expiry="15 APR 2032",
        sex="F"
    )

    report = cross_validate_viz_and_mrz(viz, valid_active_mrz_record)
    assert report.is_consistent is False
    assert report.risk_level in ("MEDIUM", "HIGH", "CRITICAL")
    assert "document_number" in report.mismatched_fields


def test_cross_validation_altered_dob(valid_active_mrz_record):
    """Verifies that mismatched Date of Birth triggers risk mismatch."""
    viz = VIZDataPayload(
        surname="ERIKSSON",
        document_number="L898902C3",
        date_of_birth="01 JAN 1990",  # Altered from 1974!
        date_of_expiry="15 APR 2032",
        sex="F"
    )

    report = cross_validate_viz_and_mrz(viz, valid_active_mrz_record)
    assert report.is_consistent is False
    assert report.risk_level in ("MEDIUM", "HIGH", "CRITICAL")
    assert "date_of_birth" in report.mismatched_fields


def test_string_similarity():
    """Verifies fuzzy similarity helper."""
    assert compute_string_similarity("JOHN", "JOHN") == 1.0
    assert compute_string_similarity("JOHN", "JOHNATHAN") >= 0.9
    assert compute_string_similarity("SMITH", "DOE") < 0.3


def test_normalize_date():
    """Verifies date normalization."""
    assert normalize_date_for_comparison("12 JUL 1985") == "1985-07-12"
    assert normalize_date_for_comparison("1985-07-12") == "1985-07-12"
    assert normalize_date_for_comparison("12/07/1985") == "1985-07-12"

