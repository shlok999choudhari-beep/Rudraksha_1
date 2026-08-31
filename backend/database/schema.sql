-- =========================================================================
-- VeriGuard AI — Production PostgreSQL Database Schema (DDL)
-- Problem Statement ID: 26188 (AI-Based Fake Identity & Document Screening System)
-- Target Database: PostgreSQL 15+
-- =========================================================================

-- Enable UUID extension if using native gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 1. USERS & OPERATIONAL PERSONAS
-- =========================================================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    full_name VARCHAR(128) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'OFFICER', -- OFFICER, SUPERVISOR, AUDITOR, ADMIN
    badge_number VARCHAR(64),
    station_id VARCHAR(64) DEFAULT 'STATION-DEL-01',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- =========================================================================
-- 2. SCREENING CASES
-- =========================================================================
CREATE TABLE IF NOT EXISTS screening_cases (
    id VARCHAR(64) PRIMARY KEY,
    case_number VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'IN_PROGRESS', -- IN_PROGRESS, COMPLETED, ESCALATED, RESOLVED
    document_type VARCHAR(32) NOT NULL DEFAULT 'PASSPORT', -- PASSPORT, NATIONAL_ID, VISA, DRIVERS_LICENSE
    document_number VARCHAR(64),
    holder_name VARCHAR(255),
    nationality VARCHAR(16),
    date_of_birth VARCHAR(32),
    date_of_expiry VARCHAR(32),
    overall_risk_score FLOAT NOT NULL DEFAULT 0.0,
    overall_risk_level VARCHAR(32) NOT NULL DEFAULT 'LOW', -- LOW, MEDIUM, HIGH, CRITICAL
    overall_trust_score FLOAT NOT NULL DEFAULT 100.0,
    decision VARCHAR(64) NOT NULL DEFAULT 'APPROVED_FOR_CLEARANCE',
    processing_time_ms FLOAT DEFAULT 0.0,
    created_by_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    reviewed_by_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    review_decision VARCHAR(64), -- APPROVED, REJECTED, ESCALATED, SECONDARY_INSPECTION
    review_notes TEXT,
    document_image_b64 TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_cases_status ON screening_cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_risk_level ON screening_cases(overall_risk_level);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON screening_cases(created_at);
CREATE INDEX IF NOT EXISTS idx_cases_doc_num ON screening_cases(document_number);

-- =========================================================================
-- 3. QUALITY CHECKS (LAYER 1: PHYSICAL PREPROCESSING)
-- =========================================================================
CREATE TABLE IF NOT EXISTS quality_records (
    id VARCHAR(64) PRIMARY KEY,
    case_id VARCHAR(64) NOT NULL UNIQUE REFERENCES screening_cases(id) ON DELETE CASCADE,
    is_acceptable BOOLEAN NOT NULL DEFAULT TRUE,
    blur_score FLOAT DEFAULT 0.0,
    glare_ratio FLOAT DEFAULT 0.0,
    resolution_w INT DEFAULT 1250,
    resolution_h INT DEFAULT 880,
    aspect_ratio FLOAT DEFAULT 1.42,
    checks_json JSON DEFAULT '[]'::json,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 4. MRZ VALIDATIONS (LAYER 2: ICAO DOC 9303 CHECKSUMS)
-- =========================================================================
CREATE TABLE IF NOT EXISTS mrz_records (
    id VARCHAR(64) PRIMARY KEY,
    case_id VARCHAR(64) NOT NULL UNIQUE REFERENCES screening_cases(id) ON DELETE CASCADE,
    document_format VARCHAR(16) DEFAULT 'TD3', -- TD1, TD2, TD3
    is_valid BOOLEAN NOT NULL DEFAULT TRUE,
    is_expired BOOLEAN NOT NULL DEFAULT FALSE,
    raw_lines_json JSON DEFAULT '[]'::json,
    check_digits_json JSON DEFAULT '[]'::json,
    errors_json JSON DEFAULT '[]'::json,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 5. TAMPER FORENSICS (LAYER 3: ELA, NOISE, COPY-MOVE)
-- =========================================================================
CREATE TABLE IF NOT EXISTS tamper_records (
    id VARCHAR(64) PRIMARY KEY,
    case_id VARCHAR(64) NOT NULL UNIQUE REFERENCES screening_cases(id) ON DELETE CASCADE,
    tamper_risk_score FLOAT DEFAULT 0.0,
    is_tampered BOOLEAN NOT NULL DEFAULT FALSE,
    photo_anomaly_score FLOAT DEFAULT 0.0,
    text_anomaly_score FLOAT DEFAULT 0.0,
    copy_move_detected BOOLEAN NOT NULL DEFAULT FALSE,
    noise_inconsistency_score FLOAT DEFAULT 0.0,
    suspicious_regions_json JSON DEFAULT '[]'::json,
    ela_heatmap_b64 TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 6. BIOMETRIC VERIFICATIONS (LAYER 4: 1:1 FACIAL & LIVENESS)
-- =========================================================================
CREATE TABLE IF NOT EXISTS biometric_records (
    id VARCHAR(64) PRIMARY KEY,
    case_id VARCHAR(64) NOT NULL UNIQUE REFERENCES screening_cases(id) ON DELETE CASCADE,
    face_matched BOOLEAN NOT NULL DEFAULT TRUE,
    similarity_score FLOAT DEFAULT 0.0,
    liveness_passed BOOLEAN NOT NULL DEFAULT TRUE,
    liveness_score FLOAT DEFAULT 0.0,
    attack_type VARCHAR(64),
    doc_face_crop_b64 TEXT,
    live_face_crop_b64 TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 7. RISK ASSESSMENTS (4-LAYER COMPOSITE & EXPLAINABILITY)
-- =========================================================================
CREATE TABLE IF NOT EXISTS risk_assessments (
    id VARCHAR(64) PRIMARY KEY,
    case_id VARCHAR(64) NOT NULL UNIQUE REFERENCES screening_cases(id) ON DELETE CASCADE,
    physical_score FLOAT DEFAULT 0.0,
    data_consistency_score FLOAT DEFAULT 0.0,
    tamper_score FLOAT DEFAULT 0.0,
    biometric_score FLOAT DEFAULT 0.0,
    critical_violations_json JSON DEFAULT '[]'::json,
    warning_flags_json JSON DEFAULT '[]'::json,
    recommendation TEXT,
    breakdown_json JSON DEFAULT '[]'::json,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 8. AUDIT LOGS (IMMUTABLE FORENSIC TRAIL)
-- =========================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actor_id VARCHAR(64),
    actor_name VARCHAR(128),
    actor_role VARCHAR(32),
    action VARCHAR(64) NOT NULL,
    case_id VARCHAR(64),
    detail TEXT,
    ip_address VARCHAR(45) DEFAULT '127.0.0.1',
    hash_signature VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_case_id ON audit_logs(case_id);

-- =========================================================================
-- 9. WATCHLIST & LAW ENFORCEMENT REFERENCE (SIMULATED SLTD)
-- =========================================================================
CREATE TABLE IF NOT EXISTS watchlist_items (
    id VARCHAR(64) PRIMARY KEY,
    document_number VARCHAR(64) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    nationality VARCHAR(16),
    reason TEXT NOT NULL,
    alert_level VARCHAR(32) NOT NULL DEFAULT 'CRITICAL', -- CRITICAL, WARNING, INFO
    issuing_authority VARCHAR(128) DEFAULT 'INTERPOL-SLTD',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_watchlist_doc_num ON watchlist_items(document_number);
