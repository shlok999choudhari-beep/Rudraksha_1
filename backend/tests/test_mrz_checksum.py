"""
Unit tests for ICAO 9303 Checksum Engine.
"""
import pytest
import datetime
from backend.app.mrz.checksum import (
    compute_check_digit,
    verify_check_digit,
    parse_mrz_date,
    check_date_expiration,
    get_character_value
)


def test_character_values():
    """Verifies standard character values per ICAO 9303."""
    assert get_character_value('<') == 0
    assert get_character_value('0') == 0
    assert get_character_value('9') == 9
    assert get_character_value('A') == 10
    assert get_character_value('Z') == 35


def test_compute_check_digit_standard_vectors():
    """
    Verifies check digit calculations using official ICAO Doc 9303 test vectors.
    """
    # Sample: Doc Number "L898902C3" -> Check digit is '6'
    # 'L' (21)*7 + '8'*3 + '9'*1 + '8'*7 + '9'*3 + '0'*1 + '2'*7 + 'C'(12)*3 + '3'*1
    # 147 + 24 + 9 + 56 + 27 + 0 + 14 + 36 + 3 = 316 % 10 = 6
    assert compute_check_digit("L898902C3") == "6"

    # Sample: DOB "740812" -> Check digit is '2'
    # 7*7 + 4*3 + 0*1 + 8*7 + 1*3 + 2*1 = 49 + 12 + 0 + 56 + 3 + 2 = 122 % 10 = 2
    assert compute_check_digit("740812") == "2"

    # Sample: Expiry "120415" -> Check digit is '9'
    # 1*7 + 2*3 + 0*1 + 4*7 + 1*3 + 5*1 = 7 + 6 + 0 + 28 + 3 + 5 = 49 % 10 = 9
    assert compute_check_digit("120415") == "9"


def test_verify_check_digit():
    """Tests verification with valid and invalid check digits."""
    assert verify_check_digit("L898902C3", "6") is True
    assert verify_check_digit("L898902C3", "7") is False
    assert verify_check_digit("740812", "2") is True
    assert verify_check_digit("740812", "3") is False


def test_parse_mrz_date():
    """Tests parsing YYMMDD into datetime.date with century resolution."""
    # DOB: 850712 -> 1985-07-12
    valid, dt, err = parse_mrz_date("850712", is_birth_date=True)
    assert valid is True
    assert dt == datetime.date(1985, 7, 12)
    assert err is None

    # Expiry: 300101 -> 2030-01-01
    valid, dt, err = parse_mrz_date("300101", is_birth_date=False)
    assert valid is True
    assert dt == datetime.date(2030, 1, 1)

    # Invalid component: month 13
    valid, dt, err = parse_mrz_date("851312", is_birth_date=True)
    assert valid is False
    assert dt is None
    assert "out of range" in err


def test_check_date_expiration():
    """Tests expiration status calculation."""
    past_date = datetime.date(2020, 1, 1)
    future_date = datetime.date(2035, 1, 1)

    past_res = check_date_expiration(past_date, reference_date=datetime.date(2026, 8, 27))
    assert past_res["is_expired"] is True
    assert past_res["status"] == "EXPIRED"

    future_res = check_date_expiration(future_date, reference_date=datetime.date(2026, 8, 27))
    assert future_res["is_expired"] is False
    assert future_res["status"] == "VALID"
