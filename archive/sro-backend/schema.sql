-- SRO Intelligence Multi-Tenant Database Schema
-- PostgreSQL

-- =====================================================
-- CLINICS (Tenants)
-- =====================================================
CREATE TABLE clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL, -- e.g., "roberts-ortho" for URLs
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    plan VARCHAR(50) DEFAULT 'trial', -- trial, starter, pro
    plan_status VARCHAR(50) DEFAULT 'active', -- active, past_due, cancelled
    settings JSONB DEFAULT '{}', -- clinic-specific settings
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- USERS (Clinicians, Admins)
-- =====================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'clinician', -- admin, clinician, staff
    title VARCHAR(100), -- "Orthopedic Surgeon", "PA", "PT"
    phone VARCHAR(50),
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(clinic_id, email)
);

-- =====================================================
-- PATIENTS
-- =====================================================
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    mrn VARCHAR(100), -- Medical Record Number (optional)
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50) NOT NULL,
    address TEXT,
    emergency_contact_name VARCHAR(200),
    emergency_contact_phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(clinic_id, mrn)
);

-- =====================================================
-- SURGERIES / EPISODES OF CARE
-- =====================================================
CREATE TABLE episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    surgeon_id UUID REFERENCES users(id),
    
    -- Procedure info
    procedure_type VARCHAR(100) NOT NULL, -- TKA, THA, ACL, etc.
    procedure_side VARCHAR(10), -- L, R, Bilateral
    procedure_date DATE NOT NULL,
    
    -- Status
    status VARCHAR(50) DEFAULT 'active', -- active, completed, discharged
    flag_status VARCHAR(20) DEFAULT 'green', -- red, yellow, green
    flag_reason TEXT,
    
    -- Targets
    rom_target_flexion INTEGER DEFAULT 120,
    rom_target_extension INTEGER DEFAULT 0,
    pain_target INTEGER DEFAULT 3,
    
    -- Tracking
    discharge_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- PATIENT CHECK-INS (from mobile app)
-- =====================================================
CREATE TABLE checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    
    -- Pain
    pain_score INTEGER CHECK (pain_score >= 0 AND pain_score <= 10),
    
    -- Range of Motion
    rom_flexion INTEGER,
    rom_extension INTEGER,
    rom_abduction INTEGER,
    
    -- PT Adherence
    pt_completed BOOLEAN,
    exercises_completed BOOLEAN,
    
    -- Concerns
    has_concern BOOLEAN DEFAULT false,
    concern_text TEXT,
    
    -- Calculated
    day_post_op INTEGER,
    flag_status VARCHAR(20), -- red, yellow, green (at time of checkin)
    
    -- Review
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- PT VISITS (from clinician input or integration)
-- =====================================================
CREATE TABLE pt_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    
    visit_date DATE NOT NULL,
    provider_name VARCHAR(200),
    
    -- Measurements
    rom_flexion INTEGER,
    rom_extension INTEGER,
    pain_score INTEGER,
    
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- AUDIT LOG (HIPAA requirement)
-- =====================================================
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL, -- view_patient, update_checkin, export_data, etc.
    resource_type VARCHAR(100), -- patient, checkin, episode
    resource_id UUID,
    details JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- INDEXES for performance
-- =====================================================
CREATE INDEX idx_users_clinic ON users(clinic_id);
CREATE INDEX idx_patients_clinic ON patients(clinic_id);
CREATE INDEX idx_episodes_clinic ON episodes(clinic_id);
CREATE INDEX idx_episodes_patient ON episodes(patient_id);
CREATE INDEX idx_episodes_status ON episodes(clinic_id, status, flag_status);
CREATE INDEX idx_checkins_episode ON checkins(episode_id);
CREATE INDEX idx_checkins_patient ON checkins(patient_id);
CREATE INDEX idx_checkins_created ON checkins(clinic_id, created_at DESC);
CREATE INDEX idx_audit_clinic ON audit_log(clinic_id, created_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY (data isolation between clinics)
-- =====================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE pt_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policies ensure users can only see their own clinic's data
-- (Applied when using Supabase or similar with RLS)
