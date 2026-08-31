"""
Automated Data & Schema Migration Script for Supabase.
Transfers users, screening cases, quality checks, tamper records, biometric logs,
audit trails, and local images to Supabase PostgreSQL and Supabase Storage.
"""
import os
import sys
import glob
import json
import uuid
import datetime
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from dotenv import load_dotenv
load_dotenv()

from backend.app.db.session import engine, SessionLocal, Base
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
from backend.app.db.auth import hash_password
from backend.app.db.supabase_client import upload_image_to_supabase, is_supabase_enabled, get_supabase_client
from backend.app.store import USERS_DB, CASES_DB, AUDIT_LOGS_DB, seed_initial_records


def run_schema_migration():
    """Applies the SQLAlchemy schema directly to the configured database engine."""
    print(" [1/4] Applying database tables to PostgreSQL / Supabase...")
    Base.metadata.create_all(bind=engine)
    
    # Check and add new columns if migrating from existing legacy SQLite DB
    from sqlalchemy import text
    with engine.connect() as conn:
        for col_name in ["document_image_url", "doc_face_url", "live_face_url", "ela_heatmap_url"]:
            try:
                conn.execute(text(f"ALTER TABLE screening_cases ADD COLUMN {col_name} TEXT"))
                conn.commit()
            except Exception:
                pass
    print("   Tables verified and created successfully.")


def migrate_users(db):
    """Migrates authentication accounts and officer profiles."""
    print(" [2/4] Migrating officer user accounts...")
    count = 0
    for email, udata in USERS_DB.items():
        existing = db.query(User).filter(User.email == email).first()
        p_hash, salt = hash_password(udata.get("password", "borderguard2026"))
        if existing:
            existing.password_hash = p_hash
            existing.salt = salt
            existing.full_name = udata.get("name", "Officer")
            existing.role = udata.get("role", "OFFICER")
            existing.badge_number = udata.get("badge_number", "BG-0001")
            existing.station_id = udata.get("station", "STATION-DEL-01")
            existing.is_active = True
            count += 1
        else:
            user = User(
                id=udata.get("id", str(uuid.uuid4())),
                email=email,
                password_hash=p_hash,
                salt=salt,
                full_name=udata.get("name", "Officer"),
                role=udata.get("role", "OFFICER"),
                badge_number=udata.get("badge_number", "BG-0001"),
                station_id=udata.get("station", "STATION-DEL-01"),
                is_active=True
            )
            db.add(user)
            count += 1
    db.commit()
    print(f"   Migrated/Synced {count} user accounts to Supabase.")


