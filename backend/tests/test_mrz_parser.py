"""
Unit tests for MRZ Multi-Format Parser (TD1, TD2, TD3).
"""
import pytest
from backend.app.mrz.parser import parse_mrz, parse_td3, parse_td1, parse_td2


def test_parse_td3_valid_passport():
    """
    Tests parsing a valid ICAO Doc 9303 TD3 standard passport MRZ.
    """
    line1 = "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<"
    line2 = "L898902C36UTO7408122F1204159ZE184226B<<<<<10"

    result = parse_td3(line1, line2)
    assert result.document_format == "TD3"
    assert result.issuing_country == "UTO"
    assert result.surname == "ERIKSSON"
    assert result.given_names == "ANNA MARIA"
    assert result.full_name == "ANNA MARIA ERIKSSON"
    assert result.document_number == "L898902C3"
    assert result.nationality == "UTO"
    assert result.raw_dob == "740812"
    assert result.sex == "F"
    assert result.raw_expiry == "120415"
    assert result.is_valid is True
    assert len(result.checksum_breakdown) >= 4


def test_parse_td3_invalid_checksum():
    """
    Tests TD3 passport with an altered document number check digit.
    """
    line1 = "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<"
    # Corrupt check digit from 6 to 9
    line2 = "L898902C39UTO7408122F1204159ZE184226B<<<<<10"

    result = parse_td3(line1, line2)
    assert result.is_valid is False
    assert result.status == "CHECKSUM_FAILED"
    assert any("Document number checksum failed" in err for err in result.errors)


def test_parse_td1_national_id():
    """
    Tests parsing a valid ICAO Doc 9303 TD1 (3 lines of 30 chars).
    """
    # Sample TD1: ID card
    line1 = "I<UTOD231458907<<<<<<<<<<<<<<<"
    line2 = "7408122F1204159UTO<<<<<<<<<<<6"
    line3 = "ERIKSSON<<ANNA<MARIA<<<<<<<<<<"

    result = parse_td1(line1, line2, line3)
    assert result.document_format == "TD1"
    assert result.surname == "ERIKSSON"
    assert result.given_names == "ANNA MARIA"
    assert result.document_number == "D23145890"
    assert result.nationality == "UTO"
    assert result.is_valid is True


def test_auto_detect_mrz():
    """Tests parse_mrz auto-detection on string input."""
    raw_passport = """
    P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<
    L898902C36UTO7408122F1204159ZE184226B<<<<<10
    """
    result = parse_mrz(raw_passport)
    assert result.document_format == "TD3"
    assert result.surname == "ERIKSSON"
