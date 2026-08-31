"""
Authentication and Password Security Engine for VeriGuard AI.
Uses PBKDF2-HMAC-SHA256 with 600,000 iterations for secure password hashing.
"""
import os
import hmac
import hashlib
import secrets
import datetime
from typing import Tuple, Optional, Dict, Any


def generate_salt(length: int = 32) -> str:
    """Generates a cryptographically secure random hexadecimal salt."""
    return secrets.token_hex(length)


def hash_password(password: str, salt: Optional[str] = None) -> Tuple[str, str]:
    """
    Hashes a password using PBKDF2-HMAC-SHA256 with a unique salt.
    
    Returns:
        (password_hash, salt)
    """
    if not salt:
        salt = generate_salt(16)
    
    pwd_bytes = password.encode("utf-8")
    salt_bytes = salt.encode("utf-8")
    
    # 600,000 iterations of PBKDF2-SHA256
    key = hashlib.pbkdf2_hmac("sha256", pwd_bytes, salt_bytes, iterations=600000)
    hash_hex = key.hex()
    
    return hash_hex, salt


def verify_password(password: str, password_hash: str, salt: str) -> bool:
    """
    Constant-time comparison verification for passwords against stored hash and salt.
    """
    try:
        calculated_hash, _ = hash_password(password, salt=salt)
        return hmac.compare_digest(calculated_hash, password_hash)
    except Exception:
        return False


def generate_session_token(user_id: str, email: str, role: str) -> str:
    """Generates a secure authenticated session token."""
    now_ts = datetime.datetime.now(datetime.timezone.utc).timestamp()
    raw = f"{user_id}:{email}:{role}:{now_ts}:{secrets.token_hex(16)}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
