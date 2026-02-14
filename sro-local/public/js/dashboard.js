// ============ CONFIGURATION ============
const CLINIC_ID = sessionStorage.getItem('clinicId') || '11111111-1111-1111-1111-111111111111';
const USER_ID = sessionStorage.getItem('userId');
const USER_NAME = sessionStorage.getItem('userName') || 'User';

// ============ STATE ============
let patients = [];
let surgeons = [];
let currentPatient = null;
let currentEpisode = null;
let preopAssessments = {}; // Cache for preop assessments
let adverseEventsCache = {}; // Cache for adverse events per patient
let promScheduleCache = {}; // Cache for PROM overdue per patient

// RPM Timer State
let rpmTimer = {
    running: false,
    startTime: null,
    patientId: null,
    episodeId: null,
    interval: null,
    durationSeconds: 0
};

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', async () => {
    // Check if logged in
    if (!CLINIC_ID) {
        window.location.href = '/index.html';
        return;
    }
    
    // Set user name in nav
    document.getElementById('userName').textContent = USER_NAME;
    
    // Load data
    await loadSurgeons();
    await loadPreopAssessments();
    await loadAlertCaches();
    await loadStats();
    await loadPatients();
    await loadPromCompliance();
});

// ============ PREOP ASSESSMENTS ============
async function loadPreopAssessments() {
    try {
        const response = await fetch(`/api/preop-assessments?clinic_id=${CLINIC_ID}`);
        const assessments = await response.json();
        
        // Index by patient_id (keep most recent)
        preopAssessments = {};
        assessments.forEach(a => {
            if (!preopAssessments[a.patient_id] || new Date(a.assessed_at) > new Date(preopAssessments[a.patient_id].assessed_at)) {
                preopAssessments[a.patient_id] = a;
            }
        });
    } catch (error) {
        console.error('Error loading preop assessments:', error);
    }
}

function getRiskBadge(patientId) {
    const preop = preopAssessments[patientId];
    if (!preop || !preop.risk_tier) {
        return '<span class="risk-badge risk-none">—</span>';
    }
    const tier = preop.risk_tier.toLowerCase();
    return `<span class="risk-badge risk-${tier}">${preop.risk_tier}</span>`;
}

// ============ ALERT CACHES ============
async function loadAlertCaches() {
    try {
        const aeResp = await fetch(`/api/adverse-events?clinic_id=${CLINIC_ID}`);
        const aeList = await aeResp.json();
        adverseEventsCache = {};
        aeList.forEach(ae => {
            if (!adverseEventsCache[ae.patient_id]) adverseEventsCache[ae.patient_id] = [];
            adverseEventsCache[ae.patient_id].push(ae);
        });
        
        const promResp = await fetch(`/api/prom-schedule?clinic_id=${CLINIC_ID}&status=overdue`);
        const promList = await promResp.json();
        promScheduleCache = {};
        promList.forEach(ps => {
            if (!promScheduleCache[ps.patient_id]) promScheduleCache[ps.patient_id] = [];
            promScheduleCache[ps.patient_id].push(ps);
        });
    } catch (error) {
        console.error('Error loading alert caches:', error);
    }
}

function getAlertBadges(patient) {
    const badges = [];
    
    const events = adverseEventsCache[patient.id] || [];
    const erCount = events.filter(e => e.event_type === 'er_visit').length;
    const readmitCount = events.filter(e => e.event_type === 'readmission').length;
    const otherEvents = events.filter(e => e.event_type !== 'er_visit' && e.event_type !== 'readmission').length;
    
    if (readmitCount > 0) badges.push(`<span title="Readmission" style="background:#7c3aed;color:white;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;cursor:help;">🏥 ${readmitCount}</span>`);
    if (erCount > 0) badges.push(`<span title="ER Visit" style="background:#dc3545;color:white;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;cursor:help;">🚨 ${erCount}</span>`);
    if (otherEvents > 0) badges.push(`<span title="Adverse Event" style="background:#f59e0b;color:white;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;cursor:help;">⚠️ ${otherEvents}</span>`);
    
    const overdueProms = promScheduleCache[patient.id] || [];
    if (overdueProms.length > 0) badges.push(`<span title="PROMs Overdue" style="background:#2563eb;color:white;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;cursor:help;">📋 ${overdueProms.length}</span>`);
    
    if (patient.last_pain_level >= 7) badges.push(`<span title="High Pain" style="background:#ef4444;color:white;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;cursor:help;">🔥</span>`);
    
    return badges.length > 0 ? badges.join(' ') : '<span style="color:#ccc;">—</span>';
}

// Stat card filter state
let activeStatFilter = null;

function switchTab(tab) {
    const patientsPanel = document.getElementById('panelPatients');
    const promPanel = document.getElementById('panelProm');
    const tabPatients = document.getElementById('tabPatients');
    const tabProm = document.getElementById('tabProm');
    
    if (tab === 'patients') {
        patientsPanel.style.display = 'block';
        promPanel.style.display = 'none';
        tabPatients.style.borderBottomColor = '#2c5aa0';
        tabPatients.style.color = '#2c5aa0';
        tabProm.style.borderBottomColor = 'transparent';
        tabProm.style.color = '#6b7280';
    } else {
        patientsPanel.style.display = 'none';
        promPanel.style.display = 'block';
        tabProm.style.borderBottomColor = '#2c5aa0';
        tabProm.style.color = '#2c5aa0';
        tabPatients.style.borderBottomColor = 'transparent';
        tabPatients.style.color = '#6b7280';
        loadPromCompliance();
    }
}

function filterByStat(filterType) {
    // Toggle off if clicking same filter
    if (activeStatFilter === filterType) {
        activeStatFilter = null;
        // Remove highlight from all stat cards
        document.querySelectorAll('.stat-card').forEach(c => c.style.outline = 'none');
    } else {
        activeStatFilter = filterType;
        // Highlight active card
        document.querySelectorAll('.stat-card').forEach(c => c.style.outline = 'none');
        const card = document.querySelector(`[data-stat-filter="${filterType}"]`);
        if (card) card.style.outline = '3px solid #2c5aa0';
    }
    renderPatientTable();
}

