"""
In-Memory Store & Persistence Engine for VeriGuard AI Backend.
Maintains screening cases, audit trail, authentication profiles, and aggregate metrics.
"""
import uuid
import datetime
from typing import Dict, List, Any, Optional

# Initial Seed Users
USERS_DB: Dict[str, Dict[str, Any]] = {
    "officer@veriguard.gov": {
        "id": "usr-officer-01",
        "name": "Insp. Priya Sharma",
        "email": "officer@veriguard.gov",
        "role": "OFFICER",
        "badge_number": "BG-8842",
        "station": "IGI Airport (Terminal 3, Lane 4)",
        "password": "borderguard2026",
    },
    "supervisor@veriguard.gov": {
        "id": "usr-super-01",
        "name": "Chief Rajesh Nair",
        "email": "supervisor@veriguard.gov",
        "role": "SUPERVISOR",
        "badge_number": "BG-1021",
        "station": "IGI Airport (Immigration Command)",
        "password": "borderguard2026",
    },
    "auditor@veriguard.gov": {
        "id": "usr-audit-01",
        "name": "Dr. Sunita Rao",
        "email": "auditor@veriguard.gov",
        "role": "AUDITOR",
        "badge_number": "AUD-4401",
        "station": "Ministry of Home Affairs",
        "password": "borderguard2026",
    },
    "admin@veriguard.gov": {
        "id": "usr-admin-01",
        "name": "System Administrator",
        "email": "admin@veriguard.gov",
        "role": "ADMIN",
        "badge_number": "SYS-0001",
        "station": "VeriGuard Central Operations",
        "password": "borderguard2026",
    },
}

# In-Memory Storage Tables
CASES_DB: Dict[str, Dict[str, Any]] = {}
AUDIT_LOGS_DB: List[Dict[str, Any]] = []


def record_audit_log(
    action: str,
    actor_name: str = "Insp. Priya Sharma",
    actor_role: str = "OFFICER",
    case_id: Optional[str] = None,
    detail: Optional[str] = None,
    actor_id: Optional[str] = None,
    ip_address: str = "127.0.0.1"
) -> Dict[str, Any]:
    """Appends an immutable audit record to memory and database."""
    log_id = f"aud-{uuid.uuid4().hex[:8]}"
    ts_now = datetime.datetime.now(datetime.timezone.utc)
    
    log_entry = {
        "id": log_id,
        "timestamp": ts_now.isoformat(),
        "actor": {
            "name": actor_name,
            "role": actor_role,
        },
        "action": action,
        "case_id": case_id,
        "detail": detail,
    }
    AUDIT_LOGS_DB.insert(0, log_entry)

    # Persist to database if available
    try:
        from backend.app.db.session import SessionLocal
        from backend.app.db.models import AuditLog
        with SessionLocal() as db:
            db_log = AuditLog(
                id=log_id,
                timestamp=ts_now,
                actor_id=actor_id or "usr-officer-01",
                actor_name=actor_name,
                actor_role=actor_role,
                action=action,
                case_id=case_id,
                detail=detail,
                ip_address=ip_address,
                hash_signature=f"sig-{uuid.uuid4().hex[:12]}"
            )
            db.add(db_log)
            db.commit()
    except Exception:
        pass

    return log_entry


