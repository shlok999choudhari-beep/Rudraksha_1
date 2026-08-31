"""
ICAO Doc 9303 Checksum Engine.
Implements the 7-3-1 modulus 10 check digit calculation and verification
for machine readable travel documents (Passports, Visas, ID Cards).
"""
import datetime
from typing import Tuple, Optional, Dict, Any


# Standard ICAO 9303 weight sequence
ICAO_WEIGHTS = [7, 3, 1]


def get_character_value(char: str) -> int:
    """
    Returns the integer value of an MRZ character per ICAO 9303:
    '0'-'9' -> 0-9
    'A'-'Z' -> 10-35
    '<' -> 0
    """
    c = char.upper()
    if c == '<':
        return 0
    elif c.isdigit():
        return int(c)
    elif 'A' <= c <= 'Z':
        return ord(c) - ord('A') + 10
    else:
        # For unexpected OCR noise, treat as 0
        return 0


def compute_check_digit(data_str: str) -> str:
    """
    Calculates the ICAO 9303 modulus 10 check digit for a given data string
    using repetitive weights [7, 3, 1].

    Args:
        data_str: Input alphanumeric string (e.g. document number, DOB, expiry).

    Returns:
        A single character string representing the check digit ('0'-'9').
    """
    total = 0
    for idx, char in enumerate(data_str):
        weight = ICAO_WEIGHTS[idx % 3]
        char_val = get_character_value(char)
        total += char_val * weight

    return str(total % 10)


def verify_check_digit(data_str: str, check_digit: str) -> bool:
    """
    Verifies if the provided check digit matches the calculated check digit.

    Args:
        data_str: The data payload string.
        check_digit: The check digit character to verify against.

    Returns:
        True if valid, False otherwise.
    """
    if not check_digit:
        return False
    expected = compute_check_digit(data_str)
    return expected == str(check_digit).strip()


def parse_mrz_date(
    date_str: str,
    is_birth_date: bool = False,
    reference_date: Optional[datetime.date] = None
) -> Tuple[bool, Optional[datetime.date], Optional[str]]:
    """
    Parses an ICAO YYMMDD date string into a Python datetime.date object.
    Applies standard century resolution heuristics.

    Args:
        date_str: 6-character string 'YYMMDD'
        is_birth_date: True if DOB (favors 1900s), False if expiry (favors 2000s)
        reference_date: Reference date for century pivot (defaults to today)

    Returns:
        (is_valid_format, parsed_date, error_message)
    """
    if not date_str or len(date_str) != 6 or not date_str.isdigit():
        return False, None, f"Invalid date format '{date_str}', expected 6 digits (YYMMDD)."

    if reference_date is None:
        reference_date = datetime.date.today()

    current_year = reference_date.year
    curr_yy = current_year % 100
    curr_century = (current_year // 100) * 100

    try:
        yy = int(date_str[0:2])
        mm = int(date_str[2:4])
        dd = int(date_str[4:6])

        if mm < 1 or mm > 12 or dd < 1 or dd > 31:
            return False, None, f"Date components out of range (MM={mm}, DD={dd})."

        if is_birth_date:
            # If DOB YY > current YY, it must be in the previous century (19YY)
            # If DOB YY <= current YY, it could be 20YY or 19YY
            full_year = (curr_century if yy <= curr_yy else curr_century - 100) + yy
        else:
            # Expiration date
            full_year = (curr_century if yy >= (curr_yy - 30) else curr_century + 100) + yy

        parsed = datetime.date(full_year, mm, dd)
        return True, parsed, None
    except ValueError as e:
        return False, None, f"Invalid calendar date: {str(e)}"


def check_date_expiration(expiry_date: datetime.date, reference_date: Optional[datetime.date] = None) -> Dict[str, Any]:
    """
    Evaluates whether an expiration date is expired or expiring soon.

    Returns:
        Dict with 'is_expired', 'expiring_soon', 'days_until_expiry', 'status'
    """
    if reference_date is None:
        reference_date = datetime.date.today()

    delta = (expiry_date - reference_date).days
    is_expired = delta < 0
    expiring_soon = 0 <= delta <= 180  # within 6 months

    if is_expired:
        status = "EXPIRED"
    elif expiring_soon:
        status = "EXPIRING_SOON"
    else:
        status = "VALID"

    return {
        "is_expired": is_expired,
        "expiring_soon": expiring_soon,
        "days_until_expiry": delta,
        "status": status
    }