// ============ DATA LOADING ============
async function loadStats() {
    try {
        const response = await fetch(`/api/dashboard-stats?clinic_id=${CLINIC_ID}`);
        const stats = await response.json();
        
        document.getElementById('statActive').textContent = stats.active_patients || 0;
        document.getElementById('statOnTrack').textContent = Math.max(0, (stats.active_patients - stats.needs_attention - stats.overdue)) || 0;
        document.getElementById('statAttention').textContent = stats.needs_attention || 0;
        document.getElementById('statOverdue').textContent = stats.overdue || 0;
        document.getElementById('statERVisits').textContent = stats.er_visits || 0;
        document.getElementById('statReadmissions').textContent = stats.readmissions || 0;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadSurgeons() {
    try {
        const response = await fetch(`/api/users?clinic_id=${CLINIC_ID}&role=surgeon`);
        surgeons = await response.json();
        
        // Populate filter dropdown
        const filterSelect = document.getElementById('filterSurgeon');
        filterSelect.innerHTML = '<option value="all">All Surgeons</option>';
        surgeons.forEach(surgeon => {
            const option = document.createElement('option');
            option.value = surgeon.id;
            option.textContent = `Dr. ${surgeon.first_name} ${surgeon.last_name}`;
            filterSelect.appendChild(option);
        });
        
        // Populate add patient form
        const surgeonSelect = document.getElementById('newSurgeon');
        if (surgeonSelect) {
            surgeonSelect.innerHTML = '<option value="">Select surgeon...</option>';
            surgeons.forEach(surgeon => {
                const option = document.createElement('option');
                option.value = surgeon.id;
                option.textContent = `Dr. ${surgeon.first_name} ${surgeon.last_name}`;
                surgeonSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading surgeons:', error);
    }
}

async function loadPatients() {
    try {
        const response = await fetch(`/api/patients?clinic_id=${CLINIC_ID}`);
        patients = await response.json();
        renderPatientTable();
    } catch (error) {
        console.error('Error loading patients:', error);
        document.getElementById('patientTableBody').innerHTML = 
            '<tr><td colspan="10" class="error">Error loading patients</td></tr>';
    }
}

// ============ RENDERING ============
function renderPatientTable() {
    const tbody = document.getElementById('patientTableBody');
    const filterStatus = document.getElementById('filterStatus').value;
    const filterSurgeon = document.getElementById('filterSurgeon').value;
    
    // Filter patients
    let filtered = patients.filter(p => {
        // Status filter
        const status = getPatientStatus(p);
        if (filterStatus !== 'all' && status !== filterStatus) return false;
        
        // Surgeon filter
        if (filterSurgeon !== 'all' && p.surgeon_id !== filterSurgeon) return false;
        
        // Stat card filter
        if (activeStatFilter) {
            const events = adverseEventsCache[p.id] || [];
            const overdueProms = promScheduleCache[p.id] || [];
            
            if (activeStatFilter === 'er_visits' && !events.some(e => e.event_type === 'er_visit')) return false;
            if (activeStatFilter === 'readmissions' && !events.some(e => e.event_type === 'readmission')) return false;
            if (activeStatFilter === 'proms_overdue' && overdueProms.length === 0) return false;
            if (activeStatFilter === 'attention' && status !== 'attention') return false;
            if (activeStatFilter === 'overdue' && status !== 'overdue') return false;
            if (activeStatFilter === 'on-track' && status !== 'on-track') return false;
        }
        
        return true;
    });
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" class="empty">No patients found ${activeStatFilter ? '— <a href="#" onclick="filterByStat(null);return false;">clear filter</a>' : ''}</td></tr>`;
        return;
    }
    
    tbody.innerHTML = filtered.map(patient => {
        const status = getPatientStatus(patient);
        const statusClass = status === 'on-track' ? 'status-success' : 
                           status === 'attention' ? 'status-warning' : 'status-danger';
        const statusText = status === 'on-track' ? '🟢 On Track' :
                          status === 'attention' ? '🟡 Attention' : '🔴 Overdue';
        
        const daysPostOp = patient.surgery_date ? 
            Math.floor((Date.now() - new Date(patient.surgery_date)) / (1000 * 60 * 60 * 24)) : '-';
        
        return `
            <tr onclick="openPatientModal('${patient.id}')" class="clickable" data-patient-id="${patient.id}">
                <td>
                    <strong>${patient.last_name}, ${patient.first_name}</strong>
                    ${patient.mrn ? `<br><small class="text-muted">MRN: ${patient.mrn}</small>` : ''}
                </td>
                <td>${patient.surgery_type || '-'}</td>
                <td>${daysPostOp}</td>
                <td>${getRiskBadge(patient.id)}</td>
                <td>${patient.surgeon_first_name ? `Dr. ${patient.surgeon_last_name}` : '-'}</td>
                <td>${patient.last_checkin_date || 'Never'}</td>
                <td>
                    ${patient.last_pain_level !== null ? 
                        `<span class="pain-badge pain-${getPainClass(patient.last_pain_level)}">${patient.last_pain_level}/10</span>` : 
                        '-'}
                </td>
                <td>${patient.last_pt_exercises === 1 ? '✅' : patient.last_pt_exercises === 0 ? '❌' : '-'}</td>
                <td>${getAlertBadges(patient)}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>
                    <button class="btn btn-sm" onclick="event.stopPropagation(); openPatientModal('${patient.id}')">View</button>
                    <button class="btn btn-sm" style="background: #28a745; color: white;" onclick="event.stopPropagation(); quickRpmLog('${patient.id}', '${patient.episode_id}', '${patient.first_name} ${patient.last_name}')">⏱️ Log Time</button>
                </td>
            </tr>
        `;
    }).join('');
}

function getPatientStatus(patient) {
    if (!patient.last_checkin_date) return 'overdue';
    
    const daysSinceCheckin = Math.floor(
        (Date.now() - new Date(patient.last_checkin_date)) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceCheckin > 3) return 'overdue';
    if (patient.last_pain_level >= 7 || patient.last_pt_exercises === 0) return 'attention';
    return 'on-track';
}

function getPainClass(level) {
    if (level <= 3) return 'low';
    if (level <= 6) return 'medium';
    return 'high';
}

function filterPatients() {
    renderPatientTable();
}

// ============ PATIENT MODAL ============
async function openPatientModal(patientId) {
    currentPatient = patients.find(p => p.id === patientId);
    if (!currentPatient) return;
    
    currentEpisode = { id: currentPatient.episode_id };
    
    // Show modal
    document.getElementById('patientModal').style.display = 'flex';
    document.getElementById('modalPatientName').textContent = 
        `${currentPatient.first_name} ${currentPatient.last_name}`;
    
    // Reset RPM timer state
    document.getElementById('startReviewBtn').style.display = 'block';
    document.getElementById('rpmTimer').style.display = 'none';
    
    // Load patient details
    renderPatientInfo();
    renderSurgeryInfo();
    renderCheckinLink();
    await loadPatientCheckins(patientId);
    await loadPatientPreopInfo(patientId);
    await loadPatientPromSchedule(patientId);
    await loadPatientAdverseEvents(patientId);
    await loadPatientNotes(patientId);
    await loadComplianceScorecard(patientId);
    await loadPromTrendChart(patientId);
}

// ============ COMPLIANCE SCORECARD ============
async function loadComplianceScorecard(patientId) {
    const checkinEl = document.getElementById('scorecardCheckin');
    const promEl = document.getElementById('scorecardProm');
    const workupEl = document.getElementById('scorecardWorkup');
    if (!checkinEl) return;
    
    try {
        // Check-in adherence: days with check-ins / days since surgery
        const patient = patients.find(p => p.id === patientId);
        if (!patient || !patient.surgery_date) {
            checkinEl.textContent = 'N/A';
            checkinEl.style.color = '#6b7280';
        } else {
            const daysSinceSurgery = Math.max(1, Math.floor((Date.now() - new Date(patient.surgery_date)) / (1000*60*60*24)));
            const checkinsResp = await fetch(`/api/checkins?patient_id=${patientId}`);
            const checkins = await checkinsResp.json();
            const uniqueDays = new Set(checkins.map(c => c.checkin_date)).size;
            const checkinPct = Math.min(100, Math.round((uniqueDays / daysSinceSurgery) * 100));
            checkinEl.textContent = checkinPct + '%';
            checkinEl.style.color = checkinPct >= 80 ? '#16a34a' : checkinPct >= 50 ? '#d97706' : '#dc2626';
        }
        
        // PROM completion
        const promResp = await fetch(`/api/prom-schedule?patient_id=${patientId}`);
        const promSchedule = await promResp.json();
        if (promSchedule.length === 0) {
            promEl.textContent = 'N/A';
            promEl.style.color = '#6b7280';
        } else {
            const dueOrDone = promSchedule.filter(p => p.status === 'completed' || p.status === 'overdue');
            const completed = promSchedule.filter(p => p.status === 'completed').length;
            if (dueOrDone.length === 0) {
                promEl.textContent = 'Pending';
                promEl.style.color = '#2563eb';
            } else {
                const promPct = Math.round((completed / dueOrDone.length) * 100);
                promEl.textContent = promPct + '%';
                promEl.style.color = promPct >= 80 ? '#16a34a' : promPct >= 50 ? '#d97706' : '#dc2626';
            }
        }
        
        // Workup status from preop
        const preop = preopAssessments[patientId];
        if (preop) {
            workupEl.textContent = preop.risk_tier === 'LOW' ? '✅ Clear' : preop.risk_tier === 'HIGH' ? '⚠️ Review' : '📋 Done';
            workupEl.style.color = preop.risk_tier === 'LOW' ? '#16a34a' : preop.risk_tier === 'HIGH' ? '#d97706' : '#2563eb';
        } else {
            workupEl.textContent = '—';
            workupEl.style.color = '#6b7280';
        }
    } catch (error) {
        console.error('Error loading scorecard:', error);
    }
}

// ============ PROM TREND CHART ============
async function loadPromTrendChart(patientId) {
    const canvas = document.getElementById('promTrendCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    try {
        // Get all PRO assessments for this patient
        const resp = await fetch(`/api/pro-assessments?patient_id=${patientId}`);
        const assessments = await resp.json();
        
        // Also get preop assessment for baseline
        const preop = preopAssessments[patientId];
        
        // Build data points: {date, joint_score, promis_physical, promis_mental, label}
        const dataPoints = [];
        
        if (preop) {
            dataPoints.push({
                date: new Date(preop.planned_surgery_date || preop.assessed_at),
                joint_score: preop.joint_score_preop,
                label: 'Pre-Op',
                type: preop.joint_score_type
            });
        }
        
        assessments.forEach(a => {
            if (a.koos_jr_score || a.hoos_jr_score) {
                dataPoints.push({
                    date: new Date(a.assessed_at || a.created_at),
                    joint_score: a.koos_jr_score || a.hoos_jr_score,
                    label: a.assessment_window || '',
                    type: a.koos_jr_score ? 'koos_jr' : 'hoos_jr'
                });
            }
        });
        
        // Sort by date
        dataPoints.sort((a, b) => a.date - b.date);
        
        if (dataPoints.length === 0) {
            ctx.font = '14px sans-serif';
            ctx.fillStyle = '#999';
            ctx.textAlign = 'center';
            ctx.fillText('No PROM data yet — scores will appear after assessments', canvas.width / 2, canvas.height / 2);
            
            // Draw projected line if preop exists
            if (preop && preop.projected_postop_score) {
                ctx.font = '12px sans-serif';
                ctx.fillStyle = '#8b5cf6';
                ctx.fillText(`Projected: ${preop.joint_score_preop} → ${preop.projected_postop_score} (+${preop.expected_improvement})`, canvas.width / 2, canvas.height / 2 + 25);
            }
            return;
        }
        
        // Draw chart
        const padding = { top: 30, right: 30, bottom: 40, left: 50 };
        const chartW = canvas.width - padding.left - padding.right;
        const chartH = canvas.height - padding.top - padding.bottom;
        
        // Y range: 0-100 for joint scores
        const yMin = 0, yMax = 100;
        const toX = (i) => padding.left + (i / Math.max(1, dataPoints.length - 1)) * chartW;
        const toY = (v) => padding.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;
        
        // Draw grid
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        for (let v = 0; v <= 100; v += 20) {
            const y = toY(v);
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(canvas.width - padding.right, y);
            ctx.stroke();
            ctx.fillStyle = '#999';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(v, padding.left - 5, y + 4);
        }
        
        // Draw projected line if exists
        if (preop && preop.projected_postop_score && dataPoints.length >= 1) {
            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = '#c4b5fd';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(toX(0), toY(preop.joint_score_preop));
            ctx.lineTo(toX(dataPoints.length - 1), toY(preop.projected_postop_score));
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        // Draw actual line
        ctx.strokeStyle = '#2c5aa0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        dataPoints.forEach((dp, i) => {
            const x = toX(i);
            const y = toY(dp.joint_score);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        
        // Draw points and labels
        dataPoints.forEach((dp, i) => {
            const x = toX(i);
            const y = toY(dp.joint_score);
            
            // Point
            ctx.fillStyle = '#2c5aa0';
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
            
            // Score label
            ctx.fillStyle = '#1e3a5f';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(dp.joint_score, x, y - 12);
            
            // X label
            ctx.fillStyle = '#666';
            ctx.font = '11px sans-serif';
            ctx.fillText(dp.label || dp.date.toLocaleDateString(), x, canvas.height - padding.bottom + 18);
        });
        
        // Legend
        const scoreType = dataPoints[0].type === 'koos_jr' ? 'KOOS Jr' : 'HOOS Jr';
        const scbThreshold = dataPoints[0].type === 'koos_jr' ? 20 : 22;
        
        // Draw SCB target line if preop exists
        if (preop && preop.joint_score_preop) {
            const targetScore = preop.joint_score_preop + scbThreshold;
            if (targetScore <= 100) {
                const targetY = toY(targetScore);
                ctx.setLineDash([4, 3]);
                ctx.strokeStyle = '#16a34a';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(padding.left, targetY);
                ctx.lineTo(canvas.width - padding.right, targetY);
                ctx.stroke();
                ctx.setLineDash([]);
                
                ctx.fillStyle = '#16a34a';
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'right';
                ctx.fillText(`SCB Target: ${targetScore}`, canvas.width - padding.right, targetY - 5);
            }
        }
        
        ctx.fillStyle = '#2c5aa0';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('● ' + scoreType, padding.left, 16);
        if (preop && preop.projected_postop_score) {
            ctx.fillStyle = '#c4b5fd';
            ctx.fillText('--- Projected', padding.left + 80, 16);
        }
        ctx.fillStyle = '#16a34a';
        ctx.fillText(`--- SCB (≥${scbThreshold} pts)`, padding.left + 180, 16);
        
    } catch (error) {
        console.error('Error loading PROM trend chart:', error);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#ef4444';
        ctx.textAlign = 'center';
        ctx.fillText('Error loading chart', canvas.width / 2, canvas.height / 2);
    }
}

function renderPatientInfo() {
    const div = document.getElementById('patientInfo');
    div.innerHTML = `
        <p><strong>DOB:</strong> ${currentPatient.date_of_birth || 'Not specified'}</p>
        <p><strong>MRN:</strong> ${currentPatient.mrn || 'Not specified'}</p>
        <p><strong>Phone:</strong> ${currentPatient.phone || 'Not specified'}</p>
        <p><strong>Email:</strong> ${currentPatient.email || 'Not specified'}</p>
        <p><strong>Token:</strong> <code style="background:#f0f0f0; padding:2px 6px; border-radius:3px; font-size:12px;">${currentPatient.token || 'N/A'}</code></p>
    `;
}

function renderSurgeryInfo() {
    const div = document.getElementById('surgeryInfo');
    const daysPostOp = currentPatient.surgery_date ? 
        Math.floor((Date.now() - new Date(currentPatient.surgery_date)) / (1000 * 60 * 60 * 24)) : null;
    
    div.innerHTML = `
        <p><strong>Type:</strong> ${currentPatient.surgery_type || 'Not specified'}</p>
        <p><strong>Date:</strong> ${currentPatient.surgery_date || 'Not specified'}</p>
        <p><strong>Days Post-Op:</strong> ${daysPostOp !== null ? daysPostOp : 'N/A'}</p>
        <p><strong>Surgeon:</strong> ${currentPatient.surgeon_first_name ? 
            `Dr. ${currentPatient.surgeon_first_name} ${currentPatient.surgeon_last_name}` : 'Not assigned'}</p>
    `;
}

function renderCheckinLink() {
    const input = document.getElementById('checkinLink');
    // Use cloud relay URL for patient check-ins from home
    const cloudRelayUrl = 'https://sro-cloud-relay.onrender.com';
    input.value = `${cloudRelayUrl}/checkin.html?t=${currentPatient.token}&c=${CLINIC_ID}`;
}

function copyCheckinLink() {
    const input = document.getElementById('checkinLink');
    input.select();
    document.execCommand('copy');
    alert('Check-in link copied to clipboard!');
}

async function loadPatientCheckins(patientId) {
    try {
        const response = await fetch(`/api/checkins?patient_id=${patientId}`);
        const checkins = await response.json();
        
        renderCheckinsList(checkins);
        renderPainChart(checkins);
    } catch (error) {
        console.error('Error loading checkins:', error);
    }
}

// Load preop info for patient detail modal
async function loadPatientPreopInfo(patientId) {
    const preopDiv = document.getElementById('preopInfo');
    const preopBtn = document.getElementById('preopActionBtn');
    
    if (!preopDiv) return; // Element doesn't exist in HTML
    
    try {
        const response = await fetch(`/api/preop-postop-comparison/${patientId}`);
        const data = await response.json();
        
        if (!data.hasPreop) {
            preopDiv.innerHTML = `<p style="color: #9ca3af;">No pre-op assessment on file.</p>`;
            if (preopBtn) {
                preopBtn.href = `/preop.html?patient=${patientId}`;
                preopBtn.textContent = '+ Complete Pre-Op';
                preopBtn.style.display = 'inline-block';
            }
            return;
        }
        
        // Update button if preop exists
        if (preopBtn) {
            preopBtn.href = `/preop.html?patient=${patientId}`;
            preopBtn.textContent = 'New Assessment';
        }
        
        const preop = data.preop;
        let html = `
            <div class="preop-grid">
                <div class="preop-stat">
                    <div><span class="risk-badge risk-${preop.riskTier.toLowerCase()}">${preop.riskTier}</span></div>
                    <div class="preop-stat-label">Risk Tier</div>
                </div>
                <div class="preop-stat">
                    <div class="preop-stat-value">${preop.jointScore}</div>
                    <div class="preop-stat-label">${preop.jointScoreType === 'koos_jr' ? 'KOOS Jr' : 'HOOS Jr'}</div>
                </div>
                <div class="preop-stat">
                    <div class="preop-stat-value" style="color: #22c55e;">${preop.projectedScore}</div>
                    <div class="preop-stat-label">Projected</div>
                </div>
                <div class="preop-stat">
                    <div class="preop-stat-value" style="color: #8b5cf6;">+${preop.expectedImprovement}</div>
                    <div class="preop-stat-label">Expected Δ</div>
                </div>
            </div>
        `;
        
        if (data.hasPostop) {
            const postop = data.postop;
            html += `
                <hr style="border-color: #374151; margin: 15px 0;">
                <div class="preop-grid">
                    <div class="preop-stat">
                        <div class="preop-stat-value">${postop.jointScore}</div>
                        <div class="preop-stat-label">Actual Post-Op</div>
                    </div>
                    <div class="preop-stat">
                        <div class="preop-stat-value" style="color: ${postop.actualImprovement >= 0 ? '#22c55e' : '#ef4444'};">
                            ${postop.actualImprovement >= 0 ? '+' : ''}${postop.actualImprovement}
                        </div>
                        <div class="preop-stat-label">Actual Δ</div>
                    </div>
                    <div class="preop-stat">
                        <div class="preop-stat-value">${postop.achievedSCB ? '✅' : '❌'}</div>
                        <div class="preop-stat-label">SCB Achieved</div>
                    </div>
                </div>
            `;
        }
        
        preopDiv.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading preop info:', error);
        if (preopDiv) {
            preopDiv.innerHTML = '<p style="color: #ef4444;">Error loading pre-op data</p>';
        }
    }
}

function renderCheckinsList(checkins) {
    const div = document.getElementById('checkinsList');
    
    if (checkins.length === 0) {
        div.innerHTML = '<p class="empty">No check-ins yet</p>';
        return;
    }
    
    div.innerHTML = checkins.slice(0, 10).map(checkin => `
        <div class="checkin-item">
            <div class="checkin-date">${checkin.checkin_date}</div>
            <div class="checkin-details">
                <span class="pain-badge pain-${getPainClass(checkin.pain_level)}">Pain: ${checkin.pain_level}/10</span>
                <span class="pt-badge ${checkin.pt_exercises ? 'pt-yes' : 'pt-no'}">
                    PT: ${checkin.pt_exercises ? '✅' : '❌'}
                </span>
                ${checkin.concerns ? `<span class="concern-badge">⚠️ ${checkin.concerns}</span>` : ''}
            </div>
            ${checkin.notes ? `<div class="checkin-notes">${checkin.notes}</div>` : ''}
        </div>
    `).join('');
}

function renderPainChart(checkins) {
    const canvas = document.getElementById('painChartCanvas');
    const ctx = canvas.getContext('2d');
    
    // Get last 14 days of data
    const last14Days = checkins.slice(0, 14).reverse();
    
    if (last14Days.length === 0) {
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.fillText('No check-in data yet', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Chart dimensions
    const padding = 40;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;
    
    // Draw axes
    ctx.strokeStyle = '#ddd';
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvas.height - padding);
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.stroke();
    
    // Draw Y-axis labels (0-10)
    ctx.fillStyle = '#666';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 10; i += 2) {
        const y = canvas.height - padding - (i / 10) * chartHeight;
        ctx.fillText(i.toString(), padding - 5, y + 4);
    }
    
    // Draw data points and line
    ctx.strokeStyle = '#e74c3c';
    ctx.fillStyle = '#e74c3c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    last14Days.forEach((checkin, index) => {
        const x = padding + (index / (last14Days.length - 1 || 1)) * chartWidth;
        const y = canvas.height - padding - (checkin.pain_level / 10) * chartHeight;
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.stroke();
    
    // Draw points
    last14Days.forEach((checkin, index) => {
        const x = padding + (index / (last14Days.length - 1 || 1)) * chartWidth;
        const y = canvas.height - padding - (checkin.pain_level / 10) * chartHeight;
        
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
    });
}

function closePatientModal() {
    document.getElementById('patientModal').style.display = 'none';
    currentPatient = null;
    currentEpisode = null;
    
    // Stop timer if running
    if (rpmTimer.running) {
        discardRpmLog();
    }
}

// ============ ADD PATIENT ============
function openAddPatientModal() {
    document.getElementById('addPatientModal').style.display = 'flex';
    document.getElementById('addPatientForm').reset();
    
    // Set default surgery date to today
    document.getElementById('newSurgeryDate').value = new Date().toISOString().split('T')[0];
}

function closeAddPatientModal() {
    document.getElementById('addPatientModal').style.display = 'none';
}

async function handleAddPatient(event) {
    event.preventDefault();
    
    try {
        // Create patient
        const patientResponse = await fetch('/api/patients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clinic_id: CLINIC_ID,
                first_name: document.getElementById('newPatientFirst').value,
                last_name: document.getElementById('newPatientLast').value,
                date_of_birth: document.getElementById('newPatientDOB').value || null,
                mrn: document.getElementById('newPatientMRN').value || null,
                email: document.getElementById('newPatientEmail').value || null,
                phone: document.getElementById('newPatientPhone').value || null
            })
        });
        
        const patient = await patientResponse.json();
        
        // Create episode
        await fetch('/api/episodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                patient_id: patient.id,
                clinic_id: CLINIC_ID,
                surgeon_id: document.getElementById('newSurgeon').value,
                surgery_type: document.getElementById('newSurgeryType').value,
                surgery_date: document.getElementById('newSurgeryDate').value
            })
        });
        
        // Refresh and close
        closeAddPatientModal();
        await loadPatients();
        await loadStats();
        
        alert('Patient added successfully!');
    } catch (error) {
        console.error('Error adding patient:', error);
        alert('Error adding patient. Please try again.');
    }
}