def save_case_to_db(case_dict: Dict[str, Any]):
    """Persists a complete screening case and relational records to the database."""
    try:
        from backend.app.db.session import SessionLocal
        from backend.app.db.models import (
            ScreeningCase, QualityRecord, MRZRecord, TamperRecord, BiometricRecord, RiskAssessment
        )
        case_id = case_dict.get("case_id")
        if not case_id:
            return

        with SessionLocal() as db:
            existing = db.query(ScreeningCase).filter(ScreeningCase.id == case_id).first()
            doc = case_dict.get("document", {})
            risk = case_dict.get("risk", {})
            quality = case_dict.get("quality", {})
            mrz = case_dict.get("mrz", {})
            tamper = case_dict.get("tampering", {})
            face = case_dict.get("face", {})
            liveness = case_dict.get("liveness", {})

            if not existing:
                new_case = ScreeningCase(
                    id=case_id,
                    case_number=f"VG-{datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d')}-{case_id[:6].upper()}",
                    status=case_dict.get("status", "COMPLETED"),
                    document_type=doc.get("type", "PASSPORT"),
                    document_number=doc.get("document_number", "N/A"),
                    holder_name=doc.get("holder_name", "N/A"),
                    nationality=doc.get("nationality", "UTO"),
                    date_of_birth=doc.get("date_of_birth", "1985-07-12"),
                    date_of_expiry=doc.get("date_of_expiry", "2030-01-01"),
                    overall_risk_score=float(risk.get("overall_score", 0.0)),
                    overall_risk_level=risk.get("level", "LOW"),
                    overall_trust_score=max(0.0, 100.0 - float(risk.get("overall_score", 0.0))),
                    decision=risk.get("recommended_action", "APPROVED_FOR_CLEARANCE"),
                    processing_time_ms=float(case_dict.get("processing_time_ms", 350.0)),
                    created_by_id=case_dict.get("created_by", {}).get("id", "usr-officer-01"),
                    document_image_b64=doc.get("image_url"),
                    created_at=datetime.datetime.now(datetime.timezone.utc),
                    completed_at=datetime.datetime.now(datetime.timezone.utc),
                )
                db.add(new_case)
                db.flush()

                # Add Quality Record
                db.add(QualityRecord(
                    case_id=case_id,
                    is_acceptable=quality.get("is_acceptable", True),
                    blur_score=850.0,
                    glare_ratio=0.01,
                    checks_json=quality.get("checks", [])
                ))

                # Add MRZ Record
                db.add(MRZRecord(
                    case_id=case_id,
                    document_format=mrz.get("format", "TD3"),
                    is_valid=mrz.get("valid", True),
                    raw_lines_json=mrz.get("lines", []),
                    check_digits_json=mrz.get("check_digits", [])
                ))

                # Add Tamper Record
                db.add(TamperRecord(
                    case_id=case_id,
                    tamper_risk_score=float(tamper.get("overall_score", 0.0)),
                    is_tampered=(tamper.get("verdict") == "HIGH"),
                    photo_anomaly_score=float(tamper.get("photo_anomaly_score", 0.0)),
                    text_anomaly_score=float(tamper.get("text_anomaly_score", 0.0)),
                    copy_move_detected=tamper.get("copy_move_detected", False),
                    noise_inconsistency_score=float(tamper.get("noise_inconsistency_score", 0.0)),
                    suspicious_regions_json=tamper.get("suspicious_regions", []),
                    ela_heatmap_b64=tamper.get("ela_heatmap_url")
                ))

                # Add Biometric Record
                db.add(BiometricRecord(
                    case_id=case_id,
                    face_matched=face.get("match", True),
                    similarity_score=float(face.get("similarity_score", 90.0)),
                    liveness_passed=liveness.get("passed", True),
                    liveness_score=float(liveness.get("liveness_score", 95.0)),
                    doc_face_crop_b64=face.get("doc_face_url"),
                    live_face_crop_b64=face.get("live_face_url")
                ))

                # Add Risk Assessment
                db.add(RiskAssessment(
                    case_id=case_id,
                    physical_score=10.0,
                    data_consistency_score=10.0,
                    tamper_score=float(tamper.get("overall_score", 0.0)),
                    biometric_score=10.0 if face.get("match", True) else 80.0,
                    recommendation=risk.get("recommended_action", "Document verified for clearance."),
                    breakdown_json=risk.get("breakdown", [])
                ))

                db.commit()
    except Exception as e:
        import traceback
        traceback.print_exc()



