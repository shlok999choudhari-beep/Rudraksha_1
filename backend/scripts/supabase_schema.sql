-- =============================================================================
-- VeriGuard AI — Supabase PostgreSQL Schema & Storage Definitions
-- Production & Demo Cloud Migration Script
-- =============================================================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS & BORDER FORCE OFFICERS
CREATE TABLE IF NOT EXISTS public.users (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    full_name VARCHAR(128) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'OFFICER', -- OFFICER, SUPERVISOR, AUDITOR, ADMIN
    badge_number VARCHAR(64),
    station_id VARCHAR(64) DEFAULT 'STATION-DEL-01',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- 2. MASTER SCREENING CASES
CREATE TABLE IF NOT EXISTS public.screening_cases (
    id VARCHAR(64) PRIMARY KEY DEFAULT ('case-' || substr(md5(random()::text), 1, 8)),
    case_number VARCHAR(64) UNIQUE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED', -- IN_PROGRESS, COMPLETED, ESCALATED, RESOLVED, AWAITING_REVIEW
    document_type VARCHAR(32) NOT NULL DEFAULT 'PASSPORT', -- PASSPORT, VISA
    document_number VARCHAR(64),
    holder_name VARCHAR(255),
    nationality VARCHAR(16),
    date_of_birth VARCHAR(32),
    date_of_expiry VARCHAR(32),
    
    overall_risk_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    overall_risk_level VARCHAR(32) NOT NULL DEFAULT 'LOW', -- LOW, MEDIUM, HIGH
    overall_trust_score DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    decision VARCHAR(64) NOT NULL DEFAULT 'APPROVED_FOR_CLEARANCE',
    processing_time_ms DOUBLE PRECISION DEFAULT 0.0,
    
    created_by_id VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_by_id VARCHAR(64) REFERENCES public.users(id) ON DELETE SET NULL,
    review_decision VARCHAR(64),
    review_notes TEXT,
    
    -- Supabase Storage URLs
    document_image_url TEXT,
    doc_face_url TEXT,
    live_face_url TEXT,
    ela_heatmap_url TEXT,
    
    -- Raw base64 fallback (if cloud storage not yet provisioned)
    document_image_b64 TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cases_created_at ON public.screening_cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.screening_cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_risk_level ON public.screening_cases(overall_risk_level);
CREATE INDEX IF NOT EXISTS idx_cases_doc_num ON public.screening_cases(document_number);

-- 3. QUALITY CHECKS RECORD
CREATE TABLE IF NOT EXISTS public.quality_records (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    case_id VARCHAR(64) UNIQUE NOT NULL REFERENCES public.screening_cases(id) ON DELETE CASCADE,
    is_acceptable BOOLEAN NOT NULL DEFAULT TRUE,
    blur_score DOUBLE PRECISION DEFAULT 0.0,
    glare_ratio DOUBLE PRECISION DEFAULT 0.0,
    resolution_w INTEGER DEFAULT 1250,
    resolution_h INTEGER DEFAULT 880,
    aspect_ratio DOUBLE PRECISION DEFAULT 1.42,
    checks_json JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MRZ PARSED RECORDS
CREATE TABLE IF NOT EXISTS public.mrz_records (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    case_id VARCHAR(64) UNIQUE NOT NULL REFERENCES public.screening_cases(id) ON DELETE CASCADE,
    document_format VARCHAR(16) DEFAULT 'TD3',
    is_valid BOOLEAN NOT NULL DEFAULT TRUE,
    is_expired BOOLEAN NOT NULL DEFAULT FALSE,
    raw_lines_json JSONB DEFAULT '[]'::jsonb,
    check_digits_json JSONB DEFAULT '[]'::jsonb,
    errors_json JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TAMPER FORENSIC RECORDS
CREATE TABLE IF NOT EXISTS public.tamper_records (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    case_id VARCHAR(64) UNIQUE NOT NULL REFERENCES public.screening_cases(id) ON DELETE CASCADE,
    tamper_risk_score DOUBLE PRECISION DEFAULT 0.0,
    is_tampered BOOLEAN NOT NULL DEFAULT FALSE,
    photo_anomaly_score DOUBLE PRECISION DEFAULT 0.0,
    text_anomaly_score DOUBLE PRECISION DEFAULT 0.0,
    copy_move_detected BOOLEAN DEFAULT FALSE,
    noise_inconsistency_score DOUBLE PRECISION DEFAULT 0.0,
    suspicious_regions_json JSONB DEFAULT '[]'::jsonb,
    ela_heatmap_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. BIOMETRIC & FACE VERIFICATION RECORDS
CREATE TABLE IF NOT EXISTS public.biometric_records (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    case_id VARCHAR(64) UNIQUE NOT NULL REFERENCES public.screening_cases(id) ON DELETE CASCADE,
    face_matched BOOLEAN NOT NULL DEFAULT TRUE,
    similarity_score DOUBLE PRECISION DEFAULT 0.0,
    liveness_passed BOOLEAN NOT NULL DEFAULT TRUE,
    liveness_score DOUBLE PRECISION DEFAULT 0.0,
    attack_type VARCHAR(64),
    doc_face_crop_url TEXT,
    live_face_crop_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. EXPLAINABLE RISK ASSESSMENTS
CREATE TABLE IF NOT EXISTS public.risk_assessments (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    case_id VARCHAR(64) UNIQUE NOT NULL REFERENCES public.screening_cases(id) ON DELETE CASCADE,
    physical_score DOUBLE PRECISION DEFAULT 0.0,
    data_consistency_score DOUBLE PRECISION DEFAULT 0.0,
    tamper_score DOUBLE PRECISION DEFAULT 0.0,
    biometric_score DOUBLE PRECISION DEFAULT 0.0,
    critical_violations_json JSONB DEFAULT '[]'::jsonb,
    warning_flags_json JSONB DEFAULT '[]'::jsonb,
    recommendation TEXT,
    breakdown_json JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. IMMUTABLE FORENSIC AUDIT LOG
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    actor_id VARCHAR(64),
    actor_name VARCHAR(128),
    actor_role VARCHAR(32),
    action VARCHAR(64) NOT NULL,
    case_id VARCHAR(64),
    detail TEXT,
    ip_address VARCHAR(45) DEFAULT '127.0.0.1',
    hash_signature VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_case_id ON public.audit_logs(case_id);

-- 9. INTERPOL / NATIONAL WATCHLIST DATABASE
CREATE TABLE IF NOT EXISTS public.watchlist_items (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    document_number VARCHAR(64) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    nationality VARCHAR(16),
    reason TEXT NOT NULL,
    alert_level VARCHAR(32) NOT NULL DEFAULT 'CRITICAL',
    issuing_authority VARCHAR(128) DEFAULT 'INTERPOL-SLTD',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watchlist_doc_num ON public.watchlist_items(document_number);

-- =============================================================================
-- Supabase Storage Buckets Configuration (SQL)
-- =============================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES 
    ('veriguard-documents', 'veriguard-documents', true),
    ('veriguard-faces', 'veriguard-faces', true),
    ('veriguard-heatmaps', 'veriguard-heatmaps', true)
ON CONFLICT (id) DO NOTHING;

-- Public Storage Access Policies
CREATE POLICY "Public Read VeriGuard Documents" 
ON storage.objects FOR SELECT 
USING (bucket_id IN ('veriguard-documents', 'veriguard-faces', 'veriguard-heatmaps'));

CREATE POLICY "Authenticated Insert VeriGuard Documents" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id IN ('veriguard-documents', 'veriguard-faces', 'veriguard-heatmaps'));
