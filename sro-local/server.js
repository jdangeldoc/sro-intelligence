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
`);

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
  
  console.log('Created default clinic and demo surgeons');
}

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
      (SELECT checkin_date FROM checkins WHERE patient_id = p.id ORDER BY checkin_date DESC LIMIT 1) as last_checkin_date,
      (SELECT pain_level FROM checkins WHERE patient_id = p.id ORDER BY checkin_date DESC LIMIT 1) as last_pain_level,
      (SELECT pt_exercises FROM checkins WHERE patient_id = p.id ORDER BY checkin_date DESC LIMIT 1) as last_pt_exercises
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
  const { first_name, last_name, date_of_birth, email, phone, mrn } = req.body;
  
  db.prepare(`
    UPDATE patients SET first_name = ?, last_name = ?, date_of_birth = ?, email = ?, phone = ?, mrn = ?
    WHERE id = ?
  `).run(first_name, last_name, date_of_birth, email, phone, mrn, req.params.id);
  
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
  
  res.json({ id, success: true });
});

app.put('/api/episodes/:id', (req, res) => {
  const { surgeon_id, surgery_type, surgery_date, surgery_location, status } = req.body;
  
  db.prepare(`
    UPDATE episodes SET surgeon_id = ?, surgery_type = ?, surgery_date = ?, surgery_location = ?, status = ?
    WHERE id = ?
  `).run(surgeon_id, surgery_type, surgery_date, surgery_location, status, req.params.id);
  
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

app.post('/api/preop-assessments', (req, res) => {
  const id = uuid();
  const {
    patient_id, clinic_id, surgeon_id, assessment_type, procedure_type, planned_surgery_date,
    mortality_risk, readmission_risk, prolonged_los_risk, risk_tier,
    age, sex, bmi, asa_class, comorbidities,
    joint_score_type, joint_score_preop, projected_postop_score, expected_improvement,
    promis_physical_tscore, promis_mental_tscore,
    cms_back_pain, cms_health_literacy, cms_other_knee_pain, cms_other_hip_pain
  } = req.body;
  
  db.prepare(`
    INSERT INTO preop_assessments (
      id, patient_id, clinic_id, surgeon_id, assessment_type, procedure_type, planned_surgery_date,
      mortality_risk, readmission_risk, prolonged_los_risk, risk_tier,
      age, sex, bmi, asa_class, comorbidities,
      joint_score_type, joint_score_preop, projected_postop_score, expected_improvement,
      promis_physical_tscore, promis_mental_tscore,
      cms_back_pain, cms_health_literacy, cms_other_knee_pain, cms_other_hip_pain
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, patient_id, clinic_id, surgeon_id, assessment_type || 'preop', procedure_type, planned_surgery_date,
    mortality_risk, readmission_risk, prolonged_los_risk, risk_tier,
    age, sex, bmi, asa_class, Array.isArray(comorbidities) ? JSON.stringify(comorbidities) : comorbidities,
    joint_score_type, joint_score_preop, projected_postop_score, expected_improvement,
    promis_physical_tscore, promis_mental_tscore,
    cms_back_pain ? 1 : 0, cms_health_literacy, cms_other_knee_pain ? 1 : 0, cms_other_hip_pain ? 1 : 0
  );
  
  res.json({ id, success: true });
});