// ============ RPM TIME TRACKING ============
function startReview() {
    if (!currentPatient) return;
    
    rpmTimer = {
        running: true,
        startTime: new Date(),
        patientId: currentPatient.id,
        episodeId: currentPatient.episode_id,
        interval: setInterval(updateTimerDisplay, 1000),
        durationSeconds: 0
    };
    
    document.getElementById('startReviewBtn').style.display = 'none';
    document.getElementById('rpmTimer').style.display = 'flex';
    document.getElementById('timerDisplay').textContent = '00:00';
}

function updateTimerDisplay() {
    const elapsed = Math.floor((new Date() - rpmTimer.startTime) / 1000);
    rpmTimer.durationSeconds = elapsed;
    
    const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const secs = (elapsed % 60).toString().padStart(2, '0');
    document.getElementById('timerDisplay').textContent = `${mins}:${secs}`;
}

function endReview() {
    clearInterval(rpmTimer.interval);
    
    // Show log modal
    const mins = Math.floor(rpmTimer.durationSeconds / 60);
    const secs = rpmTimer.durationSeconds % 60;
    document.getElementById('rpmDuration').textContent = 
        `${mins} minute${mins !== 1 ? 's' : ''} ${secs} second${secs !== 1 ? 's' : ''}`;
    
    document.getElementById('rpmLogModal').style.display = 'flex';
}

