// SRO Intelligence - Multi-Tenant Backend API
// Node.js + Express + PostgreSQL

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// =====================================================
// DATABASE CONNECTION
// =====================================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// =====================================================
// AUTH MIDDLEWARE
// =====================================================
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production';

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    req.clinicId = decoded.clinicId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// =====================================================
// AUDIT LOGGING (HIPAA)
// =====================================================
async function auditLog(clinicId, userId, action, resourceType, resourceId, details, req) {
  try {
    await pool.query(
      `INSERT INTO audit_log (clinic_id, user_id, action, resource_type, resource_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [clinicId, userId, action, resourceType, resourceId, JSON.stringify(details), 
       req.ip, req.headers['user-agent']]
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

// =====================================================
// AUTH ROUTES
// =====================================================

// Register new clinic (signup)
app.post('/api/clinics/register', async (req, res) => {
  const { clinicName, email, password, firstName, lastName } = req.body;
  
  try {
    // Create slug from clinic name
    const slug = clinicName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    // Check if exists
    const existing = await pool.query('SELECT id FROM clinics WHERE slug = $1', [slug]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Clinic name already taken' });
    }
    
    // Create clinic
    const clinicResult = await pool.query(
      `INSERT INTO clinics (name, slug, email) VALUES ($1, $2, $3) RETURNING id`,
      [clinicName, slug, email]
    );
    const clinicId = clinicResult.rows[0].id;
    
    // Create admin user
    const passwordHash = await bcrypt.hash(password, 10);
    const userResult = await pool.query(
      `INSERT INTO users (clinic_id, email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5, 'admin') RETURNING id`,
      [clinicId, email, passwordHash, firstName, lastName]
    );
    
    // Generate token
    const token = jwt.sign(
      { userId: userResult.rows[0].id, clinicId, email, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({ token, clinicId, slug });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const result = await pool.query(
      `SELECT u.*, c.slug as clinic_slug, c.name as clinic_name 
       FROM users u JOIN clinics c ON u.clinic_id = c.id 
       WHERE u.email = $1 AND u.is_active = true`,
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Update last login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    
    const token = jwt.sign(
      { userId: user.id, clinicId: user.clinic_id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        clinicName: user.clinic_name,
        clinicSlug: user.clinic_slug
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// =====================================================
// PATIENT ROUTES
// =====================================================

// List patients for clinic
app.get('/api/patients', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, 
        e.id as episode_id, e.procedure_type, e.procedure_side, e.procedure_date, 
        e.status, e.flag_status, e.flag_reason,
        (SELECT c.pain_score FROM checkins c WHERE c.episode_id = e.id ORDER BY c.created_at DESC LIMIT 1) as latest_pain,
        (SELECT c.rom_flexion FROM checkins c WHERE c.episode_id = e.id ORDER BY c.created_at DESC LIMIT 1) as latest_rom,
        (SELECT c.created_at FROM checkins c WHERE c.episode_id = e.id ORDER BY c.created_at DESC LIMIT 1) as last_checkin
       FROM patients p
       LEFT JOIN episodes e ON e.patient_id = p.id AND e.status = 'active'
       WHERE p.clinic_id = $1
       ORDER BY e.flag_status DESC, p.last_name`,
      [req.clinicId]
    );
    
    await auditLog(req.clinicId, req.user.userId, 'list_patients', 'patient', null, {}, req);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// Get single patient with full history
app.get('/api/patients/:id', authMiddleware, async (req, res) => {
  try {
    // Get patient
    const patientResult = await pool.query(
      'SELECT * FROM patients WHERE id = $1 AND clinic_id = $2',
      [req.params.id, req.clinicId]
    );
    
    if (patientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    // Get episodes
    const episodesResult = await pool.query(
      'SELECT * FROM episodes WHERE patient_id = $1 ORDER BY procedure_date DESC',
      [req.params.id]
    );
    
    // Get recent checkins
    const checkinsResult = await pool.query(
      `SELECT * FROM checkins WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 30`,
      [req.params.id]
    );
    
    await auditLog(req.clinicId, req.user.userId, 'view_patient', 'patient', req.params.id, {}, req);
    
    res.json({
      patient: patientResult.rows[0],
      episodes: episodesResult.rows,
      checkins: checkinsResult.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
});

// Create patient
app.post('/api/patients', authMiddleware, async (req, res) => {
  const { firstName, lastName, dateOfBirth, email, phone, mrn } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO patients (clinic_id, first_name, last_name, date_of_birth, email, phone, mrn)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.clinicId, firstName, lastName, dateOfBirth, email, phone, mrn]
    );
    
    await auditLog(req.clinicId, req.user.userId, 'create_patient', 'patient', result.rows[0].id, { mrn }, req);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create patient' });
  }
});

// =====================================================
// EPISODE ROUTES
// =====================================================

// Create episode (surgery)
app.post('/api/episodes', authMiddleware, async (req, res) => {
  const { patientId, procedureType, procedureSide, procedureDate, surgeonId } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO episodes (clinic_id, patient_id, procedure_type, procedure_side, procedure_date, surgeon_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.clinicId, patientId, procedureType, procedureSide, procedureDate, surgeonId]
    );
    
    await auditLog(req.clinicId, req.user.userId, 'create_episode', 'episode', result.rows[0].id, { procedureType }, req);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create episode' });
  }
});

// =====================================================
// CHECK-IN ROUTES (Patient App)
// =====================================================

// Submit check-in (from patient app - uses different auth)
app.post('/api/checkin/:episodeId', async (req, res) => {
  const { token } = req.query; // Simple token for patient access
  const { painScore, romFlexion, romExtension, ptCompleted, exercisesCompleted, hasConcern, concernText } = req.body;
  
  try {
    // Verify episode and get clinic
    const episodeResult = await pool.query(
      'SELECT e.*, p.id as patient_id FROM episodes e JOIN patients p ON e.patient_id = p.id WHERE e.id = $1',
      [req.params.episodeId]
    );
    
    if (episodeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Episode not found' });
    }
    
    const episode = episodeResult.rows[0];
    
    // Calculate day post-op
    const procedureDate = new Date(episode.procedure_date);
    const today = new Date();
    const dayPostOp = Math.floor((today - procedureDate) / (1000 * 60 * 60 * 24));
    
    // Determine flag status
    let flagStatus = 'green';
    let flagReason = null;
    
    if (hasConcern || painScore >= 7) {
      flagStatus = 'red';
      flagReason = hasConcern ? 'Patient reported concern' : 'High pain score';
    } else if (painScore >= 5 || (romFlexion && romFlexion < episode.rom_target_flexion * 0.6)) {
      flagStatus = 'yellow';
      flagReason = painScore >= 5 ? 'Elevated pain' : 'ROM below target';
    }
    
    // Insert check-in
    const result = await pool.query(
      `INSERT INTO checkins (clinic_id, episode_id, patient_id, pain_score, rom_flexion, rom_extension,
        pt_completed, exercises_completed, has_concern, concern_text, day_post_op, flag_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [episode.clinic_id, episode.id, episode.patient_id, painScore, romFlexion, romExtension,
       ptCompleted, exercisesCompleted, hasConcern, concernText, dayPostOp, flagStatus]
    );
    
    // Update episode flag status
    await pool.query(
      'UPDATE episodes SET flag_status = $1, flag_reason = $2, updated_at = NOW() WHERE id = $3',
      [flagStatus, flagReason, episode.id]
    );
    
    res.json({ success: true, flagStatus, dayPostOp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit check-in' });
  }
});

// Get check-ins for episode
app.get('/api/episodes/:id/checkins', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM checkins WHERE episode_id = $1 AND clinic_id = $2 ORDER BY created_at DESC`,
      [req.params.id, req.clinicId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch check-ins' });
  }
});

// Mark check-in as reviewed
app.post('/api/checkins/:id/review', authMiddleware, async (req, res) => {
  const { notes } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE checkins SET reviewed_by = $1, reviewed_at = NOW(), review_notes = $2
       WHERE id = $3 AND clinic_id = $4 RETURNING *`,
      [req.user.userId, notes, req.params.id, req.clinicId]
    );
    
    await auditLog(req.clinicId, req.user.userId, 'review_checkin', 'checkin', req.params.id, { notes }, req);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to review check-in' });
  }
});

// =====================================================
// DASHBOARD STATS
// =====================================================

app.get('/api/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE flag_status = 'red' AND status = 'active') as red_count,
        COUNT(*) FILTER (WHERE flag_status = 'yellow' AND status = 'active') as yellow_count,
        COUNT(*) FILTER (WHERE flag_status = 'green' AND status = 'active') as green_count,
        COUNT(*) FILTER (WHERE status = 'active') as total_active
      FROM episodes WHERE clinic_id = $1
    `, [req.clinicId]);
    
    res.json(stats.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// =====================================================
// USER MANAGEMENT (Admin only)
// =====================================================

app.get('/api/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, role, title, is_active, last_login, created_at
       FROM users WHERE clinic_id = $1 ORDER BY last_name`,
      [req.clinicId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/users', authMiddleware, adminOnly, async (req, res) => {
  const { email, password, firstName, lastName, role, title } = req.body;
  
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (clinic_id, email, password_hash, first_name, last_name, role, title)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, email, first_name, last_name, role`,
      [req.clinicId, email, passwordHash, firstName, lastName, role, title]
    );
    
    await auditLog(req.clinicId, req.user.userId, 'create_user', 'user', result.rows[0].id, { email, role }, req);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// =====================================================
// START SERVER
// =====================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SRO API running on port ${PORT}`);
});

module.exports = app;