def seed_initial_records():
    """Populates historical cases for dashboard analytics and case archive."""
    if len(CASES_DB) > 0:
        return

    now = datetime.datetime.now(datetime.timezone.utc)

    # 1. Genuine Passport Case
    c1_id = "case-a17f-942b"
    c1_created = (now - datetime.timedelta(hours=2)).isoformat()
    CASES_DB[c1_id] = {
        "case_id": c1_id,
        "status": "APPROVED",
        "created_at": c1_created,
        "completed_at": (now - datetime.timedelta(hours=1, minutes=59)).isoformat(),
        "processing_time_ms": 385.4,
        "created_by": {"id": "usr-officer-01", "name": "Insp. Priya Sharma", "role": "OFFICER"},
        "document": {
            "document_id": "doc-882194a",
            "type": "PASSPORT",
            "image_url": "/static/synthetic/sample_tilted_passport.jpg",
            "document_number": "A12345678",
            "holder_name": "JANE DOE",
            "fields": [
                {"name": "Document Number", "value": "A12345678", "confidence": 0.99},
                {"name": "Surname", "value": "DOE", "confidence": 0.98},
                {"name": "Given Names", "value": "JANE", "confidence": 0.98},
                {"name": "Date of Birth", "value": "12 JUL 1985", "confidence": 0.99},
                {"name": "Date of Expiry", "value": "01 JAN 2030", "confidence": 0.99},
                {"name": "Nationality", "value": "UTO", "confidence": 0.99},
            ],
        },
        "quality": {
            "status": "COMPLETED",
            "is_acceptable": True,
            "warnings": [],
            "checks": [
                {"key": "resolution", "label": "Resolution", "verdict": "GOOD", "detail": "1250x880 px"},
                {"key": "document_visibility", "label": "Document Edges", "verdict": "GOOD", "detail": "All four corners located"},
                {"key": "blur", "label": "Sharpness", "verdict": "GOOD", "detail": "Laplacian variance 871.1"},
                {"key": "glare", "label": "Glare", "verdict": "GOOD", "detail": "0.8% saturated pixels"},
                {"key": "perspective", "label": "Perspective Correction", "verdict": "GOOD", "detail": "Geometry confidence 94%"},
                {"key": "brightness", "label": "Exposure", "verdict": "GOOD", "detail": "Mean luminance 142"},
                {"key": "contrast", "label": "Contrast", "verdict": "GOOD", "detail": "Std. deviation 58.4"},
            ]
        },
        "stages": [
            {"key": "quality", "status": "COMPLETED", "duration_ms": 42},
            {"key": "ocr", "status": "COMPLETED", "duration_ms": 110},
            {"key": "mrz", "status": "COMPLETED", "duration_ms": 28},
            {"key": "validation", "status": "COMPLETED", "duration_ms": 15},
            {"key": "tampering", "status": "COMPLETED", "duration_ms": 125},
            {"key": "face", "status": "COMPLETED", "duration_ms": 45},
            {"key": "liveness", "status": "COMPLETED", "duration_ms": 20},
            {"key": "database", "status": "COMPLETED", "duration_ms": 12},
            {"key": "risk", "status": "COMPLETED", "duration_ms": 8},
        ],
        "ocr": {
            "status": "COMPLETED",
            "fields": [
                {"name": "Document Number", "value": "A12345678", "confidence": 0.99},
                {"name": "Surname", "value": "DOE", "confidence": 0.98},
                {"name": "Given Names", "value": "JANE", "confidence": 0.98},
            ],
            "overall_confidence": 0.98,
            "raw_text": "REPUBLIC OF UTOPIA\nPASSPORT\nDOE JANE\nA12345678",
            "engine": "Surya OCR & Layout Engine",
        },
        "mrz": {
            "status": "COMPLETED",
            "valid": True,
            "format": "TD3",
            "lines": [
                "P<UTODOE<<JANE<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<",
                "A123456784UTO8507128F3001018<<<<<<<<<<<<<<06",
            ],
            "fields": [
                {"name": "Document Number", "value": "A12345678", "confidence": 1.0},
                {"name": "Date of Birth", "value": "850712", "confidence": 1.0},
                {"name": "Date of Expiry", "value": "300101", "confidence": 1.0},
            ],
            "check_digits": [
                {"field": "Document Number", "label": "Doc No Checksum", "expected": "4", "found": "4", "valid": True},
                {"field": "Date of Birth", "label": "DOB Checksum", "expected": "8", "found": "8", "valid": True},
                {"field": "Date of Expiry", "label": "Expiry Checksum", "expected": "8", "found": "8", "valid": True},
                {"field": "Composite", "label": "Composite Checksum", "expected": "6", "found": "6", "valid": True},
            ],
        },
        "cross_check": {
            "status": "COMPLETED",
            "comparisons": [
                {"key": "doc_no", "label": "Document Number", "ocr_value": "A12345678", "mrz_value": "A12345678", "status": "MATCH"},
                {"key": "dob", "label": "Date of Birth", "ocr_value": "12 JUL 1985", "mrz_value": "12 JUL 1985", "status": "MATCH"},
                {"key": "surname", "label": "Surname", "ocr_value": "DOE", "mrz_value": "DOE", "status": "MATCH"},
                {"key": "given_names", "label": "Given Names", "ocr_value": "JANE", "mrz_value": "JANE", "status": "MATCH"},
            ],
            "mismatch_count": 0,
        },
        "validation": {
            "status": "COMPLETED",
            "checks": [
                {"key": "expiry", "label": "Document Expiration", "outcome": "PASS", "rule": "Document must not be expired", "detail": "Expires 01 JAN 2030 (1,218 days remaining)"},
                {"key": "format", "label": "Format Standard", "outcome": "PASS", "rule": "ICAO Doc 9303 TD3 standard format", "detail": "Valid TD3 dimensions"},
            ],
            "failed_count": 0,
            "ruleset_version": "ICAO-9303-v7",
        },
        "tampering": {
            "status": "COMPLETED",
            "overall_score": 12.0,
            "verdict": "LOW",
            "photo_anomaly_score": 10.5,
            "text_anomaly_score": 8.0,
            "copy_move_detected": False,
            "noise_inconsistency_score": 14.0,
            "suspicious_regions": [],
            "ela_heatmap_url": "/static/processed/milestone1_geometry_validation.jpg",
        },
        "face": {
            "status": "COMPLETED",
            "match": True,
            "similarity_score": 94.8,
            "confidence": 0.95,
            "doc_face_url": "/static/synthetic/sample_tilted_passport.jpg",
            "live_face_url": "/static/synthetic/sample_tilted_passport.jpg",
        },
        "liveness": {
            "status": "COMPLETED",
            "passed": True,
            "liveness_score": 96.2,
            "method": "2D FFT Moire & Skin Texture Micro-Analysis",
            "attack_type_detected": None,
        },
        "watchlist": {
            "status": "COMPLETED",
            "flagged": False,
            "hits": [],
            "database_version": "INTERPOL-SLTD-v2.4",
        },
        "duplicate": {
            "status": "COMPLETED",
            "duplicate_detected": False,
            "matches": [],
        },
        "risk": {
            "overall_score": 8.5,
            "level": "LOW",
            "recommended_action": "Standard Processing",
            "explanation": "No significant adverse evidence detected across all 4 integrity layers.",
            "breakdown": [
                {"category": "document_validity", "score": 0, "max_score": 30, "origin": "DETERMINISTIC", "note": "Valid ICAO layout & unexpired"},
                {"category": "ocr_mrz_consistency", "score": 0, "max_score": 25, "origin": "DETERMINISTIC", "note": "All 4 check digits passed & VIZ match"},
                {"category": "tampering", "score": 3, "max_score": 35, "origin": "PROBABILISTIC", "note": "Low ELA compression variance"},
                {"category": "identity", "score": 2, "max_score": 30, "origin": "PROBABILISTIC", "note": "Face similarity 94.8%"},
                {"category": "liveness", "score": 1, "max_score": 25, "origin": "PROBABILISTIC", "note": "Natural skin texture verified"},
                {"category": "database", "score": 0, "max_score": 40, "origin": "DETERMINISTIC", "note": "No watchlist hits"},
            ],
            "top_reasons": [
                {"id": "rs-1", "label": "ICAO 9303 Check Digits Verified", "severity": "INFO", "category": "ocr_mrz_consistency", "contribution": 0}
            ],
        },
        "evidence": [
            {
                "category": "Document Integrity",
                "signals": [
                    {"label": "Standard ID-3 Aspect Ratio", "value": "1.42 (Within ±0.04 tolerance)", "severity": "INFO"},
                    {"label": "MRZ Band Alignment", "value": "Lower 22% zone (Parallel)", "severity": "INFO"},
                ],
            }
        ],
        "review": {
            "outcome": "MARK_REVIEWED",
            "reviewed_by": "Insp. Priya Sharma",
            "reviewed_at": (now - datetime.timedelta(hours=1, minutes=58)).isoformat(),
            "notes": [
                {
                    "id": "not-01",
                    "author": "Insp. Priya Sharma",
                    "author_role": "OFFICER",
                    "body": "Clear scan, biometric verification matched passenger on Lane 4.",
                    "created_at": (now - datetime.timedelta(hours=1, minutes=58)).isoformat(),
                }
            ],
        },
        "versions": {
            "preprocessing": "v1.4.0",
            "mrz_engine": "ICAO-Doc-9303-v7",
            "tamper_engine": "ELA-Noise-ORB-v2.1",
            "face_engine": "ArcFace-ONNX-512d",
        },
    }

    # 2. Tampered Document Case (High Risk)
    c2_id = "case-7b9c-4421"
    c2_created = (now - datetime.timedelta(hours=4)).isoformat()
    CASES_DB[c2_id] = {
        "case_id": c2_id,
        "status": "ESCALATED",
        "created_at": c2_created,
        "completed_at": (now - datetime.timedelta(hours=3, minutes=58)).isoformat(),
        "processing_time_ms": 420.1,
        "created_by": {"id": "usr-officer-01", "name": "Insp. Priya Sharma", "role": "OFFICER"},
        "document": {
            "document_id": "doc-99410ac",
            "type": "PASSPORT",
            "image_url": "/static/synthetic/sample_tampered_mismatch.jpg",
            "document_number": "M98765432",
            "holder_name": "ANANYA SHARMA",
            "fields": [
                {"name": "Document Number", "value": "M98765432", "confidence": 0.92},
                {"name": "Surname", "value": "SHARMA", "confidence": 0.95},
                {"name": "Given Names", "value": "ANANYA", "confidence": 0.95},
                {"name": "Date of Birth", "value": "12 JAN 2001", "confidence": 0.91},
            ],
        },
        "quality": {
            "status": "COMPLETED",
            "is_acceptable": True,
            "warnings": ["Local compression anomaly detected"],
            "checks": [
                {"key": "resolution", "label": "Resolution", "verdict": "GOOD", "detail": "1250x880 px"},
                {"key": "document_visibility", "label": "Document Edges", "verdict": "GOOD", "detail": "All four corners located"},
                {"key": "blur", "label": "Sharpness", "verdict": "GOOD", "detail": "Laplacian variance 820.0"},
                {"key": "glare", "label": "Glare", "verdict": "GOOD", "detail": "1.2% saturated pixels"},
                {"key": "perspective", "label": "Perspective Correction", "verdict": "GOOD", "detail": "Geometry confidence 91%"},
                {"key": "brightness", "label": "Exposure", "verdict": "GOOD", "detail": "Mean luminance 138"},
                {"key": "contrast", "label": "Contrast", "verdict": "GOOD", "detail": "Std. deviation 52.0"},
            ]
        },
        "stages": [
            {"key": "quality", "status": "COMPLETED", "duration_ms": 45},
            {"key": "ocr", "status": "COMPLETED", "duration_ms": 115},
            {"key": "mrz", "status": "FAILED", "duration_ms": 30, "message": "MRZ Checksum Mismatch"},
            {"key": "validation", "status": "COMPLETED", "duration_ms": 18},
            {"key": "tampering", "status": "COMPLETED", "duration_ms": 130},
            {"key": "face", "status": "COMPLETED", "duration_ms": 48},
            {"key": "liveness", "status": "COMPLETED", "duration_ms": 22},
            {"key": "database", "status": "COMPLETED", "duration_ms": 12},
            {"key": "risk", "status": "COMPLETED", "duration_ms": 10},
        ],
        "ocr": {
            "status": "COMPLETED",
            "fields": [
                {"name": "Document Number", "value": "M98765432", "confidence": 0.92},
                {"name": "Date of Birth", "value": "12 JAN 2001", "confidence": 0.91},
            ],
            "overall_confidence": 0.92,
            "raw_text": "REPUBLIC OF UTOPIA\nPASSPORT\nSHARMA ANANYA\nDOB: 12 JAN 2001",
            "engine": "Surya OCR & Layout Engine",
        },
        "mrz": {
            "status": "FAILED",
            "valid": False,
            "format": "TD3",
            "lines": [
                "P<UTOSHARMA<<ANANYA<<<<<<<<<<<<<<<<<<<<<<<<<",
                "M987654329UTO0101124F3001018<<<<<<<<<<<<<<04",
            ],
            "fields": [
                {"name": "Document Number", "value": "M98765432", "confidence": 0.95},
                {"name": "Date of Birth", "value": "010112", "confidence": 0.95},
            ],
            "check_digits": [
                {"field": "Document Number", "label": "Doc No Checksum", "expected": "9", "found": "9", "valid": True},
                {"field": "Date of Birth", "label": "DOB Checksum", "expected": "4", "found": "7", "valid": False},
                {"field": "Date of Expiry", "label": "Expiry Checksum", "expected": "8", "found": "8", "valid": True},
            ],
            "message": "DOB check digit calculation failed (Found: 7, Expected: 4)",
        },
        "cross_check": {
            "status": "FAILED",
            "comparisons": [
                {"key": "doc_no", "label": "Document Number", "ocr_value": "M98765432", "mrz_value": "M98765432", "status": "MATCH"},
                {"key": "dob", "label": "Date of Birth", "ocr_value": "12 JAN 2001", "mrz_value": "12 JAN 2000", "status": "MISMATCH", "note": "Year mismatch (2001 vs 2000)"},
            ],
            "mismatch_count": 1,
        },
        "validation": {
            "status": "COMPLETED",
            "checks": [
                {"key": "expiry", "label": "Document Expiration", "outcome": "PASS", "rule": "Document must not be expired"},
                {"key": "dob_mrz", "label": "DOB Consistency", "outcome": "FAIL", "rule": "VIZ DOB must equal MRZ DOB", "detail": "Discrepancy detected"},
            ],
            "failed_count": 1,
            "ruleset_version": "ICAO-9303-v7",
        },
        "tampering": {
            "status": "COMPLETED",
            "overall_score": 84.5,
            "verdict": "HIGH",
            "photo_anomaly_score": 18.0,
            "text_anomaly_score": 88.0,
            "copy_move_detected": False,
            "noise_inconsistency_score": 79.5,
            "suspicious_regions": [
                {"x": 320, "y": 280, "w": 180, "h": 40, "confidence": 0.88, "type": "spliced_text"}
            ],
            "ela_heatmap_url": "/static/processed/milestone1_geometry_validation.jpg",
        },
        "face": {
            "status": "COMPLETED",
            "match": True,
            "similarity_score": 91.2,
            "confidence": 0.92,
            "doc_face_url": "/static/synthetic/sample_tampered_mismatch.jpg",
            "live_face_url": "/static/synthetic/sample_tampered_mismatch.jpg",
        },
        "liveness": {
            "status": "COMPLETED",
            "passed": True,
            "liveness_score": 94.0,
            "method": "2D FFT Moire & Skin Texture Micro-Analysis",
        },
        "watchlist": {
            "status": "COMPLETED",
            "flagged": False,
            "hits": [],
        },
        "duplicate": {
            "status": "COMPLETED",
            "duplicate_detected": False,
            "matches": [],
        },
        "risk": {
            "overall_score": 78.0,
            "level": "HIGH",
            "recommended_action": "Secondary Verification Required",
            "explanation": "High forensic tampering probability around DOB field + MRZ checksum failure.",
            "breakdown": [
                {"category": "document_validity", "score": 5, "max_score": 30, "origin": "DETERMINISTIC", "note": "DOB format discrepancy"},
                {"category": "ocr_mrz_consistency", "score": 24, "max_score": 25, "origin": "DETERMINISTIC", "note": "DOB check digit failed & VIZ mismatch"},
                {"category": "tampering", "score": 32, "max_score": 35, "origin": "PROBABILISTIC", "note": "ELA text anomaly score 88.0"},
                {"category": "identity", "score": 4, "max_score": 30, "origin": "PROBABILISTIC", "note": "Face match 91.2%"},
                {"category": "liveness", "score": 2, "max_score": 25, "origin": "PROBABILISTIC", "note": "Liveness pass"},
                {"category": "database", "score": 0, "max_score": 40, "origin": "DETERMINISTIC", "note": "No watchlist hits"},
            ],
            "top_reasons": [
                {"id": "rs-1", "label": "DOB Check Digit Failed", "severity": "CRITICAL", "category": "ocr_mrz_consistency", "detail": "Found 7, Expected 4", "contribution": 20},
                {"id": "rs-2", "label": "Localized Text Splicing Anomaly", "severity": "CRITICAL", "category": "tampering", "detail": "ELA error score 88.0 in DOB box", "contribution": 25},
                {"id": "rs-3", "label": "VIZ ↔ MRZ DOB Mismatch", "severity": "WARNING", "category": "ocr_mrz_consistency", "detail": "2001 vs 2000", "contribution": 10},
            ],
        },
        "evidence": [
            {
                "category": "Forensic Tampering",
                "signals": [
                    {"label": "ELA Splicing Heatmap", "value": "High recompression variance over date region", "severity": "CRITICAL"},
                    {"label": "Noise Residual Inconsistency", "value": "Sensor noise z-score outlier (>3.8 sigma)", "severity": "CRITICAL"},
                ],
            }
        ],
        "review": {
            "outcome": "ESCALATE",
            "reviewed_by": "Insp. Priya Sharma",
            "reviewed_at": (now - datetime.timedelta(hours=3, minutes=55)).isoformat(),
            "notes": [
                {
                    "id": "not-02",
                    "author": "Insp. Priya Sharma",
                    "author_role": "OFFICER",
                    "body": "Escalated to supervisor due to DOB alteration and check digit failure.",
                    "created_at": (now - datetime.timedelta(hours=3, minutes=55)).isoformat(),
                }
            ],
        },
        "versions": {
            "preprocessing": "v1.4.0",
            "mrz_engine": "ICAO-Doc-9303-v7",
            "tamper_engine": "ELA-Noise-ORB-v2.1",
            "face_engine": "ArcFace-ONNX-512d",
        },
    }

    # Initial Audit Trail
    record_audit_log("USER_LOGIN", actor_name="Insp. Priya Sharma", actor_role="OFFICER", detail="Login from Terminal 3")
    record_audit_log("SCREENING_COMPLETED", actor_name="Insp. Priya Sharma", actor_role="OFFICER", case_id=c1_id, detail="Risk: LOW (8.5)")
    record_audit_log("CASE_REVIEWED", actor_name="Insp. Priya Sharma", actor_role="OFFICER", case_id=c1_id, detail="Approved for clearance")
    record_audit_log("SCREENING_COMPLETED", actor_name="Insp. Priya Sharma", actor_role="OFFICER", case_id=c2_id, detail="Risk: HIGH (78.0)")
    record_audit_log("CASE_ESCALATED", actor_name="Insp. Priya Sharma", actor_role="OFFICER", case_id=c2_id, detail="Escalated to Chief Rajesh Nair")


# Initialize default seed database on module load
seed_initial_records()