async function handleSaveRpmLog(event) {
    event.preventDefault();
    
    try {
        await fetch('/api/rpm-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                patient_id: rpmTimer.patientId,
                episode_id: rpmTimer.episodeId,
                user_id: USER_ID,
                clinic_id: CLINIC_ID,
                started_at: rpmTimer.startTime.toISOString(),
                ended_at: new Date().toISOString(),
                duration_seconds: rpmTimer.durationSeconds,
                activity_type: document.getElementById('rpmActivityType').value,
                notes: document.getElementById('rpmNotes').value
            })
        });
        
        closeRpmLogModal();
        alert('Review time logged successfully!');
    } catch (error) {
        console.error('Error saving RPM log:', error);
        alert('Error saving review time. Please try again.');
    }
}

function discardRpmLog() {
    if (rpmTimer.interval) {
        clearInterval(rpmTimer.interval);
    }
    
    rpmTimer = {
        running: false,
        startTime: null,
        patientId: null,
        episodeId: null,
        interval: null,
        durationSeconds: 0
    };
    
    closeRpmLogModal();
    
    document.getElementById('startReviewBtn').style.display = 'block';
    document.getElementById('rpmTimer').style.display = 'none';
}

function closeRpmLogModal() {
    document.getElementById('rpmLogModal').style.display = 'none';
    document.getElementById('rpmLogForm').reset();
    
    // Reset timer display
    document.getElementById('startReviewBtn').style.display = 'block';
    document.getElementById('rpmTimer').style.display = 'none';
}

