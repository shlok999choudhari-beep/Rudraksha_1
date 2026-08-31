"""
Database Initialization and Seeding Script for VeriGuard AI.
Creates all database tables and seeds operational personas, historical cases, and watchlists.
"""
import uuid
import datetime
from sqlalchemy.orm import Session
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


def init_database():
    """Creates all database tables defined in SQLAlchemy models."""
    Base.metadata.create_all(bind=engine)


def seed_database(db: Session = None):
    """Seeds default personas, realistic screening cases, and Interpol watchlists."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        # 1. Seed Operational Personas
        personas = [
            {
                "id": "usr-officer-01",
                "email": "officer@veriguard.gov",
                "full_name": "Insp. Priya Sharma",
                "role": "OFFICER",
                "badge_number": "IND-7742",
                "station_id": "STATION-DEL-01",
            },
            {
                "id": "usr-supervisor-01",
                "email": "supervisor@veriguard.gov",
                "full_name": "Supr. Rajesh Kumar",
                "role": "SUPERVISOR",
                "badge_number": "IND-1029",
                "station_id": "STATION-DEL-01",
            },
            {
                "id": "usr-auditor-01",
                "email": "auditor@veriguard.gov",
                "full_name": "Aud. Sunita Rao",
                "role": "AUDITOR",
                "badge_number": "AUD-8812",
                "station_id": "HQ-AUDIT-01",
            },
            {
                "id": "usr-admin-01",
                "email": "admin@veriguard.gov",
                "full_name": "Admin Vikram Malhotra",
                "role": "ADMIN",
                "badge_number": "ADM-0001",
                "station_id": "HQ-ADMIN-01",
            },
        ]

        for p in personas:
            existing_user = db.query(User).filter(User.email == p["email"]).first()
            if not existing_user:
                pwd_hash, salt = hash_password("borderguard2026")
                new_user = User(
                    id=p["id"],
                    email=p["email"],
                    password_hash=pwd_hash,
                    salt=salt,
                    full_name=p["full_name"],
                    role=p["role"],
                    badge_number=p["badge_number"],
                    station_id=p["station_id"],
                    is_active=True,
                    created_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=30),
                    last_login_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=2),
                )
                db.add(new_user)

        # 2. Seed Watchlist Items
        watchlist_seeds = [
            {
                "id": "wl-001",
                "document_number": "P88910023",
                "full_name": "Dmitri Volkov",
                "nationality": "RUS",
                "reason": "Interpol Red Notice — Transnational Financial Forgery Syndicate",
                "alert_level": "CRITICAL",
                "issuing_authority": "INTERPOL-SLTD-LYON",
            },
            {
                "id": "wl-002",
                "document_number": "A12345678",
                "full_name": "Marcus Vance",
                "nationality": "GBR",
                "reason": "Lost and Stolen Travel Document (SLTD) database flag",
                "alert_level": "WARNING",
                "issuing_authority": "UK-PASSPORT-OFFICE",
            }
        ]

        for w in watchlist_seeds:
            existing_wl = db.query(WatchlistItem).filter(WatchlistItem.document_number == w["document_number"]).first()
            if not existing_wl:
                db.add(WatchlistItem(
                    id=w["id"],
                    document_number=w["document_number"],
                    full_name=w["full_name"],
                    nationality=w["nationality"],
                    reason=w["reason"],
                    alert_level=w["alert_level"],
                    issuing_authority=w["issuing_authority"],
                    is_active=True,
                ))

        # 3. Seed Realistic Historical Cases
        cases_to_seed = [
            {
                "id": "case-seed-001",
                "case_number": "VG-20260831-001",
                "status": "COMPLETED",
                "document_type": "PASSPORT",
                "document_number": "L898902C3",
                "holder_name": "ERIKSSON ANNA MARIA",
                "nationality": "UTO",
                "date_of_birth": "1974-08-12",
                "date_of_expiry": "2030-01-01",
                "overall_risk_score": 6.5,
                "overall_risk_level": "LOW",
                "overall_trust_score": 93.5,
                "decision": "APPROVED_FOR_CLEARANCE",
                "processing_time_ms": 342.0,
                "created_by_id": "usr-officer-01",
                "reviewed_by_id": "usr-officer-01",
                "review_decision": "APPROVED",
                "review_notes": "All ICAO check digits matched. No visual or noise tampering detected.",
                "created_at": datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=4),
                "completed_at": datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=4) + datetime.timedelta(seconds=1),
                "blur_score": 880.0,
                "glare_ratio": 0.01,
                "tamper_score": 4.0,
                "face_matched": True,
                "similarity_score": 94.8,
                "liveness_passed": True,
                "liveness_score": 96.2,
                "recommendation": "Document and identity verified for border clearance."
            },
            {
                "id": "case-seed-002",
                "case_number": "VG-20260831-002",
                "status": "ESCALATED",
                "document_type": "PASSPORT",
                "document_number": "X99881122",
                "holder_name": "SMITH JOHN DOE",
                "nationality": "UTO",
                "date_of_birth": "1985-07-12",
                "date_of_expiry": "2029-05-20",
                "overall_risk_score": 88.0,
                "overall_risk_level": "CRITICAL",
                "overall_trust_score": 12.0,
                "decision": "SECONDARY_INSPECTION_REQUIRED",
                "processing_time_ms": 410.0,
                "created_by_id": "usr-officer-01",
                "reviewed_by_id": "usr-supervisor-01",
                "review_decision": "ESCALATED",
                "review_notes": "DOB and Doc Number altered in Visual Inspection Zone. Severe ELA recompression anomaly detected on portrait photo.",
                "created_at": datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=2),
                "completed_at": datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=2) + datetime.timedelta(seconds=1),
                "blur_score": 750.0,
                "glare_ratio": 0.02,
                "tamper_score": 85.0,
                "face_matched": False,
                "similarity_score": 38.5,
                "liveness_passed": True,
                "liveness_score": 91.0,
                "recommendation": "CRITICAL RISK: Multiple forensic tampering signals detected. Escalate for secondary border inspection."
            }
        ]

        for c in cases_to_seed:
            existing_case = db.query(ScreeningCase).filter(ScreeningCase.id == c["id"]).first()
            if not existing_case:
                new_case = ScreeningCase(
                    id=c["id"],
                    case_number=c["case_number"],
                    status=c["status"],
                    document_type=c["document_type"],
                    document_number=c["document_number"],
                    holder_name=c["holder_name"],
                    nationality=c["nationality"],
                    date_of_birth=c["date_of_birth"],
                    date_of_expiry=c["date_of_expiry"],
                    overall_risk_score=c["overall_risk_score"],
                    overall_risk_level=c["overall_risk_level"],
                    overall_trust_score=c["overall_trust_score"],
                    decision=c["decision"],
                    processing_time_ms=c["processing_time_ms"],
                    created_by_id=c["created_by_id"],
                    reviewed_by_id=c["reviewed_by_id"],
                    review_decision=c["review_decision"],
                    review_notes=c["review_notes"],
                    created_at=c["created_at"],
                    completed_at=c["completed_at"]
                )
                db.add(new_case)
                db.flush()

                # Add quality record
                db.add(QualityRecord(
                    case_id=c["id"],
                    is_acceptable=True,
                    blur_score=c["blur_score"],
                    glare_ratio=c["glare_ratio"],
                    resolution_w=1250,
                    resolution_h=880,
                    aspect_ratio=1.42,
                    checks_json=[
                        {"key": "resolution", "label": "Resolution", "verdict": "GOOD", "detail": "1250x880 px"},
                        {"key": "blur", "label": "Sharpness", "verdict": "GOOD", "detail": f"Laplacian variance {c['blur_score']:.1f}"},
                    ]
                ))

                # Add MRZ record
                db.add(MRZRecord(
                    case_id=c["id"],
                    document_format="TD3",
                    is_valid=(c["overall_risk_score"] < 50),
                    is_expired=False,
                    check_digits_json=[
                        {"field": "Document Number", "label": "Doc No Checksum", "valid": True},
                        {"field": "Date of Birth", "label": "DOB Checksum", "valid": (c["overall_risk_score"] < 50)},
                    ]
                ))

                # Add Tamper record
                db.add(TamperRecord(
                    case_id=c["id"],
                    tamper_risk_score=c["tamper_score"],
                    is_tampered=(c["tamper_score"] > 30),
                    photo_anomaly_score=c["tamper_score"],
                    text_anomaly_score=10.0,
                    copy_move_detected=False,
                    noise_inconsistency_score=c["tamper_score"],
                    suspicious_regions_json=[]
                ))

                # Add Biometric record
                db.add(BiometricRecord(
                    case_id=c["id"],
                    face_matched=c["face_matched"],
                    similarity_score=c["similarity_score"],
                    liveness_passed=c["liveness_passed"],
                    liveness_score=c["liveness_score"]
                ))

                # Add Risk Assessment
                db.add(RiskAssessment(
                    case_id=c["id"],
                    physical_score=10.0,
                    data_consistency_score=10.0 if c["overall_risk_score"] < 50 else 80.0,
                    tamper_score=c["tamper_score"],
                    biometric_score=10.0 if c["face_matched"] else 75.0,
                    critical_violations_json=[] if c["overall_risk_score"] < 50 else ["VIZ-to-MRZ DOB mismatch", "ELA photo recompression anomaly"],
                    warning_flags_json=[],
                    recommendation=c["recommendation"]
                ))

        # 4. Seed Initial Audit Logs
        if db.query(AuditLog).count() == 0:
            db.add(AuditLog(
                id="aud-init-001",
                timestamp=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=4),
                actor_id="usr-officer-01",
                actor_name="Insp. Priya Sharma",
                actor_role="OFFICER",
                action="USER_LOGIN",
                case_id=None,
                detail="Officer logged into Station DEL-01 Terminal",
                ip_address="127.0.0.1",
                hash_signature="sig-sha256-init-001"
            ))
            db.add(AuditLog(
                id="aud-init-002",
                timestamp=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=2),
                actor_id="usr-supervisor-01",
                actor_name="Supr. Rajesh Kumar",
                actor_role="SUPERVISOR",
                action="CASE_REVIEWED",
                case_id="case-seed-002",
                detail="Escalated Case VG-20260831-002 to Secondary Inspection due to DOB tampering",
                ip_address="127.0.0.1",
                hash_signature="sig-sha256-init-002"
            ))

        db.commit()

    finally:
        if should_close:
            db.close()


if __name__ == "__main__":
    print("Initializing database tables...")
    init_database()
    print("Seeding database records...")
    seed_database()
    print("Database initialization complete!")
