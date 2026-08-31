"""
SQLAlchemy ORM Models for VeriGuard AI.
PostgreSQL and SQLite cross-compatible relational schema.
"""
import uuid
import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    Text,
    JSON,
    ForeignKey
)
from sqlalchemy.orm import relationship
from backend.app.db.session import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


def now_utc():
    return datetime.datetime.now(datetime.timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    salt = Column(String(64), nullable=False)
    full_name = Column(String(128), nullable=False)
    role = Column(String(32), nullable=False, default="OFFICER")  # OFFICER, SUPERVISOR, AUDITOR, ADMIN
    badge_number = Column(String(64), nullable=True)
    station_id = Column(String(64), default="STATION-DEL-01")
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=now_utc)
    last_login_at = Column(DateTime, nullable=True)

    created_cases = relationship("ScreeningCase", foreign_keys="ScreeningCase.created_by_id", back_populates="created_by")
    reviewed_cases = relationship("ScreeningCase", foreign_keys="ScreeningCase.reviewed_by_id", back_populates="reviewed_by")

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "name": self.full_name,
            "role": self.role,
            "badge_number": self.badge_number,
            "station_id": self.station_id,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_login_at": self.last_login_at.isoformat() if self.last_login_at else None,
        }


class ScreeningCase(Base):
    __tablename__ = "screening_cases"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    case_number = Column(String(64), unique=True, nullable=False, index=True)
    status = Column(String(32), default="COMPLETED", nullable=False, index=True)  # IN_PROGRESS, COMPLETED, ESCALATED, RESOLVED
    document_type = Column(String(32), default="PASSPORT", nullable=False)
    document_number = Column(String(64), nullable=True, index=True)
    holder_name = Column(String(255), nullable=True)
    nationality = Column(String(16), nullable=True)
    date_of_birth = Column(String(32), nullable=True)
    date_of_expiry = Column(String(32), nullable=True)
    
    overall_risk_score = Column(Float, default=0.0, nullable=False)
    overall_risk_level = Column(String(32), default="LOW", nullable=False, index=True)
    overall_trust_score = Column(Float, default=100.0, nullable=False)
    decision = Column(String(64), default="APPROVED_FOR_CLEARANCE", nullable=False)
    processing_time_ms = Column(Float, default=0.0)

    created_by_id = Column(String(64), ForeignKey("users.id"), nullable=True)
    reviewed_by_id = Column(String(64), ForeignKey("users.id"), nullable=True)
    review_decision = Column(String(64), nullable=True)
    review_notes = Column(Text, nullable=True)
    document_image_b64 = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    completed_at = Column(DateTime, nullable=True)

    created_by = relationship("User", foreign_keys=[created_by_id], back_populates="created_cases")
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id], back_populates="reviewed_cases")

    quality = relationship("QualityRecord", back_populates="case", uselist=False, cascade="all, delete-orphan")
    mrz = relationship("MRZRecord", back_populates="case", uselist=False, cascade="all, delete-orphan")
    tamper = relationship("TamperRecord", back_populates="case", uselist=False, cascade="all, delete-orphan")
    biometric = relationship("BiometricRecord", back_populates="case", uselist=False, cascade="all, delete-orphan")
    risk_assessment = relationship("RiskAssessment", back_populates="case", uselist=False, cascade="all, delete-orphan")

    def to_summary_dict(self):
        return {
            "case_id": self.id,
            "case_number": self.case_number,
            "status": self.status,
            "document_type": self.document_type,
            "document_number": self.document_number or "N/A",
            "holder_name": self.holder_name or "N/A",
            "nationality": self.nationality or "N/A",
            "risk_score": self.overall_risk_score,
            "risk_level": self.overall_risk_level,
            "trust_score": self.overall_trust_score,
            "decision": self.decision,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "processing_time_ms": self.processing_time_ms,
            "created_by": self.created_by.to_dict() if self.created_by else {"id": "usr-officer-01", "name": "Insp. Priya Sharma", "role": "OFFICER"},
            "review_decision": self.review_decision,
            "review_notes": self.review_notes,
        }


class QualityRecord(Base):
    __tablename__ = "quality_records"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    case_id = Column(String(64), ForeignKey("screening_cases.id"), unique=True, nullable=False)
    is_acceptable = Column(Boolean, default=True, nullable=False)
    blur_score = Column(Float, default=0.0)
    glare_ratio = Column(Float, default=0.0)
    resolution_w = Column(Integer, default=1250)
    resolution_h = Column(Integer, default=880)
    aspect_ratio = Column(Float, default=1.42)
    checks_json = Column(JSON, default=list)
    created_at = Column(DateTime, default=now_utc)

    case = relationship("ScreeningCase", back_populates="quality")