// ============ EXPORT ============
function exportPatients() {
    const headers = ['Patient Name', 'MRN', 'Surgery Type', 'Surgery Date', 'Risk Tier', 'Surgeon', 'Last Check-in', 'Pain', 'PT Status'];
    const rows = patients.map(p => {
        const preop = preopAssessments[p.id];
        return [
            `${p.last_name}, ${p.first_name}`,
            p.mrn || '',
            p.surgery_type || '',
            p.surgery_date || '',
            preop ? preop.risk_tier : '',
            p.surgeon_first_name ? `Dr. ${p.surgeon_last_name}` : '',
            p.last_checkin_date || '',
            p.last_pain_level !== null ? p.last_pain_level : '',
            p.last_pt_exercises === 1 ? 'Yes' : p.last_pt_exercises === 0 ? 'No' : ''
        ];
    });
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sro-patients-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

// ============ MANUAL CHECK-IN ============
function openManualCheckinModal() {
    if (!currentPatient) return;
    document.getElementById('manualCheckinForm').reset();
    document.getElementById('manualCheckinModal').style.display = 'flex';
}

function closeManualCheckinModal() {
    document.getElementById('manualCheckinModal').style.display = 'none';
}

async function handleManualCheckin(event) {
    event.preventDefault();
    
    const source = document.getElementById('manualSource').value;
    const notes = document.getElementById('manualNotes').value;
    const sourceNote = `[${source.toUpperCase()}] ${notes}`.trim();
    
    try {
        await fetch('/api/checkins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                patient_id: currentPatient.id,
                episode_id: currentPatient.episode_id,
                clinic_id: CLINIC_ID,
                checkin_type: 'manual',
                checkin_date: new Date().toISOString().split('T')[0],
                pain_level: parseInt(document.getElementById('manualPain').value),
                pt_exercises: document.getElementById('manualPT').value === '1',
                medication_taken: document.getElementById('manualMed').value === '1',
                concerns: document.getElementById('manualConcerns').value,
                notes: sourceNote
            })
        });
        
        closeManualCheckinModal();
        await loadPatientCheckins(currentPatient.id);
        await loadPatients();
        await loadStats();
        
        alert('Manual check-in saved!');
    } catch (error) {
        console.error('Error saving manual check-in:', error);
        alert('Error saving check-in. Please try again.');
    }
}

