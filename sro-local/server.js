const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============ AUDIT LOGGING MIDDLEWARE (HIPAA §164.312(b)) ============
// Logs all API calls automatically. Also provides logAudit() for explicit logging.
function logAudit(userId, action, resourceType, resourceId, details, ipAddress) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), userId || null, action, resourceType || null, resourceId || null,
           typeof details === 'object' ? JSON.stringify(details) : (details || null), ipAddress || null);
  } catch(e) {
    // Never let audit logging break the app
    console.error('[Audit] Logging error:', e.message);
  }
}

// Auto-log all API requests
app.use('/api', (req, res, next) => {
  // Extract user context from headers or query (dashboard sends these)
  const userId = req.headers['x-user-id'] || req.query.user_id || null;
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
  
  // Determine resource type from URL path
  const pathParts = req.path.split('/').filter(Boolean);
  const resourceType = pathParts[0] || null; // e.g. 'patients', 'checkins', 'episodes'
  const resourceId = pathParts[1] || null;    // e.g. patient UUID
  
  // Map HTTP method to action
  const actionMap = { GET: 'read', POST: 'create', PUT: 'update', DELETE: 'delete' };
  const action = `api_${actionMap[req.method] || req.method.toLowerCase()}`;
  
  // Skip logging for high-frequency/noisy endpoints
  const skipPaths = ['/api/dashboard-stats', '/api/prom-schedule/update-overdue'];
  if (skipPaths.some(p => req.originalUrl.startsWith(p))) {
    return next();
  }
  
  // Log after response completes (so we get status code)
  const originalEnd = res.end;
  res.end = function(...args) {
    logAudit(userId, action, resourceType, resourceId, {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      body_keys: req.method !== 'GET' ? Object.keys(req.body || {}) : undefined
    }, ip);
    originalEnd.apply(res, args);
  };
  
  next();
});

