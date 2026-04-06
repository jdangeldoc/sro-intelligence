const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage for pending check-ins (temporary until NUC picks them up)
const pendingCheckins = new Map();

// Also serve checkin.html and portal.html from root
app.use(express.static(__dirname));

// ============ API ROUTES ============

// Validate token (for patient check-in page)
// In production, this would verify against the clinic NUC
// For now, accept any token and return basic info
app.get('/api/validate-token/:token', (req, res) => {
    const token = req.params.token;
    
    // For demo/testing, accept any token
    // Real implementation would call the clinic NUC to validate
    res.json({
        valid: true,
        first_name: 'Patient',
        days_post_op: 7,
        surgery_type: 'TKA'
    });
});

// ============ PORTAL API ROUTES ============

// Portal status — returns episode info and module statuses for portal.html
// In production, this would query the clinic NUC via a secure relay call.
// For now, returns demo data so the portal page renders correctly.
app.get('/api/portal/status', (req, res) => {
    const token = req.query.t;
    if (!token) {
        return res.status(400).json({ error: 'Token required' });
    }

    // Demo/fallback response — NUC will eventually feed real data here
    // via the polling mechanism (same as check-ins)
    res.json({
        verified: false,
        episode_type: 'TKA',
        side: 'Right',
        surgeon_name: 'Dr. Angel',
        surgery_date: null,
        practice_name: null,
        modules: {
            health: 'not_started',
            treatment: 'locked',
            checkin: 'locked',
            survey: 'locked'
        }
    });
});

// Portal identity verification
// In production, this would verify DOB + phone against the clinic NUC.
// For now, accepts any valid-looking input so the portal flow works.
app.post('/api/portal/verify', (req, res) => {
    const { token, dob, phone_last4 } = req.body;

    if (!token || !dob || !phone_last4) {
        return res.status(400).json({ error: 'Token, DOB, and phone last 4 required' });
    }

    // TODO: In production, relay this to the clinic NUC for real verification:
    //   NUC checks: patients.date_of_birth == dob AND patients.phone LIKE '%phone_last4'
    //   For now, accept any input
    console.log(`[Portal] Verify attempt for token ${token.substring(0, 6)}... DOB: ${dob}`);

    res.json({ verified: true, token });
});

// ============ TREATMENT JOURNEY ROUTES ============

// Receive treatment journey data from patient
// Stored in pendingCheckins-style map, keyed by token, type: 'treatment'
// NUC will poll and pick this up same as check-ins
app.post('/api/portal/treatment', (req, res) => {
    const { token, ...treatmentData } = req.body;

    if (!token) {
        return res.status(400).json({ error: 'Token required' });
    }

    const entryId = crypto.randomUUID();
    const entry = {
        id: entryId,
        token,
        type: 'treatment',
        ...treatmentData,
        received_at: new Date().toISOString()
    };

    // Store in pending map (same structure as check-ins)
    if (!pendingCheckins.has(token)) {
        pendingCheckins.set(token, []);
    }
    pendingCheckins.get(token).push(entry);

    console.log(`[Treatment] Received from token ${token.substring(0, 6)}...`);

    res.json({ success: true, id: entryId });
});

// ============ CHECK-IN ROUTES ============

// Receive check-in from patient
app.post('/api/checkin', (req, res) => {
    const { token, checkin_date, pain_level, pt_exercises, medication_taken, swelling, concerns } = req.body;
    
    if (!token) {
        return res.status(400).json({ error: 'Token required' });
    }
    
    const checkinId = crypto.randomUUID();
    const checkin = {
        id: checkinId,
        token,
        checkin_date: checkin_date || new Date().toISOString().split('T')[0],
        pain_level: pain_level ?? 0,
        pt_exercises: pt_exercises ? 1 : 0,
        medication_taken: medication_taken ? 1 : 0,
        swelling: swelling || 'none',
        concerns: concerns || '',
        received_at: new Date().toISOString()
    };
    
    // Store in pending (keyed by token for now)
    if (!pendingCheckins.has(token)) {
        pendingCheckins.set(token, []);
    }
    pendingCheckins.get(token).push(checkin);
    
    console.log(`[Checkin] Received from token ${token.substring(0, 6)}... Pain: ${pain_level}`);
    
    res.json({ success: true, id: checkinId });
});

// Get pending check-ins for a clinic (called by NUC)
app.get('/pending/:clinicId', (req, res) => {
    const secret = req.query.secret;
    
    // Simple secret check (in production, use proper auth)
    if (secret !== 'clinic-secret-key' && secret !== process.env.RELAY_SECRET) {
        return res.status(401).json({ error: 'Invalid secret' });
    }
    
    // Gather all pending check-ins
    const allCheckins = [];
    pendingCheckins.forEach((checkins, token) => {
        checkins.forEach(c => {
            allCheckins.push({ ...c, token });
        });
    });
    
    res.json({
        count: allCheckins.length,
        checkins: allCheckins
    });
});

// Confirm receipt of check-ins (called by NUC after storing)
app.post('/confirm-batch', (req, res) => {
    const { clinic_id, ids, secret } = req.body;
    
    if (secret !== 'clinic-secret-key' && secret !== process.env.RELAY_SECRET) {
        return res.status(401).json({ error: 'Invalid secret' });
    }
    
    // Remove confirmed check-ins
    let removed = 0;
    pendingCheckins.forEach((checkins, token) => {
        const before = checkins.length;
        const filtered = checkins.filter(c => !ids.includes(c.id));
        pendingCheckins.set(token, filtered);
        removed += before - filtered.length;
    });
    
    // Clean up empty token entries
    pendingCheckins.forEach((checkins, token) => {
        if (checkins.length === 0) {
            pendingCheckins.delete(token);
        }
    });
    
    console.log(`[Confirm] Removed ${removed} check-ins`);
    
    res.json({ success: true, removed });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', pending: pendingCheckins.size });
});

// Serve portal.html for /portal route (clean URL)
app.get('/portal', (req, res) => {
    res.sendFile(path.join(__dirname, 'portal.html'));
});

// Serve treatment.html for /treatment route (clean URL)
app.get('/treatment', (req, res) => {
    res.sendFile(path.join(__dirname, 'treatment.html'));
});

// Serve checkin.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'checkin.html'));
});

// Start server
app.listen(PORT, () => {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║              SRO CLOUD RELAY                              ║');
    console.log('║         Patient Check-in & Portal Relay Server            ║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log(`║  Server running at: http://localhost:${PORT}                 ║`);
    console.log('║                                                           ║');
    console.log('║  Endpoints:                                               ║');
    console.log('║    GET  /                     - Check-in page             ║');
    console.log('║    GET  /portal               - Patient portal            ║');
    console.log('║    GET  /treatment            - Treatment journey         ║');
    console.log('║    GET  /api/portal/status    - Portal module status      ║');
    console.log('║    POST /api/portal/verify    - Portal identity verify    ║');
    console.log('║    POST /api/portal/treatment - Submit treatment data     ║');
    console.log('║    GET  /api/validate-token   - Validate patient token    ║');
    console.log('║    POST /api/checkin          - Submit check-in           ║');
    console.log('║    GET  /pending/:clinicId    - Get pending (for NUC)     ║');
    console.log('║    POST /confirm-batch        - Confirm receipt (for NUC) ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
});

module.exports = app;
