"""
Database Layer for VeriGuard AI.
"""
from backend.app.db.session import engine, SessionLocal, Base, get_db, DATABASE_URL
from backend.app.db.models import (
    User,
    ScreeningCase,
    QualityRecord,
    MRZRecord,
    TamperRecord,
    BiometricRecord,
    RiskAssessment,
    AuditLog,
    WatchlistItem
)
from backend.app.db.auth import (
    hash_password,
    verify_password,
    generate_salt,
    generate_session_token
)
from backend.app.db.init_db import init_database, seed_database

__all__ = [
    "engine",
    "SessionLocal",
    "Base",
    "get_db",
    "DATABASE_URL",
    "User",
    "ScreeningCase",
    "QualityRecord",
    "MRZRecord",
    "TamperRecord",
    "BiometricRecord",
    "RiskAssessment",
    "AuditLog",
    "WatchlistItem",
    "hash_password",
    "verify_password",
    "generate_salt",
    "generate_session_token",
    "init_database",
    "seed_database",
]