// ============ QUICK RPM LOG ============
function quickRpmLog(patientId, episodeId, patientName) {
    document.getElementById('quickRpmPatientId').value = patientId;
    document.getElementById('quickRpmEpisodeId').value = episodeId;
    document.getElementById('quickRpmPatientName').textContent = patientName;
    document.getElementById('quickRpmForm').reset();
    document.getElementById('quickRpmPatientId').value = patientId;
    document.getElementById('quickRpmEpisodeId').value = episodeId;
    document.getElementById('quickRpmModal').style.display = 'flex';
}

function closeQuickRpmModal() {
    document.getElementById('quickRpmModal').style.display = 'none';
}

async function handleQuickRpmLog(event) {
    event.preventDefault();
    
    const patientId = document.getElementById('quickRpmPatientId').value;
    const episodeId = document.getElementById('quickRpmEpisodeId').value;
    const minutes = parseInt(document.getElementById('quickRpmMinutes').value);
    const durationSeconds = minutes * 60;
    
    const now = new Date();
    const startedAt = new Date(now.getTime() - durationSeconds * 1000);
    
    try {
        await fetch('/api/rpm-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                patient_id: patientId,
                episode_id: episodeId,
                user_id: USER_ID,
                clinic_id: CLINIC_ID,
                started_at: startedAt.toISOString(),
                ended_at: now.toISOString(),
                duration_seconds: durationSeconds,
                activity_type: document.getElementById('quickRpmActivity').value,
                notes: document.getElementById('quickRpmNotes').value
            })
        });
        
        closeQuickRpmModal();
        alert(`Logged ${minutes} minutes of RPM time!`);
    } catch (error) {
        console.error('Error saving RPM log:', error);
        alert('Error saving time. Please try again.');
    }
}

