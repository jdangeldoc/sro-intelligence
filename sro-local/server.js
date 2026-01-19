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

  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_patients_clinic ON patients(clinic_id);
  CREATE INDEX IF NOT EXISTS idx_patients_token ON patients(token);
  CREATE INDEX IF NOT EXISTS idx_episodes_patient ON episodes(patient_id);
  CREATE INDEX IF NOT EXISTS idx_episodes_surgeon ON episodes(surgeon_id);
  CREATE INDEX IF NOT EXISTS idx_checkins_patient ON checkins(patient_id);
  CREATE INDEX IF NOT EXISTS idx_checkins_episode ON checkins(episode_id);
  CREATE INDEX IF NOT EXISTS idx_checkins_date ON checkins(checkin_date);
  CREATE INDEX IF NOT EXISTS idx_rpm_logs_billing ON rpm_time_logs(clinic_id, user_id, billing_month);
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
  db.prepare('DELETE FROM checkins WHERE patient_id = ?').run(req.params.id);
  db.prepare('DELETE FROM pro_assessments WHERE patient_id = ?').run(req.params.id);
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
  
  // Auto-calculate billing month from started_at
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
  
  // Get RPM time logs grouped by patient
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
  
  // Get check-in days for each patient in this billing month
  const checkinQuery = db.prepare(`
    SELECT COUNT(DISTINCT checkin_date) as checkin_days
    FROM checkins
    WHERE patient_id = ?
    AND strftime('%Y-%m', checkin_date) = ?
  `);
  
  // Get staff time breakdown per patient
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
  
  // Calculate days left in month
  const today = new Date();
  const currentMonth = today.toISOString().slice(0, 7);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeftInMonth = lastDayOfMonth - today.getDate();
  const isCurrentMonth = billing_month === currentMonth;
  
  // Add billing eligibility and check-in days
  const result = summary.map(row => {
    const checkinResult = checkinQuery.get(row.patient_id, billing_month);
    const checkinDays = checkinResult ? checkinResult.checkin_days : 0;
    const staffBreakdown = staffTimeQuery.all(row.patient_id, billing_month);
    
    const totalSeconds = row.total_seconds || 0;
    const totalMinutes = Math.round(totalSeconds / 60);
    const neededCheckins = Math.max(0, 16 - checkinDays);
    
    // Determine status
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
      // Past month
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
  
  // Active patients
  const activePatients = db.prepare(`
    SELECT COUNT(DISTINCT p.id) as count
    FROM patients p
    JOIN episodes e ON e.patient_id = p.id
    WHERE p.clinic_id = ? AND e.status = 'active'
  `).get(clinic_id);
  
  // Patients with check-in today
  const checkedInToday = db.prepare(`
    SELECT COUNT(DISTINCT patient_id) as count
    FROM checkins
    WHERE clinic_id = ? AND checkin_date = ?
  `).get(clinic_id, today);
  
  // Patients needing attention (pain >= 7 or missed PT for 3+ days)
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
  
  // Overdue check-ins (no check-in in 3+ days)
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
  
  res.json({
    active_patients: activePatients.count,
    checked_in_today: checkedInToday.count,
    needs_attention: needsAttention.count,
    overdue: overdue.count
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
// Configuration - set these in environment or config file
const RELAY_URL = process.env.RELAY_URL || 'https://sro-cloud-relay.onrender.com';
const RELAY_SECRET = process.env.RELAY_SECRET || 'clinic-secret-key'; // PLACEHOLDER - set unique secret per clinic
const POLL_INTERVAL = 15 * 60 * 1000; // 15 minutes

async function pollCloudRelay() {
  const clinicId = '11111111-1111-1111-1111-111111111111'; // TODO: Get from config
  
  try {
    // Fetch pending check-ins from cloud relay
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
      // Find patient by token
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
      
      // Insert check-in into local database
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
      
      // TODO: Store ROM data if we add rom_flexion/rom_extension columns
      
      confirmedIds.push(checkin.id);
      console.log(`[Relay Poll] Stored check-in for patient ${patient.patient_id}`);
    }
    
    // Confirm receipt to cloud relay (so it can delete them)
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

// Start polling when server starts
console.log('[Relay Poll] Starting cloud relay polling every 15 minutes...');
setInterval(pollCloudRelay, POLL_INTERVAL);
pollCloudRelay(); // Poll immediately on startup

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
  console.log(`║    Analytics:  http://localhost:${PORT}/analytics.html        ║`);
  console.log(`║    Settings:   http://localhost:${PORT}/settings.html         ║`);
  console.log(`║    RPM Report: http://localhost:${PORT}/rpm-report.html       ║`);
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
});

module.exports = app;