// Initialize SQLite database
const db = new Database(path.join(__dirname, 'sro.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Generate UUID
function uuid() {
  return crypto.randomUUID();
}

// Generate short token for patients
function generateToken() {
  return crypto.randomBytes(6).toString('hex'); // 12 character token
}

// Create tables
db.exec(`
  -- Clinics
  CREATE TABLE IF NOT EXISTS clinics (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Users (surgeons, staff)
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    clinic_id TEXT REFERENCES clinics(id),
    email TEXT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT DEFAULT 'surgeon',
    specialty TEXT,
    npi TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Patients
  CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    clinic_id TEXT REFERENCES clinics(id),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE,
    email TEXT,
    phone TEXT,
    mrn TEXT,
    token TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Episodes (surgical episodes)
  CREATE TABLE IF NOT EXISTS episodes (
    id TEXT PRIMARY KEY,
    patient_id TEXT REFERENCES patients(id),
    clinic_id TEXT REFERENCES clinics(id),
    surgeon_id TEXT REFERENCES users(id),
    surgery_type TEXT,
    surgery_date DATE,
    surgery_location TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Check-ins
  CREATE TABLE IF NOT EXISTS checkins (
    id TEXT PRIMARY KEY,
    patient_id TEXT REFERENCES patients(id),
    episode_id TEXT REFERENCES episodes(id),
    clinic_id TEXT REFERENCES clinics(id),
    checkin_type TEXT DEFAULT 'daily',
    checkin_date DATE,
    pain_level INTEGER,
    pain_location TEXT,
    pt_exercises INTEGER DEFAULT 0,
    medication_taken INTEGER DEFAULT 0,
    swelling TEXT,
    concerns TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- PRO Assessments (KOOS Jr, HOOS Jr, PROMIS-10)
  CREATE TABLE IF NOT EXISTS pro_assessments (
    id TEXT PRIMARY KEY,
    patient_id TEXT REFERENCES patients(id),
    episode_id TEXT REFERENCES episodes(id),
    clinic_id TEXT REFERENCES clinics(id),
    assessment_type TEXT NOT NULL,
    assessment_date DATE,
    score REAL,
    responses TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Pre-Op Assessments (Risk stratification)
  CREATE TABLE IF NOT EXISTS preop_assessments (
    id TEXT PRIMARY KEY,
    patient_id TEXT REFERENCES patients(id),
    clinic_id TEXT REFERENCES clinics(id),
    surgeon_id TEXT REFERENCES users(id),
    assessment_type TEXT DEFAULT 'preop',
    procedure_type TEXT,
    planned_surgery_date DATE,
    assessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    mortality_risk REAL,
    readmission_risk REAL,
    prolonged_los_risk REAL,
    risk_tier TEXT,
    
    age INTEGER,
    sex TEXT,
    bmi REAL,
    asa_class INTEGER,
    comorbidities TEXT,
    
    joint_score_type TEXT,
    joint_score_preop REAL,
    projected_postop_score REAL,
    expected_improvement REAL,
    
    promis_physical_tscore REAL,
    promis_mental_tscore REAL,
    
    cms_back_pain INTEGER DEFAULT 0,
    cms_health_literacy TEXT,
    cms_other_knee_pain INTEGER DEFAULT 0,
    cms_other_hip_pain INTEGER DEFAULT 0,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- RPM Time Logs
  CREATE TABLE IF NOT EXISTS rpm_time_logs (
    id TEXT PRIMARY KEY,
    patient_id TEXT REFERENCES patients(id),
    episode_id TEXT REFERENCES episodes(id),
    user_id TEXT REFERENCES users(id),
    clinic_id TEXT REFERENCES clinics(id),
    started_at DATETIME NOT NULL,
    ended_at DATETIME NOT NULL,
    duration_seconds INTEGER NOT NULL,
    activity_type TEXT,
    notes TEXT,
    billing_month TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Adverse Events (ER visits, readmissions)
  CREATE TABLE IF NOT EXISTS adverse_events (
    id TEXT PRIMARY KEY,
    patient_id TEXT REFERENCES patients(id),
    episode_id TEXT REFERENCES episodes(id),
    clinic_id TEXT REFERENCES clinics(id),
    event_type TEXT NOT NULL,
    event_date DATE,
    reported_by TEXT DEFAULT 'patient',
    facility TEXT,
    reason TEXT,
    notes TEXT,
    resolved INTEGER DEFAULT 0,
    resolved_at DATETIME,
    resolved_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Nurse alert acknowledgments (temporary suppression)
  CREATE TABLE IF NOT EXISTS nurse_alert_acks (
    id TEXT PRIMARY KEY,
    patient_id TEXT REFERENCES patients(id),
    clinic_id TEXT REFERENCES clinics(id),
    alert_type TEXT NOT NULL,
    acknowledged_by TEXT,
    acknowledged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    note TEXT
  );

  -- PROM Schedule (tracks which PROMs are due and when)
  CREATE TABLE IF NOT EXISTS prom_schedule (
    id TEXT PRIMARY KEY,
    patient_id TEXT REFERENCES patients(id),
    episode_id TEXT REFERENCES episodes(id),
    clinic_id TEXT REFERENCES clinics(id),
    assessment_type TEXT NOT NULL,
    window_name TEXT NOT NULL,
    due_date DATE NOT NULL,
    window_open DATE,
    window_close DATE,
    completed_date DATE,
    pro_assessment_id TEXT REFERENCES pro_assessments(id),
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Nursing Notes
  CREATE TABLE IF NOT EXISTS nursing_notes (
    id TEXT PRIMARY KEY,
    patient_id TEXT REFERENCES patients(id),
    episode_id TEXT REFERENCES episodes(id),
    clinic_id TEXT REFERENCES clinics(id),
    user_id TEXT REFERENCES users(id),
    note_type TEXT NOT NULL,
    note_text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_patients_clinic ON patients(clinic_id);
  CREATE INDEX IF NOT EXISTS idx_patients_token ON patients(token);
  CREATE INDEX IF NOT EXISTS idx_episodes_patient ON episodes(patient_id);
  CREATE INDEX IF NOT EXISTS idx_episodes_surgeon ON episodes(surgeon_id);
  CREATE INDEX IF NOT EXISTS idx_checkins_patient ON checkins(patient_id);
  CREATE INDEX IF NOT EXISTS idx_checkins_episode ON checkins(episode_id);
  CREATE INDEX IF NOT EXISTS idx_checkins_date ON checkins(checkin_date);
  CREATE INDEX IF NOT EXISTS idx_rpm_logs_billing ON rpm_time_logs(clinic_id, user_id, billing_month);
  CREATE INDEX IF NOT EXISTS idx_preop_patient ON preop_assessments(patient_id);
  CREATE INDEX IF NOT EXISTS idx_preop_clinic ON preop_assessments(clinic_id);
  CREATE INDEX IF NOT EXISTS idx_adverse_patient ON adverse_events(patient_id);
  CREATE INDEX IF NOT EXISTS idx_adverse_episode ON adverse_events(episode_id);
  CREATE INDEX IF NOT EXISTS idx_prom_schedule_patient ON prom_schedule(patient_id);
  CREATE INDEX IF NOT EXISTS idx_prom_schedule_episode ON prom_schedule(episode_id);
  CREATE INDEX IF NOT EXISTS idx_prom_schedule_status ON prom_schedule(status);
  CREATE INDEX IF NOT EXISTS idx_prom_schedule_due ON prom_schedule(due_date);
  CREATE INDEX IF NOT EXISTS idx_nursing_notes_patient ON nursing_notes(patient_id);
  CREATE INDEX IF NOT EXISTS idx_nursing_notes_episode ON nursing_notes(episode_id);

  -- Surgical Prep Data
  CREATE TABLE IF NOT EXISTS surgical_prep (
    id TEXT PRIMARY KEY,
    patient_id TEXT REFERENCES patients(id),
    episode_id TEXT,
    clinic_id TEXT REFERENCES clinics(id),
    contract_data TEXT,
    consent_data TEXT,
    history_data TEXT,
    insurance_data TEXT,
    prosthesis_data TEXT,
    contract_signed_at DATETIME,
    consent_signed_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_surgical_prep_patient ON surgical_prep(patient_id);

  -- Audit Logs (HIPAA §164.312(b) — required audit controls)
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    details TEXT,
    ip_address TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
  CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);

  -- PT Episodes (one per PT phase per episode: pre-op, post-op, conservative)
  CREATE TABLE IF NOT EXISTS pt_episodes (
    id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL REFERENCES episodes(id),
    patient_id TEXT NOT NULL REFERENCES patients(id),
    phase TEXT NOT NULL CHECK(phase IN ('pre-op', 'post-op', 'conservative')),
    program_type TEXT NOT NULL CHECK(program_type IN ('TKA', 'THA', 'UKA', 'TSA', 'custom')),
    program_template TEXT DEFAULT 'standard',
    start_date TEXT NOT NULL,
    target_end_date TEXT,
    actual_end_date TEXT,
    duration_weeks INTEGER DEFAULT 4,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'discontinued', 'transitioned')),
    compliance_percentage REAL DEFAULT 0,
    total_exercise_days INTEGER DEFAULT 0,
    total_possible_days INTEGER DEFAULT 0,
    flagged_status TEXT DEFAULT 'none' CHECK(flagged_status IN ('none', 'low_compliance', 'non_compliant', 'critical')),
    surgeon_id TEXT REFERENCES users(id),
    surgeon_notes TEXT,
    custom_exercises TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_pt_episodes_episode ON pt_episodes(episode_id);
  CREATE INDEX IF NOT EXISTS idx_pt_episodes_patient ON pt_episodes(patient_id);
  CREATE INDEX IF NOT EXISTS idx_pt_episodes_status ON pt_episodes(status);

  -- PT Daily Logs (one per patient per day from checkin flow)
  CREATE TABLE IF NOT EXISTS pt_daily_logs (
    id TEXT PRIMARY KEY,
    pt_episode_id TEXT NOT NULL REFERENCES pt_episodes(id),
    patient_id TEXT NOT NULL REFERENCES patients(id),
    log_date TEXT NOT NULL,
    walking_minutes INTEGER,
    exercises_completed TEXT,
    exercise_completion_pct REAL,
    pt_session_attended INTEGER DEFAULT 0,
    pain_score INTEGER,
    pain_barrier INTEGER DEFAULT 0,
    difficulty_notes TEXT,
    rom_flexion INTEGER,
    rom_extension INTEGER,
    source TEXT DEFAULT 'patient' CHECK(source IN ('patient', 'nurse', 'system')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pt_episode_id, log_date)
  );
  CREATE INDEX IF NOT EXISTS idx_pt_daily_patient_date ON pt_daily_logs(patient_id, log_date);
  CREATE INDEX IF NOT EXISTS idx_pt_daily_episode ON pt_daily_logs(pt_episode_id);

  -- PT Program Templates (surgeon-customizable, system ships with defaults)
  CREATE TABLE IF NOT EXISTS pt_program_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    program_type TEXT NOT NULL,
    phase TEXT NOT NULL CHECK(phase IN ('pre-op', 'post-op', 'conservative')),
    surgeon_id TEXT REFERENCES users(id),
    is_default INTEGER DEFAULT 0,
    exercises TEXT NOT NULL,
    walking_goal_start_min INTEGER DEFAULT 10,
    walking_goal_end_min INTEGER DEFAULT 30,
    duration_weeks INTEGER DEFAULT 4,
    frequency_per_day INTEGER DEFAULT 2,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- PT Deviation Events (alerts for nurse dashboard)
  CREATE TABLE IF NOT EXISTS pt_deviation_events (
    id TEXT PRIMARY KEY,
    pt_episode_id TEXT NOT NULL REFERENCES pt_episodes(id),
    patient_id TEXT NOT NULL REFERENCES patients(id),
    deviation_type TEXT NOT NULL CHECK(deviation_type IN ('missed_days', 'low_compliance', 'high_pain', 'rom_plateau', 'missed_pt_session', 'no_checkin')),
    severity TEXT NOT NULL CHECK(severity IN ('critical', 'warning', 'info')),
    description TEXT,
    detected_date TEXT NOT NULL,
    acknowledged INTEGER DEFAULT 0,
    acknowledged_by TEXT REFERENCES users(id),
    acknowledged_at TEXT,
    resolved INTEGER DEFAULT 0,
    resolved_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_pt_deviations_patient ON pt_deviation_events(patient_id);
  CREATE INDEX IF NOT EXISTS idx_pt_deviations_unresolved ON pt_deviation_events(resolved, severity);

  -- Non-Op Plans (Conservative Care Checklists)
  CREATE TABLE IF NOT EXISTS nonop_plans (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id),
    episode_id TEXT REFERENCES episodes(id),
    clinic_id TEXT REFERENCES clinics(id),
    joint TEXT CHECK(joint IN ('knee', 'hip')),
    plan_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_nonop_plans_patient ON nonop_plans(patient_id);

  -- External Providers (PT clinics, consultants, labs, imaging centers)
  CREATE TABLE IF NOT EXISTS external_providers (
    id TEXT PRIMARY KEY,
    clinic_id TEXT REFERENCES clinics(id),
    provider_type TEXT NOT NULL CHECK(provider_type IN ('pt_clinic', 'consultant', 'imaging', 'lab', 'pharmacy', 'dme', 'other')),
    name TEXT NOT NULL,
    specialty TEXT,
    npi TEXT,
    tax_id TEXT,
    phone TEXT,
    fax TEXT,
    fax_alt TEXT,
    email TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    preferred INTEGER DEFAULT 0,
    accepts_medicare INTEGER DEFAULT 1,
    accepts_medicaid INTEGER DEFAULT 1,
    notes TEXT,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_ext_providers_type ON external_providers(provider_type);
  CREATE INDEX IF NOT EXISTS idx_ext_providers_clinic ON external_providers(clinic_id);

  -- Orders (interface-ready format for future EMR/HL7 integration)
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    clinic_id TEXT REFERENCES clinics(id),
    patient_id TEXT NOT NULL REFERENCES patients(id),
    episode_id TEXT REFERENCES episodes(id),
    order_number TEXT UNIQUE,
    placer_order_number TEXT,
    filler_order_number TEXT,
    order_type TEXT NOT NULL CHECK(order_type IN (
      'PT_REFERRAL', 'INJECTION', 'DME', 'IMAGING', 'LAB', 'CONSULT', 'MEDICATION', 'PROCEDURE', 'OTHER'
    )),
    order_subtype TEXT,
    description TEXT NOT NULL,
    clinical_indication TEXT,
    icd10_codes TEXT,
    cpt_codes TEXT,
    ordering_provider_id TEXT REFERENCES users(id),
    ordering_provider_npi TEXT,
    destination_provider_id TEXT REFERENCES external_providers(id),
    order_details TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN (
      'draft', 'pending', 'sent', 'acknowledged', 'scheduled', 'in_progress', 'completed', 'cancelled', 'failed'
    )),
    ordered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    signed_at DATETIME,
    sent_at DATETIME,
    acknowledged_at DATETIME,
    completed_at DATETIME,
    priority TEXT DEFAULT 'routine' CHECK(priority IN ('stat', 'urgent', 'routine')),
    requires_auth INTEGER DEFAULT 0,
    auth_number TEXT,
    auth_status TEXT,
    created_by TEXT REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_orders_patient ON orders(patient_id);
  CREATE INDEX IF NOT EXISTS idx_orders_episode ON orders(episode_id);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_type ON orders(order_type);
  CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);

  -- Fax Queue (for Twilio fax integration)
  CREATE TABLE IF NOT EXISTS fax_queue (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES orders(id),
    clinic_id TEXT REFERENCES clinics(id),
    fax_number TEXT NOT NULL,
    fax_number_from TEXT,
    document_url TEXT,
    document_content TEXT,
    external_id TEXT,
    provider TEXT DEFAULT 'twilio',
    status TEXT DEFAULT 'queued' CHECK(status IN ('queued', 'sending', 'delivered', 'failed', 'cancelled')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_attempt_at DATETIME,
    next_attempt_at DATETIME,
    error_code TEXT,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
  );
  CREATE INDEX IF NOT EXISTS idx_fax_queue_status ON fax_queue(status);
  CREATE INDEX IF NOT EXISTS idx_fax_queue_order ON fax_queue(order_id);

  -- Nurse Tasks (for failed faxes and other to-do items)
  CREATE TABLE IF NOT EXISTS nurse_tasks (
    id TEXT PRIMARY KEY,
    clinic_id TEXT REFERENCES clinics(id),
    patient_id TEXT REFERENCES patients(id),
    episode_id TEXT REFERENCES episodes(id),
    order_id TEXT REFERENCES orders(id),
    fax_id TEXT REFERENCES fax_queue(id),
    task_type TEXT NOT NULL CHECK(task_type IN (
      'fax_failed', 'order_followup', 'callback_patient', 'callback_provider', 
      'verify_auth', 'schedule_appointment', 'document_review', 'other'
    )),
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    assigned_to TEXT REFERENCES users(id),
    due_date DATE,
    completed_at DATETIME,
    completed_by TEXT REFERENCES users(id),
    completion_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_nurse_tasks_status ON nurse_tasks(status);
  CREATE INDEX IF NOT EXISTS idx_nurse_tasks_clinic ON nurse_tasks(clinic_id);
  CREATE INDEX IF NOT EXISTS idx_nurse_tasks_patient ON nurse_tasks(patient_id);
  CREATE INDEX IF NOT EXISTS idx_nurse_tasks_assigned ON nurse_tasks(assigned_to);

  -- Conservative Care Items (structured tracking for EMR interface export)
  CREATE TABLE IF NOT EXISTS conservative_care_items (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id),
    episode_id TEXT REFERENCES episodes(id),
    clinic_id TEXT REFERENCES clinics(id),
    joint TEXT NOT NULL CHECK(joint IN ('knee', 'hip')),
    item_category TEXT NOT NULL CHECK(item_category IN ('payer_required', 'additional')),
    item_code TEXT NOT NULL,
    item_name TEXT NOT NULL,
    status TEXT DEFAULT 'not_started' CHECK(status IN (
      'not_started', 'ordered', 'in_progress', 'completed', 'contraindicated', 'declined'
    )),
    order_id TEXT REFERENCES orders(id),
    start_date DATE,
    end_date DATE,
    duration_weeks INTEGER,
    provider_name TEXT,
    notes TEXT,
    icd10_code TEXT,
    cpt_code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_cc_items_patient ON conservative_care_items(patient_id);
  CREATE INDEX IF NOT EXISTS idx_cc_items_episode ON conservative_care_items(episode_id);
  CREATE INDEX IF NOT EXISTS idx_cc_items_status ON conservative_care_items(status);

  -- Pre-Op Optimization Orders
  CREATE TABLE IF NOT EXISTS preop_orders (
    id TEXT PRIMARY KEY,
    clinic_id TEXT REFERENCES clinics(id),
    patient_id TEXT NOT NULL REFERENCES patients(id),
    episode_id TEXT REFERENCES episodes(id),
    order_key TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN (
      'pending', 'ordered', 'received', 'cleared', 'conditional', 'not_cleared', 'completed'
    )),
    provider_name TEXT,
    notes TEXT,
    ordered_at DATETIME,
    received_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_preop_orders_patient ON preop_orders(patient_id);
  CREATE INDEX IF NOT EXISTS idx_preop_orders_episode ON preop_orders(episode_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_preop_orders_unique ON preop_orders(patient_id, order_key);

  -- Cockpit Sector Items (radial patient view)
  CREATE TABLE IF NOT EXISTS cockpit_sector_items (
    id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL REFERENCES episodes(id),
    sector_id TEXT NOT NULL,
    item_text TEXT NOT NULL,
    item_status TEXT DEFAULT 'pending' CHECK(item_status IN ('ok', 'alert', 'warning', 'pending')),
    item_icon TEXT DEFAULT '○',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_cockpit_items_episode ON cockpit_sector_items(episode_id);
  CREATE INDEX IF NOT EXISTS idx_cockpit_items_sector ON cockpit_sector_items(episode_id, sector_id);

  -- Clinic Visits (daily worklist)
  CREATE TABLE IF NOT EXISTS clinic_visits (
    id TEXT PRIMARY KEY,
    patient_id TEXT REFERENCES patients(id),
    episode_id TEXT REFERENCES episodes(id),
    clinic_id TEXT REFERENCES clinics(id),
    surgeon_id TEXT REFERENCES users(id),
    visit_date DATE NOT NULL,
    visit_time TIME,
    visit_type TEXT DEFAULT 'follow_up',
    visit_status TEXT DEFAULT 'scheduled',
    chief_complaint TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_clinic_visits_date ON clinic_visits(visit_date, clinic_id);
  CREATE INDEX IF NOT EXISTS idx_clinic_visits_patient ON clinic_visits(patient_id);
  CREATE INDEX IF NOT EXISTS idx_clinic_visits_surgeon ON clinic_visits(surgeon_id);
`);

// Migration: add medicare/insurance columns to patients
const patCols = db.pragma('table_info(patients)').map(c => c.name);
if (!patCols.includes('medicare_id')) {
  db.exec("ALTER TABLE patients ADD COLUMN medicare_id TEXT");
}
if (!patCols.includes('insurance_type')) {
  db.exec("ALTER TABLE patients ADD COLUMN insurance_type TEXT");
}

// Migration: add CMS exclusion columns to episodes
const epCols = db.pragma('table_info(episodes)').map(c => c.name);
if (!epCols.includes('procedure_category')) {
  // 'primary' or 'revision' — revisions excluded from CMS denominator
  db.exec("ALTER TABLE episodes ADD COLUMN procedure_category TEXT DEFAULT 'primary'");
}
if (!epCols.includes('case_type')) {
  // 'elective' or 'trauma' — trauma/fractures excluded from elective LEJR
  db.exec("ALTER TABLE episodes ADD COLUMN case_type TEXT DEFAULT 'elective'");
}
if (!epCols.includes('is_partial')) {
  // 0 = total (included), 1 = partial/unicompartmental (excluded)
  db.exec("ALTER TABLE episodes ADD COLUMN is_partial INTEGER DEFAULT 0");
}
if (!epCols.includes('has_malignancy')) {
  // 0 = no, 1 = yes — bone/joint cancer at surgical site (excluded)
  db.exec("ALTER TABLE episodes ADD COLUMN has_malignancy INTEGER DEFAULT 0");
}
if (!epCols.includes('discharge_status')) {
  // 'home','snf','rehab','home_health','outpatient_pt','death','transfer_acute' 
  // death and transfer_acute are CMS exclusions
  db.exec("ALTER TABLE episodes ADD COLUMN discharge_status TEXT");
}
if (!epCols.includes('simultaneous_device_removal')) {
  // 0 = no, 1 = yes — excluded from PRO-PM
  db.exec("ALTER TABLE episodes ADD COLUMN simultaneous_device_removal INTEGER DEFAULT 0");
}

// Migration: add CMS risk variable columns if missing
const preopCols = db.pragma('table_info(preop_assessments)').map(c => c.name);
if (!preopCols.includes('chronic_narcotics_use')) {
  db.exec("ALTER TABLE preop_assessments ADD COLUMN chronic_narcotics_use INTEGER DEFAULT 0");
}
if (!preopCols.includes('total_painful_joint_count')) {
  db.exec("ALTER TABLE preop_assessments ADD COLUMN total_painful_joint_count INTEGER DEFAULT 0");
}
if (!preopCols.includes('health_literacy_sils')) {
  db.exec("ALTER TABLE preop_assessments ADD COLUMN health_literacy_sils INTEGER");
}
if (!preopCols.includes('low_back_pain')) {
  db.exec("ALTER TABLE preop_assessments ADD COLUMN low_back_pain INTEGER DEFAULT 0");
}
if (!preopCols.includes('koos_jr_raw')) {
  db.exec("ALTER TABLE preop_assessments ADD COLUMN koos_jr_raw INTEGER");
}
if (!preopCols.includes('hoos_jr_raw')) {
  db.exec("ALTER TABLE preop_assessments ADD COLUMN hoos_jr_raw INTEGER");
}
if (!preopCols.includes('surgeon_justification')) {
  db.exec("ALTER TABLE preop_assessments ADD COLUMN surgeon_justification TEXT");
}
if (!preopCols.includes('status')) {
  db.exec("ALTER TABLE preop_assessments ADD COLUMN status TEXT DEFAULT 'complete'");
}
if (!preopCols.includes('intake_responses')) {
  db.exec("ALTER TABLE preop_assessments ADD COLUMN intake_responses TEXT");
}
if (!preopCols.includes('comorb_data')) {
  db.exec("ALTER TABLE preop_assessments ADD COLUMN comorb_data TEXT");
}
if (!preopCols.includes('workup_data')) {
  db.exec("ALTER TABLE preop_assessments ADD COLUMN workup_data TEXT");
}

// Migration: add resolved_at and resolved_by to adverse_events
const aeCols = db.pragma('table_info(adverse_events)').map(c => c.name);
if (!aeCols.includes('resolved_at')) {
  db.exec("ALTER TABLE adverse_events ADD COLUMN resolved_at DATETIME");
}
if (!aeCols.includes('resolved_by')) {
  db.exec("ALTER TABLE adverse_events ADD COLUMN resolved_by TEXT");
}

// --- Portal status columns on episodes ---
const epCols2 = db.prepare("PRAGMA table_info(episodes)").all().map(c => c.name);
if (!epCols2.includes('baseline_completed')) {
  db.exec("ALTER TABLE episodes ADD COLUMN baseline_completed INTEGER DEFAULT 0");
}
if (!epCols2.includes('conservative_completed')) {
  db.exec("ALTER TABLE episodes ADD COLUMN conservative_completed INTEGER DEFAULT 0");
}
if (!epCols2.includes('portal_last_accessed')) {
  db.exec("ALTER TABLE episodes ADD COLUMN portal_last_accessed DATETIME");
}

// ============ MIGRATION: Episode Stage Tracking ============
const epColsStage = db.pragma('table_info(episodes)').map(c => c.name);
if (!epColsStage.includes('episode_stage')) {
  db.exec("ALTER TABLE episodes ADD COLUMN episode_stage TEXT DEFAULT 'intake'");
  console.log('Migration: added episode_stage to episodes');
}
if (!epColsStage.includes('stage_data')) {
  db.exec("ALTER TABLE episodes ADD COLUMN stage_data TEXT DEFAULT '{}'");
  console.log('Migration: added stage_data to episodes');
}
if (!epColsStage.includes('stage_updated_at')) {
  db.exec("ALTER TABLE episodes ADD COLUMN stage_updated_at DATETIME");
  console.log('Migration: added stage_updated_at to episodes');
}

// ============ STAGE DEFINITIONS ============
const EPISODE_STAGES = [
  { key: 'intake', label: 'Intake', icon: '📋', description: 'Demographics, baseline PROMs, initial assessment', page: '/dashboard.html' },
  { key: 'conservative_care', label: 'Conservative Care', icon: '💊', description: 'Non-operative treatment plan per AAOS guidelines', page: '/nonop-plan.html' },
  { key: 'preop_assessment', label: 'PreOp Assessment', icon: '🩺', description: 'Risk stratification, comorbidities, workup clearance', page: '/preop.html' },
  { key: 'surgical_prep', label: 'Surgical Prep', icon: '📝', description: 'Insurance, consent, disposition, prehab', page: '/surgical-prep.html' },
  { key: 'surgery', label: 'Surgery', icon: '🔪', description: 'Procedure performed', page: null },
  { key: 'postop', label: 'Post-Op', icon: '📊', description: 'Recovery tracking, check-ins, post-op PROMs', page: '/episode-timeline.html' }
];

const STAGE_ORDER = EPISODE_STAGES.map(s => s.key);

function getStageIndex(stageKey) {
  return STAGE_ORDER.indexOf(stageKey);
}

function isValidAdvance(currentStage, targetStage) {
  const currentIdx = getStageIndex(currentStage);
  const targetIdx = getStageIndex(targetStage);
  return targetIdx === currentIdx + 1;
}

function detectStageCompletion(episodeId, patientId, stageKey) {
  switch (stageKey) {
    case 'intake': {
      const hasProm = db.prepare("SELECT id FROM pro_assessments WHERE patient_id = ? AND episode_id = ? LIMIT 1").get(patientId, episodeId);
      const hasPreop = db.prepare("SELECT id FROM preop_assessments WHERE patient_id = ? LIMIT 1").get(patientId);
      return !!(hasProm || hasPreop);
    }
    case 'conservative_care': return false;
    case 'preop_assessment': {
      const preop = db.prepare("SELECT id FROM preop_assessments WHERE patient_id = ? AND (status = 'complete' OR status IS NULL) LIMIT 1").get(patientId);
      return !!preop;
    }
    case 'surgical_prep': {
      const prep = db.prepare("SELECT id FROM surgical_prep WHERE patient_id = ? AND consent_signed_at IS NOT NULL LIMIT 1").get(patientId);
      return !!prep;
    }
    case 'surgery': {
      const ep = db.prepare("SELECT surgery_date FROM episodes WHERE id = ?").get(episodeId);
      if (ep && ep.surgery_date) return new Date(ep.surgery_date) <= new Date();
      return false;
    }
    case 'postop': {
      const yearProm = db.prepare("SELECT id FROM prom_schedule WHERE episode_id = ? AND window_name = '1_year' AND status = 'completed' LIMIT 1").get(episodeId);
      return !!yearProm;
    }
    default: return false;
  }
}

// Insert default clinic if none exists
const clinicCount = db.prepare('SELECT COUNT(*) as count FROM clinics').get();
if (clinicCount.count === 0) {
  const defaultClinicId = '11111111-1111-1111-1111-111111111111';
  db.prepare(`
    INSERT INTO clinics (id, name, address, phone) 
    VALUES (?, 'Demo Orthopedic Clinic', '123 Medical Center Dr', '555-123-4567')
  `).run(defaultClinicId);
  
  // Add demo surgeons
  db.prepare(`
    INSERT INTO users (id, clinic_id, first_name, last_name, role, specialty)
    VALUES (?, ?, 'Sarah', 'Smith', 'surgeon', 'Total Joint Replacement')
  `).run(uuid(), defaultClinicId);
  
  db.prepare(`
    INSERT INTO users (id, clinic_id, first_name, last_name, role, specialty)
    VALUES (?, ?, 'Michael', 'Jones', 'surgeon', 'Sports Medicine')
  `).run(uuid(), defaultClinicId);
  
  db.prepare(`
    INSERT INTO users (id, clinic_id, first_name, last_name, role, specialty)
    VALUES (?, ?, 'Jennifer', 'Lee', 'surgeon', 'Total Joint Replacement')
  `).run(uuid(), defaultClinicId);
  
  db.prepare(`
    INSERT INTO users (id, clinic_id, first_name, last_name, role, specialty)
    VALUES (?, ?, 'Lisa', 'Thompson', 'nurse', 'Orthopedic Nursing')
  `).run(uuid(), defaultClinicId);
  
  db.prepare(`
    INSERT INTO users (id, clinic_id, first_name, last_name, role, specialty)
    VALUES (?, ?, 'Karen', 'Davis', 'admin', 'Practice Administration')
  `).run(uuid(), defaultClinicId);
  
  console.log('Created default clinic and demo users (surgeons, nurse, admin)');
}

// Migration: ensure nurse and admin users exist (for existing databases)
const defaultClinicCheck = db.prepare('SELECT id FROM clinics LIMIT 1').get();
if (defaultClinicCheck) {
  const hasNurse = db.prepare("SELECT id FROM users WHERE clinic_id = ? AND role = 'nurse' LIMIT 1").get(defaultClinicCheck.id);
  if (!hasNurse) {
    db.prepare("INSERT INTO users (id, clinic_id, first_name, last_name, role, specialty) VALUES (?, ?, 'Lisa', 'Thompson', 'nurse', 'Orthopedic Nursing')").run(uuid(), defaultClinicCheck.id);
    console.log('Added demo nurse user');
  }
  const hasAdmin = db.prepare("SELECT id FROM users WHERE clinic_id = ? AND role = 'admin' LIMIT 1").get(defaultClinicCheck.id);
  if (!hasAdmin) {
    db.prepare("INSERT INTO users (id, clinic_id, first_name, last_name, role, specialty) VALUES (?, ?, 'Karen', 'Davis', 'admin', 'Practice Administration')").run(uuid(), defaultClinicCheck.id);
    console.log('Added demo admin user');
  }
}

// ============ SEED DEFAULT PT EXERCISE TEMPLATES ============
const ptTemplateCount = db.prepare('SELECT COUNT(*) as count FROM pt_program_templates WHERE is_default = 1').get();
if (ptTemplateCount.count === 0) {
  const insertTemplate = db.prepare(`
    INSERT INTO pt_program_templates (id, name, program_type, phase, is_default, exercises, walking_goal_start_min, walking_goal_end_min, duration_weeks, frequency_per_day)
    VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
  `);

  // TKA Pre-Op Prehab
  insertTemplate.run(uuid(), 'TKA Pre-Op Prehab (Standard)', 'TKA', 'pre-op',
    JSON.stringify([
      { name: 'Quad Sets', reps: 10, hold_seconds: 5, sets: 1, instructions: 'Tighten thigh muscle, press knee flat into bed. Hold 5 seconds.' },
      { name: 'Straight Leg Raises', reps: 10, hold_seconds: 0, sets: 1, instructions: 'Tighten quad, lift leg 6-8 inches off bed. Keep knee straight.' },
      { name: 'Heel Slides', reps: 10, hold_seconds: 0, sets: 1, instructions: 'Slide heel toward buttock, bending knee. Slide back out.' },
      { name: 'Ankle Pumps', reps: 20, hold_seconds: 0, sets: 1, instructions: 'Point toes down, then pull toes up. Pump steadily.' },
      { name: 'Mini Squats', reps: 10, hold_seconds: 0, sets: 1, instructions: 'Hold counter or chair. Bend knees 30-45 degrees. Stand back up.' }
    ]), 10, 30, 4, 2);

  // TKA Post-Op Home Exercise
  insertTemplate.run(uuid(), 'TKA Post-Op Home Exercise (Standard)', 'TKA', 'post-op',
    JSON.stringify([
      { name: 'Quad Sets', reps: 10, hold_seconds: 5, sets: 1, instructions: 'Tighten thigh muscle, press knee flat. Hold 5 seconds.' },
      { name: 'Straight Leg Raises', reps: 10, hold_seconds: 0, sets: 1, instructions: 'Tighten quad, lift leg 6-8 inches. Keep knee straight.' },
      { name: 'Heel Slides', reps: 10, hold_seconds: 0, sets: 1, instructions: 'Slide heel toward buttock, bending knee as far as comfortable.' },
      { name: 'Ankle Pumps', reps: 20, hold_seconds: 0, sets: 1, instructions: 'Point toes down, then pull toes up. Important for blood clot prevention.' },
      { name: 'Short Arc Quads', reps: 10, hold_seconds: 3, sets: 1, instructions: 'Roll towel under knee. Straighten knee, tighten quad. Hold 3 seconds.' },
      { name: 'Seated Knee Flexion', reps: 10, hold_seconds: 0, sets: 1, instructions: 'Sit in chair. Slide foot back, bending knee. Use other foot to assist if needed.' }
    ]), 5, 30, 12, 3);

  // THA Pre-Op Prehab
  insertTemplate.run(uuid(), 'THA Pre-Op Prehab (Standard)', 'THA', 'pre-op',
    JSON.stringify([
      { name: 'Glute Bridges', reps: 10, hold_seconds: 5, sets: 1, instructions: 'Lie on back, knees bent. Squeeze glutes and lift hips. Hold 5 seconds.' },
      { name: 'Clamshells', reps: 10, hold_seconds: 0, sets: 1, instructions: 'Lie on side, knees bent. Open top knee like a clamshell. Keep feet together.' },
      { name: 'Hip Abduction (Side Leg Raise)', reps: 10, hold_seconds: 0, sets: 1, instructions: 'Lie on side, lift top leg 12 inches. Keep leg straight.' },
      { name: 'Ankle Pumps', reps: 20, hold_seconds: 0, sets: 1, instructions: 'Point toes down, then pull toes up. Pump steadily.' },
      { name: 'Standing Hip Flexion', reps: 10, hold_seconds: 0, sets: 1, instructions: 'Hold counter. Lift knee toward chest. Lower slowly.' }
    ]), 10, 30, 4, 2);

  // THA Post-Op Home Exercise
  insertTemplate.run(uuid(), 'THA Post-Op Home Exercise (Standard)', 'THA', 'post-op',
    JSON.stringify([
      { name: 'Ankle Pumps', reps: 20, hold_seconds: 0, sets: 1, instructions: 'Point toes down, then pull toes up. Important for blood clot prevention.' },
      { name: 'Glute Sets', reps: 10, hold_seconds: 5, sets: 1, instructions: 'Squeeze buttocks together. Hold 5 seconds.' },
      { name: 'Heel Slides', reps: 10, hold_seconds: 0, sets: 1, instructions: 'Slide heel toward buttock. Observe hip precautions — do not flex past 90 degrees.' },
      { name: 'Standing Hip Abduction', reps: 10, hold_seconds: 0, sets: 1, instructions: 'Hold walker or counter. Slide operated leg out to side. Return slowly.' },
      { name: 'Standing Hip Extension', reps: 10, hold_seconds: 0, sets: 1, instructions: 'Hold walker or counter. Move operated leg straight back. Keep trunk upright.' },
      { name: 'Standing Marches', reps: 10, hold_seconds: 0, sets: 1, instructions: 'Hold counter. Lift knee toward chest (observe precautions). Alternate legs.' }
    ]), 5, 30, 12, 3);

  console.log('Seeded 4 default PT exercise templates (TKA/THA pre-op/post-op)');
}

// ============ PROM SCHEDULE HELPER ============
// CMS TEAM Model standard collection windows:
// Pre-op: before surgery (captured in preop.html)
// 6 weeks: 42 days post-op (window: 35-56 days)
// 3 months: 90 days post-op (window: 75-120 days)
// 1 year: 365 days post-op (window: 335-395 days)

function generatePromSchedule(episodeId, patientId, clinicId, surgeryType, surgeryDate) {
  if (!surgeryDate) return;
  
  const surgery = new Date(surgeryDate);
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r.toISOString().split('T')[0]; };
  
  // Determine which PROMs based on surgery type
  const isHip = surgeryType && (surgeryType.toUpperCase().includes('THA') || surgeryType.toUpperCase().includes('HIP'));
  const jointProm = isHip ? 'hoos_jr' : 'koos_jr';
  
  const windows = [
    { name: '6_week', dueDays: 42, openDays: 35, closeDays: 56 },
    { name: '3_month', dueDays: 90, openDays: 75, closeDays: 120 },
    { name: '1_year', dueDays: 365, openDays: 335, closeDays: 395 }
  ];
  
  // PROMs to schedule at each window
  const promTypes = [jointProm, 'promis_10'];
  
  const insert = db.prepare(`
    INSERT OR IGNORE INTO prom_schedule (id, patient_id, episode_id, clinic_id, assessment_type, window_name, due_date, window_open, window_close, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `);
  
  const scheduleTransaction = db.transaction(() => {
    windows.forEach(w => {
      promTypes.forEach(promType => {
        const schedId = `${episodeId}-${w.name}-${promType}`;
        insert.run(
          schedId, patientId, episodeId, clinicId, promType, w.name,
          addDays(surgery, w.dueDays),
          addDays(surgery, w.openDays),
          addDays(surgery, w.closeDays)
        );
      });
    });
  });
  
  try {
    scheduleTransaction();
  } catch (e) {
    console.log('PROM schedule generation note:', e.message);
  }
}

// ============ KOOS Jr / HOOS Jr Rasch Interval Scoring (Official HSS Tables) ============

// ============ PT ENGINE HELPER FUNCTIONS ============

// Auto-create a pre-op PT plan when an episode is created
function autoCreatePtPlan(episodeId, patientId, surgeryType, surgeonId, surgeryDate) {
  try {
    // Determine program type from surgery type
    let programType = 'TKA';
    if (surgeryType) {
      const st = surgeryType.toUpperCase();
      if (st.includes('THA') || st.includes('HIP')) programType = 'THA';
      else if (st.includes('UKA') || st.includes('PARTIAL KNEE')) programType = 'UKA';
      else if (st.includes('TSA') || st.includes('SHOULDER')) programType = 'TSA';
    }

    // Find the default template for this program type and pre-op phase
    const template = db.prepare(`
      SELECT * FROM pt_program_templates
      WHERE program_type = ? AND phase = 'pre-op' AND is_default = 1
      LIMIT 1
    `).get(programType);

    // Fallback: use TKA pre-op if no specific template found
    const fallbackTemplate = template || db.prepare(`
      SELECT * FROM pt_program_templates
      WHERE program_type = 'TKA' AND phase = 'pre-op' AND is_default = 1
      LIMIT 1
    `).get();

    if (!fallbackTemplate) {
      console.log('[PT Engine] No default template found, skipping auto-create');
      return null;
    }

    const today = new Date().toISOString().split('T')[0];
    const durationWeeks = fallbackTemplate.duration_weeks || 4;
    const targetEnd = surgeryDate || new Date(Date.now() + durationWeeks * 7 * 86400000).toISOString().split('T')[0];

    const ptEpisodeId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO pt_episodes (id, episode_id, patient_id, phase, program_type, program_template,
        start_date, target_end_date, duration_weeks, status, surgeon_id, custom_exercises)
      VALUES (?, ?, ?, 'pre-op', ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(ptEpisodeId, episodeId, patientId, programType, fallbackTemplate.name,
           today, targetEnd, durationWeeks, surgeonId || null, fallbackTemplate.exercises);

    console.log(`[PT Engine] Auto-created pre-op PT plan for episode ${episodeId.substring(0, 8)}...`);
    return ptEpisodeId;
  } catch (e) {
    console.log('[PT Engine] Auto-create error:', e.message);
    return null;
  }
}

// Recalculate PT compliance for a pt_episode
function recalcPtCompliance(ptEpisodeId) {
  try {
    const ptEp = db.prepare('SELECT * FROM pt_episodes WHERE id = ?').get(ptEpisodeId);
    if (!ptEp || ptEp.status !== 'active') return;

    const startDate = new Date(ptEp.start_date);
    const today = new Date();
    const totalPossibleDays = Math.max(1, Math.floor((today - startDate) / 86400000));

    const totalExerciseDays = db.prepare(`
      SELECT COUNT(*) as count FROM pt_daily_logs
      WHERE pt_episode_id = ? AND exercise_completion_pct > 0
    `).get(ptEpisodeId).count;

    const compliancePct = Math.round((totalExerciseDays / totalPossibleDays) * 100 * 10) / 10;

    // Determine flagged status
    let flaggedStatus = 'none';
    if (compliancePct < 25) flaggedStatus = 'critical';
    else if (compliancePct < 50) flaggedStatus = 'non_compliant';
    else if (compliancePct < 75) flaggedStatus = 'low_compliance';

    db.prepare(`
      UPDATE pt_episodes SET compliance_percentage = ?, total_exercise_days = ?,
        total_possible_days = ?, flagged_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(compliancePct, totalExerciseDays, totalPossibleDays, flaggedStatus, ptEpisodeId);

    return { compliancePct, flaggedStatus, totalExerciseDays, totalPossibleDays };
  } catch (e) {
    console.log('[PT Engine] Compliance recalc error:', e.message);
    return null;
  }
}

// Check deviation triggers for a patient's active PT episode
function checkPtDeviations(patientId) {
  try {
    const ptEp = db.prepare(`
      SELECT * FROM pt_episodes WHERE patient_id = ? AND status = 'active'
      ORDER BY created_at DESC LIMIT 1
    `).get(patientId);
    if (!ptEp) return;

    const today = new Date().toISOString().split('T')[0];

    // Check: 3+ consecutive days without a log
    const recentLogs = db.prepare(`
      SELECT log_date FROM pt_daily_logs
      WHERE pt_episode_id = ? ORDER BY log_date DESC LIMIT 3
    `).all(ptEp.id);

    if (recentLogs.length > 0) {
      const lastLogDate = new Date(recentLogs[0].log_date);
      const daysSinceLog = Math.floor((new Date() - lastLogDate) / 86400000);
      if (daysSinceLog >= 3) {
        // Only create if no unresolved deviation of this type exists
        const existing = db.prepare(`
          SELECT id FROM pt_deviation_events
          WHERE pt_episode_id = ? AND deviation_type = 'missed_days' AND resolved = 0
        `).get(ptEp.id);
        if (!existing) {
          db.prepare(`
            INSERT INTO pt_deviation_events (id, pt_episode_id, patient_id, deviation_type, severity, description, detected_date)
            VALUES (?, ?, ?, 'missed_days', 'warning', ?, ?)
          `).run(crypto.randomUUID(), ptEp.id, patientId,
                 `No PT log for ${daysSinceLog} days`, today);
        }
      }
    } else if (ptEp.total_possible_days >= 3) {
      // No logs at all and plan started 3+ days ago
      const existing = db.prepare(`
        SELECT id FROM pt_deviation_events
        WHERE pt_episode_id = ? AND deviation_type = 'no_checkin' AND resolved = 0
      `).get(ptEp.id);
      if (!existing) {
        db.prepare(`
          INSERT INTO pt_deviation_events (id, pt_episode_id, patient_id, deviation_type, severity, description, detected_date)
          VALUES (?, ?, ?, 'no_checkin', 'critical', 'No PT data received since plan started', ?)
        `).run(crypto.randomUUID(), ptEp.id, patientId, today);
      }
    }

    // Check: weekly compliance <50%
    if (ptEp.compliance_percentage < 50 && ptEp.total_possible_days >= 7) {
      const existing = db.prepare(`
        SELECT id FROM pt_deviation_events
        WHERE pt_episode_id = ? AND deviation_type = 'low_compliance' AND resolved = 0
      `).get(ptEp.id);
      if (!existing) {
        db.prepare(`
          INSERT INTO pt_deviation_events (id, pt_episode_id, patient_id, deviation_type, severity, description, detected_date)
          VALUES (?, ?, ?, 'low_compliance', ?, ?, ?)
        `).run(crypto.randomUUID(), ptEp.id, patientId,
               ptEp.compliance_percentage < 25 ? 'critical' : 'warning',
               `PT compliance at ${ptEp.compliance_percentage}%`, today);
      }
    }

    // Check: high pain barrier in recent logs
    const highPainLog = db.prepare(`
      SELECT * FROM pt_daily_logs
      WHERE pt_episode_id = ? AND pain_barrier = 1 AND log_date >= date('now', '-3 days')
      ORDER BY log_date DESC LIMIT 1
    `).get(ptEp.id);
    if (highPainLog) {
      const existing = db.prepare(`
        SELECT id FROM pt_deviation_events
        WHERE pt_episode_id = ? AND deviation_type = 'high_pain' AND resolved = 0
      `).get(ptEp.id);
      if (!existing) {
        db.prepare(`
          INSERT INTO pt_deviation_events (id, pt_episode_id, patient_id, deviation_type, severity, description, detected_date)
          VALUES (?, ?, ?, 'high_pain', 'warning', 'Patient reports pain is preventing exercises', ?)
        `).run(crypto.randomUUID(), ptEp.id, patientId, today);
      }
    }
  } catch (e) {
    console.log('[PT Engine] Deviation check error:', e.message);
  }
}

// KOOS Jr: Raw sum 0-28 → Interval 0-100 (0 = total disability, 100 = perfect health)
const KOOS_JR_TABLE = {
  0: 100.000, 1: 91.975, 2: 84.600, 3: 79.914, 4: 76.332, 5: 73.342, 6: 70.704, 7: 68.284,
  8: 65.994, 9: 63.776, 10: 61.583, 11: 59.381, 12: 57.140, 13: 54.840, 14: 52.465,
  15: 50.012, 16: 47.487, 17: 44.905, 18: 42.281, 19: 39.625, 20: 36.931, 21: 34.174,
  22: 31.307, 23: 28.251, 24: 24.875, 25: 20.941, 26: 15.939, 27: 8.291, 28: 0.000
};

// HOOS Jr: Raw sum 0-24 → Interval 0-100 (0 = total disability, 100 = perfect health)
const HOOS_JR_TABLE = {
  0: 100.000, 1: 92.340, 2: 85.257, 3: 80.550, 4: 76.776, 5: 73.472, 6: 70.426, 7: 67.516,
  8: 64.664, 9: 61.815, 10: 58.930, 11: 55.985, 12: 52.965, 13: 49.858, 14: 46.652,
  15: 43.335, 16: 39.902, 17: 36.363, 18: 32.735, 19: 29.009, 20: 25.103, 21: 20.805,
  22: 15.633, 23: 8.104, 24: 0.000
};

function convertKoosJrScore(rawSum) {
  if (rawSum < 0 || rawSum > 28) return null;
  return KOOS_JR_TABLE[Math.round(rawSum)];
}

function convertHoosJrScore(rawSum) {
  if (rawSum < 0 || rawSum > 24) return null;
  return HOOS_JR_TABLE[Math.round(rawSum)];
}

// CMS SCB Thresholds (interval score improvement)
const SCB_KOOS_JR = 20; // TKA: ≥20 point improvement on KOOS Jr interval score
const SCB_HOOS_JR = 22; // THA: ≥22 point improvement on HOOS Jr interval score

// ============ API ROUTES ============

// --- Clinics ---
app.get('/api/clinics', (req, res) => {
  const clinics = db.prepare('SELECT * FROM clinics').all();
  res.json(clinics);
});

app.get('/api/clinics/:id', (req, res) => {
  const clinic = db.prepare('SELECT * FROM clinics WHERE id = ?').get(req.params.id);
  res.json(clinic);
});

// --- Users (Surgeons) ---
app.get('/api/users', (req, res) => {
  const { clinic_id, role } = req.query;
  let query = 'SELECT * FROM users WHERE 1=1';
  const params = [];
  
  if (clinic_id) { query += ' AND clinic_id = ?'; params.push(clinic_id); }
  if (role) { query += ' AND role = ?'; params.push(role); }
  
  query += ' ORDER BY last_name, first_name';
  const users = db.prepare(query).all(...params);
  res.json(users);
});

app.get('/api/users/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  res.json(user);
});

app.post('/api/users', (req, res) => {
  const id = uuid();
  const { clinic_id, email, first_name, last_name, role, specialty, npi } = req.body;
  
  db.prepare(`
    INSERT INTO users (id, clinic_id, email, first_name, last_name, role, specialty, npi)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, clinic_id, email, first_name, last_name, role || 'surgeon', specialty, npi);
  
  res.json({ id, success: true });
});

app.put('/api/users/:id', (req, res) => {
  const { email, first_name, last_name, role, specialty, npi } = req.body;
  
  db.prepare(`
    UPDATE users SET email = ?, first_name = ?, last_name = ?, role = ?, specialty = ?, npi = ?
    WHERE id = ?
  `).run(email, first_name, last_name, role, specialty, npi, req.params.id);
  
  res.json({ success: true });
});

app.delete('/api/users/:id', (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// --- Patients ---
app.get('/api/patients', (req, res) => {
  const { clinic_id } = req.query;
  
  const patients = db.prepare(`
    SELECT 
      p.*,
      e.id as episode_id,
      e.surgery_type,
      e.surgery_date,
      e.status as episode_status,
      e.surgeon_id,
      u.first_name as surgeon_first_name,
      u.last_name as surgeon_last_name,
      (SELECT checkin_date FROM checkins WHERE patient_id = p.id ORDER BY checkin_date DESC, created_at DESC LIMIT 1) as last_checkin_date,
      (SELECT pain_level FROM checkins WHERE patient_id = p.id ORDER BY checkin_date DESC, created_at DESC LIMIT 1) as last_pain_level,
      (SELECT pt_exercises FROM checkins WHERE patient_id = p.id ORDER BY checkin_date DESC, created_at DESC LIMIT 1) as last_pt_exercises
    FROM patients p
    LEFT JOIN episodes e ON e.patient_id = p.id AND e.status = 'active'
    LEFT JOIN users u ON e.surgeon_id = u.id
    WHERE p.clinic_id = ?
    ORDER BY p.last_name, p.first_name
  `).all(clinic_id);
  
  res.json(patients);
});

app.get('/api/patients/:id', (req, res) => {
  const patient = db.prepare(`
    SELECT 
      p.*,
      e.id as episode_id,
      e.surgery_type,
      e.surgery_date,
      e.status as episode_status,
      e.surgeon_id,
      u.first_name as surgeon_first_name,
      u.last_name as surgeon_last_name
    FROM patients p
    LEFT JOIN episodes e ON e.patient_id = p.id AND e.status = 'active'
    LEFT JOIN users u ON e.surgeon_id = u.id
    WHERE p.id = ?
  `).get(req.params.id);
  
  res.json(patient);
});

app.post('/api/patients', (req, res) => {
  const id = uuid();
  const token = generateToken();
  const { clinic_id, first_name, last_name, date_of_birth, email, phone, mrn } = req.body;
  
  db.prepare(`
    INSERT INTO patients (id, clinic_id, first_name, last_name, date_of_birth, email, phone, mrn, token)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, clinic_id, first_name, last_name, date_of_birth, email, phone, mrn, token);
  
  res.json({ id, token, success: true });
});

app.put('/api/patients/:id', (req, res) => {
  const { first_name, last_name, date_of_birth, email, phone, mrn, insurance_type, medicare_id } = req.body;
  
  const updates = [];
  const vals = [];
  if (first_name !== undefined) { updates.push('first_name = ?'); vals.push(first_name); }
  if (last_name !== undefined) { updates.push('last_name = ?'); vals.push(last_name); }
  if (date_of_birth !== undefined) { updates.push('date_of_birth = ?'); vals.push(date_of_birth); }
  if (email !== undefined) { updates.push('email = ?'); vals.push(email); }
  if (phone !== undefined) { updates.push('phone = ?'); vals.push(phone); }
  if (mrn !== undefined) { updates.push('mrn = ?'); vals.push(mrn); }
  if (insurance_type !== undefined) { updates.push('insurance_type = ?'); vals.push(insurance_type); }
  if (medicare_id !== undefined) { updates.push('medicare_id = ?'); vals.push(medicare_id); }
  
  if (updates.length === 0) return res.json({ success: false, error: 'No fields to update' });
  
  vals.push(req.params.id);
  db.prepare(`UPDATE patients SET ${updates.join(', ')} WHERE id = ?`).run(...vals);
  
  res.json({ success: true });
});

app.delete('/api/patients/:id', (req, res) => {
  // Delete related records first
  db.prepare('DELETE FROM pt_deviation_events WHERE patient_id = ?').run(req.params.id);
  db.prepare('DELETE FROM pt_daily_logs WHERE patient_id = ?').run(req.params.id);
  db.prepare('DELETE FROM pt_episodes WHERE patient_id = ?').run(req.params.id);
  db.prepare('DELETE FROM adverse_events WHERE patient_id = ?').run(req.params.id);
  db.prepare('DELETE FROM checkins WHERE patient_id = ?').run(req.params.id);
  db.prepare('DELETE FROM pro_assessments WHERE patient_id = ?').run(req.params.id);
  db.prepare('DELETE FROM preop_assessments WHERE patient_id = ?').run(req.params.id);
  db.prepare('DELETE FROM rpm_time_logs WHERE patient_id = ?').run(req.params.id);
  db.prepare('DELETE FROM prom_schedule WHERE patient_id = ?').run(req.params.id);
  db.prepare('DELETE FROM nursing_notes WHERE patient_id = ?').run(req.params.id);
  db.prepare('DELETE FROM surgical_prep WHERE patient_id = ?').run(req.params.id);
  db.prepare('DELETE FROM episodes WHERE patient_id = ?').run(req.params.id);
  db.prepare('DELETE FROM patients WHERE id = ?').run(req.params.id);
  logAudit(null, 'patient_deleted', 'patients', req.params.id, null);
  res.json({ success: true });
});

// --- Patient by Token (for check-in) ---
app.get('/api/patient-by-token/:token', (req, res) => {
  const patient = db.prepare(`
    SELECT 
      p.id,
      p.first_name,
      p.clinic_id,
      e.id as episode_id,
      e.surgery_type,
      e.surgery_date
    FROM patients p
    LEFT JOIN episodes e ON e.patient_id = p.id AND e.status = 'active'
    WHERE p.token = ?
  `).get(req.params.token);
  
  if (!patient) {
    return res.status(404).json({ error: 'Invalid check-in link' });
  }
  
  // Calculate days post-op
  let daysPostOp = null;
  if (patient.surgery_date) {
    const surgeryDate = new Date(patient.surgery_date);
    const today = new Date();
    daysPostOp = Math.floor((today - surgeryDate) / (1000 * 60 * 60 * 24));
  }
  
  res.json({
    patient_id: patient.id,
    first_name: patient.first_name,
    clinic_id: patient.clinic_id,
    episode_id: patient.episode_id,
    surgery_type: patient.surgery_type,
    days_post_op: daysPostOp
  });
});

// --- Validate Token (alias for checkin.html compatibility) ---
app.get('/api/validate-token/:token', (req, res) => {
  const patient = db.prepare(`
    SELECT 
      p.id, p.first_name, p.clinic_id,
      e.id as episode_id, e.surgery_type, e.surgery_date
    FROM patients p
    LEFT JOIN episodes e ON e.patient_id = p.id AND e.status = 'active'
    WHERE p.token = ?
  `).get(req.params.token);
  
  if (!patient) return res.status(404).json({ error: 'Invalid token' });
  
  let daysPostOp = null;
  if (patient.surgery_date) {
    daysPostOp = Math.floor((new Date() - new Date(patient.surgery_date)) / (1000 * 60 * 60 * 24));
  }
  
  res.json({
    patient_id: patient.id, first_name: patient.first_name, clinic_id: patient.clinic_id,
    episode_id: patient.episode_id, surgery_type: patient.surgery_type, days_post_op: daysPostOp
  });
});

// --- Portal Status (for dashboard Portal button/badge) ---
app.get('/api/portal-status/:patientId', (req, res) => {
  const patient = db.prepare(`
    SELECT p.id, p.token, p.first_name, p.last_name, p.date_of_birth, p.phone,
           e.id as episode_id, e.surgery_type, e.surgery_date, e.status as episode_status,
           e.baseline_completed, e.conservative_completed, e.portal_last_accessed
    FROM patients p
    LEFT JOIN episodes e ON e.patient_id = p.id AND e.status = 'active'
    WHERE p.id = ?
  `).get(req.params.patientId);

  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  // Check if preop assessment exists (baseline)
  const hasPreop = db.prepare(`
    SELECT COUNT(*) as cnt FROM preop_assessments WHERE patient_id = ?
  `).get(req.params.patientId);

  // Check PROM status
  const promCount = db.prepare(`
    SELECT COUNT(*) as cnt FROM pro_assessments WHERE patient_id = ?
  `).get(req.params.patientId);

  // Derive module statuses
  const baselineDone = patient.baseline_completed || (hasPreop.cnt > 0);
  let healthStatus = baselineDone ? 'complete' : 'not_started';
  let treatmentStatus = patient.conservative_completed ? 'complete' : (baselineDone ? 'not_started' : 'locked');
  
  // Check-in: available if surgery date is in the past
  let checkinStatus = 'locked';
  if (patient.surgery_date) {
    const surgDate = new Date(patient.surgery_date);
    if (surgDate <= new Date()) checkinStatus = 'available';
  }

  // Survey: check PROM schedule
  let surveyStatus = 'locked';
  if (patient.surgery_date && promCount.cnt > 0) {
    surveyStatus = 'complete';
  }

  res.json({
    token: patient.token,
    episode_type: patient.surgery_type,
    surgery_date: patient.surgery_date,
    baseline_completed: baselineDone ? 1 : 0,
    conservative_completed: patient.conservative_completed || 0,
    portal_last_accessed: patient.portal_last_accessed,
    modules: {
      health: healthStatus,
      treatment: treatmentStatus,
      checkin: checkinStatus,
      survey: surveyStatus
    }
  });
});

// --- Check-in History (for progress chart in checkin.html) ---
app.get('/api/checkin-history/:token', (req, res) => {
  const patient = db.prepare('SELECT id FROM patients WHERE token = ?').get(req.params.token);
  if (!patient) return res.status(404).json({ error: 'Invalid token' });
  
  const days = parseInt(req.query.days) || 7;
  const history = db.prepare(`
    SELECT checkin_date, pain_level, pt_exercises, medication_taken, swelling
    FROM checkins WHERE patient_id = ? ORDER BY checkin_date DESC LIMIT ?
  `).all(patient.id, days);
  
  res.json(history);
});

// --- Token-based Check-in (for patient-facing form - HIPAA safe, no PHI in request) ---
app.post('/api/checkin', (req, res) => {
  const { token, checkin_date, pain_level, pt_exercises, medication_taken, swelling, rom_flexion, rom_extension, concerns_flags, concerns_text, surgery_type, er_visit, er_facility, er_reason, readmitted, readmit_facility, readmit_reason } = req.body;
  
  if (!token) {
    return res.status(400).json({ error: 'Token required' });
  }
  
  const patient = db.prepare(`
    SELECT p.id as patient_id, p.clinic_id, e.id as episode_id
    FROM patients p
    LEFT JOIN episodes e ON e.patient_id = p.id AND e.status = 'active'
    WHERE p.token = ?
  `).get(token);
  
  if (!patient) {
    return res.status(404).json({ error: 'Invalid token' });
  }
  
  const id = uuid();
  const concerns = [concerns_flags, concerns_text].filter(Boolean).join(' | ');
  
  db.prepare(`
    INSERT INTO checkins (id, patient_id, episode_id, clinic_id, checkin_type, checkin_date,
                          pain_level, pt_exercises, medication_taken, swelling, concerns, notes)
    VALUES (?, ?, ?, ?, 'daily', ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, patient.patient_id, patient.episode_id, patient.clinic_id,
    checkin_date, pain_level, pt_exercises ? 1 : 0, medication_taken ? 1 : 0,
    swelling, concerns,
    rom_flexion ? ('ROM: ' + rom_flexion + '/' + (rom_extension || 0)) : null
  );
  
  // Log adverse events if reported
  if (er_visit === 'yes') {
    const aeId = uuid();
    db.prepare(`
      INSERT INTO adverse_events (id, patient_id, episode_id, clinic_id, event_type, event_date, reported_by, facility, reason)
      VALUES (?, ?, ?, ?, 'er_visit', ?, 'patient', ?, ?)
    `).run(aeId, patient.patient_id, patient.episode_id, patient.clinic_id, checkin_date, er_facility || '', er_reason || '');
    logAudit(null, 'adverse_event_reported', 'adverse_events', aeId, { type: 'er_visit', patient_id: patient.patient_id });
  }
  
  if (readmitted === 'yes') {
    const aeId = uuid();
    db.prepare(`
      INSERT INTO adverse_events (id, patient_id, episode_id, clinic_id, event_type, event_date, reported_by, facility, reason)
      VALUES (?, ?, ?, ?, 'readmission', ?, 'patient', ?, ?)
    `).run(aeId, patient.patient_id, patient.episode_id, patient.clinic_id, checkin_date, readmit_facility || '', readmit_reason || '');
    logAudit(null, 'adverse_event_reported', 'adverse_events', aeId, { type: 'readmission', patient_id: patient.patient_id });
  }
  
  res.json({ id, success: true });
});

// --- Pre-Visit Intake (patient self-service, token-based) ---

// GET: Returns patient info needed by the previsit form
app.get('/api/previsit-info/:token', (req, res) => {
  try {
    const patient = db.prepare(`
      SELECT p.id, p.first_name, p.clinic_id,
             e.surgery_type, e.id as episode_id, e.surgeon_id
      FROM patients p
      LEFT JOIN episodes e ON e.patient_id = p.id AND e.status = 'active'
      WHERE p.token = ?
    `).get(req.params.token);
    
    if (!patient) {
      return res.status(404).json({ error: 'Invalid or expired link. Please contact your doctor\'s office.' });
    }
    
    // Check if previsit already submitted
    const existing = db.prepare(`
      SELECT id, assessed_at FROM preop_assessments 
      WHERE patient_id = ? AND assessment_type = 'previsit'
      ORDER BY assessed_at DESC LIMIT 1
    `).get(patient.id);
    
    res.json({
      first_name: patient.first_name,
      surgery_type: patient.surgery_type || null,
      has_previsit: !!existing,
      previsit_date: existing ? existing.assessed_at : null
    });
  } catch(err) {
    console.error('previsit-info error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST: Receives completed previsit intake
app.post('/api/previsit', (req, res) => {
  try {
    const { token, responses, scores, completed_at } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });
    
    const patient = db.prepare(`
      SELECT p.id as patient_id, p.clinic_id,
             e.id as episode_id, e.surgery_type, e.surgeon_id
      FROM patients p
      LEFT JOIN episodes e ON e.patient_id = p.id AND e.status = 'active'
      WHERE p.token = ?
    `).get(token);
    
    if (!patient) return res.status(404).json({ error: 'Invalid token' });
    
    // Delete any previous previsit assessment (retake replaces)
    db.prepare('DELETE FROM preop_assessments WHERE patient_id = ? AND assessment_type = ?').run(patient.patient_id, 'previsit');
    
    // Determine joint score type and values
    const jointType = scores.joint_type || (patient.surgery_type && patient.surgery_type.toUpperCase().indexOf('HIP') >= 0 ? 'HOOS-JR' : 'KOOS-JR');
    const jointScore = scores.joint_score || null;
    const jointRaw = scores.joint_raw || null;
    
    // Determine procedure type from episode
    let procedureType = null;
    if (patient.surgery_type) {
      const st = patient.surgery_type.toUpperCase();
      if (st.indexOf('KNEE') >= 0 || st === 'TKA') procedureType = 'TKA';
      else if (st === 'UKA') procedureType = 'UKA';
      else if (st.indexOf('HIP') >= 0 || st === 'THA') procedureType = 'THA';
    }
    
    // Extract comorbidity flags from responses for the comorbidities JSON
    const comorbFlags = [];
    const r = responses || {};
    if (r.diabetes && r.diabetes.answer && r.diabetes.answer !== 'No') comorbFlags.push('diabetes');
    if (r.cardiac && r.cardiac.answer === 'Yes') comorbFlags.push('cardiac');
    if (r.cardiac_chf && r.cardiac_chf.answer && r.cardiac_chf.answer !== 'No') comorbFlags.push('chf');
    if (r.cardiac_cad && r.cardiac_cad.answer === 'Yes') comorbFlags.push('cad');
    if (r.cardiac_afib && r.cardiac_afib.answer === 'Yes') comorbFlags.push('afib');
    if (r.ckd && r.ckd.answer && r.ckd.answer !== 'No') comorbFlags.push('ckd');
    if (r.copd && r.copd.answer && r.copd.answer !== 'No') comorbFlags.push('copd');
    if (r.smoker && r.smoker.answer && r.smoker.answer.indexOf('Current') >= 0) comorbFlags.push('smoker');
    if (r.sleep_apnea && r.sleep_apnea.answer && r.sleep_apnea.answer !== 'No') comorbFlags.push('sleep_apnea');
    if (r.rheumatoid && r.rheumatoid.answer && r.rheumatoid.answer !== 'No') comorbFlags.push('rheumatoid');
    if (r.anticoagulant && r.anticoagulant.answer === 'Yes') comorbFlags.push('anticoagulant');
    if (r.opioid && r.opioid.answer && r.opioid.answer.indexOf('more than 3') >= 0) comorbFlags.push('chronic_opioid');
    if (r.liver && r.liver.answer === 'Yes') comorbFlags.push('liver');
    if (r.anemia && r.anemia.answer === 'Yes') comorbFlags.push('anemia');
    if (scores.bmi && scores.bmi >= 40) comorbFlags.push('morbid_obesity');
    if (r.dental && r.dental.answer && r.dental.answer.indexOf('Severe') >= 0) comorbFlags.push('dental');
    
    const preopId = uuid();
    const age = r.age ? r.age.answer : null;
    const sex = r.gender ? r.gender.answer : null;
    
    db.prepare(`
      INSERT INTO preop_assessments (
        id, patient_id, clinic_id, surgeon_id, assessment_type, procedure_type,
        age, sex, bmi, comorbidities,
        joint_score_type, joint_score_preop, koos_jr_raw, hoos_jr_raw,
        promis_physical_tscore, promis_mental_tscore,
        cms_back_pain, cms_health_literacy, cms_other_knee_pain,
        low_back_pain, health_literacy_sils, chronic_narcotics_use,
        status, intake_responses
      ) VALUES (?, ?, ?, ?, 'previsit', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'patient_submitted', ?)
    `).run(
      preopId, patient.patient_id, patient.clinic_id, patient.surgeon_id,
      procedureType,
      age, sex, scores.bmi,
      JSON.stringify(comorbFlags),
      jointType, jointScore,
      jointType === 'KOOS-JR' ? jointRaw : null,
      jointType === 'HOOS-JR' ? jointRaw : null,
      scores.promis_physical, scores.promis_mental,
      scores.cms_low_back || 0,
      scores.cms_health_literacy != null ? String(scores.cms_health_literacy) : null,
      scores.cms_other_joint || 0,
      scores.cms_low_back || 0,
      scores.cms_health_literacy,
      scores.cms_narcotics_90d || 0,
      JSON.stringify(responses)
    );
    
    // Also save scored instruments as pro_assessments for PROM tracking
    const today = new Date().toISOString().split('T')[0];
    
    if (jointScore != null) {
      const proId = uuid();
      db.prepare(`
        INSERT INTO pro_assessments (id, patient_id, episode_id, clinic_id, assessment_type, assessment_date, score, responses)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(proId, patient.patient_id, patient.episode_id, patient.clinic_id,
        jointType === 'KOOS-JR' ? 'koos_jr' : 'hoos_jr', today, jointScore,
        JSON.stringify({ raw: jointRaw, interval: jointScore, source: 'previsit' }));
    }
    
    if (scores.promis_physical) {
      const proId = uuid();
      db.prepare(`
        INSERT INTO pro_assessments (id, patient_id, episode_id, clinic_id, assessment_type, assessment_date, score, responses)
        VALUES (?, ?, ?, ?, 'promis_physical', ?, ?, ?)
      `).run(proId, patient.patient_id, patient.episode_id, patient.clinic_id,
        today, scores.promis_physical, JSON.stringify({ source: 'previsit' }));
    }
    
    if (scores.promis_mental) {
      const proId = uuid();
      db.prepare(`
        INSERT INTO pro_assessments (id, patient_id, episode_id, clinic_id, assessment_type, assessment_date, score, responses)
        VALUES (?, ?, ?, ?, 'promis_mental', ?, ?, ?)
      `).run(proId, patient.patient_id, patient.episode_id, patient.clinic_id,
        today, scores.promis_mental, JSON.stringify({ source: 'previsit' }));
    }
    
    // Mark preop PROM schedule as completed if exists
    try {
      db.prepare(`
        UPDATE prom_schedule SET status = 'completed', completed_date = ?
        WHERE patient_id = ? AND window_name = 'preop' AND status IN ('pending', 'overdue')
      `).run(today, patient.patient_id);
    } catch(e) { /* prom_schedule may not have matching record */ }
    
    console.log(`[PreVisit] Saved for patient ${patient.patient_id.substring(0,8)}... — ${comorbFlags.length} comorbidities, joint: ${jointScore || 'N/A'}`);
    
    res.json({ id: preopId, success: true });
  } catch(err) {
    console.error('previsit POST error:', err);
    res.status(500).json({ error: 'Failed to save responses: ' + err.message });
  }
});

// --- Episodes ---
app.get('/api/episodes', (req, res) => {
  const { patient_id, clinic_id, surgeon_id, status } = req.query;
  let query = 'SELECT * FROM episodes WHERE 1=1';
  const params = [];
  
  if (patient_id) { query += ' AND patient_id = ?'; params.push(patient_id); }
  if (clinic_id) { query += ' AND clinic_id = ?'; params.push(clinic_id); }
  if (surgeon_id) { query += ' AND surgeon_id = ?'; params.push(surgeon_id); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  
  query += ' ORDER BY surgery_date DESC';
  const episodes = db.prepare(query).all(...params);
  res.json(episodes);
});

app.post('/api/episodes', (req, res) => {
  const id = uuid();
  const { patient_id, clinic_id, surgeon_id, surgery_type, surgery_date, surgery_location } = req.body;
  
  db.prepare(`
    INSERT INTO episodes (id, patient_id, clinic_id, surgeon_id, surgery_type, surgery_date, surgery_location)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, patient_id, clinic_id, surgeon_id, surgery_type, surgery_date, surgery_location);
  
  // Auto-generate PROM collection schedule
  generatePromSchedule(id, patient_id, clinic_id, surgery_type, surgery_date);
  
  // Auto-create pre-op PT plan from default template
  const ptEpisodeId = autoCreatePtPlan(id, patient_id, surgery_type, surgeon_id, surgery_date);
  
  // Log episode creation for audit
  logAudit(surgeon_id, 'episode_created', 'episodes', id, { patient_id, surgery_type, surgery_date, pt_episode_id: ptEpisodeId });
  
  res.json({ id, pt_episode_id: ptEpisodeId, success: true });
});

app.put('/api/episodes/:id', (req, res) => {
  const { surgeon_id, surgery_type, surgery_date, surgery_location, status,
          procedure_category, case_type, is_partial, has_malignancy,
          discharge_status, simultaneous_device_removal } = req.body;
  
  // Build dynamic update to only set provided fields
  const updates = [];
  const vals = [];
  if (surgeon_id !== undefined) { updates.push('surgeon_id = ?'); vals.push(surgeon_id); }
  if (surgery_type !== undefined) { updates.push('surgery_type = ?'); vals.push(surgery_type); }
  if (surgery_date !== undefined) { updates.push('surgery_date = ?'); vals.push(surgery_date); }
  if (surgery_location !== undefined) { updates.push('surgery_location = ?'); vals.push(surgery_location); }
  if (status !== undefined) { updates.push('status = ?'); vals.push(status); }
  if (procedure_category !== undefined) { updates.push('procedure_category = ?'); vals.push(procedure_category); }
  if (case_type !== undefined) { updates.push('case_type = ?'); vals.push(case_type); }
  if (is_partial !== undefined) { updates.push('is_partial = ?'); vals.push(is_partial ? 1 : 0); }
  if (has_malignancy !== undefined) { updates.push('has_malignancy = ?'); vals.push(has_malignancy ? 1 : 0); }
  if (discharge_status !== undefined) { updates.push('discharge_status = ?'); vals.push(discharge_status); }
  if (simultaneous_device_removal !== undefined) { updates.push('simultaneous_device_removal = ?'); vals.push(simultaneous_device_removal ? 1 : 0); }
  
  if (updates.length === 0) return res.json({ success: false, error: 'No fields to update' });
  
  vals.push(req.params.id);
  db.prepare(`UPDATE episodes SET ${updates.join(', ')} WHERE id = ?`).run(...vals);
  
  res.json({ success: true });
});

// ============ STAGE TRACKING API ROUTES ============

app.get('/api/stage-definitions', (req, res) => {
  res.json(EPISODE_STAGES);
});

app.get('/api/episodes/:id/stage', (req, res) => {
  const episode = db.prepare(
    'SELECT id, patient_id, episode_stage, stage_data, stage_updated_at, surgery_date FROM episodes WHERE id = ?'
  ).get(req.params.id);
  if (!episode) return res.status(404).json({ error: 'Episode not found' });

  let stageData = {};
  try { stageData = JSON.parse(episode.stage_data || '{}'); } catch(e) {}

  const currentStage = episode.episode_stage || 'intake';
  const currentIdx = getStageIndex(currentStage);

  const stages = EPISODE_STAGES.map((s, idx) => {
    const completed = stageData[s.key] && stageData[s.key].completed_at;
    const autoComplete = !completed && detectStageCompletion(episode.id, episode.patient_id, s.key);
    let status;
    if (completed) { status = 'completed'; }
    else if (idx === currentIdx) { status = 'current'; }
    else if (idx < currentIdx) { status = 'completed'; }
    else { status = 'upcoming'; }

    return {
      key: s.key, label: s.label, icon: s.icon, description: s.description, page: s.page,
      status: status, auto_completable: autoComplete,
      completed_at: stageData[s.key] ? stageData[s.key].completed_at : null,
      completed_by: stageData[s.key] ? stageData[s.key].completed_by : null
    };
  });

  res.json({
    episode_id: episode.id, current_stage: currentStage,
    current_stage_index: currentIdx, surgery_date: episode.surgery_date, stages: stages
  });
});

app.post('/api/episodes/:id/advance-stage', (req, res) => {
  const { completed_by } = req.body;
  const episode = db.prepare('SELECT id, patient_id, episode_stage, stage_data FROM episodes WHERE id = ?').get(req.params.id);
  if (!episode) return res.status(404).json({ error: 'Episode not found' });

  const currentStage = episode.episode_stage || 'intake';
  const currentIdx = getStageIndex(currentStage);
  if (currentIdx >= STAGE_ORDER.length - 1) return res.status(400).json({ error: 'Already at final stage' });

  const nextStage = STAGE_ORDER[currentIdx + 1];
  let stageData = {};
  try { stageData = JSON.parse(episode.stage_data || '{}'); } catch(e) {}
  stageData[currentStage] = { completed_at: new Date().toISOString(), completed_by: completed_by || null };

  db.prepare('UPDATE episodes SET episode_stage = ?, stage_data = ?, stage_updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(nextStage, JSON.stringify(stageData), req.params.id);

  res.json({ success: true, previous_stage: currentStage, current_stage: nextStage, stage_data: stageData });
});

app.post('/api/episodes/:id/set-stage', (req, res) => {
  const { stage, completed_by, reason } = req.body;
  if (!STAGE_ORDER.includes(stage)) return res.status(400).json({ error: 'Invalid stage' });

  const episode = db.prepare('SELECT id, patient_id, episode_stage, stage_data FROM episodes WHERE id = ?').get(req.params.id);
  if (!episode) return res.status(404).json({ error: 'Episode not found' });

  const currentStage = episode.episode_stage || 'intake';
  const targetIdx = getStageIndex(stage);
  const currentIdx = getStageIndex(currentStage);

  let stageData = {};
  try { stageData = JSON.parse(episode.stage_data || '{}'); } catch(e) {}

  for (let i = 0; i < targetIdx; i++) {
    const priorStage = STAGE_ORDER[i];
    if (!stageData[priorStage]) {
      stageData[priorStage] = {
        completed_at: new Date().toISOString(), completed_by: completed_by || null,
        skipped: i >= currentIdx, skip_reason: i >= currentIdx ? (reason || 'Clinician override') : undefined
      };
    }
  }

  db.prepare('UPDATE episodes SET episode_stage = ?, stage_data = ?, stage_updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(stage, JSON.stringify(stageData), req.params.id);

  res.json({ success: true, previous_stage: currentStage, current_stage: stage, stage_data: stageData });
});

app.post('/api/episodes/:id/complete-stage', (req, res) => {
  const { completed_by } = req.body;
  const episode = db.prepare('SELECT id, episode_stage, stage_data FROM episodes WHERE id = ?').get(req.params.id);
  if (!episode) return res.status(404).json({ error: 'Episode not found' });

  const currentStage = episode.episode_stage || 'intake';
  let stageData = {};
  try { stageData = JSON.parse(episode.stage_data || '{}'); } catch(e) {}
  stageData[currentStage] = { completed_at: new Date().toISOString(), completed_by: completed_by || null };

  db.prepare('UPDATE episodes SET stage_data = ?, stage_updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(JSON.stringify(stageData), req.params.id);

  res.json({ success: true, stage: currentStage, stage_data: stageData });
});

// --- Check-ins ---
app.get('/api/checkins', (req, res) => {
  const { patient_id, episode_id, clinic_id, start_date, end_date } = req.query;
  let query = 'SELECT * FROM checkins WHERE 1=1';
  const params = [];
  
  if (patient_id) { query += ' AND patient_id = ?'; params.push(patient_id); }
  if (episode_id) { query += ' AND episode_id = ?'; params.push(episode_id); }
  if (clinic_id) { query += ' AND clinic_id = ?'; params.push(clinic_id); }
  if (start_date) { query += ' AND checkin_date >= ?'; params.push(start_date); }
  if (end_date) { query += ' AND checkin_date <= ?'; params.push(end_date); }
  
  query += ' ORDER BY checkin_date DESC, created_at DESC';
  const checkins = db.prepare(query).all(...params);
  res.json(checkins);
});

app.post('/api/checkins', (req, res) => {
  const id = uuid();
  const { 
    patient_id, episode_id, clinic_id, checkin_type, checkin_date,
    pain_level, pain_location, pt_exercises, medication_taken, swelling, concerns, notes 
  } = req.body;
  
  db.prepare(`
    INSERT INTO checkins (id, patient_id, episode_id, clinic_id, checkin_type, checkin_date,
                          pain_level, pain_location, pt_exercises, medication_taken, swelling, concerns, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, patient_id, episode_id, clinic_id, checkin_type || 'daily', checkin_date,
         pain_level, pain_location, pt_exercises ? 1 : 0, medication_taken ? 1 : 0, swelling, concerns, notes);
  
  res.json({ id, success: true });
});

// --- PRO Assessments ---
app.get('/api/pro-assessments', (req, res) => {
  const { patient_id, episode_id, assessment_type } = req.query;
  let query = 'SELECT * FROM pro_assessments WHERE 1=1';
  const params = [];
  
  if (patient_id) { query += ' AND patient_id = ?'; params.push(patient_id); }
  if (episode_id) { query += ' AND episode_id = ?'; params.push(episode_id); }
  if (assessment_type) { query += ' AND assessment_type = ?'; params.push(assessment_type); }
  
  query += ' ORDER BY assessment_date DESC';
  const assessments = db.prepare(query).all(...params);
  res.json(assessments);
});

app.post('/api/pro-assessments', (req, res) => {
  const id = uuid();
  const { patient_id, episode_id, clinic_id, assessment_type, assessment_date, score, responses } = req.body;
  
  db.prepare(`
    INSERT INTO pro_assessments (id, patient_id, episode_id, clinic_id, assessment_type, assessment_date, score, responses)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, patient_id, episode_id, clinic_id, assessment_type, assessment_date, score, 
         typeof responses === 'object' ? JSON.stringify(responses) : responses);
  
  res.json({ id, success: true });
});

// --- Pre-Op Assessments ---
app.get('/api/preop-assessments', (req, res) => {
  const { patient_id, clinic_id, procedure_type } = req.query;
  let query = 'SELECT * FROM preop_assessments WHERE 1=1';
  const params = [];
  
  if (patient_id) { query += ' AND patient_id = ?'; params.push(patient_id); }
  if (clinic_id) { query += ' AND clinic_id = ?'; params.push(clinic_id); }
  if (procedure_type) { query += ' AND procedure_type = ?'; params.push(procedure_type); }
  
  query += ' ORDER BY assessed_at DESC';
  const assessments = db.prepare(query).all(...params);
  res.json(assessments);
});

app.get('/api/preop-assessments/:id', (req, res) => {
  const assessment = db.prepare('SELECT * FROM preop_assessments WHERE id = ?').get(req.params.id);
  if (!assessment) {
    return res.status(404).json({ error: 'Assessment not found' });
  }
  res.json(assessment);
});

// Surgery Not Indicated - update episode status
app.post('/api/episodes/not-indicated', (req, res) => {
  const { patient_id, clinic_id, status, reason } = req.body;
  if (!patient_id) return res.status(400).json({ error: 'patient_id required' });
  
  const episode = db.prepare(
    'SELECT id FROM episodes WHERE patient_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1'
  ).get(patient_id, 'active');
  
  if (episode) {
    db.prepare('UPDATE episodes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(status || 'not_indicated', episode.id);
    res.json({ success: true, episode_id: episode.id, status: status || 'not_indicated' });
  } else {
    // No active episode found, still return success (patient may not have episode yet)
    res.json({ success: true, message: 'No active episode found for patient' });
  }
});

app.post('/api/preop-assessments', (req, res) => {
  const id = uuid();
  const {
    patient_id, clinic_id, surgeon_id, assessment_type, procedure_type, planned_surgery_date,
    mortality_risk, readmission_risk, prolonged_los_risk, risk_tier,
    age, sex, bmi, asa_class, comorbidities,
    joint_score_type, joint_score_preop, projected_postop_score, expected_improvement,
    promis_physical_tscore, promis_mental_tscore,
    cms_back_pain, cms_health_literacy, cms_other_knee_pain, cms_other_hip_pain,
    low_back_pain, health_literacy_sils, total_painful_joint_count, chronic_narcotics_use,
    koos_jr_raw, hoos_jr_raw, surgeon_justification,
    status, intake_responses, comorb_data, workup_data
  } = req.body;
  
  db.prepare(`
    INSERT INTO preop_assessments (
      id, patient_id, clinic_id, surgeon_id, assessment_type, procedure_type, planned_surgery_date,
      mortality_risk, readmission_risk, prolonged_los_risk, risk_tier,
      age, sex, bmi, asa_class, comorbidities,
      joint_score_type, joint_score_preop, projected_postop_score, expected_improvement,
      promis_physical_tscore, promis_mental_tscore,
      cms_back_pain, cms_health_literacy, cms_other_knee_pain, cms_other_hip_pain,
      low_back_pain, health_literacy_sils, total_painful_joint_count, chronic_narcotics_use,
      koos_jr_raw, hoos_jr_raw, surgeon_justification,
      status, intake_responses, comorb_data, workup_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, patient_id, clinic_id, surgeon_id, assessment_type || 'preop', procedure_type, planned_surgery_date,
    mortality_risk, readmission_risk, prolonged_los_risk, risk_tier,
    age, sex, bmi, asa_class, Array.isArray(comorbidities) ? JSON.stringify(comorbidities) : comorbidities,
    joint_score_type, joint_score_preop, projected_postop_score, expected_improvement,
    promis_physical_tscore, promis_mental_tscore,
    cms_back_pain || low_back_pain ? 1 : 0, cms_health_literacy || null, cms_other_knee_pain ? 1 : 0, cms_other_hip_pain ? 1 : 0,
    low_back_pain ? 1 : 0, health_literacy_sils !== undefined ? health_literacy_sils : null,
    total_painful_joint_count || 0, chronic_narcotics_use ? 1 : 0,
    koos_jr_raw !== undefined ? koos_jr_raw : null, hoos_jr_raw !== undefined ? hoos_jr_raw : null,
    surgeon_justification || null,
    status || 'complete', intake_responses || null, comorb_data || null, workup_data || null
  );
  
  res.json({ id, success: true });
});

app.delete('/api/preop-assessments/:id', (req, res) => {
  db.prepare('DELETE FROM preop_assessments WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Update existing preop assessment (for draft save/edit)
app.put('/api/preop-assessments/:id', (req, res) => {
  const {
    procedure_type, planned_surgery_date, risk_tier,
    age, sex, bmi, asa_class, comorbidities,
    joint_score_type, joint_score_preop, projected_postop_score, expected_improvement,
    promis_physical_tscore, promis_mental_tscore,
    readmission_risk, mortality_risk,
    low_back_pain, health_literacy_sils, total_painful_joint_count, chronic_narcotics_use,
    koos_jr_raw, hoos_jr_raw, surgeon_justification,
    status, intake_responses, comorb_data, workup_data
  } = req.body;

  db.prepare(`
    UPDATE preop_assessments SET
      procedure_type=?, planned_surgery_date=?, risk_tier=?,
      age=?, sex=?, bmi=?, asa_class=?, comorbidities=?,
      joint_score_type=?, joint_score_preop=?, projected_postop_score=?, expected_improvement=?,
      promis_physical_tscore=?, promis_mental_tscore=?,
      readmission_risk=?, mortality_risk=?,
      low_back_pain=?, health_literacy_sils=?, total_painful_joint_count=?, chronic_narcotics_use=?,
      koos_jr_raw=?, hoos_jr_raw=?, surgeon_justification=?,
      status=?, intake_responses=?, comorb_data=?, workup_data=?,
      assessed_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    procedure_type, planned_surgery_date, risk_tier,
    age, sex, bmi, asa_class, Array.isArray(comorbidities) ? JSON.stringify(comorbidities) : comorbidities,
    joint_score_type, joint_score_preop, projected_postop_score, expected_improvement,
    promis_physical_tscore, promis_mental_tscore,
    readmission_risk, mortality_risk,
    low_back_pain ? 1 : 0, health_literacy_sils !== undefined ? health_literacy_sils : null,
    total_painful_joint_count || 0, chronic_narcotics_use ? 1 : 0,
    koos_jr_raw !== undefined ? koos_jr_raw : null, hoos_jr_raw !== undefined ? hoos_jr_raw : null,
    surgeon_justification || null,
    status || 'complete', intake_responses || null, comorb_data || null, workup_data || null,
    req.params.id
  );

  res.json({ id: req.params.id, success: true });
});

// Get pre-op and post-op comparison for a patient (SCB calculation)
app.get('/api/preop-postop-comparison/:patient_id', (req, res) => {
  const preop = db.prepare(`
    SELECT * FROM preop_assessments 
    WHERE patient_id = ? 
    ORDER BY assessed_at DESC 
    LIMIT 1
  `).get(req.params.patient_id);
  
  const postop = db.prepare(`
    SELECT * FROM pro_assessments 
    WHERE patient_id = ? 
    AND assessment_type IN ('koos_jr', 'hoos_jr')
    ORDER BY assessment_date DESC 
    LIMIT 1
  `).get(req.params.patient_id);
  
  if (!preop) {
    return res.json({ hasPreop: false });
  }
  
  const result = {
    hasPreop: true,
    preop: {
      date: preop.assessed_at,
      jointScore: preop.joint_score_preop,
      jointScoreType: preop.joint_score_type,
      riskTier: preop.risk_tier,
      projectedScore: preop.projected_postop_score,
      expectedImprovement: preop.expected_improvement
    }
  };
  
  if (postop) {
    const actualImprovement = postop.score - preop.joint_score_preop;
    const scbThreshold = preop.joint_score_type === 'koos_jr' ? SCB_KOOS_JR : SCB_HOOS_JR;
    
    result.hasPostop = true;
    result.postop = {
      date: postop.assessment_date,
      jointScore: postop.score,
      actualImprovement: actualImprovement,
      achievedSCB: actualImprovement >= scbThreshold,
      scbThreshold: scbThreshold
    };
  } else {
    result.hasPostop = false;
  }
  
  res.json(result);
});

// --- Cockpit Radial Patient View ---
app.get('/api/episodes/:id/cockpit', (req, res) => {
  const episode = db.prepare(`
    SELECT e.*, p.id as patient_id, p.first_name, p.last_name, p.mrn, p.date_of_birth
    FROM episodes e
    JOIN patients p ON e.patient_id = p.id
    WHERE e.id = ?
  `).get(req.params.id);
  
  if (!episode) {
    return res.status(404).json({ error: 'Episode not found' });
  }
  
  // Get cockpit sector items grouped by sector
  const sectorItems = db.prepare(`
    SELECT sector_id, item_text, item_status, item_icon, sort_order
    FROM cockpit_sector_items
    WHERE episode_id = ?
    ORDER BY sector_id, sort_order
  `).all(req.params.id);
  
  // Group items by sector
  const sectors = {};
  sectorItems.forEach(item => {
    if (!sectors[item.sector_id]) {
      sectors[item.sector_id] = [];
    }
    sectors[item.sector_id].push({
      icon: item.item_icon,
      status: item.item_status,
      text: item.item_text
    });
  });
  
  // Calculate patient age
  const age = episode.date_of_birth ? 
    Math.floor((new Date() - new Date(episode.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000)) : 
    null;
  
  // Get latest vitals from most recent check-in
  const lastCheckin = db.prepare(`
    SELECT pain_level, concerns, notes, checkin_date
    FROM checkins
    WHERE episode_id = ?
    ORDER BY checkin_date DESC LIMIT 1
  `).get(req.params.id);
  
  res.json({
    episode_id: req.params.id,
    patient: {
      name: `${episode.last_name}, ${episode.first_name}`,
      age: age,
      sex: 'M',
      mrn: episode.mrn,
      photo: '/img/patients/default-avatar.png',
      vitals: lastCheckin ? {
        hr: 82,
        bp: '132/78',
        temp: 98.6,
        spo2: 98,
        pain_level: lastCheckin.pain_level
      } : {
        hr: 82,
        bp: '132/78',
        temp: 98.6,
        spo2: 98,
        pain_level: null
      },
      alerts: []
    },
    episode_stage: episode.episode_stage || 'intake',
    surgery_type: episode.surgery_type,
    surgery_date: episode.surgery_date,
    sectors: sectors
  });
});

// --- Adverse Events (ER Visits, Readmissions) ---
app.get('/api/adverse-events', (req, res) => {
  const { patient_id, episode_id, clinic_id, event_type } = req.query;
  let query = 'SELECT * FROM adverse_events WHERE 1=1';
  const params = [];
  
  if (patient_id) { query += ' AND patient_id = ?'; params.push(patient_id); }
  if (episode_id) { query += ' AND episode_id = ?'; params.push(episode_id); }
  if (clinic_id) { query += ' AND clinic_id = ?'; params.push(clinic_id); }
  if (event_type) { query += ' AND event_type = ?'; params.push(event_type); }
  
  query += ' ORDER BY event_date DESC, created_at DESC';
  const events = db.prepare(query).all(...params);
  res.json(events);
});

app.post('/api/adverse-events', (req, res) => {
  const id = uuid();
  const { patient_id, episode_id, clinic_id, event_type, event_date, reported_by, facility, reason, notes } = req.body;
  
  db.prepare(`
    INSERT INTO adverse_events (id, patient_id, episode_id, clinic_id, event_type, event_date, reported_by, facility, reason, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, patient_id, episode_id, clinic_id, event_type, event_date, reported_by || 'patient', facility, reason, notes);
  
  res.json({ id, success: true });
});

app.put('/api/adverse-events/:id', (req, res) => {
  const { resolved, notes, resolved_by } = req.body;
  try {
    if (resolved) {
      // Try with new columns first, fall back to just resolved flag
      try {
        db.prepare('UPDATE adverse_events SET resolved = 1, resolved_at = CURRENT_TIMESTAMP, resolved_by = ?, notes = COALESCE(?, notes) WHERE id = ?').run(resolved_by || 'staff', notes, req.params.id);
      } catch(e) {
        db.prepare('UPDATE adverse_events SET resolved = 1, notes = COALESCE(?, notes) WHERE id = ?').run(notes, req.params.id);
      }
    } else {
      try {
        db.prepare('UPDATE adverse_events SET resolved = 0, resolved_at = NULL, resolved_by = NULL, notes = COALESCE(?, notes) WHERE id = ?').run(notes, req.params.id);
      } catch(e) {
        db.prepare('UPDATE adverse_events SET resolved = 0, notes = COALESCE(?, notes) WHERE id = ?').run(notes, req.params.id);
      }
    }
    res.json({ success: true });
  } catch(err) {
    console.error('Error updating adverse event:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Nurse Alert Acknowledgments ---
app.get('/api/nurse-acks', (req, res) => {
  const { clinic_id } = req.query;
  // Return only active (non-expired) acks
  const acks = db.prepare(`
    SELECT * FROM nurse_alert_acks 
    WHERE clinic_id = ? AND expires_at > CURRENT_TIMESTAMP
  `).all(clinic_id);
  res.json(acks);
});

app.post('/api/nurse-ack', (req, res) => {
  try {
    const id = uuid();
    const { patient_id, clinic_id, alert_type, acknowledged_by, hours, note } = req.body;
    const expiresAt = new Date(Date.now() + (hours || 24) * 60 * 60 * 1000).toISOString();
    db.prepare(`
      INSERT INTO nurse_alert_acks (id, patient_id, clinic_id, alert_type, acknowledged_by, expires_at, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, patient_id, clinic_id, alert_type, acknowledged_by || 'staff', expiresAt, note || null);
    res.json({ id, success: true });
  } catch(err) {
    console.error('Error creating nurse ack:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/nurse-ack/:id', (req, res) => {
  db.prepare('DELETE FROM nurse_alert_acks WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// --- Token-based adverse event (from patient check-in) ---
app.post('/api/adverse-event-by-token', (req, res) => {
  const { token, event_type, event_date, facility, reason } = req.body;
  
  if (!token) return res.status(400).json({ error: 'Token required' });
  
  const patient = db.prepare(`
    SELECT p.id as patient_id, p.clinic_id, e.id as episode_id
    FROM patients p
    LEFT JOIN episodes e ON e.patient_id = p.id AND e.status = 'active'
    WHERE p.token = ?
  `).get(token);
  
  if (!patient) return res.status(404).json({ error: 'Invalid token' });
  
  const id = uuid();
  db.prepare(`
    INSERT INTO adverse_events (id, patient_id, episode_id, clinic_id, event_type, event_date, reported_by, facility, reason)
    VALUES (?, ?, ?, ?, ?, ?, 'patient', ?, ?)
  `).run(id, patient.patient_id, patient.episode_id, patient.clinic_id, event_type, event_date, facility, reason);
  
  res.json({ id, success: true });
});

// --- PROM Schedule ---
app.get('/api/prom-schedule', (req, res) => {
  const { patient_id, episode_id, clinic_id, status, window_name } = req.query;
  let query = `
    SELECT ps.*, 
      p.first_name, p.last_name, p.mrn,
      e.surgery_type, e.surgery_date,
      u.first_name as surgeon_first, u.last_name as surgeon_last
    FROM prom_schedule ps
    JOIN patients p ON ps.patient_id = p.id
    LEFT JOIN episodes e ON ps.episode_id = e.id
    LEFT JOIN users u ON e.surgeon_id = u.id
    WHERE 1=1`;
  const params = [];
  
  if (patient_id) { query += ' AND ps.patient_id = ?'; params.push(patient_id); }
  if (episode_id) { query += ' AND ps.episode_id = ?'; params.push(episode_id); }
  if (clinic_id) { query += ' AND ps.clinic_id = ?'; params.push(clinic_id); }
  if (status) { query += ' AND ps.status = ?'; params.push(status); }
  if (window_name) { query += ' AND ps.window_name = ?'; params.push(window_name); }
  
  query += ' ORDER BY ps.due_date ASC';
  const schedule = db.prepare(query).all(...params);
  res.json(schedule);
});

// Mark a PROM schedule item as complete
app.put('/api/prom-schedule/:id/complete', (req, res) => {
  const { completed_date, pro_assessment_id } = req.body;
  db.prepare(`
    UPDATE prom_schedule SET status = 'completed', completed_date = ?, pro_assessment_id = ?
    WHERE id = ?
  `).run(completed_date || new Date().toISOString().split('T')[0], pro_assessment_id || null, req.params.id);
  res.json({ success: true });
});

// Mark a PROM schedule item as skipped
app.put('/api/prom-schedule/:id/skip', (req, res) => {
  db.prepare("UPDATE prom_schedule SET status = 'skipped' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// Generate schedule for existing episode (manual trigger)
app.post('/api/prom-schedule/generate', (req, res) => {
  const { episode_id } = req.body;
  const episode = db.prepare(`
    SELECT e.*, p.id as pid FROM episodes e JOIN patients p ON e.patient_id = p.id WHERE e.id = ?
  `).get(episode_id);
  
  if (!episode) return res.status(404).json({ error: 'Episode not found' });
  
  generatePromSchedule(episode.id, episode.patient_id, episode.clinic_id, episode.surgery_type, episode.surgery_date);
  res.json({ success: true });
});

// Auto-update overdue statuses
app.post('/api/prom-schedule/update-overdue', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const result = db.prepare(`
    UPDATE prom_schedule SET status = 'overdue'
    WHERE status = 'pending' AND window_close < ?
  `).run(today);
  res.json({ success: true, updated: result.changes });
});

// --- PROM Compliance Summary ---
app.get('/api/prom-compliance', (req, res) => {
  const { clinic_id } = req.query;
  const today = new Date().toISOString().split('T')[0];
  
  // First update overdue statuses
  db.prepare(`
    UPDATE prom_schedule SET status = 'overdue'
    WHERE status = 'pending' AND window_close < ? AND clinic_id = ?
  `).run(today, clinic_id);
  
  // Overall stats
  const total = db.prepare('SELECT COUNT(*) as count FROM prom_schedule WHERE clinic_id = ?').get(clinic_id);
  const completed = db.prepare("SELECT COUNT(*) as count FROM prom_schedule WHERE clinic_id = ? AND status = 'completed'").get(clinic_id);
  const overdue = db.prepare("SELECT COUNT(*) as count FROM prom_schedule WHERE clinic_id = ? AND status = 'overdue'").get(clinic_id);
  const pending = db.prepare("SELECT COUNT(*) as count FROM prom_schedule WHERE clinic_id = ? AND status = 'pending'").get(clinic_id);
  const due_soon = db.prepare(`
    SELECT COUNT(*) as count FROM prom_schedule 
    WHERE clinic_id = ? AND status = 'pending' AND due_date <= date(?, '+14 days')
  `).get(clinic_id, today);
  
  // Per-window breakdown
  const byWindow = db.prepare(`
    SELECT 
      window_name,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
    FROM prom_schedule WHERE clinic_id = ?
    GROUP BY window_name
    ORDER BY CASE window_name WHEN '6_week' THEN 1 WHEN '3_month' THEN 2 WHEN '1_year' THEN 3 END
  `).all(clinic_id);
  
  // Per-surgeon breakdown
  const bySurgeon = db.prepare(`
    SELECT 
      u.first_name || ' ' || u.last_name as surgeon_name,
      COUNT(*) as total,
      SUM(CASE WHEN ps.status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN ps.status = 'overdue' THEN 1 ELSE 0 END) as overdue
    FROM prom_schedule ps
    JOIN episodes e ON ps.episode_id = e.id
    JOIN users u ON e.surgeon_id = u.id
    WHERE ps.clinic_id = ?
    GROUP BY u.id
    ORDER BY u.last_name
  `).all(clinic_id);
  
  // Patients with overdue PROMs (for action list)
  const overduePatients = db.prepare(`
    SELECT DISTINCT
      p.id as patient_id,
      p.first_name, p.last_name, p.mrn, p.token,
      ps.assessment_type, ps.window_name, ps.due_date, ps.window_close,
      e.surgery_type
    FROM prom_schedule ps
    JOIN patients p ON ps.patient_id = p.id
    JOIN episodes e ON ps.episode_id = e.id
    WHERE ps.clinic_id = ? AND ps.status = 'overdue'
    ORDER BY ps.due_date ASC
    LIMIT 20
  `).all(clinic_id);
  
  // Patients with PROMs due in next 14 days
  const dueSoonPatients = db.prepare(`
    SELECT DISTINCT
      p.id as patient_id,
      p.first_name, p.last_name, p.mrn, p.token,
      ps.id as schedule_id, ps.assessment_type, ps.window_name, ps.due_date,
      e.surgery_type
    FROM prom_schedule ps
    JOIN patients p ON ps.patient_id = p.id
    JOIN episodes e ON ps.episode_id = e.id
    WHERE ps.clinic_id = ? AND ps.status = 'pending' AND ps.due_date <= date(?, '+14 days')
    ORDER BY ps.due_date ASC
    LIMIT 20
  `).all(clinic_id, today);
  
  res.json({
    total: total.count,
    completed: completed.count,
    overdue: overdue.count,
    pending: pending.count,
    due_soon: due_soon.count,
    compliance_rate: total.count > 0 ? Math.round((completed.count / total.count) * 100) : 0,
    by_window: byWindow,
    by_surgeon: bySurgeon,
    overdue_patients: overduePatients,
    due_soon_patients: dueSoonPatients
  });
});

// --- Score Conversion API ---
app.post('/api/score/koos-jr', (req, res) => {
  const { raw_sum } = req.body;
  const interval = convertKoosJrScore(raw_sum);
  res.json({ raw_sum, interval_score: interval, instrument: 'KOOS Jr', scb_threshold: SCB_KOOS_JR });
});

app.post('/api/score/hoos-jr', (req, res) => {
  const { raw_sum } = req.body;
  const interval = convertHoosJrScore(raw_sum);
  res.json({ raw_sum, interval_score: interval, instrument: 'HOOS Jr', scb_threshold: SCB_HOOS_JR });
});

app.get('/api/score/tables', (req, res) => {
  res.json({ koos_jr: KOOS_JR_TABLE, hoos_jr: HOOS_JR_TABLE, scb: { koos_jr: SCB_KOOS_JR, hoos_jr: SCB_HOOS_JR } });
});

// --- Nursing Notes ---
app.get('/api/nursing-notes', (req, res) => {
  const { patient_id, episode_id, clinic_id } = req.query;
  let query = `
    SELECT nn.*, u.first_name as author_first, u.last_name as author_last
    FROM nursing_notes nn
    LEFT JOIN users u ON nn.user_id = u.id
    WHERE 1=1`;
  const params = [];
  
  if (patient_id) { query += ' AND nn.patient_id = ?'; params.push(patient_id); }
  if (episode_id) { query += ' AND nn.episode_id = ?'; params.push(episode_id); }
  if (clinic_id) { query += ' AND nn.clinic_id = ?'; params.push(clinic_id); }
  
  query += ' ORDER BY nn.created_at DESC';
  const notes = db.prepare(query).all(...params);
  res.json(notes);
});

app.post('/api/nursing-notes', (req, res) => {
  const id = uuid();
  const { patient_id, episode_id, clinic_id, user_id, note_type, note_text } = req.body;
  
  db.prepare(`
    INSERT INTO nursing_notes (id, patient_id, episode_id, clinic_id, user_id, note_type, note_text)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, patient_id, episode_id, clinic_id, user_id, note_type, note_text);
  
  res.json({ id, success: true });
});

app.delete('/api/nursing-notes/:id', (req, res) => {
  db.prepare('DELETE FROM nursing_notes WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// --- Seed Demo Data ---
app.post('/api/seed-demo', (req, res) => {
  const clinicId = '11111111-1111-1111-1111-111111111111';
  
  // Get existing surgeons
  const surgeons = db.prepare('SELECT id FROM users WHERE clinic_id = ? AND role = ?').all(clinicId, 'surgeon');
  if (surgeons.length === 0) return res.status(400).json({ error: 'No surgeons found. Create surgeons first.' });
  
  const today = new Date();
  const fmt = (d) => d.toISOString().split('T')[0];
  const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return d; };
  
  const demoPatients = [
    { first: 'Maria', last: 'Rodriguez', mrn: '10001', dob: '1958-03-15', surgery: 'TKA', daysAgoSurgery: 7, surgeonIdx: 0, phone: '555-201-0001', email: 'maria.r@email.com' },
    { first: 'Robert', last: 'Thompson', mrn: '10002', dob: '1965-11-22', surgery: 'THA', daysAgoSurgery: 14, surgeonIdx: 1, phone: '555-201-0002', email: 'robert.t@email.com' },
    { first: 'Patricia', last: 'Chen', mrn: '10003', dob: '1972-07-08', surgery: 'TKA', daysAgoSurgery: 21, surgeonIdx: 0, phone: '555-201-0003', email: 'patricia.c@email.com' },
    { first: 'James', last: 'Williams', mrn: '10004', dob: '1955-01-30', surgery: 'Revision TKA', daysAgoSurgery: 3, surgeonIdx: 2, phone: '555-201-0004', email: 'james.w@email.com' },
    { first: 'Linda', last: 'Davis', mrn: '10005', dob: '1960-09-12', surgery: 'THA', daysAgoSurgery: 30, surgeonIdx: 1, phone: '555-201-0005', email: 'linda.d@email.com' },
    { first: 'Michael', last: 'Johnson', mrn: '10006', dob: '1968-05-25', surgery: 'TKA', daysAgoSurgery: 10, surgeonIdx: 2, phone: '555-201-0006', email: 'michael.j@email.com' }
  ];
  
  const insertPatient = db.prepare('INSERT OR IGNORE INTO patients (id, clinic_id, first_name, last_name, date_of_birth, email, phone, mrn, token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertEpisode = db.prepare('INSERT OR IGNORE INTO episodes (id, patient_id, clinic_id, surgeon_id, surgery_type, surgery_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insertCheckin = db.prepare('INSERT OR IGNORE INTO checkins (id, patient_id, episode_id, clinic_id, checkin_type, checkin_date, pain_level, pt_exercises, medication_taken, swelling, concerns, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertAdverse = db.prepare('INSERT OR IGNORE INTO adverse_events (id, patient_id, episode_id, clinic_id, event_type, event_date, reported_by, facility, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertPreop = db.prepare(`INSERT OR IGNORE INTO preop_assessments (id, patient_id, clinic_id, surgeon_id, procedure_type, planned_surgery_date, risk_tier, age, sex, bmi, asa_class, joint_score_type, joint_score_preop, projected_postop_score, expected_improvement, promis_physical_tscore, promis_mental_tscore, low_back_pain, health_literacy_sils, total_painful_joint_count, chronic_narcotics_use, koos_jr_raw, hoos_jr_raw) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  
  // Rasch conversion lookups for demo
  var KOOS_TABLE = {0:100,1:91.975,2:84.6,3:79.914,4:76.332,5:73.342,6:70.704,7:68.284,8:65.994,9:63.776,10:61.583,11:59.381,12:57.14,13:54.84,14:52.465,15:50.012,16:47.487,17:44.905,18:42.281,19:39.625,20:36.931,21:34.174,22:31.307,23:28.251,24:24.875,25:20.941,26:15.939,27:8.291,28:0};
  var HOOS_TABLE = {0:100,1:92.34,2:85.257,3:80.55,4:76.776,5:73.472,6:70.426,7:67.516,8:64.664,9:61.815,10:58.93,11:55.985,12:52.965,13:49.858,14:46.652,15:43.335,16:39.902,17:36.363,18:32.735,19:29.009,20:25.103,21:20.805,22:15.633,23:8.104,24:0};
  
  const transaction = db.transaction(() => {
    demoPatients.forEach((dp, idx) => {
      const patientId = `demo-patient-${idx + 1}`;
      const episodeId = `demo-episode-${idx + 1}`;
      const token = `demo${String(idx + 1).padStart(4, '0')}seed`;
      const surgeonId = surgeons[dp.surgeonIdx % surgeons.length].id;
      const surgeryDate = fmt(daysAgo(dp.daysAgoSurgery));
      
      // Patient
      insertPatient.run(patientId, clinicId, dp.first, dp.last, dp.dob, dp.email, dp.phone, dp.mrn, token);
      
      // Episode
      insertEpisode.run(episodeId, patientId, clinicId, surgeonId, dp.surgery, surgeryDate, 'active');
      
      // PreOp assessment with Rasch interval scoring
      const age = today.getFullYear() - parseInt(dp.dob.split('-')[0]);
      const scoreType = dp.surgery.includes('TH') ? 'hoos_jr' : 'koos_jr';
      // Typical pre-op raw: 15-22 for KOOS (moderate-severe), 12-18 for HOOS
      const rawScore = scoreType === 'koos_jr' ? (15 + Math.floor(Math.random() * 8)) : (12 + Math.floor(Math.random() * 7));
      const tbl = scoreType === 'koos_jr' ? KOOS_TABLE : HOOS_TABLE;
      const preScore = Math.round(tbl[rawScore] * 10) / 10;
      const scbThresh = scoreType === 'koos_jr' ? 20 : 22;
      const projectedImprovement = scbThresh + 5 + Math.floor(Math.random() * 8);
      const riskTier = preScore < 40 ? 'HIGH' : preScore < 55 ? 'MODERATE' : 'LOW';
      const demoLowBack = idx === 2 || idx === 3 ? 1 : 0;
      const demoLiteracy = idx === 4 ? 1 : 3;
      const demoOtherJoint = idx === 3 ? 3 : Math.floor(Math.random() * 2);
      const demoNarcotics = idx === 3 ? 1 : 0;
      insertPreop.run(`demo-preop-${idx+1}`, patientId, clinicId, surgeonId, dp.surgery, surgeryDate, riskTier, age, idx%2===0?'F':'M', 25+Math.random()*10, idx<3?2:3, scoreType, preScore, Math.min(preScore+projectedImprovement, 100), projectedImprovement, 35+Math.random()*15, 40+Math.random()*15, demoLowBack, demoLiteracy, demoOtherJoint, demoNarcotics, scoreType==='koos_jr'?rawScore:null, scoreType==='hoos_jr'?rawScore:null);
      
      // Checkins — generate realistic daily data
      const checkinDays = Math.min(dp.daysAgoSurgery, 14);
      for (let d = 0; d < checkinDays; d++) {
        // Skip some days for patients 3 and 4 (overdue/attention)
        if (idx === 3 && d > 0 && d < 3) continue; // James: gap in check-ins
        if (idx === 4 && d < 4) continue; // Linda: hasn't checked in recently
        
        const dayOffset = dp.daysAgoSurgery - d;
        const checkinDate = fmt(daysAgo(dayOffset));
        
        // Pain decreases over time, higher for revisions
        let basePain = dp.surgery.includes('Revision') ? 7 : 5;
        let pain = Math.max(1, Math.min(10, basePain - Math.floor(d * 0.4) + Math.floor(Math.random() * 2)));
        
        // Patient 1 (Maria): good recovery
        if (idx === 0) pain = Math.max(1, 5 - Math.floor(d * 0.5));
        // Patient 3 (James): high pain, recent revision
        if (idx === 3) pain = Math.min(10, 8 + Math.floor(Math.random() * 2));
        // Patient 5 (Michael): moderate but trending up (bad sign)
        if (idx === 5) pain = Math.min(10, 3 + Math.floor(d * 0.3) + Math.floor(Math.random() * 2));
        
        const ptDone = (idx === 3 || (idx === 5 && d > 5)) ? 0 : 1;
        const medTaken = d < 2 && idx === 4 ? 0 : 1;
        const swelling = pain >= 6 ? 'moderate' : pain >= 4 ? 'mild' : 'none';
        const concerns = (idx === 3 && d === checkinDays - 1) ? 'Fever or chills' : '';
        const rom = dp.surgery.includes('TK') ? `ROM: ${70 + d * 3}/${Math.max(0, 15 - d)}` : null;
        
        insertCheckin.run(
          `demo-checkin-${idx+1}-${d}`, patientId, episodeId, clinicId,
          'daily', checkinDate, pain, ptDone, medTaken, swelling, concerns, rom
        );
      }
      
      // Adverse events for specific patients
      // Patient 4 (James): ER visit 2 days ago
      if (idx === 3) {
        insertAdverse.run(`demo-adverse-1`, patientId, episodeId, clinicId, 'er_visit', fmt(daysAgo(2)), 'patient', 'Baptist Medical Center', 'High pain and swelling, concern about infection');
      }
      // Patient 5 (Linda): readmission 5 days ago
      if (idx === 4) {
        insertAdverse.run(`demo-adverse-2`, patientId, episodeId, clinicId, 'readmission', fmt(daysAgo(5)), 'staff', 'University Hospital', 'Wound drainage, possible surgical site infection');
      }
      
      // Generate PROM schedule for each patient
      generatePromSchedule(episodeId, patientId, clinicId, dp.surgery, surgeryDate);
    });
    
    // Now modify some PROM schedules for demo realism
    // Patient 3 (Patricia, 21 days post-op): her 6-week PROMs are coming due soon - leave as pending
    // Patient 5 (Linda, 30 days post-op): her 6-week PROMs should be due very soon
    // For patients with older surgeries, let's add some completed ones
    // We'll also add a couple patients with much older surgery dates for overdue demos
  });
  
  try {
    transaction();
    
    // Add 2 extra demo patients with older surgery dates to show overdue/completed PROMs
    const insertPatient2 = db.prepare('INSERT OR IGNORE INTO patients (id, clinic_id, first_name, last_name, date_of_birth, email, phone, mrn, token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const insertEpisode2 = db.prepare('INSERT OR IGNORE INTO episodes (id, patient_id, clinic_id, surgeon_id, surgery_type, surgery_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const insertPreop2 = db.prepare(`INSERT OR IGNORE INTO preop_assessments (id, patient_id, clinic_id, surgeon_id, procedure_type, planned_surgery_date, risk_tier, age, sex, bmi, asa_class, joint_score_type, joint_score_preop, projected_postop_score, expected_improvement, promis_physical_tscore, promis_mental_tscore, low_back_pain, health_literacy_sils, total_painful_joint_count, chronic_narcotics_use, koos_jr_raw, hoos_jr_raw) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    
    // Patient 7: 60 days post-op (6-week PROMs should be completed or overdue)
    const surgeonId7 = surgeons[0].id;
    const surgDate7 = fmt(daysAgo(60));
    insertPatient2.run('demo-patient-7', clinicId, 'Dorothy', 'Martinez', '1962-04-18', 'dorothy.m@email.com', '555-201-0007', '10007', 'demo0007seed');
    insertEpisode2.run('demo-episode-7', 'demo-patient-7', clinicId, surgeonId7, 'TKA', surgDate7, 'active');
    // KOOS Jr raw 16 → interval 47.5 (typical moderate pre-op TKA)
    insertPreop2.run('demo-preop-7', 'demo-patient-7', clinicId, surgeonId7, 'TKA', surgDate7, 'LOW', 63, 'F', 27.5, 2, 'koos_jr', 47.487, 72.5, 25, 42, 48, 0, 3, 1, 0, 16, null);
    generatePromSchedule('demo-episode-7', 'demo-patient-7', clinicId, 'TKA', surgDate7);
    // Mark her 6-week KOOS Jr as completed
    db.prepare("UPDATE prom_schedule SET status = 'completed', completed_date = ? WHERE id = ?").run(fmt(daysAgo(18)), 'demo-episode-7-6_week-koos_jr');
    // Leave 6-week PROMIS-10 as overdue (window_close passed but not completed)
    
    // Patient 8: 100 days post-op (6-week done, 3-month coming due)
    const surgeonId8 = surgeons[1 % surgeons.length].id;
    const surgDate8 = fmt(daysAgo(100));
    insertPatient2.run('demo-patient-8', clinicId, 'William', 'Garcia', '1957-08-30', 'william.g@email.com', '555-201-0008', '10008', 'demo0008seed');
    insertEpisode2.run('demo-episode-8', 'demo-patient-8', clinicId, surgeonId8, 'THA', surgDate8, 'active');
    // HOOS Jr raw 14 → interval 46.7 (typical moderate pre-op THA)
    insertPreop2.run('demo-preop-8', 'demo-patient-8', clinicId, surgeonId8, 'THA', surgDate8, 'MODERATE', 68, 'M', 31.2, 3, 'hoos_jr', 46.652, 71.5, 25, 38, 44, 1, 2, 2, 0, null, 14);
    generatePromSchedule('demo-episode-8', 'demo-patient-8', clinicId, 'THA', surgDate8);
    // Mark both 6-week PROMs as completed
    db.prepare("UPDATE prom_schedule SET status = 'completed', completed_date = ? WHERE id = ?").run(fmt(daysAgo(58)), 'demo-episode-8-6_week-hoos_jr');
    db.prepare("UPDATE prom_schedule SET status = 'completed', completed_date = ? WHERE id = ?").run(fmt(daysAgo(58)), 'demo-episode-8-6_week-promis_10');
    // 3-month PROMs are now in the due window - leave as pending
    
    // Seed clinic visits for today, yesterday, and tomorrow
    const todayStr = fmt(new Date());
    const yesterdayStr = fmt(daysAgo(1));
    const tomorrowStr = fmt(new Date(Date.now() + 86400000));
    const allDemo = db.prepare("SELECT p.id, e.id as episode_id, e.surgeon_id FROM patients p JOIN episodes e ON e.patient_id = p.id WHERE p.clinic_id = ?").all(clinicId);
    const vtTimes = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','13:00','13:30','14:00'];
    const vtTypes = ['follow_up','post_op','pre_op','follow_up','new_patient','injection','follow_up','post_op','follow_up','consult'];
    db.prepare("DELETE FROM clinic_visits WHERE clinic_id = ?").run(clinicId);
    const insVisit = db.prepare('INSERT OR IGNORE INTO clinic_visits (id, patient_id, episode_id, clinic_id, surgeon_id, visit_date, visit_time, visit_type, visit_status) VALUES (?,?,?,?,?,?,?,?,?)');
    [yesterdayStr, todayStr, tomorrowStr].forEach(function(vdate) {
      allDemo.forEach(function(dp, vi) {
        if (vi >= vtTimes.length) return;
        insVisit.run('visit-' + vdate + '-' + vi, dp.id, dp.episode_id, clinicId, dp.surgeon_id, vdate, vtTimes[vi], vtTypes[vi % vtTypes.length], vdate === yesterdayStr ? 'completed' : 'scheduled');
      });
    });

    res.json({ success: true, message: 'Seeded 8 demo patients with check-ins, preop assessments, adverse events, PROM schedules, and clinic visits.' });
  } catch (error) {
    console.error('Seed error:', error);
    res.json({ success: false, error: error.message });
  }
});

// Clear demo data
app.post('/api/clear-demo', (req, res) => {
  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM clinic_visits WHERE patient_id LIKE 'demo-%'").run();
    db.prepare("DELETE FROM pt_deviation_events WHERE patient_id LIKE 'demo-%'").run();
    db.prepare("DELETE FROM pt_daily_logs WHERE patient_id LIKE 'demo-%'").run();
    db.prepare("DELETE FROM pt_episodes WHERE patient_id LIKE 'demo-%'").run();
    db.prepare("DELETE FROM nursing_notes WHERE patient_id LIKE 'demo-%'").run();
    db.prepare("DELETE FROM prom_schedule WHERE episode_id LIKE 'demo-%'").run();
    db.prepare("DELETE FROM adverse_events WHERE id LIKE 'demo-%' OR patient_id LIKE 'demo-%'").run();
    db.prepare("DELETE FROM checkins WHERE id LIKE 'demo-%' OR patient_id LIKE 'demo-%'").run();
    db.prepare("DELETE FROM pro_assessments WHERE id LIKE 'demo-%' OR patient_id LIKE 'demo-%'").run();
    db.prepare("DELETE FROM preop_assessments WHERE id LIKE 'demo-%' OR patient_id LIKE 'demo-%'").run();
    db.prepare("DELETE FROM rpm_time_logs WHERE patient_id LIKE 'demo-%'").run();
    db.prepare("DELETE FROM surgical_prep WHERE patient_id LIKE 'demo-%'").run();
    db.prepare("DELETE FROM episodes WHERE id LIKE 'demo-%'").run();
    db.prepare("DELETE FROM patients WHERE id LIKE 'demo-%'").run();
  });
  
  try {
    transaction();
    res.json({ success: true, message: 'Demo data cleared.' });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// --- Surgical Prep ---

// --- CMS Compliance Reporting ---
// METHODOLOGY (per CMS final rule):
// PRO-PM: Medicare FFS, 65+, elective primary THA/TKA, Inpatient/HOPD/ASC, 50% matched rate (45% ASC)
// TEAM:   Medicare FFS, ALL ages (incl disability), LEJR + SHFFT + more, Inpatient/HOPD only, CBSA-specific
// Exclusions: Trauma/fracture (from LEJR), malignancy, revisions, partials, death during stay
// Pre-op window: 0-90 days before surgery | Post-op window: 300-425 days after surgery
// SCB: TKA >= +20 KOOS Jr | THA >= +22 HOOS Jr
// Risk vars: low back pain, health literacy (SILS), other joint pain, chronic narcotics >90d
// Matching vars: Medicare MBI, DOB, procedure date, procedure type
app.get('/api/cms-compliance', (req, res) => {
  const clinic_id = req.query.clinic_id || '11111111-1111-1111-1111-111111111111';
  const surgeon_id = req.query.surgeon_id || null;
  const program_filter = req.query.program_filter || 'pro_pm'; // 'pro_pm', 'team', 'all_payers'
  
  // Arkansas TEAM CBSAs (mandatory participation areas)
  const TEAM_CBSAS_AR = ['Batesville','Searcy','Harrison','Hot Springs','Camden','West Memphis'];
  const EXEMPT_CBSAS_AR = ['Little Rock','Conway','Fayetteville','Bentonville','Jonesboro'];
  
  // Get all patients with episodes
  let patientQuery = `
    SELECT p.id, p.first_name, p.last_name, p.date_of_birth, p.medicare_id, p.insurance_type,
           e.id as episode_id, e.surgery_type, e.surgery_date, e.surgeon_id, e.status as episode_status,
           e.surgery_location, e.procedure_category, e.case_type, e.is_partial,
           e.has_malignancy, e.discharge_status, e.simultaneous_device_removal,
           u.first_name as surgeon_first_name, u.last_name as surgeon_last_name
    FROM patients p
    LEFT JOIN episodes e ON e.patient_id = p.id
    LEFT JOIN users u ON e.surgeon_id = u.id
    WHERE p.clinic_id = ?
    AND e.surgery_type IN ('TKA','THA')
  `;
  const params = [clinic_id];
  if (surgeon_id) { patientQuery += ' AND e.surgeon_id = ?'; params.push(surgeon_id); }
  patientQuery += ' ORDER BY e.surgery_date DESC';
  
  let patients = db.prepare(patientQuery).all(...params);
  
  // Get all preop assessments
  const preops = db.prepare('SELECT * FROM preop_assessments WHERE clinic_id = ?').all(clinic_id);
  const preopByPatient = {};
  preops.forEach(p => {
    if (!preopByPatient[p.patient_id] || new Date(p.assessed_at) > new Date(preopByPatient[p.patient_id].assessed_at)) {
      preopByPatient[p.patient_id] = p;
    }
  });
  
  // Get all PRO assessments  
  const pros = db.prepare('SELECT * FROM pro_assessments WHERE clinic_id = ?').all(clinic_id);
  const prosByPatient = {};
  pros.forEach(p => {
    if (!prosByPatient[p.patient_id]) prosByPatient[p.patient_id] = [];
    prosByPatient[p.patient_id].push(p);
  });
  
  // Get adverse events
  const adverse = db.prepare('SELECT * FROM adverse_events WHERE clinic_id = ?').all(clinic_id);
  const adverseByPatient = {};
  adverse.forEach(a => {
    if (!adverseByPatient[a.patient_id]) adverseByPatient[a.patient_id] = [];
    adverseByPatient[a.patient_id].push(a);
  });

  // Get surgical_prep insurance data
  const surgPreps = db.prepare('SELECT patient_id, insurance_data FROM surgical_prep WHERE clinic_id = ?').all(clinic_id);
  const surgPrepByPatient = {};
  surgPreps.forEach(sp => { surgPrepByPatient[sp.patient_id] = sp; });
  
  // Build per-patient compliance records
  const records = patients.map(p => {
    const preop = preopByPatient[p.id] || null;
    const patientPros = prosByPatient[p.id] || [];
    const patientAdverse = adverseByPatient[p.id] || [];
    const surgPrep = surgPrepByPatient[p.id] || null;
    
    // Determine insurance from surgical_prep if not on patient record
    let insuranceType = p.insurance_type || null;
    let surgLocation = p.surgery_location || null;
    if (!insuranceType && surgPrep && surgPrep.insurance_data) {
      try {
        const ins = JSON.parse(surgPrep.insurance_data);
        insuranceType = ins.plan_type || ins.carrier || null;
        if (!surgLocation && ins.surgery_location) surgLocation = ins.surgery_location;
      } catch(e) {}
    }
    
    // Age calculation
    const age = p.date_of_birth ? Math.floor((new Date() - new Date(p.date_of_birth)) / (365.25*24*60*60*1000)) : null;
    
    // === ELIGIBILITY DETERMINATIONS ===
    const isMedicareFFS = insuranceType && (
      insuranceType === 'Medicare FFS' || insuranceType === 'medicare_ffs' ||
      insuranceType.toLowerCase() === 'medicare ffs'
    );
    const isMedicareAdvantage = insuranceType && (
      insuranceType === 'Medicare Advantage' || insuranceType === 'medicare_advantage' ||
      insuranceType.toLowerCase() === 'medicare advantage'
    );
    
    // === CMS EXCLUSION CHECKS ===
    const isRevision = p.procedure_category === 'revision';
    const isTrauma = p.case_type === 'trauma';
    const isPartial = p.is_partial === 1;
    const hasMalignancy = p.has_malignancy === 1;
    const diedDuringStay = p.discharge_status === 'death';
    const transferredAcute = p.discharge_status === 'transfer_acute';
    const hasDeviceRemoval = p.simultaneous_device_removal === 1;
    
    const hasClinicalExclusion = isRevision || isTrauma || isPartial || hasMalignancy || diedDuringStay || transferredAcute || hasDeviceRemoval;
    
    // PRO-PM: Medicare FFS + 65+ + elective primary THA/TKA + no clinical exclusions
    const isAge65Plus = age !== null && age >= 65;
    const isPROPMEligible = !!(isMedicareFFS && isAge65Plus && !hasClinicalExclusion);
    
    // TEAM: Medicare FFS + ANY age + elective primary THA/TKA + no clinical exclusions
    const isTEAMEligible = !!(isMedicareFFS && !hasClinicalExclusion);
    
    // Exclusion tracking for display
    const exclusions = [];
    if (isMedicareAdvantage) exclusions.push('Medicare Advantage');
    if (!isMedicareFFS && !isMedicareAdvantage && insuranceType) exclusions.push('Non-Medicare payer');
    if (!insuranceType) exclusions.push('Insurance not set');
    if (isRevision) exclusions.push('Revision procedure');
    if (isTrauma) exclusions.push('Trauma/fracture');
    if (isPartial) exclusions.push('Partial/unicompartmental');
    if (hasMalignancy) exclusions.push('Malignancy at surgical site');
    if (diedDuringStay) exclusions.push('Death during stay');
    if (transferredAcute) exclusions.push('Transfer to acute care');
    if (hasDeviceRemoval) exclusions.push('Simultaneous device removal');
    
    // Find pre-op PROM (within 90 days before surgery)
    const surgDate = p.surgery_date ? new Date(p.surgery_date) : null;
    let preopProm = null;
    let postopProm = null;
    
    const jointType = p.surgery_type === 'THA' ? 'hoos_jr' : 'koos_jr';
    const jointPros = patientPros.filter(pr => pr.assessment_type === jointType);
    
    if (surgDate) {
      const preWindow = new Date(surgDate); preWindow.setDate(preWindow.getDate() - 90);
      preopProm = jointPros.find(pr => {
        const d = new Date(pr.assessment_date);
        return d >= preWindow && d <= surgDate;
      });
      
      const postStart = new Date(surgDate); postStart.setDate(postStart.getDate() + 300);
      const postEnd = new Date(surgDate); postEnd.setDate(postEnd.getDate() + 425);
      postopProm = jointPros.find(pr => {
        const d = new Date(pr.assessment_date);
        return d >= postStart && d <= postEnd;
      });
    }
    
    // Risk variable completeness
    const hasLowBackPain = !!(preop && preop.low_back_pain !== null && preop.low_back_pain !== undefined);
    const hasHealthLiteracy = !!(preop && preop.health_literacy_sils !== null && preop.health_literacy_sils !== undefined);
    const hasOtherJointPain = !!(preop && (preop.cms_other_knee_pain !== null || preop.cms_other_hip_pain !== null || preop.total_painful_joint_count !== null));
    const hasNarcotics = !!(preop && preop.chronic_narcotics_use !== null && preop.chronic_narcotics_use !== undefined);
    const riskVarsComplete = hasLowBackPain && hasHealthLiteracy && hasOtherJointPain && hasNarcotics;
    const riskVarsCount = [hasLowBackPain, hasHealthLiteracy, hasOtherJointPain, hasNarcotics].filter(Boolean).length;
    
    // Matching variables
    const hasMedicareId = !!(p.medicare_id);
    const hasDOB = !!(p.date_of_birth);
    const hasSurgeryDate = !!(p.surgery_date);
    const hasSurgeryType = !!(p.surgery_type);
    const matchingVarsComplete = hasMedicareId && hasDOB && hasSurgeryDate && hasSurgeryType;
    const matchingVarsCount = [hasMedicareId, hasDOB, hasSurgeryDate, hasSurgeryType].filter(Boolean).length;
    
    // SCB
    let scbAchieved = null;
    let delta = null;
    const scbThreshold = p.surgery_type === 'THA' ? 22 : 20;
    if (preopProm && postopProm) {
      delta = postopProm.score - preopProm.score;
      scbAchieved = delta >= scbThreshold;
    }
    
    // Adverse events
    const erVisits = patientAdverse.filter(a => a.event_type === 'er_visit').length;
    const readmissions = patientAdverse.filter(a => a.event_type === 'readmission').length;
    
    // Post-op window status
    let postopWindowStatus = 'not_scheduled';
    let daysSinceSurg = null;
    if (surgDate) {
      const now = new Date();
      daysSinceSurg = Math.floor((now - surgDate) / (1000*60*60*24));
      if (daysSinceSurg < 0) postopWindowStatus = 'pre_surgery';
      else if (daysSinceSurg < 300) postopWindowStatus = 'recovery';
      else if (daysSinceSurg <= 425) postopWindowStatus = 'window_open';
      else postopWindowStatus = 'window_closed';
    }
    
    return {
      patient_id: p.id, first_name: p.first_name, last_name: p.last_name,
      dob: p.date_of_birth, age, medicare_id: p.medicare_id,
      insurance_type: insuranceType, surgery_location: surgLocation,
      episode_id: p.episode_id, surgery_type: p.surgery_type,
      surgery_date: p.surgery_date, surgeon_id: p.surgeon_id,
      surgeon_name: p.surgeon_last_name ? `Dr. ${p.surgeon_first_name} ${p.surgeon_last_name}` : null,
      is_pro_pm_eligible: isPROPMEligible, is_team_eligible: isTEAMEligible,
      is_medicare_ffs: !!isMedicareFFS, is_medicare_advantage: !!isMedicareAdvantage,
      is_age_65_plus: !!isAge65Plus, exclusions,
      // CMS exclusion details
      procedure_category: p.procedure_category || 'primary',
      case_type: p.case_type || 'elective',
      is_partial: !!isPartial,
      has_malignancy: !!hasMalignancy,
      discharge_status: p.discharge_status || null,
      simultaneous_device_removal: !!hasDeviceRemoval,
      has_clinical_exclusion: hasClinicalExclusion,
      has_preop_prom: !!preopProm, preop_prom_date: preopProm ? preopProm.assessment_date : null,
      preop_prom_score: preopProm ? preopProm.score : null,
      has_postop_prom: !!postopProm, postop_prom_date: postopProm ? postopProm.assessment_date : null,
      postop_prom_score: postopProm ? postopProm.score : null,
      postop_window_status: postopWindowStatus, days_since_surgery: daysSinceSurg,
      is_matched: !!(preopProm && postopProm),
      risk_vars: { low_back_pain: hasLowBackPain, health_literacy: hasHealthLiteracy, other_joint_pain: hasOtherJointPain, chronic_narcotics: hasNarcotics, complete: riskVarsComplete, count: riskVarsCount },
      matching_vars: { medicare_id: hasMedicareId, dob: hasDOB, surgery_date: hasSurgeryDate, surgery_type: hasSurgeryType, complete: matchingVarsComplete, count: matchingVarsCount },
      scb_achieved: scbAchieved, delta, scb_threshold: scbThreshold,
      er_visits: erVisits, readmissions,
      has_preop_assessment: !!preop,
      preop_data_complete: !!(preopProm && riskVarsComplete && matchingVarsComplete),
      risk_tier: preop ? preop.risk_tier : null,
      bmi: preop ? preop.bmi : null,
      asa_class: preop ? preop.asa_class : null
    };
  });
  
  // Apply program filter
  let filteredRecords = records;
  if (program_filter === 'pro_pm') {
    filteredRecords = records.filter(r => r.is_pro_pm_eligible);
  } else if (program_filter === 'team') {
    filteredRecords = records.filter(r => r.is_team_eligible);
  }
  
  // Aggregate
  const total = filteredRecords.length;
  const withPreop = filteredRecords.filter(r => r.has_preop_prom).length;
  const withPostop = filteredRecords.filter(r => r.has_postop_prom).length;
  const matched = filteredRecords.filter(r => r.is_matched).length;
  const riskComplete = filteredRecords.filter(r => r.risk_vars.complete).length;
  const matchComplete = filteredRecords.filter(r => r.matching_vars.complete).length;
  const scbYes = filteredRecords.filter(r => r.scb_achieved === true).length;
  const scbNo = filteredRecords.filter(r => r.scb_achieved === false).length;
  const scbEligible = scbYes + scbNo;
  const totalER = filteredRecords.reduce((s,r) => s + r.er_visits, 0);
  const totalReadmit = filteredRecords.reduce((s,r) => s + r.readmissions, 0);
  const patientsWithReadmit = filteredRecords.filter(r => r.readmissions > 0).length;
  
  // Cross-program and exclusion counts
  const clinicallyExcluded = records.filter(r => r.has_clinical_exclusion).length;
  const proPmCount = records.filter(r => r.is_pro_pm_eligible).length;
  const teamCount = records.filter(r => r.is_team_eligible).length;
  
  const surgeons = db.prepare("SELECT id, first_name, last_name FROM users WHERE clinic_id = ? AND role = 'surgeon'").all(clinic_id);
  
  res.json({
    methodology: {
      pro_pm: {
        payer: 'Medicare FFS only', age: '65+ years',
        procedures: 'Elective primary THA/TKA',
        settings: 'Inpatient, HOPD, ASC',
        threshold_inpatient: '50% matched', threshold_asc: '45% matched',
        penalty: '25% APU reduction on ALL Medicare reimbursement',
        scb_tka: '+20 KOOS Jr', scb_tha: '+22 HOOS Jr',
        preop_window: '0-90 days before surgery',
        postop_window: '300-425 days after surgery',
        excludes: ['Medicare Advantage','Trauma/fractures','Malignancy','Revisions','Partial joints','Death during stay']
      },
      team: {
        payer: 'Medicare FFS only', age: 'All ages (includes disability)',
        procedures: 'LEJR (THA/TKA) + SHFFT + Spinal Fusion + CABG + Major Bowel',
        settings: 'Inpatient and HOPD only (not ASC)',
        episode_window: '30 days post-discharge',
        quality_measures: ['Hybrid HWR (Readmission)','PSI 90 (Patient Safety)','THA/TKA PRO-PM'],
        py3_addition: 'Information Transfer PRO-PM (2028)',
        tracks: { 1: 'Upside only (PY1)', 2: 'Safety net/rural (PY2-5)', 3: 'Full risk/reward (all PYs)' },
        ar_mandatory_cbsas: TEAM_CBSAS_AR,
        ar_exempt_cbsas: EXEMPT_CBSAS_AR,
        low_volume_threshold: 'Fewer than 31 episodes = no downside risk',
        excludes: ['Medicare Advantage','Non-Medicare payers']
      },
      risk_variables: ['Low back pain','Health literacy (SILS-2)','Other joint pain','Chronic narcotics >90 days'],
      matching_variables: ['Medicare MBI','Date of birth','Procedure date','Procedure type']
    },
    summary: {
      program_filter,
      total_in_view: total,
      total_all_payers: records.length,
      total_clinically_excluded: clinicallyExcluded,
      total_pro_pm_eligible: proPmCount,
      total_team_eligible: teamCount,
      preop_captured: withPreop,
      preop_rate: total ? ((withPreop/total)*100).toFixed(1) : '0.0',
      postop_captured: withPostop,
      postop_rate: total ? ((withPostop/total)*100).toFixed(1) : '0.0',
      matched, matched_rate: total ? ((matched/total)*100).toFixed(1) : '0.0',
      risk_vars_complete: riskComplete,
      risk_vars_rate: total ? ((riskComplete/total)*100).toFixed(1) : '0.0',
      matching_vars_complete: matchComplete,
      matching_vars_rate: total ? ((matchComplete/total)*100).toFixed(1) : '0.0',
      scb_achieved: scbYes, scb_not_achieved: scbNo, scb_eligible: scbEligible,
      scb_rate: scbEligible ? ((scbYes/scbEligible)*100).toFixed(1) : '0.0',
      er_visits: totalER, readmissions: totalReadmit,
      readmission_rate: total ? ((patientsWithReadmit/total)*100).toFixed(1) : '0.0',
      pre_surgery_count: filteredRecords.filter(r => r.postop_window_status === 'pre_surgery').length,
      recovery_count: filteredRecords.filter(r => r.postop_window_status === 'recovery').length,
      window_open_count: filteredRecords.filter(r => r.postop_window_status === 'window_open').length,
      window_closed_count: filteredRecords.filter(r => r.postop_window_status === 'window_closed').length
    },
    records: filteredRecords,
    all_records: records,
    surgeons
  });
});


app.get('/api/surgical-prep', (req, res) => {
  const { patient_id, clinic_id } = req.query;
  let query = 'SELECT * FROM surgical_prep WHERE 1=1';
  const params = [];
  if (patient_id) { query += ' AND patient_id = ?'; params.push(patient_id); }
  if (clinic_id) { query += ' AND clinic_id = ?'; params.push(clinic_id); }
  query += ' ORDER BY updated_at DESC';
  res.json(db.prepare(query).all(...params));
});

app.post('/api/surgical-prep', (req, res) => {
  const id = uuid();
  const { patient_id, episode_id, clinic_id, contract_data, consent_data, history_data, insurance_data, prosthesis_data, contract_signed_at, consent_signed_at } = req.body;
  db.prepare(`INSERT INTO surgical_prep (id, patient_id, episode_id, clinic_id, contract_data, consent_data, history_data, insurance_data, prosthesis_data, contract_signed_at, consent_signed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, patient_id, episode_id, clinic_id,
    contract_data || null, consent_data || null, history_data || null, insurance_data || null, prosthesis_data || null,
    contract_signed_at || null, consent_signed_at || null
  );
  res.json({ id, success: true });
});

app.put('/api/surgical-prep/:id', (req, res) => {
  const { contract_data, consent_data, history_data, insurance_data, prosthesis_data, contract_signed_at, consent_signed_at } = req.body;
  db.prepare(`UPDATE surgical_prep SET contract_data=?, consent_data=?, history_data=?, insurance_data=?, prosthesis_data=?, contract_signed_at=?, consent_signed_at=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(
    contract_data || null, consent_data || null, history_data || null, insurance_data || null, prosthesis_data || null,
    contract_signed_at || null, consent_signed_at || null, req.params.id
  );
  res.json({ id: req.params.id, success: true });
});

// --- RPM Time Logs ---
app.get('/api/rpm-logs', (req, res) => {
  const { clinic_id, user_id, patient_id, billing_month } = req.query;
  let query = 'SELECT * FROM rpm_time_logs WHERE 1=1';
  const params = [];
  
  if (clinic_id) { query += ' AND clinic_id = ?'; params.push(clinic_id); }
  if (user_id) { query += ' AND user_id = ?'; params.push(user_id); }
  if (patient_id) { query += ' AND patient_id = ?'; params.push(patient_id); }
  if (billing_month) { query += ' AND billing_month = ?'; params.push(billing_month); }
  
  query += ' ORDER BY created_at DESC';
  const logs = db.prepare(query).all(...params);
  res.json(logs);
});

app.post('/api/rpm-logs', (req, res) => {
  const id = uuid();
  const { patient_id, episode_id, user_id, clinic_id, started_at, ended_at, duration_seconds, activity_type, notes } = req.body;
  
  const billingMonth = started_at ? started_at.substring(0, 7) : new Date().toISOString().substring(0, 7);
  
  db.prepare(`
    INSERT INTO rpm_time_logs (id, patient_id, episode_id, user_id, clinic_id, started_at, ended_at, duration_seconds, activity_type, notes, billing_month)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, patient_id, episode_id, user_id, clinic_id, started_at, ended_at, duration_seconds, activity_type, notes, billingMonth);
  
  res.json({ id, success: true });
});

// --- RPM Summary for Billing ---
app.get('/api/rpm-summary', (req, res) => {
  const { clinic_id, user_id, billing_month } = req.query;
  
  let query = `
    SELECT 
      p.id as patient_id,
      p.first_name as patient_first,
      p.last_name as patient_last,
      p.mrn,
      COUNT(DISTINCT r.id) as sessions,
      SUM(r.duration_seconds) as total_seconds
    FROM patients p
    LEFT JOIN rpm_time_logs r ON r.patient_id = p.id AND r.billing_month = ?
    LEFT JOIN episodes e ON e.patient_id = p.id AND e.status = 'active'
    WHERE p.clinic_id = ?
    AND e.id IS NOT NULL
    GROUP BY p.id
  `;
  const params = [billing_month, clinic_id];
  
  query += ' ORDER BY p.last_name, p.first_name';
  
  const summary = db.prepare(query).all(...params);
  
  const checkinQuery = db.prepare(`
    SELECT COUNT(DISTINCT checkin_date) as checkin_days
    FROM checkins
    WHERE patient_id = ?
    AND strftime('%Y-%m', checkin_date) = ?
  `);
  
  const staffTimeQuery = db.prepare(`
    SELECT 
      u.first_name || ' ' || u.last_name as staff_name,
      u.role,
      SUM(r.duration_seconds) as seconds
    FROM rpm_time_logs r
    JOIN users u ON r.user_id = u.id
    WHERE r.patient_id = ?
    AND r.billing_month = ?
    GROUP BY u.id
  `);
  
  const today = new Date();
  const currentMonth = today.toISOString().slice(0, 7);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeftInMonth = lastDayOfMonth - today.getDate();
  const isCurrentMonth = billing_month === currentMonth;
  
  const result = summary.map(row => {
    const checkinResult = checkinQuery.get(row.patient_id, billing_month);
    const checkinDays = checkinResult ? checkinResult.checkin_days : 0;
    const staffBreakdown = staffTimeQuery.all(row.patient_id, billing_month);
    
    const totalSeconds = row.total_seconds || 0;
    const totalMinutes = Math.round(totalSeconds / 60);
    const neededCheckins = Math.max(0, 16 - checkinDays);
    
    let daysStatus = '';
    let daysStatusCode = '';
    
    if (checkinDays >= 16) {
      daysStatus = '✅ Qualified';
      daysStatusCode = 'qualified';
    } else if (isCurrentMonth) {
      if (neededCheckins <= daysLeftInMonth) {
        daysStatus = `⚠️ Needs ${neededCheckins} more check-in${neededCheckins !== 1 ? 's' : ''}`;
        daysStatusCode = 'at-risk';
      } else {
        daysStatus = `🔴 Needs ${neededCheckins}, only ${daysLeftInMonth} days left`;
        daysStatusCode = 'wont-make-it';
      }
    } else {
      if (checkinDays >= 16) {
        daysStatus = '✅ Qualified';
        daysStatusCode = 'qualified';
      } else {
        daysStatus = `🔴 Only ${checkinDays}/16 days`;
        daysStatusCode = 'wont-make-it';
      }
    }
    
    return {
      ...row,
      total_seconds: totalSeconds,
      total_minutes: totalMinutes,
      checkin_days: checkinDays,
      needed_checkins: neededCheckins,
      days_left_in_month: isCurrentMonth ? daysLeftInMonth : 0,
      is_current_month: isCurrentMonth,
      days_status: daysStatus,
      days_status_code: daysStatusCode,
      staff_breakdown: staffBreakdown,
      cpt_99457_eligible: totalSeconds >= 1200 && checkinDays >= 16,
      cpt_99458_eligible: totalSeconds >= 2400 && checkinDays >= 16
    };
  });
  
  res.json(result);
});

// --- Dashboard Stats ---
app.get('/api/dashboard-stats', (req, res) => {
  const { clinic_id, surgeon_id } = req.query;
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  // Build surgeon filter clause
  const surgeonFilter = surgeon_id ? ' AND e.surgeon_id = ?' : '';
  const surgeonParams = surgeon_id ? [surgeon_id] : [];
  
  const activePatients = db.prepare(`
    SELECT COUNT(DISTINCT p.id) as count
    FROM patients p
    JOIN episodes e ON e.patient_id = p.id
    WHERE p.clinic_id = ? AND e.status = 'active'${surgeonFilter}
  `).get(clinic_id, ...surgeonParams);
  
  const checkedInToday = db.prepare(`
    SELECT COUNT(DISTINCT c.patient_id) as count
    FROM checkins c
    JOIN episodes e ON e.patient_id = c.patient_id AND e.status = 'active'
    WHERE c.clinic_id = ? AND c.checkin_date = ?${surgeonFilter}
  `).get(clinic_id, today, ...surgeonParams);
  
  const needsAttention = db.prepare(`
    SELECT COUNT(DISTINCT p.id) as count
    FROM patients p
    JOIN episodes e ON e.patient_id = p.id
    LEFT JOIN (
      SELECT patient_id, pain_level, pt_exercises,
             ROW_NUMBER() OVER (PARTITION BY patient_id ORDER BY checkin_date DESC) as rn
      FROM checkins
    ) c ON c.patient_id = p.id AND c.rn = 1
    WHERE p.clinic_id = ? AND e.status = 'active'${surgeonFilter}
    AND (c.pain_level >= 7 OR c.pt_exercises = 0)
  `).get(clinic_id, ...surgeonParams);
  
  const overdue = db.prepare(`
    SELECT COUNT(DISTINCT p.id) as count
    FROM patients p
    JOIN episodes e ON e.patient_id = p.id
    LEFT JOIN (
      SELECT patient_id, MAX(checkin_date) as last_checkin
      FROM checkins
      GROUP BY patient_id
    ) c ON c.patient_id = p.id
    WHERE p.clinic_id = ? AND e.status = 'active'${surgeonFilter}
    AND (c.last_checkin IS NULL OR c.last_checkin < ?)
  `).get(clinic_id, ...surgeonParams, sevenDaysAgo);
  
  const erVisits = db.prepare(`
    SELECT COUNT(*) as count FROM adverse_events ae
    JOIN episodes e ON e.patient_id = ae.patient_id AND e.status = 'active'
    WHERE ae.clinic_id = ? AND ae.event_type = 'er_visit'${surgeonFilter}
  `).get(clinic_id, ...surgeonParams);
  
  const readmissions = db.prepare(`
    SELECT COUNT(*) as count FROM adverse_events ae
    JOIN episodes e ON e.patient_id = ae.patient_id AND e.status = 'active'
    WHERE ae.clinic_id = ? AND ae.event_type = 'readmission'${surgeonFilter}
  `).get(clinic_id, ...surgeonParams);
  
  // Update overdue PROM statuses
  db.prepare(`
    UPDATE prom_schedule SET status = 'overdue'
    WHERE status = 'pending' AND window_close < ? AND clinic_id = ?
  `).run(today, clinic_id);
  
  const promsOverdue = db.prepare(`
    SELECT COUNT(*) as count FROM prom_schedule ps
    JOIN episodes e ON e.patient_id = ps.patient_id AND e.status = 'active'
    WHERE ps.clinic_id = ? AND ps.status = 'overdue'${surgeonFilter}
  `).get(clinic_id, ...surgeonParams);
  
  const promsDueSoon = db.prepare(`
    SELECT COUNT(*) as count FROM prom_schedule ps
    JOIN episodes e ON e.patient_id = ps.patient_id AND e.status = 'active'
    WHERE ps.clinic_id = ? AND ps.status = 'pending' AND ps.due_date <= date(?, '+14 days')${surgeonFilter}
  `).get(clinic_id, today, ...surgeonParams);
  
  res.json({
    active_patients: activePatients.count,
    checked_in_today: checkedInToday.count,
    needs_attention: needsAttention.count,
    overdue: overdue.count,
    er_visits: erVisits.count,
    readmissions: readmissions.count,
    proms_overdue: promsOverdue.count,
    proms_due_soon: promsDueSoon.count
  });
});

// --- Analytics ---
app.get('/api/analytics/surgeon-comparison', (req, res) => {
  const { clinic_id, start_date, end_date } = req.query;
  
  const comparison = db.prepare(`
    SELECT 
      u.id as surgeon_id,
      u.first_name,
      u.last_name,
      COUNT(DISTINCT e.id) as total_episodes,
      COUNT(DISTINCT p.id) as total_patients,
      AVG(c.pain_level) as avg_pain,
      AVG(CASE WHEN c.pt_exercises = 1 THEN 100.0 ELSE 0.0 END) as pt_compliance_rate
    FROM users u
    LEFT JOIN episodes e ON e.surgeon_id = u.id AND e.status = 'active'
    LEFT JOIN patients p ON e.patient_id = p.id
    LEFT JOIN checkins c ON c.episode_id = e.id
    WHERE u.clinic_id = ? AND u.role = 'surgeon'
    GROUP BY u.id
    ORDER BY u.last_name
  `).all(clinic_id);
  
  res.json(comparison);
});

// --- CMS Outcomes Report ---
app.get('/api/analytics/cms-outcomes', (req, res) => {
  const { clinic_id } = req.query;
  
  // Get all patients with preop assessments
  const patients = db.prepare(`
    SELECT 
      p.id, p.first_name, p.last_name, p.mrn, p.date_of_birth,
      e.id as episode_id, e.surgery_type, e.surgery_date, e.surgeon_id,
      u.first_name as surgeon_first, u.last_name as surgeon_last,
      pa.risk_tier, pa.joint_score_type, pa.joint_score_preop, 
      pa.projected_postop_score, pa.expected_improvement,
      pa.promis_physical_tscore, pa.promis_mental_tscore,
      pa.age, pa.sex, pa.bmi, pa.asa_class,
      pa.low_back_pain, pa.health_literacy_sils, pa.total_painful_joint_count, 
      pa.chronic_narcotics_use, pa.cms_back_pain, pa.cms_health_literacy
    FROM patients p
    JOIN episodes e ON e.patient_id = p.id
    JOIN users u ON e.surgeon_id = u.id
    LEFT JOIN preop_assessments pa ON pa.patient_id = p.id
    WHERE p.clinic_id = ?
    ORDER BY e.surgery_date DESC
  `).all(clinic_id);
  
  // For each patient, get latest post-op score
  const results = patients.map(pt => {
    const postop = db.prepare(`
      SELECT * FROM pro_assessments 
      WHERE patient_id = ? AND assessment_type IN ('koos_jr', 'hoos_jr')
      ORDER BY assessment_date DESC LIMIT 1
    `).get(pt.id);
    
    const postopPromis = db.prepare(`
      SELECT * FROM pro_assessments 
      WHERE patient_id = ? AND assessment_type = 'promis_10'
      ORDER BY assessment_date DESC LIMIT 1
    `).get(pt.id);
    
    const scbThreshold = pt.joint_score_type === 'koos_jr' ? SCB_KOOS_JR : SCB_HOOS_JR;
    const postopScore = postop ? postop.score : null;
    const delta = postopScore !== null && pt.joint_score_preop !== null ? postopScore - pt.joint_score_preop : null;
    const scbMet = delta !== null ? delta >= scbThreshold : null;
    
    return {
      mrn: pt.mrn,
      patient_name: `${pt.last_name}, ${pt.first_name}`,
      dob: pt.date_of_birth,
      age: pt.age,
      sex: pt.sex,
      bmi: pt.bmi ? Math.round(pt.bmi * 10) / 10 : null,
      asa_class: pt.asa_class,
      surgery_type: pt.surgery_type,
      surgery_date: pt.surgery_date,
      surgeon: `Dr. ${pt.surgeon_first} ${pt.surgeon_last}`,
      risk_tier: pt.risk_tier,
      score_type: pt.joint_score_type === 'koos_jr' ? 'KOOS Jr' : pt.joint_score_type === 'hoos_jr' ? 'HOOS Jr' : pt.joint_score_type,
      preop_score: pt.joint_score_preop,
      postop_score: postopScore,
      delta: delta,
      scb_threshold: scbThreshold,
      scb_met: scbMet,
      promis_physical_pre: pt.promis_physical_tscore,
      promis_mental_pre: pt.promis_mental_tscore,
      promis_physical_post: postopPromis ? postopPromis.physical_tscore : null,
      promis_mental_post: postopPromis ? postopPromis.mental_tscore : null,
      low_back_pain: pt.low_back_pain || pt.cms_back_pain || 0,
      health_literacy: pt.health_literacy_sils !== null ? pt.health_literacy_sils : pt.cms_health_literacy,
      total_painful_joint_count: pt.total_painful_joint_count || 0,
      chronic_narcotics_use: pt.chronic_narcotics_use || 0,
      has_postop: postopScore !== null
    };
  });
  
  // Summary stats
  const withPostop = results.filter(r => r.has_postop);
  const tkaResults = withPostop.filter(r => r.surgery_type && r.surgery_type.toUpperCase().includes('TKA'));
  const thaResults = withPostop.filter(r => r.surgery_type && (r.surgery_type.toUpperCase().includes('THA') || r.surgery_type.toUpperCase().includes('HIP')));
  
  const tkaScbRate = tkaResults.length > 0 ? Math.round((tkaResults.filter(r => r.scb_met).length / tkaResults.length) * 100) : null;
  const thaScbRate = thaResults.length > 0 ? Math.round((thaResults.filter(r => r.scb_met).length / thaResults.length) * 100) : null;
  const overallScbRate = withPostop.length > 0 ? Math.round((withPostop.filter(r => r.scb_met).length / withPostop.length) * 100) : null;
  
  // Per-surgeon SCB rates
  const surgeonMap = {};
  withPostop.forEach(r => {
    if (!surgeonMap[r.surgeon]) surgeonMap[r.surgeon] = { total: 0, scb: 0 };
    surgeonMap[r.surgeon].total++;
    if (r.scb_met) surgeonMap[r.surgeon].scb++;
  });
  const bySurgeon = Object.entries(surgeonMap).map(([name, d]) => ({
    surgeon: name, total: d.total, scb_met: d.scb, scb_rate: Math.round((d.scb / d.total) * 100)
  }));
  
  // Per risk tier
  const tierMap = {};
  withPostop.forEach(r => {
    const tier = r.risk_tier || 'UNKNOWN';
    if (!tierMap[tier]) tierMap[tier] = { total: 0, scb: 0 };
    tierMap[tier].total++;
    if (r.scb_met) tierMap[tier].scb++;
  });
  const byRiskTier = Object.entries(tierMap).map(([tier, d]) => ({
    tier, total: d.total, scb_met: d.scb, scb_rate: Math.round((d.scb / d.total) * 100)
  }));
  
  res.json({
    patients: results,
    summary: {
      total_episodes: results.length,
      with_preop: results.filter(r => r.preop_score !== null).length,
      with_postop: withPostop.length,
      completion_rate: results.length > 0 ? Math.round((withPostop.length / results.length) * 100) : 0,
      tka_scb_rate: tkaScbRate,
      tha_scb_rate: thaScbRate,
      overall_scb_rate: overallScbRate,
      avg_delta_tka: tkaResults.length > 0 ? Math.round(tkaResults.reduce((s, r) => s + r.delta, 0) / tkaResults.length) : null,
      avg_delta_tha: thaResults.length > 0 ? Math.round(thaResults.reduce((s, r) => s + r.delta, 0) / thaResults.length) : null
    },
    by_surgeon: bySurgeon,
    by_risk_tier: byRiskTier
  });
});

// ============ AUDIT LOG API ============

// Query audit logs (admin only)
app.get('/api/audit-logs', (req, res) => {
  const { user_id, action, resource_type, resource_id, start_date, end_date, limit: queryLimit } = req.query;
  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];
  
  if (user_id) { query += ' AND user_id = ?'; params.push(user_id); }
  if (action) { query += ' AND action = ?'; params.push(action); }
  if (resource_type) { query += ' AND resource_type = ?'; params.push(resource_type); }
  if (resource_id) { query += ' AND resource_id = ?'; params.push(resource_id); }
  if (start_date) { query += ' AND timestamp >= ?'; params.push(start_date); }
  if (end_date) { query += ' AND timestamp <= ?'; params.push(end_date); }
  
  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(parseInt(queryLimit) || 100);
  
  const logs = db.prepare(query).all(...params);
  res.json(logs);
});

// Explicit audit log entry (for login attempts, data exports, etc.)
app.post('/api/audit-log', (req, res) => {
  const { user_id, action, resource_type, resource_id, details } = req.body;
  logAudit(user_id, action, resource_type, resource_id, details,
           req.headers['x-forwarded-for'] || req.socket?.remoteAddress);
  res.json({ success: true });
});

// ============ PT ENGINE API ENDPOINTS ============

// --- PT Episodes ---
app.get('/api/pt-episodes', (req, res) => {
  const { patient_id, episode_id, status, phase } = req.query;
  let query = `
    SELECT pe.*, e.surgery_type, e.surgery_date,
      p.first_name, p.last_name, p.mrn,
      u.first_name as surgeon_first, u.last_name as surgeon_last
    FROM pt_episodes pe
    JOIN patients p ON pe.patient_id = p.id
    LEFT JOIN episodes e ON pe.episode_id = e.id
    LEFT JOIN users u ON pe.surgeon_id = u.id
    WHERE 1=1`;
  const params = [];
  
  if (patient_id) { query += ' AND pe.patient_id = ?'; params.push(patient_id); }
  if (episode_id) { query += ' AND pe.episode_id = ?'; params.push(episode_id); }
  if (status) { query += ' AND pe.status = ?'; params.push(status); }
  if (phase) { query += ' AND pe.phase = ?'; params.push(phase); }
  
  query += ' ORDER BY pe.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

app.get('/api/pt-episodes/:id', (req, res) => {
  const ptEp = db.prepare(`
    SELECT pe.*, e.surgery_type, e.surgery_date,
      p.first_name, p.last_name, p.mrn
    FROM pt_episodes pe
    JOIN patients p ON pe.patient_id = p.id
    LEFT JOIN episodes e ON pe.episode_id = e.id
    WHERE pe.id = ?
  `).get(req.params.id);
  if (!ptEp) return res.status(404).json({ error: 'PT episode not found' });
  
  // Include daily logs and deviations
  const logs = db.prepare('SELECT * FROM pt_daily_logs WHERE pt_episode_id = ? ORDER BY log_date DESC').all(req.params.id);
  const deviations = db.prepare('SELECT * FROM pt_deviation_events WHERE pt_episode_id = ? ORDER BY created_at DESC').all(req.params.id);
  
  res.json({ ...ptEp, daily_logs: logs, deviations });
});

app.post('/api/pt-episodes', (req, res) => {
  const id = uuid();
  const { episode_id, patient_id, phase, program_type, program_template, start_date,
          target_end_date, duration_weeks, surgeon_id, surgeon_notes, custom_exercises } = req.body;
  
  db.prepare(`
    INSERT INTO pt_episodes (id, episode_id, patient_id, phase, program_type, program_template,
      start_date, target_end_date, duration_weeks, surgeon_id, surgeon_notes, custom_exercises)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, episode_id, patient_id, phase, program_type || 'TKA', program_template || 'standard',
         start_date || new Date().toISOString().split('T')[0], target_end_date,
         duration_weeks || 4, surgeon_id, surgeon_notes,
         typeof custom_exercises === 'object' ? JSON.stringify(custom_exercises) : custom_exercises);
  
  res.json({ id, success: true });
});

app.put('/api/pt-episodes/:id', (req, res) => {
  const { status, surgeon_notes, custom_exercises, target_end_date, actual_end_date, duration_weeks } = req.body;
  const updates = [];
  const vals = [];
  
  if (status !== undefined) { updates.push('status = ?'); vals.push(status); }
  if (surgeon_notes !== undefined) { updates.push('surgeon_notes = ?'); vals.push(surgeon_notes); }
  if (custom_exercises !== undefined) { updates.push('custom_exercises = ?'); vals.push(typeof custom_exercises === 'object' ? JSON.stringify(custom_exercises) : custom_exercises); }
  if (target_end_date !== undefined) { updates.push('target_end_date = ?'); vals.push(target_end_date); }
  if (actual_end_date !== undefined) { updates.push('actual_end_date = ?'); vals.push(actual_end_date); }
  if (duration_weeks !== undefined) { updates.push('duration_weeks = ?'); vals.push(duration_weeks); }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  
  if (updates.length <= 1) return res.json({ success: false, error: 'No fields to update' });
  
  vals.push(req.params.id);
  db.prepare(`UPDATE pt_episodes SET ${updates.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ success: true });
});

// Transition pre-op → post-op (surgery date reached)
app.post('/api/pt-episodes/:id/transition', (req, res) => {
  const ptEp = db.prepare('SELECT * FROM pt_episodes WHERE id = ?').get(req.params.id);
  if (!ptEp) return res.status(404).json({ error: 'PT episode not found' });
  if (ptEp.phase !== 'pre-op') return res.status(400).json({ error: 'Can only transition pre-op episodes' });
  
  const today = new Date().toISOString().split('T')[0];
  
  // Complete the pre-op episode
  db.prepare(`
    UPDATE pt_episodes SET status = 'transitioned', actual_end_date = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(today, req.params.id);
  
  // Find the post-op template
  const template = db.prepare(`
    SELECT * FROM pt_program_templates
    WHERE program_type = ? AND phase = 'post-op' AND is_default = 1
    LIMIT 1
  `).get(ptEp.program_type);
  
  if (template) {
    const newId = uuid();
    const targetEnd = new Date(Date.now() + (template.duration_weeks || 12) * 7 * 86400000).toISOString().split('T')[0];
    
    db.prepare(`
      INSERT INTO pt_episodes (id, episode_id, patient_id, phase, program_type, program_template,
        start_date, target_end_date, duration_weeks, status, surgeon_id, custom_exercises)
      VALUES (?, ?, ?, 'post-op', ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(newId, ptEp.episode_id, ptEp.patient_id, ptEp.program_type, template.name,
           today, targetEnd, template.duration_weeks || 12, ptEp.surgeon_id, template.exercises);
    
    res.json({ success: true, old_id: req.params.id, new_id: newId, phase: 'post-op' });
  } else {
    res.json({ success: true, old_id: req.params.id, new_id: null, message: 'No post-op template found' });
  }
});

// --- PT Daily Logs ---
app.get('/api/pt-daily-logs', (req, res) => {
  const { patient_id, pt_episode_id, start_date, end_date } = req.query;
  let query = 'SELECT * FROM pt_daily_logs WHERE 1=1';
  const params = [];
  
  if (patient_id) { query += ' AND patient_id = ?'; params.push(patient_id); }
  if (pt_episode_id) { query += ' AND pt_episode_id = ?'; params.push(pt_episode_id); }
  if (start_date) { query += ' AND log_date >= ?'; params.push(start_date); }
  if (end_date) { query += ' AND log_date <= ?'; params.push(end_date); }
  
  query += ' ORDER BY log_date DESC';
  res.json(db.prepare(query).all(...params));
});

app.post('/api/pt-daily-logs', (req, res) => {
  const { pt_episode_id, patient_id, log_date, walking_minutes, exercises_completed,
          exercise_completion_pct, pt_session_attended, pain_score, pain_barrier,
          difficulty_notes, rom_flexion, rom_extension, source } = req.body;
  
  // Find active PT episode if not provided
  let ptEpId = pt_episode_id;
  if (!ptEpId && patient_id) {
    const active = db.prepare(`
      SELECT id FROM pt_episodes WHERE patient_id = ? AND status = 'active'
      ORDER BY created_at DESC LIMIT 1
    `).get(patient_id);
    ptEpId = active ? active.id : null;
  }
  
  if (!ptEpId) return res.status(400).json({ error: 'No active PT episode found' });
  
  const id = uuid();
  const logDateVal = log_date || new Date().toISOString().split('T')[0];
  
  try {
    db.prepare(`
      INSERT OR REPLACE INTO pt_daily_logs (id, pt_episode_id, patient_id, log_date, walking_minutes,
        exercises_completed, exercise_completion_pct, pt_session_attended, pain_score, pain_barrier,
        difficulty_notes, rom_flexion, rom_extension, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, ptEpId, patient_id, logDateVal, walking_minutes || null,
           typeof exercises_completed === 'object' ? JSON.stringify(exercises_completed) : exercises_completed,
           exercise_completion_pct || null, pt_session_attended ? 1 : 0, pain_score || null,
           pain_barrier ? 1 : 0, difficulty_notes || null, rom_flexion || null, rom_extension || null,
           source || 'patient');
    
    // Recalculate compliance
    const compliance = recalcPtCompliance(ptEpId);
    
    // Check deviation triggers
    checkPtDeviations(patient_id);
    
    res.json({ id, success: true, compliance });
  } catch (e) {
    // Handle UNIQUE constraint (upsert: update existing log for same episode+date)
    if (e.message.includes('UNIQUE')) {
      const existing = db.prepare('SELECT id FROM pt_daily_logs WHERE pt_episode_id = ? AND log_date = ?').get(ptEpId, logDateVal);
      if (existing) {
        db.prepare(`
          UPDATE pt_daily_logs SET walking_minutes=?, exercises_completed=?, exercise_completion_pct=?,
            pt_session_attended=?, pain_score=?, pain_barrier=?, difficulty_notes=?,
            rom_flexion=?, rom_extension=?, source=?
          WHERE id = ?
        `).run(walking_minutes || null,
               typeof exercises_completed === 'object' ? JSON.stringify(exercises_completed) : exercises_completed,
               exercise_completion_pct || null, pt_session_attended ? 1 : 0, pain_score || null,
               pain_barrier ? 1 : 0, difficulty_notes || null, rom_flexion || null, rom_extension || null,
               source || 'patient', existing.id);
        const compliance = recalcPtCompliance(ptEpId);
        return res.json({ id: existing.id, success: true, updated: true, compliance });
      }
    }
    res.status(500).json({ error: e.message });
  }
});

// --- PT Program Templates ---
app.get('/api/pt-templates', (req, res) => {
  const { program_type, phase, surgeon_id, is_default } = req.query;
  let query = 'SELECT * FROM pt_program_templates WHERE 1=1';
  const params = [];
  
  if (program_type) { query += ' AND program_type = ?'; params.push(program_type); }
  if (phase) { query += ' AND phase = ?'; params.push(phase); }
  if (surgeon_id) { query += ' AND (surgeon_id = ? OR is_default = 1)'; params.push(surgeon_id); }
  if (is_default !== undefined) { query += ' AND is_default = ?'; params.push(is_default === 'true' ? 1 : 0); }
  
  query += ' ORDER BY is_default DESC, name ASC';
  res.json(db.prepare(query).all(...params));
});

app.get('/api/pt-templates/:id', (req, res) => {
  const template = db.prepare('SELECT * FROM pt_program_templates WHERE id = ?').get(req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });
  res.json(template);
});

app.post('/api/pt-templates', (req, res) => {
  const id = uuid();
  const { name, program_type, phase, surgeon_id, exercises, walking_goal_start_min,
          walking_goal_end_min, duration_weeks, frequency_per_day } = req.body;
  
  db.prepare(`
    INSERT INTO pt_program_templates (id, name, program_type, phase, surgeon_id, is_default, exercises,
      walking_goal_start_min, walking_goal_end_min, duration_weeks, frequency_per_day)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
  `).run(id, name, program_type, phase, surgeon_id || null,
         typeof exercises === 'object' ? JSON.stringify(exercises) : exercises,
         walking_goal_start_min || 10, walking_goal_end_min || 30,
         duration_weeks || 4, frequency_per_day || 2);
  
  res.json({ id, success: true });
});

app.put('/api/pt-templates/:id', (req, res) => {
  const { name, exercises, walking_goal_start_min, walking_goal_end_min, duration_weeks, frequency_per_day } = req.body;
  const updates = [];
  const vals = [];
  
  if (name !== undefined) { updates.push('name = ?'); vals.push(name); }
  if (exercises !== undefined) { updates.push('exercises = ?'); vals.push(typeof exercises === 'object' ? JSON.stringify(exercises) : exercises); }
  if (walking_goal_start_min !== undefined) { updates.push('walking_goal_start_min = ?'); vals.push(walking_goal_start_min); }
  if (walking_goal_end_min !== undefined) { updates.push('walking_goal_end_min = ?'); vals.push(walking_goal_end_min); }
  if (duration_weeks !== undefined) { updates.push('duration_weeks = ?'); vals.push(duration_weeks); }
  if (frequency_per_day !== undefined) { updates.push('frequency_per_day = ?'); vals.push(frequency_per_day); }
  
  if (updates.length === 0) return res.json({ success: false, error: 'No fields to update' });
  
  vals.push(req.params.id);
  db.prepare(`UPDATE pt_program_templates SET ${updates.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ success: true });
});

app.delete('/api/pt-templates/:id', (req, res) => {
  // Don't delete default templates
  const template = db.prepare('SELECT is_default FROM pt_program_templates WHERE id = ?').get(req.params.id);
  if (template && template.is_default) {
    return res.status(400).json({ error: 'Cannot delete default templates' });
  }
  db.prepare('DELETE FROM pt_program_templates WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// --- PT Deviation Events ---
app.get('/api/pt-deviations', (req, res) => {
  const { patient_id, pt_episode_id, resolved, severity } = req.query;
  let query = `
    SELECT de.*, p.first_name, p.last_name, p.mrn,
      pe.phase, pe.program_type, pe.compliance_percentage
    FROM pt_deviation_events de
    JOIN patients p ON de.patient_id = p.id
    LEFT JOIN pt_episodes pe ON de.pt_episode_id = pe.id
    WHERE 1=1`;
  const params = [];
  
  if (patient_id) { query += ' AND de.patient_id = ?'; params.push(patient_id); }
  if (pt_episode_id) { query += ' AND de.pt_episode_id = ?'; params.push(pt_episode_id); }
  if (resolved !== undefined) { query += ' AND de.resolved = ?'; params.push(resolved === 'true' ? 1 : 0); }
  if (severity) { query += ' AND de.severity = ?'; params.push(severity); }
  
  query += ' ORDER BY de.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

app.put('/api/pt-deviations/:id/acknowledge', (req, res) => {
  const { acknowledged_by } = req.body;
  db.prepare(`
    UPDATE pt_deviation_events SET acknowledged = 1, acknowledged_by = ?, acknowledged_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(acknowledged_by || null, req.params.id);
  res.json({ success: true });
});

app.put('/api/pt-deviations/:id/resolve', (req, res) => {
  db.prepare(`
    UPDATE pt_deviation_events SET resolved = 1, resolved_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(req.params.id);
  res.json({ success: true });
});

// --- PT Precertification Summary ---
// Auto-populates conservative care documentation for precert letters
app.get('/api/pt-precert-summary/:episodeId', (req, res) => {
  const ptEpisodes = db.prepare(`
    SELECT * FROM pt_episodes WHERE episode_id = ? ORDER BY created_at ASC
  `).all(req.params.episodeId);
  
  if (ptEpisodes.length === 0) {
    return res.json({ has_pt_data: false });
  }
  
  // Build conservative care summary
  const summaries = ptEpisodes.map(pe => {
    const logCount = db.prepare('SELECT COUNT(*) as count FROM pt_daily_logs WHERE pt_episode_id = ?').get(pe.id).count;
    const avgCompletion = db.prepare('SELECT AVG(exercise_completion_pct) as avg FROM pt_daily_logs WHERE pt_episode_id = ?').get(pe.id).avg;
    
    return {
      phase: pe.phase,
      program_type: pe.program_type,
      program_name: pe.program_template,
      start_date: pe.start_date,
      end_date: pe.actual_end_date || pe.target_end_date,
      duration_weeks: pe.duration_weeks,
      status: pe.status,
      compliance_percentage: pe.compliance_percentage,
      total_exercise_days: pe.total_exercise_days,
      total_possible_days: pe.total_possible_days,
      logged_days: logCount,
      avg_completion_pct: avgCompletion ? Math.round(avgCompletion) : 0
    };
  });
  
  // Generate narrative for precert letter
  const preop = summaries.find(s => s.phase === 'pre-op' || s.phase === 'conservative');
  let narrative = '';
  if (preop) {
    narrative = `Patient completed a structured ${preop.duration_weeks}-week ${preop.phase === 'conservative' ? 'conservative therapy' : 'prehabilitation'} program (${preop.program_name}). `;
    narrative += `Exercise compliance was ${preop.compliance_percentage}% over ${preop.total_possible_days} days. `;
    if (preop.compliance_percentage >= 75) {
      narrative += 'Despite consistent participation in the prescribed rehabilitation program, symptoms persist and functional limitations remain, ';
    } else {
      narrative += 'The patient participated in the prescribed program. ';
    }
    narrative += 'supporting the medical necessity of surgical intervention.';
  }
  
  res.json({
    has_pt_data: true,
    episodes: summaries,
    narrative,
    total_weeks: summaries.reduce((s, e) => s + (e.duration_weeks || 0), 0)
  });
});

// --- PT KPIs (Aggregate compliance metrics) ---
app.get('/api/pt-kpis', (req, res) => {
  const { clinic_id, surgeon_id } = req.query;
  
  // All active PT episodes
  let activeQuery = `
    SELECT pe.* FROM pt_episodes pe
    JOIN patients p ON pe.patient_id = p.id
    WHERE pe.status = 'active' AND p.clinic_id = ?`;
  const params = [clinic_id || '11111111-1111-1111-1111-111111111111'];
  if (surgeon_id) { activeQuery += ' AND pe.surgeon_id = ?'; params.push(surgeon_id); }
  
  const activeEpisodes = db.prepare(activeQuery).all(...params);
  
  // Completed PT episodes (for preop completion rate)
  let completedQuery = `
    SELECT pe.* FROM pt_episodes pe
    JOIN patients p ON pe.patient_id = p.id
    WHERE pe.status IN ('completed', 'transitioned') AND pe.phase = 'pre-op' AND p.clinic_id = ?`;
  const cParams = [params[0]];
  if (surgeon_id) { completedQuery += ' AND pe.surgeon_id = ?'; cParams.push(surgeon_id); }
  
  const completedPreop = db.prepare(completedQuery).all(...cParams);
  
  // Unresolved deviations
  let devQuery = `
    SELECT de.* FROM pt_deviation_events de
    JOIN patients p ON de.patient_id = p.id
    WHERE de.resolved = 0 AND p.clinic_id = ?`;
  const dParams = [params[0]];
  const unresolvedDeviations = db.prepare(devQuery).all(...dParams);
  
  const avgCompliance = activeEpisodes.length > 0
    ? Math.round(activeEpisodes.reduce((s, e) => s + (e.compliance_percentage || 0), 0) / activeEpisodes.length)
    : 0;
  
  const preopCompletionRate = completedPreop.length > 0
    ? Math.round(completedPreop.filter(e => e.compliance_percentage >= 50).length / completedPreop.length * 100)
    : 0;
  
  res.json({
    active_pt_episodes: activeEpisodes.length,
    avg_compliance: avgCompliance,
    low_compliance_count: activeEpisodes.filter(e => (e.compliance_percentage || 0) < 50).length,
    critical_count: activeEpisodes.filter(e => e.flagged_status === 'critical').length,
    preop_completion_rate: preopCompletionRate,
    completed_preop_programs: completedPreop.length,
    unresolved_deviations: unresolvedDeviations.length,
    deviations_by_type: {
      critical: unresolvedDeviations.filter(d => d.severity === 'critical').length,
      warning: unresolvedDeviations.filter(d => d.severity === 'warning').length,
      info: unresolvedDeviations.filter(d => d.severity === 'info').length
    }
  });
});

// --- PT Compliance Recalc (manual trigger) ---
app.post('/api/pt-episodes/:id/recalc', (req, res) => {
  const result = recalcPtCompliance(req.params.id);
  if (result) {
    checkPtDeviations(db.prepare('SELECT patient_id FROM pt_episodes WHERE id = ?').get(req.params.id)?.patient_id);
    res.json({ success: true, ...result });
  } else {
    res.status(404).json({ error: 'PT episode not found or not active' });
  }
});

// ==================== NON-OP PLANS (Conservative Care Checklists) ====================

app.get('/api/nonop-plans', (req, res) => {
  const { patient_id, clinic_id, episode_id } = req.query;
  let sql = 'SELECT * FROM nonop_plans WHERE 1=1';
  const params = [];
  
  if (patient_id) { sql += ' AND patient_id = ?'; params.push(patient_id); }
  if (clinic_id) { sql += ' AND clinic_id = ?'; params.push(clinic_id); }
  if (episode_id) { sql += ' AND episode_id = ?'; params.push(episode_id); }
  
  sql += ' ORDER BY updated_at DESC';
  const plans = db.prepare(sql).all(...params);
  res.json(plans);
});

app.get('/api/nonop-plans/:id', (req, res) => {
  const plan = db.prepare('SELECT * FROM nonop_plans WHERE id = ?').get(req.params.id);
  res.json(plan);
});

app.post('/api/nonop-plans', (req, res) => {
  const id = uuid();
  const { patient_id, episode_id, clinic_id, joint, plan_data } = req.body;
  
  db.prepare(`
    INSERT INTO nonop_plans (id, patient_id, episode_id, clinic_id, joint, plan_data)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, patient_id, episode_id, clinic_id, joint, plan_data);
  
  res.json({ id, success: true });
});

app.put('/api/nonop-plans/:id', (req, res) => {
  const { joint, plan_data } = req.body;
  
  db.prepare(`
    UPDATE nonop_plans SET joint = ?, plan_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(joint, plan_data, req.params.id);
  
  res.json({ success: true });
});

// ==================== EXTERNAL PROVIDERS ====================

app.get('/api/external-providers', (req, res) => {
  const { clinic_id, type, active_only } = req.query;
  let sql = 'SELECT * FROM external_providers WHERE 1=1';
  const params = [];
  
  if (clinic_id) { sql += ' AND clinic_id = ?'; params.push(clinic_id); }
  if (type) { sql += ' AND provider_type = ?'; params.push(type); }
  if (active_only !== 'false') { sql += ' AND active = 1'; }
  sql += ' ORDER BY preferred DESC, name ASC';
  
  const providers = db.prepare(sql).all(...params);
  res.json(providers);
});

app.get('/api/external-providers/:id', (req, res) => {
  const provider = db.prepare('SELECT * FROM external_providers WHERE id = ?').get(req.params.id);
  res.json(provider);
});

app.post('/api/external-providers', (req, res) => {
  const id = uuid();
  const { clinic_id, provider_type, name, specialty, npi, tax_id, phone, fax, fax_alt, email,
          address_line1, address_line2, city, state, zip, preferred, accepts_medicare, 
          accepts_medicaid, notes } = req.body;
  
  db.prepare(`
    INSERT INTO external_providers (id, clinic_id, provider_type, name, specialty, npi, tax_id,
      phone, fax, fax_alt, email, address_line1, address_line2, city, state, zip,
      preferred, accepts_medicare, accepts_medicaid, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, clinic_id, provider_type, name, specialty, npi, tax_id, phone, fax, fax_alt, email,
         address_line1, address_line2, city, state, zip, preferred ? 1 : 0, 
         accepts_medicare !== false ? 1 : 0, accepts_medicaid !== false ? 1 : 0, notes);
  
  res.json({ id, success: true });
});

app.put('/api/external-providers/:id', (req, res) => {
  const fields = [];
  const values = [];
  
  const allowedFields = ['name', 'specialty', 'npi', 'tax_id', 'phone', 'fax', 'fax_alt', 'email',
    'address_line1', 'address_line2', 'city', 'state', 'zip', 'preferred', 'accepts_medicare',
    'accepts_medicaid', 'notes', 'active'];
  
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      fields.push(`${field} = ?`);
      values.push(typeof req.body[field] === 'boolean' ? (req.body[field] ? 1 : 0) : req.body[field]);
    }
  }
  
  if (fields.length === 0) return res.json({ success: true });
  
  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(req.params.id);
  
  db.prepare(`UPDATE external_providers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ success: true });
});

app.delete('/api/external-providers/:id', (req, res) => {
  db.prepare('UPDATE external_providers SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==================== ORDERS ====================

function generateOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seq = db.prepare(`SELECT COUNT(*) as cnt FROM orders WHERE order_number LIKE ?`).get(`ORD-${date}%`);
  const num = String((seq.cnt || 0) + 1).padStart(4, '0');
  return `ORD-${date}-${num}`;
}

app.get('/api/orders', (req, res) => {
  const { clinic_id, patient_id, episode_id, status, order_type } = req.query;
  let sql = `
    SELECT o.*, 
           p.first_name as patient_first_name, p.last_name as patient_last_name, p.mrn,
           ep.name as destination_provider_name, ep.fax as destination_fax,
           u.first_name as ordering_provider_first, u.last_name as ordering_provider_last
    FROM orders o
    LEFT JOIN patients p ON o.patient_id = p.id
    LEFT JOIN external_providers ep ON o.destination_provider_id = ep.id
    LEFT JOIN users u ON o.ordering_provider_id = u.id
    WHERE 1=1
  `;
  const params = [];
  
  if (clinic_id) { sql += ' AND o.clinic_id = ?'; params.push(clinic_id); }
  if (patient_id) { sql += ' AND o.patient_id = ?'; params.push(patient_id); }
  if (episode_id) { sql += ' AND o.episode_id = ?'; params.push(episode_id); }
  if (status) { sql += ' AND o.status = ?'; params.push(status); }
  if (order_type) { sql += ' AND o.order_type = ?'; params.push(order_type); }
  
  sql += ' ORDER BY o.created_at DESC';
  
  const orders = db.prepare(sql).all(...params);
  res.json(orders);
});

app.get('/api/orders/:id', (req, res) => {
  const order = db.prepare(`
    SELECT o.*, 
           p.first_name as patient_first_name, p.last_name as patient_last_name, 
           p.date_of_birth, p.mrn, p.phone as patient_phone,
           ep.name as provider_name, ep.fax as provider_fax, ep.address_line1, ep.city, ep.state, ep.zip,
           e.surgery_type, e.surgery_date
    FROM orders o
    LEFT JOIN patients p ON o.patient_id = p.id
    LEFT JOIN external_providers ep ON o.destination_provider_id = ep.id
    LEFT JOIN episodes e ON o.episode_id = e.id
    WHERE o.id = ?
  `).get(req.params.id);
  res.json(order);
});

app.post('/api/orders', (req, res) => {
  const id = uuid();
  const order_number = generateOrderNumber();
  const { clinic_id, patient_id, episode_id, order_type, order_subtype, description,
          clinical_indication, icd10_codes, cpt_codes, ordering_provider_id, ordering_provider_npi,
          destination_provider_id, order_details, priority, requires_auth, created_by } = req.body;
  
  db.prepare(`
    INSERT INTO orders (id, order_number, clinic_id, patient_id, episode_id, order_type, order_subtype,
      description, clinical_indication, icd10_codes, cpt_codes, ordering_provider_id, ordering_provider_npi,
      destination_provider_id, order_details, priority, requires_auth, created_by, status, ordered_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
  `).run(id, order_number, clinic_id, patient_id, episode_id, order_type, order_subtype,
         description, clinical_indication, 
         typeof icd10_codes === 'object' ? JSON.stringify(icd10_codes) : icd10_codes,
         typeof cpt_codes === 'object' ? JSON.stringify(cpt_codes) : cpt_codes,
         ordering_provider_id, ordering_provider_npi, destination_provider_id,
         typeof order_details === 'object' ? JSON.stringify(order_details) : order_details,
         priority || 'routine', requires_auth ? 1 : 0, created_by);
  
  res.json({ id, order_number, success: true });
});

app.put('/api/orders/:id', (req, res) => {
  const fields = [];
  const values = [];
  
  const allowedFields = ['status', 'destination_provider_id', 'order_details', 'priority',
    'auth_number', 'auth_status', 'signed_at', 'sent_at', 'acknowledged_at', 'completed_at'];
  
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      fields.push(`${field} = ?`);
      values.push(req.body[field]);
    }
  }
  
  if (fields.length === 0) return res.json({ success: true });
  
  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(req.params.id);
  
  db.prepare(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ success: true });
});

// ==================== FAX QUEUE ====================

app.get('/api/fax-queue', (req, res) => {
  const { clinic_id, status } = req.query;
  let sql = `
    SELECT fq.*, o.order_number, o.description as order_description,
           p.first_name, p.last_name
    FROM fax_queue fq
    LEFT JOIN orders o ON fq.order_id = o.id
    LEFT JOIN patients p ON o.patient_id = p.id
    WHERE 1=1
  `;
  const params = [];
  
  if (clinic_id) { sql += ' AND fq.clinic_id = ?'; params.push(clinic_id); }
  if (status) { sql += ' AND fq.status = ?'; params.push(status); }
  
  sql += ' ORDER BY fq.created_at DESC';
  
  const queue = db.prepare(sql).all(...params);
  res.json(queue);
});

app.post('/api/fax-queue', (req, res) => {
  const id = uuid();
  const { order_id, clinic_id, fax_number, fax_number_from, document_url, document_content } = req.body;
  
  db.prepare(`
    INSERT INTO fax_queue (id, order_id, clinic_id, fax_number, fax_number_from, 
      document_url, document_content, status, next_attempt_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', CURRENT_TIMESTAMP)
  `).run(id, order_id, clinic_id, fax_number, fax_number_from, document_url, document_content);
  
  res.json({ id, success: true });
});

app.put('/api/fax-queue/:id', (req, res) => {
  const { status, external_id, error_code, error_message, attempts } = req.body;
  
  const updates = ['updated_at = CURRENT_TIMESTAMP'];
  const values = [];
  
  if (status) { updates.push('status = ?'); values.push(status); }
  if (external_id) { updates.push('external_id = ?'); values.push(external_id); }
  if (error_code) { updates.push('error_code = ?'); values.push(error_code); }
  if (error_message) { updates.push('error_message = ?'); values.push(error_message); }
  if (attempts !== undefined) { updates.push('attempts = ?'); values.push(attempts); }
  
  if (status === 'delivered' || status === 'failed' || status === 'cancelled') {
    updates.push('completed_at = CURRENT_TIMESTAMP');
  }
  if (status === 'sending' || status === 'failed') {
    updates.push('last_attempt_at = CURRENT_TIMESTAMP');
  }
  
  values.push(req.params.id);
  db.prepare(`UPDATE fax_queue SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  
  // If failed and max retries reached, create nurse task
  if (status === 'failed') {
    const fax = db.prepare('SELECT * FROM fax_queue WHERE id = ?').get(req.params.id);
    if (fax && fax.attempts >= fax.max_attempts) {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(fax.order_id);
      if (order) {
        const taskId = uuid();
        db.prepare(`
          INSERT INTO nurse_tasks (id, clinic_id, patient_id, episode_id, order_id, fax_id,
            task_type, title, description, priority, status)
          VALUES (?, ?, ?, ?, ?, ?, 'fax_failed', ?, ?, 'high', 'pending')
        `).run(taskId, order.clinic_id, order.patient_id, order.episode_id, order.id, fax.id,
               `Fax failed: ${order.description}`,
               `Fax to ${fax.fax_number} failed after ${fax.attempts} attempts. Error: ${error_message || 'Unknown'}`);
      }
    }
  }
  
  res.json({ success: true });
});

// ==================== NURSE TASKS ====================

app.get('/api/nurse-tasks', (req, res) => {
  const { clinic_id, status, assigned_to, task_type } = req.query;
  let sql = `
    SELECT nt.*, 
           p.first_name as patient_first_name, p.last_name as patient_last_name,
           o.order_number, o.description as order_description
    FROM nurse_tasks nt
    LEFT JOIN patients p ON nt.patient_id = p.id
    LEFT JOIN orders o ON nt.order_id = o.id
    WHERE 1=1
  `;
  const params = [];
  
  if (clinic_id) { sql += ' AND nt.clinic_id = ?'; params.push(clinic_id); }
  if (status) { sql += ' AND nt.status = ?'; params.push(status); }
  if (assigned_to) { sql += ' AND nt.assigned_to = ?'; params.push(assigned_to); }
  if (task_type) { sql += ' AND nt.task_type = ?'; params.push(task_type); }
  
  sql += ' ORDER BY CASE nt.priority WHEN "urgent" THEN 1 WHEN "high" THEN 2 WHEN "normal" THEN 3 ELSE 4 END, nt.created_at ASC';
  
  const tasks = db.prepare(sql).all(...params);
  res.json(tasks);
});

app.get('/api/nurse-tasks/count', (req, res) => {
  const { clinic_id, status } = req.query;
  let sql = 'SELECT COUNT(*) as count FROM nurse_tasks WHERE 1=1';
  const params = [];
  
  if (clinic_id) { sql += ' AND clinic_id = ?'; params.push(clinic_id); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  
  const result = db.prepare(sql).get(...params);
  res.json({ count: result.count });
});

app.post('/api/nurse-tasks', (req, res) => {
  const id = uuid();
  const { clinic_id, patient_id, episode_id, order_id, fax_id, task_type, title, description,
          priority, assigned_to, due_date } = req.body;
  
  db.prepare(`
    INSERT INTO nurse_tasks (id, clinic_id, patient_id, episode_id, order_id, fax_id,
      task_type, title, description, priority, assigned_to, due_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(id, clinic_id, patient_id, episode_id, order_id, fax_id, task_type, title, description,
         priority || 'normal', assigned_to, due_date);
  
  res.json({ id, success: true });
});

app.put('/api/nurse-tasks/:id', (req, res) => {
  const { status, assigned_to, completion_notes, completed_by } = req.body;
  
  const updates = ['updated_at = CURRENT_TIMESTAMP'];
  const values = [];
  
  if (status) { 
    updates.push('status = ?'); 
    values.push(status);
    if (status === 'completed') {
      updates.push('completed_at = CURRENT_TIMESTAMP');
      if (completed_by) { updates.push('completed_by = ?'); values.push(completed_by); }
    }
  }
  if (assigned_to !== undefined) { updates.push('assigned_to = ?'); values.push(assigned_to); }
  if (completion_notes) { updates.push('completion_notes = ?'); values.push(completion_notes); }
  
  values.push(req.params.id);
  db.prepare(`UPDATE nurse_tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  
  res.json({ success: true });
});

// ==================== CONSERVATIVE CARE ITEMS ====================

app.get('/api/conservative-care-items', (req, res) => {
  const { patient_id, episode_id } = req.query;
  let sql = 'SELECT * FROM conservative_care_items WHERE 1=1';
  const params = [];
  
  if (patient_id) { sql += ' AND patient_id = ?'; params.push(patient_id); }
  if (episode_id) { sql += ' AND episode_id = ?'; params.push(episode_id); }
  
  sql += ' ORDER BY item_category, item_code';
  
  const items = db.prepare(sql).all(...params);
  res.json(items);
});

app.post('/api/conservative-care-items', (req, res) => {
  const { patient_id, episode_id, clinic_id, joint, item_category, item_code, item_name,
          status, order_id, start_date, end_date, duration_weeks, provider_name, notes,
          icd10_code, cpt_code } = req.body;
  
  // Upsert - check if exists
  const existing = db.prepare(`
    SELECT id FROM conservative_care_items 
    WHERE patient_id = ? AND item_code = ? AND joint = ?
  `).get(patient_id, item_code, joint);
  
  if (existing) {
    db.prepare(`
      UPDATE conservative_care_items SET
        status = ?, order_id = ?, start_date = ?, end_date = ?, duration_weeks = ?,
        provider_name = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, order_id, start_date, end_date, duration_weeks, provider_name, notes, existing.id);
    res.json({ id: existing.id, updated: true });
  } else {
    const id = uuid();
    db.prepare(`
      INSERT INTO conservative_care_items (id, patient_id, episode_id, clinic_id, joint,
        item_category, item_code, item_name, status, order_id, start_date, end_date,
        duration_weeks, provider_name, notes, icd10_code, cpt_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, patient_id, episode_id, clinic_id, joint, item_category, item_code, item_name,
           status || 'not_started', order_id, start_date, end_date, duration_weeks, 
           provider_name, notes, icd10_code, cpt_code);
    res.json({ id, created: true });
  }
});

// ==================== PRE-OP ORDERS API ====================
// GET /api/preop-orders - Get preop orders for a patient
app.get('/api/preop-orders', (req, res) => {
  const { patient_id, episode_id, clinic_id } = req.query;
  let sql = 'SELECT * FROM preop_orders WHERE 1=1';
  const params = [];
  
  if (patient_id) { sql += ' AND patient_id = ?'; params.push(patient_id); }
  if (episode_id) { sql += ' AND episode_id = ?'; params.push(episode_id); }
  if (clinic_id) { sql += ' AND clinic_id = ?'; params.push(clinic_id); }
  
  sql += ' ORDER BY created_at DESC';
  
  try {
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/preop-orders - Create or upsert a preop order
app.post('/api/preop-orders', (req, res) => {
  const { clinic_id, patient_id, episode_id, order_key, status, provider_name, notes } = req.body;
  
  if (!patient_id || !order_key) {
    return res.status(400).json({ error: 'patient_id and order_key required' });
  }
  
  try {
    // Check if exists
    const existing = db.prepare('SELECT id FROM preop_orders WHERE patient_id = ? AND order_key = ?').get(patient_id, order_key);
    
    if (existing) {
      // Update existing
      db.prepare(`
        UPDATE preop_orders SET 
          status = COALESCE(?, status),
          provider_name = COALESCE(?, provider_name),
          notes = COALESCE(?, notes),
          ordered_at = CASE WHEN ? IN ('ordered', 'received', 'cleared', 'completed') AND ordered_at IS NULL THEN CURRENT_TIMESTAMP ELSE ordered_at END,
          received_at = CASE WHEN ? IN ('received', 'cleared', 'conditional', 'not_cleared') AND received_at IS NULL THEN CURRENT_TIMESTAMP ELSE received_at END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(status, provider_name, notes, status, status, existing.id);
      
      const updated = db.prepare('SELECT * FROM preop_orders WHERE id = ?').get(existing.id);
      res.json(updated);
    } else {
      // Insert new
      const id = uuid();
      const now = new Date().toISOString();
      const ordered_at = ['ordered', 'received', 'cleared', 'completed'].includes(status) ? now : null;
      const received_at = ['received', 'cleared', 'conditional', 'not_cleared'].includes(status) ? now : null;
      
      db.prepare(`
        INSERT INTO preop_orders (id, clinic_id, patient_id, episode_id, order_key, status, provider_name, notes, ordered_at, received_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, clinic_id, patient_id, episode_id, order_key, status || 'pending', provider_name, notes, ordered_at, received_at);
      
      const created = db.prepare('SELECT * FROM preop_orders WHERE id = ?').get(id);
      res.json(created);
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/preop-orders/:id - Update a preop order
app.put('/api/preop-orders/:id', (req, res) => {
  const { id } = req.params;
  const { status, provider_name, notes } = req.body;
  
  try {
    const existing = db.prepare('SELECT * FROM preop_orders WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Preop order not found' });
    }
    
    db.prepare(`
      UPDATE preop_orders SET 
        status = COALESCE(?, status),
        provider_name = COALESCE(?, provider_name),
        notes = COALESCE(?, notes),
        ordered_at = CASE WHEN ? IN ('ordered', 'received', 'cleared', 'completed') AND ordered_at IS NULL THEN CURRENT_TIMESTAMP ELSE ordered_at END,
        received_at = CASE WHEN ? IN ('received', 'cleared', 'conditional', 'not_cleared') AND received_at IS NULL THEN CURRENT_TIMESTAMP ELSE received_at END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, provider_name, notes, status, status, id);
    
    const updated = db.prepare('SELECT * FROM preop_orders WHERE id = ?').get(id);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== SEED DEMO PT PROVIDERS ====================
const demoClinicForProviders = db.prepare('SELECT id FROM clinics LIMIT 1').get();
if (demoClinicForProviders) {
  const ptCount = db.prepare("SELECT COUNT(*) as c FROM external_providers WHERE provider_type = 'pt_clinic'").get().c;
  if (ptCount === 0) {
    const insertProvider = db.prepare(`
      INSERT INTO external_providers (id, clinic_id, provider_type, name, phone, fax, address_line1, city, state, zip, preferred)
      VALUES (?, ?, 'pt_clinic', ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertProvider.run(uuid(), demoClinicForProviders.id, 'Peak Performance PT', '501-555-0101', '501-555-0102', '100 Therapy Way', 'Little Rock', 'AR', '72201', 1);
    insertProvider.run(uuid(), demoClinicForProviders.id, 'Baptist Health Rehab', '501-555-0201', '501-555-0202', '200 Medical Center Dr', 'Little Rock', 'AR', '72205', 0);
    insertProvider.run(uuid(), demoClinicForProviders.id, 'ATI Physical Therapy', '501-555-0301', '501-555-0302', '300 Wellness Blvd', 'North Little Rock', 'AR', '72114', 0);
    console.log('Seeded 3 demo PT clinics');
  }
}

// --- Clinic Visits (Worklist) ---
app.get('/api/clinic-visits/dates', (req, res) => {
  const { clinic_id, month } = req.query;
  if (!clinic_id || !month) return res.json([]);
  const rows = db.prepare(
    "SELECT visit_date, COUNT(*) as visit_count FROM clinic_visits WHERE clinic_id = ? AND strftime('%Y-%m', visit_date) = ? GROUP BY visit_date ORDER BY visit_date"
  ).all(clinic_id, month);
  res.json(rows);
});

app.get('/api/clinic-visits', (req, res) => {
  const { clinic_id, visit_date, surgeon_id } = req.query;
  let query = `
    SELECT cv.*,
      p.first_name, p.last_name, p.mrn, p.date_of_birth,
      e.surgery_type, e.surgery_date, e.episode_stage, e.status as episode_status,
      u.first_name as surgeon_first_name, u.last_name as surgeon_last_name,
      (SELECT pain_level FROM checkins WHERE patient_id = p.id ORDER BY checkin_date DESC LIMIT 1) as last_pain,
      (SELECT checkin_date FROM checkins WHERE patient_id = p.id ORDER BY checkin_date DESC LIMIT 1) as last_checkin_date
    FROM clinic_visits cv
    JOIN patients p ON cv.patient_id = p.id
    LEFT JOIN episodes e ON cv.episode_id = e.id
    LEFT JOIN users u ON cv.surgeon_id = u.id
    WHERE 1=1`;
  const params = [];
  if (clinic_id) { query += ' AND cv.clinic_id = ?'; params.push(clinic_id); }
  if (visit_date) { query += ' AND cv.visit_date = ?'; params.push(visit_date); }
  if (surgeon_id) { query += ' AND cv.surgeon_id = ?'; params.push(surgeon_id); }
  query += ' ORDER BY cv.visit_time ASC, p.last_name ASC';
  res.json(db.prepare(query).all(...params));
});

app.post('/api/clinic-visits', (req, res) => {
  const id = uuid();
  const { patient_id, episode_id, clinic_id, surgeon_id, visit_date, visit_time, visit_type, chief_complaint } = req.body;
  db.prepare(
    'INSERT INTO clinic_visits (id, patient_id, episode_id, clinic_id, surgeon_id, visit_date, visit_time, visit_type, chief_complaint) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(id, patient_id, episode_id || null, clinic_id, surgeon_id || null, visit_date, visit_time || null, visit_type || 'follow_up', chief_complaint || null);
  res.json({ id, success: true });
});

app.put('/api/clinic-visits/:id', (req, res) => {
  const { visit_status, notes } = req.body;
  const updates = ['updated_at = CURRENT_TIMESTAMP'];
  const vals = [];
  if (visit_status) { updates.push('visit_status = ?'); vals.push(visit_status); }
  if (notes !== undefined) { updates.push('notes = ?'); vals.push(notes); }
  vals.push(req.params.id);
  db.prepare('UPDATE clinic_visits SET ' + updates.join(', ') + ' WHERE id = ?').run(...vals);
  res.json({ success: true });
});

app.delete('/api/clinic-visits/:id', (req, res) => {
  db.prepare('DELETE FROM clinic_visits WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/seed-clinic-visits', (req, res) => {
  const clinicId = '11111111-1111-1111-1111-111111111111';
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const demoPatients = db.prepare("SELECT p.id, e.id as episode_id, e.surgeon_id FROM patients p JOIN episodes e ON e.patient_id = p.id WHERE p.clinic_id = ?").all(clinicId);
  const visitTimes = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','13:00','13:30','14:00'];
  const visitTypes = ['follow_up','post_op','pre_op','follow_up','new_patient','injection','follow_up','post_op','follow_up','consult'];
  db.prepare("DELETE FROM clinic_visits WHERE clinic_id = ?").run(clinicId);
  const ins = db.prepare('INSERT OR IGNORE INTO clinic_visits (id, patient_id, episode_id, clinic_id, surgeon_id, visit_date, visit_time, visit_type, visit_status) VALUES (?,?,?,?,?,?,?,?,?)');
  [yesterday, today, tomorrow].forEach(function(date) {
    demoPatients.forEach(function(p, i) {
      if (i >= visitTimes.length) return;
      ins.run('visit-' + date + '-' + i, p.id, p.episode_id, clinicId, p.surgeon_id, date, visitTimes[i], visitTypes[i % visitTypes.length], date === yesterday ? 'completed' : 'scheduled');
    });
  });
  res.json({ success: true, message: 'Seeded clinic visits for ' + demoPatients.length + ' patients across 3 days.' });
});

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all: serve index.html for any unmatched routes (SPA support)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// ============ NOTE BLOCK ============
app.get('/api/patients/:id/note-block', (req, res) => {
  const patientId = req.params.id;

  const patient = db.prepare(`
    SELECT p.*, e.id as episode_id, e.surgery_type, e.surgery_date, e.status as episode_status,
           e.surgeon_id, u.first_name as surgeon_first_name, u.last_name as surgeon_last_name
    FROM patients p
    LEFT JOIN episodes e ON e.patient_id = p.id AND e.status = 'active'
    LEFT JOIN users u ON e.surgeon_id = u.id
    WHERE p.id = ?
  `).get(patientId);

  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  const recentCheckin = db.prepare(`
    SELECT * FROM checkins WHERE patient_id = ? ORDER BY checkin_date DESC, created_at DESC LIMIT 1
  `).get(patientId);

  const recentPreop = db.prepare(`
    SELECT * FROM preop_assessments WHERE patient_id = ? ORDER BY assessed_at DESC LIMIT 1
  `).get(patientId);

  const recentPro = db.prepare(`
    SELECT * FROM pro_assessments WHERE patient_id = ? ORDER BY assessment_date DESC LIMIT 1
  `).get(patientId);

  res.json({ patient, recentCheckin, recentPreop, recentPro });
});

// ============ CLOUD RELAY POLLING ============
const RELAY_URL = process.env.RELAY_URL || 'https://sro-cloud-relay.onrender.com';
const RELAY_SECRET = process.env.RELAY_SECRET || 'clinic-secret-key';
const POLL_INTERVAL = 15 * 60 * 1000;

async function pollCloudRelay() {
  const clinicId = '11111111-1111-1111-1111-111111111111';
  
  try {
    const response = await fetch(`${RELAY_URL}/pending/${clinicId}?secret=${RELAY_SECRET}`);
    
    if (!response.ok) {
      console.log('[Relay Poll] No response or error from relay');
      return;
    }
    
    const data = await response.json();
    
    if (data.count === 0) {
      console.log('[Relay Poll] No pending check-ins');
      return;
    }
    
    console.log(`[Relay Poll] Found ${data.count} pending check-ins`);
    
    const confirmedIds = [];
    
    for (const checkin of data.checkins) {
      const patient = db.prepare(`
        SELECT p.id as patient_id, p.clinic_id, e.id as episode_id
        FROM patients p
        LEFT JOIN episodes e ON e.patient_id = p.id AND e.status = 'active'
        WHERE p.token = ?
      `).get(checkin.token);
      
      if (!patient) {
        console.log(`[Relay Poll] Unknown token: ${checkin.token.substring(0, 6)}...`);
        continue;
      }
      
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO checkins (id, patient_id, episode_id, clinic_id, checkin_type, checkin_date,
                              pain_level, pt_exercises, medication_taken, swelling, concerns, notes)
        VALUES (?, ?, ?, ?, 'remote', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        patient.patient_id,
        patient.episode_id,
        patient.clinic_id,
        checkin.checkin_date,
        checkin.pain_level,
        checkin.pt_exercises ? 1 : 0,
        checkin.medication_taken ? 1 : 0,
        checkin.swelling,
        checkin.concerns,
        checkin.notes
      );
      
      confirmedIds.push(checkin.id);
      console.log(`[Relay Poll] Stored check-in for patient ${patient.patient_id}`);
    }
    
    if (confirmedIds.length > 0) {
      await fetch(`${RELAY_URL}/confirm-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinic_id: clinicId,
          ids: confirmedIds,
          secret: RELAY_SECRET
        })
      });
      console.log(`[Relay Poll] Confirmed ${confirmedIds.length} check-ins`);
    }
    
  } catch (error) {
    console.log('[Relay Poll] Error polling relay:', error.message);
  }
}

console.log('[Relay Poll] Starting cloud relay polling every 15 minutes...');
setInterval(pollCloudRelay, POLL_INTERVAL);
pollCloudRelay();

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                    SRO INTELLIGENCE                       ║');
  console.log('║              Post-Surgical Recovery Platform              ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║  Server running at: http://localhost:${PORT}                  ║`);
  console.log('║                                                           ║');
  console.log('║  Pages:                                                   ║');
  console.log(`║    Dashboard:  http://localhost:${PORT}/dashboard.html        ║`);
  console.log(`║    Check-in:   http://localhost:${PORT}/checkin.html          ║`);
  console.log(`║    Pre-Op:     http://localhost:${PORT}/preop-assessment.html ║`);
  console.log(`║    Analytics:  http://localhost:${PORT}/analytics.html        ║`);
  console.log(`║    Settings:   http://localhost:${PORT}/settings.html         ║`);
  console.log(`║    RPM Report: http://localhost:${PORT}/rpm-report.html       ║`);
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
});

module.exports = app;