// ============ PROM COMPLIANCE ============
async function loadPromCompliance() {
    try {
        const response = await fetch(`/api/prom-compliance?clinic_id=${CLINIC_ID}`);
        const data = await response.json();
        
        const panel = document.getElementById('promCompliancePanel');
        if (!panel) return;
        
        // Overall stats
        document.getElementById('promComplianceRate').textContent = data.compliance_rate + '%';
        document.getElementById('promCompleted').textContent = data.completed;
        document.getElementById('promDueSoon').textContent = data.due_soon;
        document.getElementById('promOverdue').textContent = data.overdue;
        document.getElementById('promPending').textContent = data.pending;
        
        // Color the compliance rate
        const rateEl = document.getElementById('promComplianceRate');
        if (data.compliance_rate >= 80) rateEl.style.color = '#16a34a';
        else if (data.compliance_rate >= 50) rateEl.style.color = '#d97706';
        else rateEl.style.color = '#dc2626';
        
        // Window breakdown
        const windowNames = { '6_week': '6 Week', '3_month': '3 Month', '1_year': '1 Year' };
        const windowDiv = document.getElementById('promByWindow');
        windowDiv.innerHTML = data.by_window.map(w => {
            const pct = w.total > 0 ? Math.round((w.completed / w.total) * 100) : 0;
            const barColor = pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';
            return `
                <div style="margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                        <span>${windowNames[w.window_name] || w.window_name}</span>
                        <span>${w.completed}/${w.total} (${pct}%)</span>
                    </div>
                    <div style="background: #e5e7eb; border-radius: 4px; height: 8px;">
                        <div style="background: ${barColor}; height: 100%; border-radius: 4px; width: ${pct}%;"></div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Surgeon breakdown
        const surgeonDiv = document.getElementById('promBySurgeon');
        surgeonDiv.innerHTML = data.by_surgeon.map(s => {
            const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
            const barColor = pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';
            return `
                <div style="margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                        <span>Dr. ${s.surgeon_name}</span>
                        <span>${s.completed}/${s.total} (${pct}%)${s.overdue > 0 ? ' <span style="color:#dc2626;">' + s.overdue + ' overdue</span>' : ''}</span>
                    </div>
                    <div style="background: #e5e7eb; border-radius: 4px; height: 8px;">
                        <div style="background: ${barColor}; height: 100%; border-radius: 4px; width: ${pct}%;"></div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Overdue list
        const overdueDiv = document.getElementById('promOverdueList');
        if (data.overdue_patients.length === 0) {
            overdueDiv.innerHTML = '<p style="color: #999;">None — great job!</p>';
        } else {
            overdueDiv.innerHTML = data.overdue_patients.map(p => `
                <div style="padding: 6px 0; border-bottom: 1px solid #f3f4f6; display: flex; justify-content: space-between; cursor:pointer;" onclick="switchTab('patients');openPatientModal('${p.patient_id}')">
                    <span><strong style="color:#2c5aa0;text-decoration:underline;">${p.last_name}, ${p.first_name}</strong> — ${p.assessment_type === 'koos_jr' ? 'KOOS Jr' : p.assessment_type === 'hoos_jr' ? 'HOOS Jr' : 'PROMIS-10'} (${(p.window_name || '').replace('_', ' ')})</span>
                    <span style="color: #dc2626;">Due ${p.due_date}</span>
                </div>
            `).join('');
        }
        
        // Due soon list
        const dueSoonDiv = document.getElementById('promDueSoonList');
        if (data.due_soon_patients.length === 0) {
            dueSoonDiv.innerHTML = '<p style="color: #999;">No PROMs due in the next 14 days.</p>';
        } else {
            dueSoonDiv.innerHTML = data.due_soon_patients.map(p => `
                <div style="padding: 6px 0; border-bottom: 1px solid #f3f4f6; display: flex; justify-content: space-between; align-items: center; cursor:pointer;" onclick="switchTab('patients');openPatientModal('${p.patient_id}')">
                    <span><strong style="color:#2c5aa0;text-decoration:underline;">${p.last_name}, ${p.first_name}</strong> — ${p.assessment_type === 'koos_jr' ? 'KOOS Jr' : p.assessment_type === 'hoos_jr' ? 'HOOS Jr' : 'PROMIS-10'}</span>
                    <span style="color: #d97706;">Due ${p.due_date}</span>
                </div>
            `).join('');
        }
        
    } catch (error) {
        console.error('Error loading PROM compliance:', error);
    }
}

// Load PROM schedule for individual patient modal
async function loadPatientPromSchedule(patientId) {
    const div = document.getElementById('promScheduleList');
    if (!div) return;
    
    try {
        const response = await fetch(`/api/prom-schedule?patient_id=${patientId}`);
        const schedule = await response.json();
        
        if (schedule.length === 0) {
            div.innerHTML = '<p class="text-muted" style="text-align:center;">No PROM schedule generated yet.</p>';
            return;
        }
        
        div.innerHTML = schedule.map(item => {
            const typeLabel = item.assessment_type === 'koos_jr' ? 'KOOS Jr' : item.assessment_type === 'hoos_jr' ? 'HOOS Jr' : 'PROMIS-10';
            const windowLabel = (item.window_name || '').replace('_', ' ');
            
            let statusHtml = '';
            if (item.status === 'completed') {
                statusHtml = `<span style="color: #16a34a; font-weight: 600;">✅ Done ${item.completed_date || ''}</span>`;
            } else if (item.status === 'overdue') {
                statusHtml = `<span style="color: #dc2626; font-weight: 600;">🔴 Overdue</span>`;
            } else {
                const today = new Date();
                const due = new Date(item.due_date);
                const daysUntil = Math.ceil((due - today) / (1000*60*60*24));
                if (daysUntil <= 14 && daysUntil >= 0) {
                    statusHtml = `<span style="color: #d97706; font-weight: 600;">🟡 Due in ${daysUntil}d</span>`;
                } else {
                    statusHtml = `<span style="color: #6b7280;">⏳ ${item.due_date}</span>`;
                }
            }
            
            return `
                <div style="padding: 8px 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${typeLabel}</strong>
                        <span style="color: #9ca3af; font-size: 0.8rem; margin-left: 8px;">${windowLabel}</span>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        ${statusHtml}
                        ${item.status !== 'completed' ? `<button class="btn btn-sm" style="font-size:0.7rem;padding:3px 8px;" onclick="markPromComplete('${item.id}','${patientId}')">Mark Done</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading PROM schedule:', error);
        div.innerHTML = '<p style="color:#ef4444;">Error loading schedule</p>';
    }
}

async function markPromComplete(scheduleId, patientId) {
    try {
        await fetch(`/api/prom-schedule/${scheduleId}/complete`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed_date: new Date().toISOString().split('T')[0] })
        });
        await loadPatientPromSchedule(patientId);
        await loadPromCompliance();
        await loadStats();
    } catch (error) {
        console.error('Error marking PROM complete:', error);
    }
}

// ============ ADVERSE EVENTS ============
async function loadPatientAdverseEvents(patientId) {
    const div = document.getElementById('adverseEventsList');
    if (!div) return;
    
    try {
        const response = await fetch(`/api/adverse-events?patient_id=${patientId}`);
        const events = await response.json();
        
        if (events.length === 0) {
            div.innerHTML = '<p class="text-muted" style="text-align:center;">No adverse events recorded.</p>';
            return;
        }
        
        div.innerHTML = events.map(evt => {
            const typeLabel = {
                'er_visit': '🚨 ER Visit',
                'readmission': '🏥 Readmission',
                'complication': '⚠️ Complication',
                'fall': '🤕 Fall',
                'infection': '🦠 Infection',
                'other': '📋 Other'
            }[evt.event_type] || evt.event_type;
            
            return `
                <div style="padding: 12px; border-bottom: 1px solid #eee; ${evt.resolved ? 'opacity: 0.6;' : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <strong style="color: ${evt.event_type === 'readmission' ? '#7c3aed' : '#dc3545'};">${typeLabel}</strong>
                        <span class="text-muted" style="font-size: 13px;">${evt.event_date}</span>
                    </div>
                    ${evt.facility ? `<div style="font-size: 13px; margin-top: 4px;">📍 ${evt.facility}</div>` : ''}
                    ${evt.reason ? `<div style="font-size: 13px; color: #666; margin-top: 4px;">${evt.reason}</div>` : ''}
                    <div style="font-size: 12px; color: #999; margin-top: 4px;">Reported by: ${evt.reported_by}</div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading adverse events:', error);
        div.innerHTML = '<p style="color: #ef4444;">Error loading events</p>';
    }
}

function openAdverseEventModal() {
    if (!currentPatient) return;
    document.getElementById('adverseEventForm').reset();
    document.getElementById('aeEventDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('adverseEventModal').style.display = 'flex';
}

function closeAdverseEventModal() {
    document.getElementById('adverseEventModal').style.display = 'none';
}

async function handleLogAdverseEvent(event) {
    event.preventDefault();
    
    try {
        await fetch('/api/adverse-events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                patient_id: currentPatient.id,
                episode_id: currentPatient.episode_id,
                clinic_id: CLINIC_ID,
                event_type: document.getElementById('aeEventType').value,
                event_date: document.getElementById('aeEventDate').value,
                facility: document.getElementById('aeFacility').value,
                reason: document.getElementById('aeReason').value,
                reported_by: document.getElementById('aeReportedBy').value
            })
        });
        
        closeAdverseEventModal();
        await loadPatientAdverseEvents(currentPatient.id);
        await loadStats();
        alert('Adverse event logged.');
    } catch (error) {
        console.error('Error logging adverse event:', error);
        alert('Error logging event. Please try again.');
    }
}

// ============ NURSING NOTES ============
async function loadPatientNotes(patientId) {
    const div = document.getElementById('nursingNotesList');
    if (!div) return;
    
    try {
        const response = await fetch(`/api/nursing-notes?patient_id=${patientId}`);
        const notes = await response.json();
        
        if (notes.length === 0) {
            div.innerHTML = '<p class="text-muted" style="text-align:center;">No notes yet.</p>';
            return;
        }
        
        const typeIcons = {
            'phone_call': '📞', 'clinic_visit': '🏥', 'nurse_note': '📝',
            'provider_note': '👨‍⚕️', 'care_coordination': '🤝', 'other': '📋'
        };
        const typeLabels = {
            'phone_call': 'Phone Call', 'clinic_visit': 'Clinic Visit', 'nurse_note': 'Nurse Note',
            'provider_note': 'Provider Note', 'care_coordination': 'Care Coordination', 'other': 'Other'
        };
        
        div.innerHTML = notes.map(n => `
            <div style="padding: 10px 0; border-bottom: 1px solid #eee;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong>${typeIcons[n.note_type] || '📋'} ${typeLabels[n.note_type] || n.note_type}</strong>
                    <span style="color: #999; font-size: 12px;">${new Date(n.created_at).toLocaleString()}${n.author_last ? ' — ' + n.author_first + ' ' + n.author_last : ''}</span>
                </div>
                <div style="margin-top: 6px; color: #333; white-space: pre-wrap;">${n.note_text}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading notes:', error);
        div.innerHTML = '<p style="color:#ef4444;">Error loading notes</p>';
    }
}

function openNoteModal() {
    if (!currentPatient) return;
    document.getElementById('nursingNoteForm').reset();
    document.getElementById('nursingNoteModal').style.display = 'flex';
}

function closeNoteModal() {
    document.getElementById('nursingNoteModal').style.display = 'none';
}

async function handleSaveNote(event) {
    event.preventDefault();
    
    try {
        await fetch('/api/nursing-notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                patient_id: currentPatient.id,
                episode_id: currentPatient.episode_id,
                clinic_id: CLINIC_ID,
                user_id: USER_ID,
                note_type: document.getElementById('noteType').value,
                note_text: document.getElementById('noteText').value
            })
        });
        
        closeNoteModal();
        await loadPatientNotes(currentPatient.id);
    } catch (error) {
        console.error('Error saving note:', error);
        alert('Error saving note.');
    }
}

