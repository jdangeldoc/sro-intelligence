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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
  db.prepare('DELETE FROM adverse_events WHERE patient_id = ?').run(req.params.id);
  db.prepare('DELETE FROM checkins WHERE patient_id = ?').run(req.params.id);
  db.prepare('DELETE FROM pro_assessments WHERE patient_id = ?').run(req.params.id);
  db.prepare('DELETE FROM preop_assessments WHERE patient_id = ?').run(req.params.id);
  db.prepare('DELETE FROM rpm_time_logs WHERE patient_id = ?').run(req.params.id);
  db.prepare('DELETE FROM episodes WHERE patient_id = ?').run(req.params.id);
  db.prepare('DELETE FROM patients WHERE id = ?').run(req.params.id);
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
  }
  
  if (readmitted === 'yes') {
    const aeId = uuid();
    db.prepare(`
      INSERT INTO adverse_events (id, patient_id, episode_id, clinic_id, event_type, event_date, reported_by, facility, reason)
      VALUES (?, ?, ?, ?, 'readmission', ?, 'patient', ?, ?)
    `).run(aeId, patient.patient_id, patient.episode_id, patient.clinic_id, checkin_date, readmit_facility || '', readmit_reason || '');
  }
  
  res.json({ id, success: true });
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
  
  res.json({ id, success: true });
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
  const { resolved, notes } = req.body;
  db.prepare('UPDATE adverse_events SET resolved = ?, notes = ? WHERE id = ?').run(resolved ? 1 : 0, notes, req.params.id);
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
      p.first_name, p.last_name, p.mrn,
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
    
    res.json({ success: true, message: 'Seeded 8 demo patients with check-ins, preop assessments, adverse events, and PROM schedules.' });
  } catch (error) {
    console.error('Seed error:', error);
    res.json({ success: false, error: error.message });
  }
});

// Clear demo data
app.post('/api/clear-demo', (req, res) => {
  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM nursing_notes WHERE patient_id LIKE 'demo-%'").run();
    db.prepare("DELETE FROM prom_schedule WHERE episode_id LIKE 'demo-%'").run();
    db.prepare("DELETE FROM adverse_events WHERE id LIKE 'demo-%' OR patient_id LIKE 'demo-%'").run();
    db.prepare("DELETE FROM checkins WHERE id LIKE 'demo-%' OR patient_id LIKE 'demo-%'").run();
    db.prepare("DELETE FROM pro_assessments WHERE id LIKE 'demo-%' OR patient_id LIKE 'demo-%'").run();
    db.prepare("DELETE FROM preop_assessments WHERE id LIKE 'demo-%' OR patient_id LIKE 'demo-%'").run();
    db.prepare("DELETE FROM rpm_time_logs WHERE patient_id LIKE 'demo-%'").run();
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