app.delete('/api/preop-assessments/:id', (req, res) => {
  db.prepare('DELETE FROM preop_assessments WHERE id = ?').run(req.params.id);
  res.json({ success: true });
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
    const scbThreshold = preop.joint_score_type === 'koos_jr' ? 12 : 14;
    
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
  const insertPreop = db.prepare(`INSERT OR IGNORE INTO preop_assessments (id, patient_id, clinic_id, surgeon_id, procedure_type, planned_surgery_date, risk_tier, age, sex, bmi, asa_class, joint_score_type, joint_score_preop, projected_postop_score, expected_improvement, promis_physical_tscore, promis_mental_tscore) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  
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
      
      // PreOp assessment
      const age = today.getFullYear() - parseInt(dp.dob.split('-')[0]);
      const scoreType = dp.surgery.includes('TH') ? 'hoos_jr' : 'koos_jr';
      const preScore = 45 + Math.floor(Math.random() * 20);
      const riskTier = preScore < 50 ? 'HIGH' : preScore < 60 ? 'MODERATE' : 'LOW';
      insertPreop.run(`demo-preop-${idx+1}`, patientId, clinicId, surgeonId, dp.surgery, surgeryDate, riskTier, age, idx%2===0?'F':'M', 25+Math.random()*10, idx<3?2:3, scoreType, preScore, preScore+18, 18, 35+Math.random()*15, 40+Math.random()*15);
      
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
    });
  });
  
  try {
    transaction();
    res.json({ success: true, message: `Seeded ${demoPatients.length} demo patients with check-ins, preop assessments, and adverse events.` });
  } catch (error) {
    console.error('Seed error:', error);
    res.json({ success: false, error: error.message });
  }
});

// Clear demo data
app.post('/api/clear-demo', (req, res) => {
  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM adverse_events WHERE id LIKE 'demo-%'").run();
    db.prepare("DELETE FROM checkins WHERE id LIKE 'demo-%'").run();
    db.prepare("DELETE FROM pro_assessments WHERE id LIKE 'demo-%'").run();
    db.prepare("DELETE FROM preop_assessments WHERE id LIKE 'demo-%'").run();
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
  const { clinic_id } = req.query;
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const activePatients = db.prepare(`
    SELECT COUNT(DISTINCT p.id) as count
    FROM patients p
    JOIN episodes e ON e.patient_id = p.id
    WHERE p.clinic_id = ? AND e.status = 'active'
  `).get(clinic_id);
  
  const checkedInToday = db.prepare(`
    SELECT COUNT(DISTINCT patient_id) as count
    FROM checkins
    WHERE clinic_id = ? AND checkin_date = ?
  `).get(clinic_id, today);
  
  const needsAttention = db.prepare(`
    SELECT COUNT(DISTINCT p.id) as count
    FROM patients p
    JOIN episodes e ON e.patient_id = p.id
    LEFT JOIN (
      SELECT patient_id, pain_level, pt_exercises,
             ROW_NUMBER() OVER (PARTITION BY patient_id ORDER BY checkin_date DESC) as rn
      FROM checkins
    ) c ON c.patient_id = p.id AND c.rn = 1
    WHERE p.clinic_id = ? AND e.status = 'active'
    AND (c.pain_level >= 7 OR c.pt_exercises = 0)
  `).get(clinic_id);
  
  const overdue = db.prepare(`
    SELECT COUNT(DISTINCT p.id) as count
    FROM patients p
    JOIN episodes e ON e.patient_id = p.id
    LEFT JOIN (
      SELECT patient_id, MAX(checkin_date) as last_checkin
      FROM checkins
      GROUP BY patient_id
    ) c ON c.patient_id = p.id
    WHERE p.clinic_id = ? AND e.status = 'active'
    AND (c.last_checkin IS NULL OR c.last_checkin < ?)
  `).get(clinic_id, sevenDaysAgo);
  
  const erVisits = db.prepare(`
    SELECT COUNT(*) as count FROM adverse_events
    WHERE clinic_id = ? AND event_type = 'er_visit'
  `).get(clinic_id);
  
  const readmissions = db.prepare(`
    SELECT COUNT(*) as count FROM adverse_events
    WHERE clinic_id = ? AND event_type = 'readmission'
  `).get(clinic_id);
  
  res.json({
    active_patients: activePatients.count,
    checked_in_today: checkedInToday.count,
    needs_attention: needsAttention.count,
    overdue: overdue.count,
    er_visits: erVisits.count,
    readmissions: readmissions.count
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