// ============ AUTO-REFRESH ============
setInterval(async () => {
    // Only refresh if patient modal is NOT open
    if (document.getElementById('patientModal').style.display !== 'flex') {
        await loadStats();
        await loadAlertCaches();
        await loadPatients();
    }
}, 60000);

// ============ SEED / CLEAR DEMO DATA ============
async function seedDemoData() {
    if (!confirm('This will add 6 demo patients with check-in history, preop assessments, and adverse events. Continue?')) return;
    
    try {
        const response = await fetch('/api/seed-demo', { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            alert(data.message);
            await loadPreopAssessments();
            await loadStats();
            await loadPatients();
            await loadPromCompliance();
        } else {
            alert('Error: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error seeding demo data:', error);
        alert('Error seeding demo data.');
    }
}

async function clearDemoData() {
    if (!confirm('This will remove all demo patients and their data. Your real patients will not be affected. Continue?')) return;
    
    try {
        const response = await fetch('/api/clear-demo', { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            alert(data.message);
            await loadPreopAssessments();
            await loadStats();
            await loadPatients();
            await loadPromCompliance();
        } else {
            alert('Error: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error clearing demo data:', error);
    }
}

// ============ LOGOUT ============
function logout() {
    sessionStorage.clear();
    window.location.href = '/index.html';
}