def migrate_screening_cases(db):
    """Migrates historical cases and related forensic reports."""
    print(" [3/4] Migrating screening cases and forensic records...")
    # Ensure seed cases are initialized
    seed_initial_records()
    
    count = 0
    for case_id, c in CASES_DB.items():
        existing = db.query(ScreeningCase).filter(ScreeningCase.id == case_id).first()
        if existing:
            continue

        doc = c.get("document", {})
        risk = c.get("risk", {})
        quality = c.get("quality", {})
        mrz = c.get("mrz", {})
        tamper = c.get("tampering", {})
        face = c.get("face", {})
        liveness = c.get("liveness", {})

        # Optional cloud image upload
        doc_img_url = doc.get("image_url")
        if doc_img_url and is_supabase_enabled() and doc_img_url.startswith("data:"):
            cloud_url = upload_image_to_supabase(doc_img_url, bucket_name="veriguard-documents", filename=f"{case_id}_doc.jpg")
            if cloud_url:
                doc_img_url = cloud_url

        db_case = ScreeningCase(
            id=case_id,
            case_number=case_id.replace("case-", "CASE-").upper(),
            status=c.get("status", "COMPLETED"),
            document_type=doc.get("type", "PASSPORT"),
            document_number=doc.get("document_number", "N/A"),
            holder_name=doc.get("holder_name", "N/A"),
            nationality=doc.get("nationality", "N/A"),
            overall_risk_score=float(risk.get("overall_score", 0.0)),
            overall_risk_level=risk.get("overall_level", "LOW"),
            overall_trust_score=float(risk.get("trust_score", 100.0)),
            decision=risk.get("recommendation", "APPROVED_FOR_CLEARANCE"),
            processing_time_ms=float(c.get("processing_time_ms", 350.0)),
            document_image_b64=doc.get("image_url") if not doc_img_url else None,
            document_image_url=doc_img_url if doc_img_url and not doc_img_url.startswith("data:") else None
        )
        db.add(db_case)
        db.flush()

        # Add Quality Record
        q_record = QualityRecord(
            case_id=case_id,
            is_acceptable=quality.get("is_acceptable", True),
            checks_json=quality.get("checks", [])
        )
        db.add(q_record)

        # Add MRZ Record
        m_record = MRZRecord(
            case_id=case_id,
            document_format=mrz.get("format", "TD3"),
            is_valid=mrz.get("valid", True),
            raw_lines_json=mrz.get("lines", []),
            check_digits_json=mrz.get("check_digits", [])
        )
        db.add(m_record)

        # Add Tamper Record
        t_record = TamperRecord(
            case_id=case_id,
            tamper_risk_score=float(tamper.get("overall_score", 0.0)),
            is_tampered=tamper.get("verdict") == "HIGH",
            photo_anomaly_score=float(tamper.get("photo_score", 0.0)),
            text_anomaly_score=float(tamper.get("text_score", 0.0)),
            suspicious_regions_json=tamper.get("suspicious_regions", [])
        )
        db.add(t_record)

        # Add Biometric Record
        b_record = BiometricRecord(
            case_id=case_id,
            face_matched=face.get("verdict") == "MATCH",
            similarity_score=float(face.get("similarity", 0.0)),
            liveness_passed=liveness.get("liveness_passed", True),
            liveness_score=float(liveness.get("score", 1.0))
        )
        db.add(b_record)

        # Add Risk Assessment
        r_record = RiskAssessment(
            case_id=case_id,
            physical_score=float(risk.get("physical_score", 0.0)),
            data_consistency_score=float(risk.get("data_consistency_score", 0.0)),
            tamper_score=float(risk.get("tamper_score", 0.0)),
            biometric_score=float(risk.get("biometric_score", 0.0)),
            critical_violations_json=risk.get("critical_violations", []),
            warning_flags_json=risk.get("warning_flags", []),
            recommendation=risk.get("recommendation", "APPROVED_FOR_CLEARANCE")
        )
        db.add(r_record)
        count += 1

    db.commit()
    print(f"   Migrated {count} screening cases to Supabase.")


def migrate_audit_logs(db):
    """Migrates audit trail to Supabase."""
    print(" [4/4] Migrating immutable forensic audit logs...")
    count = 0
    for a in AUDIT_LOGS_DB:
        existing = db.query(AuditLog).filter(AuditLog.id == a.get("id")).first()
        if not existing:
            log = AuditLog(
                id=a.get("id", str(uuid.uuid4())),
                actor_id=a.get("actor_id", "usr-officer-01"),
                actor_name=a.get("actor_name", "Insp. Priya Sharma"),
                actor_role=a.get("actor_role", "OFFICER"),
                action=a.get("action", "SCREENING_PERFORMED"),
                case_id=a.get("case_id"),
                detail=a.get("detail"),
                ip_address=a.get("ip_address", "127.0.0.1"),
                hash_signature=a.get("hash_signature")
            )
            db.add(log)
            count += 1
    db.commit()
    print(f"   Migrated {count} audit log records.")


def main():
    print("=" * 60)
    print(" VeriGuard AI -> Supabase Cloud Migration Tool")
    print(f" Database URL: {engine.url}")
    print(f" Supabase Storage Enabled: {is_supabase_enabled()}")
    print("=" * 60)

    run_schema_migration()

    db = SessionLocal()
    try:
        migrate_users(db)
        migrate_screening_cases(db)
        migrate_audit_logs(db)
        print("\n Migration completed successfully!")
    finally:
        db.close()


if __name__ == "__main__":
    main()