class MRZRecord(Base):
    __tablename__ = "mrz_records"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    case_id = Column(String(64), ForeignKey("screening_cases.id"), unique=True, nullable=False)
    document_format = Column(String(16), default="TD3")
    is_valid = Column(Boolean, default=True, nullable=False)
    is_expired = Column(Boolean, default=False, nullable=False)
    raw_lines_json = Column(JSON, default=list)
    check_digits_json = Column(JSON, default=list)
    errors_json = Column(JSON, default=list)
    created_at = Column(DateTime, default=now_utc)

    case = relationship("ScreeningCase", back_populates="mrz")


class TamperRecord(Base):
    __tablename__ = "tamper_records"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    case_id = Column(String(64), ForeignKey("screening_cases.id"), unique=True, nullable=False)
    tamper_risk_score = Column(Float, default=0.0)
    is_tampered = Column(Boolean, default=False, nullable=False)
    photo_anomaly_score = Column(Float, default=0.0)
    text_anomaly_score = Column(Float, default=0.0)
    copy_move_detected = Column(Boolean, default=False)
    noise_inconsistency_score = Column(Float, default=0.0)
    suspicious_regions_json = Column(JSON, default=list)
    ela_heatmap_b64 = Column(Text, nullable=True)
    created_at = Column(DateTime, default=now_utc)

    case = relationship("ScreeningCase", back_populates="tamper")


class BiometricRecord(Base):
    __tablename__ = "biometric_records"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    case_id = Column(String(64), ForeignKey("screening_cases.id"), unique=True, nullable=False)
    face_matched = Column(Boolean, default=True, nullable=False)
    similarity_score = Column(Float, default=0.0)
    liveness_passed = Column(Boolean, default=True, nullable=False)
    liveness_score = Column(Float, default=0.0)
    attack_type = Column(String(64), nullable=True)
    doc_face_crop_b64 = Column(Text, nullable=True)
    live_face_crop_b64 = Column(Text, nullable=True)
    created_at = Column(DateTime, default=now_utc)

    case = relationship("ScreeningCase", back_populates="biometric")


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    case_id = Column(String(64), ForeignKey("screening_cases.id"), unique=True, nullable=False)
    physical_score = Column(Float, default=0.0)
    data_consistency_score = Column(Float, default=0.0)
    tamper_score = Column(Float, default=0.0)
    biometric_score = Column(Float, default=0.0)
    critical_violations_json = Column(JSON, default=list)
    warning_flags_json = Column(JSON, default=list)
    recommendation = Column(Text, nullable=True)
    breakdown_json = Column(JSON, default=list)
    created_at = Column(DateTime, default=now_utc)

    case = relationship("ScreeningCase", back_populates="risk_assessment")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    timestamp = Column(DateTime, default=now_utc, index=True)
    actor_id = Column(String(64), nullable=True)
    actor_name = Column(String(128), nullable=True)
    actor_role = Column(String(32), nullable=True)
    action = Column(String(64), nullable=False, index=True)
    case_id = Column(String(64), nullable=True, index=True)
    detail = Column(Text, nullable=True)
    ip_address = Column(String(45), default="127.0.0.1")
    hash_signature = Column(String(64), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "actor_id": self.actor_id or "system",
            "actor_name": self.actor_name or "VeriGuard Core",
            "actor_role": self.actor_role or "SYSTEM",
            "action": self.action,
            "case_id": self.case_id,
            "detail": self.detail,
            "ip_address": self.ip_address,
            "hash_signature": self.hash_signature,
        }


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    document_number = Column(String(64), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    nationality = Column(String(16), nullable=True)
    reason = Column(Text, nullable=False)
    alert_level = Column(String(32), default="CRITICAL", nullable=False)
    issuing_authority = Column(String(128), default="INTERPOL-SLTD")
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=now_utc)

    def to_dict(self):
        return {
            "id": self.id,
            "document_number": self.document_number,
            "full_name": self.full_name,
            "nationality": self.nationality,
            "reason": self.reason,
            "alert_level": self.alert_level,
            "issuing_authority": self.issuing_authority,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
