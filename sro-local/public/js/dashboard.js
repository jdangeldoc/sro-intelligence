// ============ CONFIGURATION ============
const CLINIC_ID = sessionStorage.getItem('clinicId') || '11111111-1111-1111-1111-111111111111';
const USER_ID = sessionStorage.getItem('userId');
const USER_NAME = sessionStorage.getItem('userName') || 'User';
const USER_ROLE = sessionStorage.getItem('userRole') || 'surgeon';

// ============ STATE ============
let patients = [];
let surgeons = [];
let currentPatient = null;
let currentEpisode = null;
let preopAssessments = {}; // Cache for preop assessments
let adverseEventsCache = {}; // Cache for adverse events per patient
let nurseAcksCache = []; // Cache for nurse alert acknowledgments
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

// ============ TOAST NOTIFICATIONS ============
function showToast(message, type) {
    type = type || 'success';
    var container = document.getElementById('toastContainer');
    if (!container) return;
    var toast = document.createElement('div');
    toast.className = 'sro-toast ' + type;
    toast.innerHTML = (type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ') + ' ' + message;
    container.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 3100);
}

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', async () => {
    // Check if logged in
    if (!CLINIC_ID) {
        window.location.href = '/index.html';
        return;
    }
    
    // Set user name and role badge in nav
    const roleLabels = { surgeon: 'Surgeon', nurse: 'Nurse', admin: 'Admin' };
    const roleColors = { surgeon: '#2c5aa0', nurse: '#059669', admin: '#7c3aed' };
    document.getElementById('userName').innerHTML = USER_NAME + 
        ' <span style="background:' + (roleColors[USER_ROLE] || '#6b7280') + 
        ';color:white;padding:2px 8px;border-radius:10px;font-size:0.75rem;margin-left:6px;">' + 
        (roleLabels[USER_ROLE] || USER_ROLE) + '</span>';
    
    // Apply role-based visibility
    applyRoleBasedView();
    
    // Load data
    await loadSurgeons();
    await loadPreopAssessments();
    await loadAlertCaches();
    await loadStats();
    await loadPatients();
    await loadPromCompliance();
    
    // Render nurse panel if nurse role
    if (USER_ROLE === 'nurse') {
        document.getElementById('nursePanel').style.display = 'block';
        // Set welcome text
        document.getElementById('nurseWelcomeText').textContent = 'Welcome back, ' + USER_NAME;
        var activeCount = patients.filter(function(p) { return p.episode_id; }).length;
        document.getElementById('nurseWelcomeSub').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) + '  •  ' + activeCount + ' active patients';
        // Hide the 6-card stat grid (replaced by KPI strip)
        document.querySelector('.stats-grid').style.display = 'none';
        // Hide the flat patient table by default
        var ntableEl = document.querySelector('#panelPatients .table-container');
        var ntoolbarEl = document.querySelector('#panelPatients .toolbar');
        if (ntableEl) ntableEl.style.display = 'none';
        if (ntoolbarEl) ntoolbarEl.style.display = 'none';
        await renderNursePanel();
    }
    
    // Render admin panel if admin role
    if (USER_ROLE === 'admin') {
        document.getElementById('adminPanel').style.display = 'block';
        document.getElementById('adminWelcomeText').textContent = 'Welcome back, ' + USER_NAME;
        document.getElementById('adminWelcomeSub').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        // Hide the 6-card stat grid (replaced by executive sections)
        document.querySelector('.stats-grid').style.display = 'none';
        // Hide the flat patient table by default
        var atableEl = document.querySelector('#panelPatients .table-container');
        var atoolbarEl = document.querySelector('#panelPatients .toolbar');
        if (atableEl) atableEl.style.display = 'none';
        if (atoolbarEl) atoolbarEl.style.display = 'none';
        await renderAdminPanel();
    }
    
    // Render surgeon tiered view
    if (USER_ROLE === 'surgeon') {
        document.getElementById('surgeonWelcome').style.display = 'flex';
        document.getElementById('surgeonKpiStrip').style.display = 'flex';
        document.getElementById('surgeonTieredPanel').style.display = 'block';
        // Set welcome text
        document.getElementById('welcomeText').textContent = 'Welcome back, ' + USER_NAME;
        document.getElementById('welcomeSub').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        // Hide the 6-card stat grid (replaced by KPI strip)
        document.querySelector('.stats-grid').style.display = 'none';
        // Hide the flat patient table by default (tiered view replaces it)
        const tableEl = document.querySelector('#panelPatients .table-container');
        const toolbarEl = document.querySelector('#panelPatients .toolbar');
        if (tableEl) tableEl.style.display = 'none';
        if (toolbarEl) toolbarEl.style.display = 'none';
        renderSurgeonTieredView();
    }
    
    // For surgeons, auto-select their own name in filter
    if (USER_ROLE === 'surgeon' && USER_ID) {
        const filterSurgeon = document.getElementById('filterSurgeon');
        if (filterSurgeon) {
            // Find the option matching this user
            for (let opt of filterSurgeon.options) {
                if (opt.value === USER_ID) {
                    filterSurgeon.value = USER_ID;
                    filterPatients();
                    break;
                }
            }
        }
    }
});

// ============ ROLE-BASED VIEWS ============
function applyRoleBasedView() {
    // Nav links - show/hide based on role
    document.querySelectorAll('.nav-link').forEach(link => {
        const href = link.getAttribute('href');
        if (USER_ROLE === 'nurse') {
            // Nurses: hide Analytics (surgeon tool), Settings (admin tool)
            // Nurses KEEP: Dashboard, Pre-Op, Surg Prep (nurse does insurance, precert, consent, education), Non-Op Plan, RPM Billing
            if (href === '/analytics.html' || href === '/settings.html') link.style.display = 'none';
        } else if (USER_ROLE === 'surgeon') {
            // Surgeons: hide RPM Billing (nurse does this), Settings (admin tool)
            // Surgeons KEEP: Dashboard, Pre-Op (decision tool), Analytics (outcomes)
            if (href === '/rpm-report.html' || href === '/settings.html') link.style.display = 'none';
        }
        // Admin: sees everything
    });
    
    // Demo buttons - admin only
    const demoButtons = document.querySelectorAll('[onclick*="seedDemo"], [onclick*="clearDemo"]');
    if (USER_ROLE !== 'admin') {
        demoButtons.forEach(btn => btn.style.display = 'none');
    }
    
    // Add Patient / Pre-Op Assessment buttons - nurses need both for data entry
    
    // Export CSV - admin and surgeon only
    const exportBtn = document.querySelector('[onclick*="exportPatients"]');
    if (USER_ROLE === 'nurse' && exportBtn) exportBtn.style.display = 'none';
    
    // PROM Compliance tab - visible for all roles (nurses need it for chasing)
    // RPM timer in patient modal - visible for all roles (nurses log call time, surgeons log review time)
}

// ============ SURGEON TIERED DASHBOARD ============
let fullTableVisible = false;

function renderSurgeonTieredView() {
    const surgeonId = USER_ID;
    const myPatients = surgeonId ? patients.filter(p => p.surgeon_id === surgeonId) : patients;
    
    const decisionItems = [];
    const reviewItems = [];
    const doneItems = [];
    
    myPatients.forEach(p => {
        const preop = preopAssessments[p.id];
        const aeList = adverseEventsCache[p.id] || [];
        const overdueProms = promScheduleCache[p.id] || [];
        const erEvents = aeList.filter(e => e.event_type === 'er_visit' && !e.resolved);
        const readmitEvents = aeList.filter(e => e.event_type === 'readmission' && !e.resolved);
        const erCount = erEvents.length;
        const readmitCount = readmitEvents.length;
        
        const daysPostOp = p.surgery_date ? Math.floor((Date.now() - new Date(p.surgery_date)) / (1000*60*60*24)) : null;
        const daysToSurgery = p.surgery_date ? Math.floor((new Date(p.surgery_date) - Date.now()) / (1000*60*60*24)) : null;
        const daysSinceCheckin = p.last_checkin_date ? Math.floor((Date.now() - new Date(p.last_checkin_date)) / (1000*60*60*24)) : null;
        
        const label = p.last_name + ', ' + p.first_name;
        const mrn = p.mrn || '';
        const procedure = p.surgery_type || '-';
        const riskTier = preop ? preop.risk_tier : null;
        
        let dayLabel = '';
        if (daysPostOp !== null && daysPostOp >= 0) dayLabel = 'Day ' + daysPostOp + ' post-op';
        else if (daysToSurgery !== null && daysToSurgery >= 0) dayLabel = daysToSurgery + 'd to surgery';
        
        const base = { patientId: p.id, name: label, mrn: mrn, procedure: procedure, dayLabel: dayLabel, riskTier: riskTier, token: p.token };
        let placedDecision = false;
        let placedReview = false;
        
        function isAcked(alertType) {
            return nurseAcksCache.some(a => a.patient_id === p.id && a.alert_type === alertType);
        }
        
        // === TIER 1: DECISION (must act) ===
        if (readmitCount > 0) {
            decisionItems.push(Object.assign({}, base, { icon: '🏥', issue: 'Readmission reported', issueClass: 'critical', priority: 1, cta: 'View Details', alertType: 'readmission', aeId: readmitEvents[0].id }));
            placedDecision = true;
        }
        if (erCount > 0) {
            decisionItems.push(Object.assign({}, base, { icon: '🚨', issue: 'ER visit reported', issueClass: 'critical', priority: 2, cta: 'View Details', alertType: 'er_visit', aeId: erEvents[0].id }));
            placedDecision = true;
        }
        if (p.last_pain_level >= 7 && !isAcked('high_pain')) {
            decisionItems.push(Object.assign({}, base, { icon: '🔥', issue: 'Pain level: ' + p.last_pain_level + '/10', issueClass: 'critical', priority: 3, cta: 'Review', alertType: 'high_pain' }));
            placedDecision = true;
        }
        if (daysToSurgery !== null && daysToSurgery >= 0 && daysToSurgery <= 7 && !preop) {
            decisionItems.push(Object.assign({}, base, { icon: '⚠️', issue: 'Surgery in ' + daysToSurgery + 'd — no preop', issueClass: 'critical', priority: 2, cta: 'Open PreOp', alertType: 'no_preop' }));
            placedDecision = true;
        }
        if (daysToSurgery !== null && daysToSurgery >= 0 && daysToSurgery <= 7 && riskTier && (riskTier.toUpperCase() === 'HIGH' || riskTier.toUpperCase() === 'VERY HIGH')) {
            decisionItems.push(Object.assign({}, base, { icon: '🔴', issue: 'Surgery in ' + daysToSurgery + 'd — ' + riskTier + ' risk', issueClass: 'critical', priority: 2, cta: 'Decision Tool', alertType: 'workup_urgent' }));
            placedDecision = true;
        }
        
        // === TIER 2: REVIEW (flagged, not urgent) ===
        if (p.last_pain_level >= 4 && p.last_pain_level < 7 && !placedDecision) {
            reviewItems.push(Object.assign({}, base, { icon: '📈', issue: 'Pain at ' + p.last_pain_level + '/10 — monitor', issueClass: 'warning', priority: 4, alertType: 'moderate_pain' }));
            placedReview = true;
        }
        if (daysSinceCheckin !== null && daysSinceCheckin > 3) {
            reviewItems.push(Object.assign({}, base, { icon: '📵', issue: 'No check-in for ' + daysSinceCheckin + ' days', issueClass: 'warning', priority: 5, alertType: 'missed_checkin' }));
            placedReview = true;
        } else if (!p.last_checkin_date && daysPostOp !== null && daysPostOp >= 0) {
            reviewItems.push(Object.assign({}, base, { icon: '📵', issue: 'Never checked in (Day ' + daysPostOp + ')', issueClass: 'warning', priority: 5, alertType: 'missed_checkin' }));
            placedReview = true;
        }
        if (overdueProms.length > 0) {
            var windows = overdueProms.map(function(o) { return (o.window_name || '').replace('_', ' '); }).join(', ');
            reviewItems.push(Object.assign({}, base, { icon: '📋', issue: 'PROM overdue: ' + windows, issueClass: 'info', priority: 6, alertType: 'prom_overdue' }));
            placedReview = true;
        }
        // PT skipped removed — nurse handles this, not surgeon
        
        // === TIER 3: DONE (on track patients only) ===
        if (p.last_checkin_date && daysSinceCheckin !== null && daysSinceCheckin <= 3 && !placedDecision && !placedReview) {
            doneItems.push(Object.assign({}, base, { icon: '✅', text: 'Checked in ' + (daysSinceCheckin === 0 ? 'today' : daysSinceCheckin + 'd ago') + ' — pain ' + (p.last_pain_level != null ? p.last_pain_level : '?') + '/10', priority: 11 }));
        }
        if (p.last_pain_level !== null && p.last_pain_level !== undefined && p.last_pain_level <= 3 && daysSinceCheckin !== null && daysSinceCheckin <= 3 && !placedDecision && !placedReview) {
            doneItems.push(Object.assign({}, base, { icon: '🟢', text: 'On track — low pain, recent check-in', priority: 12 }));
        }
    });
    
    // Sort
    decisionItems.sort(function(a,b){ return a.priority - b.priority; });
    reviewItems.sort(function(a,b){ return a.priority - b.priority; });
    doneItems.sort(function(a,b){ return a.priority - b.priority; });
    
    // Dedup: one entry per patient+issue in decision/review, one per patient in done
    function dedupByKey(arr) {
        var seen = {};
        return arr.filter(function(item) {
            var key = item.patientId + '|' + item.issue;
            if (seen[key]) return false;
            seen[key] = true;
            return true;
        });
    }
    function dedupByPatient(arr) {
        var seen = {};
        return arr.filter(function(item) {
            if (seen[item.patientId]) return false;
            seen[item.patientId] = true;
            return true;
        });
    }
    
    var finalDecision = dedupByKey(decisionItems);
    var finalReview = dedupByKey(reviewItems);
    var finalDone = dedupByPatient(doneItems);
    
    // KPI strip
    var alertCount = finalDecision.length;
    var overduePromCount = 0;
    myPatients.forEach(function(p) { overduePromCount += (promScheduleCache[p.id] || []).length; });
    var totalReadmit = 0;
    myPatients.forEach(function(p) { totalReadmit += (adverseEventsCache[p.id] || []).filter(function(e){ return e.event_type === 'readmission'; }).length; });
    
    document.getElementById('kpiActive').textContent = myPatients.length;
    document.getElementById('kpiAlerts').textContent = alertCount;
    document.getElementById('kpiOverdue').textContent = overduePromCount;
    document.getElementById('kpiReadmissions').textContent = totalReadmit;
    
    // Tier counts
    document.getElementById('tierDecisionCount').textContent = finalDecision.length;
    document.getElementById('tierReviewCount').textContent = finalReview.length;
    document.getElementById('tierDoneCount').textContent = finalDone.length;
    
    // Render Decision
    var decBody = document.getElementById('tierDecisionBody');
    if (finalDecision.length === 0) {
        decBody.innerHTML = '<div class="tier-empty">✅ All clear — no urgent decisions</div>';
    } else {
        decBody.innerHTML = finalDecision.map(renderTierDecisionCard).join('');
    }
    
    // Render Review
    var revBody = document.getElementById('tierReviewBody');
    if (finalReview.length === 0) {
        revBody.innerHTML = '<div class="tier-empty">👍 Nothing flagged — looking good</div>';
    } else {
        revBody.innerHTML = finalReview.map(renderTierReviewCard).join('');
    }
    
    // Render Done
    var doneBody = document.getElementById('tierDoneBody');
    if (finalDone.length === 0) {
        doneBody.innerHTML = '<div class="tier-empty">No completed items</div>';
    } else {
        var maxShow = 5;
        var shown = finalDone.slice(0, maxShow);
        var hidden = finalDone.slice(maxShow);
        var html = shown.map(renderTierDoneCard).join('');
        if (hidden.length > 0) {
            html += '<div class="tier-show-more" onclick="this.style.display=\'none\';document.getElementById(\'tierDoneMore\').style.display=\'block\';">+ ' + hidden.length + ' more</div>';
            html += '<div id="tierDoneMore" style="display:none;">' + hidden.map(renderTierDoneCard).join('') + '</div>';
        }
        doneBody.innerHTML = html;
    }
}

function renderTierDecisionCard(item) {
    var riskHtml = item.riskTier ? '<span class="risk-badge risk-' + item.riskTier.toLowerCase() + '">' + item.riskTier + '</span>' : '';
    var resolveBtn = '';
    if (item.aeId) {
        resolveBtn = '<button class="tier-btn resolve" onclick="event.stopPropagation();resolveAdverseEvent(\'' + item.aeId + '\',\'' + item.patientId + '\')" title="Mark resolved">✓ Resolve</button>';
    } else if (item.alertType) {
        resolveBtn = '<button class="tier-btn ack" onclick="event.stopPropagation();acknowledgeAlert(\'' + item.patientId + '\',\'' + item.alertType + '\')" title="Suppress 24h">✓ Ack</button>';
    }
    return '<div class="tier-item" onclick="openPatientModal(\'' + item.patientId + '\')">' +
        '<div class="tier-item-top"><div>' +
        '<span class="tier-item-name">' + item.name + '</span>' +
        '<span class="tier-item-mrn">' + (item.mrn ? '[' + item.mrn + ']' : '') + '</span>' +
        '</div>' + riskHtml + '</div>' +
        '<div class="tier-item-meta">' +
        '<span class="meta-chip">' + item.procedure + '</span>' +
        '<span class="meta-chip">' + item.dayLabel + '</span>' +
        '</div>' +
        '<div class="tier-item-issue critical">' + item.icon + ' ' + item.issue + '</div>' +
        '<div class="tier-item-actions">' +
        '<button class="tier-btn primary" onclick="event.stopPropagation();openPatientModal(\'' + item.patientId + '\')">' + (item.cta || 'View') + '</button>' +
        '<button class="tier-btn" onclick="event.stopPropagation();window.location.href=\'/preop.html?patient=' + item.patientId + '\'">PreOp</button>' +
        '<button class="tier-btn" onclick="event.stopPropagation();window.location.href=\'/surgical-prep.html?patient=' + item.patientId + '\'">Surg Prep</button>' +
        resolveBtn +
        '</div></div>';
}

function renderTierReviewCard(item) {
    var riskHtml = item.riskTier ? '<span class="risk-badge risk-' + item.riskTier.toLowerCase() + '">' + item.riskTier + '</span>' : '';
    var ackBtn = '';
    if (item.alertType) {
        ackBtn = '<button class="tier-btn ack" onclick="event.stopPropagation();acknowledgeAlert(\'' + item.patientId + '\',\'' + item.alertType + '\')" title="Suppress 24h" style="margin-top:6px;">✓ Ack</button>';
    }
    return '<div class="tier-item" onclick="openPatientModal(\'' + item.patientId + '\')">' +
        '<div class="tier-item-top"><div>' +
        '<span class="tier-item-name">' + item.name + '</span>' +
        '<span class="tier-item-mrn">' + (item.mrn ? '[' + item.mrn + ']' : '') + '</span>' +
        '</div>' + riskHtml + '</div>' +
        '<div class="tier-item-meta">' +
        '<span class="meta-chip">' + item.procedure + '</span>' +
        '<span class="meta-chip">' + item.dayLabel + '</span>' +
        '</div>' +
        '<div class="tier-item-issue ' + item.issueClass + '">' + item.icon + ' ' + item.issue + '</div>' +
        '<div class="tier-item-actions" style="margin-top:4px;">' +
        '<button class="tier-btn" onclick="event.stopPropagation();openPatientModal(\'' + item.patientId + '\')">View</button>' +
        ackBtn +
        '</div></div>';
}

function renderTierDoneCard(item) {
    return '<div class="tier-item" onclick="openPatientModal(\'' + item.patientId + '\')">' +
        '<div class="done-check">' + item.icon + ' ' + item.text + '</div>' +
        '<div style="font-size:0.75rem;color:#6b7280;margin-top:2px;">' + item.name + ' ' + (item.mrn ? '[' + item.mrn + ']' : '') + ' &bull; ' + item.procedure + '</div>' +
        '</div>';
}

function toggleFullPatientTable() {
    var tableEl = document.querySelector('#panelPatients .table-container');
    var toolbarEl = document.querySelector('#panelPatients .toolbar');
    fullTableVisible = !fullTableVisible;
    if (fullTableVisible) {
        if (tableEl) tableEl.style.display = 'block';
        if (toolbarEl) toolbarEl.style.display = 'flex';
    } else {
        if (tableEl) tableEl.style.display = 'none';
        if (toolbarEl) toolbarEl.style.display = 'none';
    }
}

// ============ NURSE ACTION PANEL ============
async function renderNursePanel() {
    // Load due-soon PROMs (pending, due within 14 days)
    let dueSoonProms = [];
    try {
        const resp = await fetch(`/api/prom-schedule?clinic_id=${CLINIC_ID}&status=pending`);
        const pending = await resp.json();
        const now = new Date();
        const in14 = new Date(now.getTime() + 14*24*60*60*1000);
        dueSoonProms = pending.filter(p => new Date(p.due_date) <= in14);
    } catch(e) {}
    
    const criticalItems = [];
    const complianceItems = [];
    const infoItems = [];
    
    patients.forEach(p => {
        const daysPostOp = p.surgery_date ? Math.floor((Date.now() - new Date(p.surgery_date)) / (1000*60*60*24)) : null;
        const daysToSurgery = p.surgery_date ? Math.floor((new Date(p.surgery_date) - Date.now()) / (1000*60*60*24)) : null;
        const daysSinceCheckin = p.last_checkin_date ? Math.floor((Date.now() - new Date(p.last_checkin_date)) / (1000*60*60*24)) : null;
        const surgeonName = p.surgeon_first_name ? 'Dr. ' + p.surgeon_last_name : '';
        const patientLabel = p.last_name + ', ' + p.first_name + (p.mrn ? ' [' + p.mrn + ']' : '');
        const detailStr = surgeonName + (daysPostOp !== null && daysPostOp >= 0 ? ' • Day ' + daysPostOp : (daysToSurgery !== null && daysToSurgery >= 0 ? ' • ' + daysToSurgery + 'd to surgery' : ''));
        
        const aeList = adverseEventsCache[p.id] || [];
        const erEvents = aeList.filter(e => e.event_type === 'er_visit' && !e.resolved);
        const readmitEvents = aeList.filter(e => e.event_type === 'readmission' && !e.resolved);
        const resolvedER = aeList.filter(e => e.event_type === 'er_visit' && e.resolved);
        const resolvedReadmit = aeList.filter(e => e.event_type === 'readmission' && e.resolved);
        const overdueProms = promScheduleCache[p.id] || [];
        const preop = preopAssessments[p.id];
        
        // Check if this patient+alert_type is acknowledged
        function isAcked(alertType) {
            return nurseAcksCache.some(a => a.patient_id === p.id && a.alert_type === alertType);
        }
        
        // === TIER 1: CRITICAL ===
        if (readmitEvents.length > 0 && !isAcked('readmission')) {
            criticalItems.push({ icon: '🏥', patient: patientLabel, patientId: p.id, issueClass: 'crit',
                issue: 'Readmission reported' + (readmitEvents[0].facility ? ' — ' + readmitEvents[0].facility : ''),
                detail: detailStr, token: p.token, priority: 1, alertType: 'readmission', aeId: readmitEvents[0].id });
        }
        if (erEvents.length > 0 && !isAcked('er_visit')) {
            criticalItems.push({ icon: '🚨', patient: patientLabel, patientId: p.id, issueClass: 'crit',
                issue: 'ER visit reported' + (erEvents[0].facility ? ' — ' + erEvents[0].facility : ''),
                detail: detailStr, token: p.token, priority: 2, alertType: 'er_visit', aeId: erEvents[0].id });
        }
        if (p.last_pain_level >= 8 && !isAcked('high_pain')) {
            criticalItems.push({ icon: '🔥', patient: patientLabel, patientId: p.id, issueClass: 'crit',
                issue: 'Severe pain: ' + p.last_pain_level + '/10',
                detail: detailStr + ' • Last check-in: ' + (p.last_checkin_date || 'Never'), token: p.token, priority: 3, alertType: 'high_pain' });
        }
        // Surgery within 5 days — workup incomplete
        if (daysToSurgery !== null && daysToSurgery >= 0 && daysToSurgery <= 5 && preop && preop.risk_tier && preop.risk_tier.toUpperCase() !== 'LOW') {
            criticalItems.push({ icon: '⚠️', patient: patientLabel, patientId: p.id, issueClass: 'crit',
                issue: 'Surgery in ' + daysToSurgery + 'd — ' + preop.risk_tier + ' risk, review workup',
                detail: detailStr, token: p.token, priority: 2, alertType: 'workup_urgent' });
        }
        if (daysToSurgery !== null && daysToSurgery >= 0 && daysToSurgery <= 5 && !preop) {
            criticalItems.push({ icon: '⚠️', patient: patientLabel, patientId: p.id, issueClass: 'crit',
                issue: 'Surgery in ' + daysToSurgery + 'd — no preop on file',
                detail: detailStr, token: p.token, priority: 2, alertType: 'no_preop' });
        }
        // High pain 7 (not severe 8+, which is critical above)
        if (p.last_pain_level === 7 && !isAcked('high_pain')) {
            criticalItems.push({ icon: '🔥', patient: patientLabel, patientId: p.id, issueClass: 'crit',
                issue: 'High pain: 7/10',
                detail: detailStr, token: p.token, priority: 4, alertType: 'high_pain' });
        }
        
        // === TIER 2: COMPLIANCE ===
        if (overdueProms.length > 0) {
            const windowNames = overdueProms.map(o => (o.window_name || '').replace('_', ' ')).join(', ');
            complianceItems.push({ icon: '📋', patient: patientLabel, patientId: p.id, issueClass: 'warn',
                issue: 'PROM overdue: ' + windowNames,
                detail: detailStr, token: p.token, priority: 5, alertType: 'prom_overdue' });
        }
        if (daysSinceCheckin !== null && daysSinceCheckin > 3 && !isAcked('missed_checkin')) {
            complianceItems.push({ icon: '📵', patient: patientLabel, patientId: p.id, issueClass: 'warn',
                issue: 'No check-in for ' + daysSinceCheckin + ' days',
                detail: detailStr, token: p.token, priority: 6, alertType: 'missed_checkin' });
        } else if (!p.last_checkin_date && daysPostOp !== null && daysPostOp >= 0 && !isAcked('missed_checkin')) {
            complianceItems.push({ icon: '📵', patient: patientLabel, patientId: p.id, issueClass: 'warn',
                issue: 'Never checked in (Day ' + daysPostOp + ' post-op)',
                detail: detailStr, token: p.token, priority: 6, alertType: 'missed_checkin' });
        }
        if (p.last_pt_exercises === 0 && !isAcked('skipped_pt')) {
            complianceItems.push({ icon: '🏋️', patient: patientLabel, patientId: p.id, issueClass: 'warn',
                issue: 'Skipped PT exercises',
                detail: detailStr + ' • Last check-in: ' + (p.last_checkin_date || 'Never'), token: p.token, priority: 7, alertType: 'skipped_pt' });
        }
        // Preop incomplete but surgery not imminent (>5 days)
        if (daysToSurgery !== null && daysToSurgery > 5 && daysToSurgery <= 30 && !preop) {
            complianceItems.push({ icon: '📝', patient: patientLabel, patientId: p.id, issueClass: 'info-text',
                issue: 'Preop not started — surgery in ' + daysToSurgery + ' days',
                detail: detailStr, token: p.token, priority: 8, alertType: 'preop_needed' });
        }
        
        // === TIER 3: INFORMATIONAL ===
        // Moderate pain 4-6 (not high)
        if (p.last_pain_level >= 4 && p.last_pain_level <= 6) {
            infoItems.push({ icon: '📈', patient: patientLabel, patientId: p.id, issueClass: 'info-text',
                issue: 'Pain at ' + p.last_pain_level + '/10 — monitoring',
                detail: detailStr, token: p.token, priority: 9 });
        }
        // On track patients
        if (p.last_pain_level !== null && p.last_pain_level !== undefined && p.last_pain_level <= 3 && daysSinceCheckin !== null && daysSinceCheckin <= 3) {
            infoItems.push({ icon: '🟢', patient: patientLabel, patientId: p.id, issueClass: 'good-text',
                issue: 'On track — pain ' + p.last_pain_level + '/10, checked in ' + (daysSinceCheckin === 0 ? 'today' : daysSinceCheckin + 'd ago'),
                detail: detailStr, token: p.token, priority: 12 });
        }
    });
    
    // Add due-soon PROMs to informational
    dueSoonProms.forEach(ps => {
        const daysUntil = Math.floor((new Date(ps.due_date) - Date.now()) / (1000*60*60*24));
        const alreadyHasOverdue = complianceItems.some(i => i.patientId === ps.patient_id && i.icon === '📋');
        if (!alreadyHasOverdue) {
            infoItems.push({
                icon: '🕐', issueClass: 'info-text',
                patient: (ps.last_name || '') + ', ' + (ps.first_name || '') + (ps.mrn ? ' [' + ps.mrn + ']' : ''),
                patientId: ps.patient_id,
                issue: (ps.window_name || '').replace('_', ' ') + ' PROM due in ' + Math.max(0, daysUntil) + ' days',
                detail: (ps.surgeon_first ? 'Dr. ' + ps.surgeon_last : ''),
                token: null, priority: 10
            });
        }
    });
    
    // Sort each tier
    criticalItems.sort((a,b) => a.priority - b.priority);
    complianceItems.sort((a,b) => a.priority - b.priority);
    infoItems.sort((a,b) => a.priority - b.priority);
    
    // KPI calculations
    const activePatients = patients.filter(p => p.episode_id);
    const recentCheckins = activePatients.filter(p => {
        if (!p.last_checkin_date) return false;
        return Math.floor((Date.now() - new Date(p.last_checkin_date)) / (1000*60*60*24)) <= 3;
    });
    const checkinRate = activePatients.length > 0 ? Math.round((recentCheckins.length / activePatients.length) * 100) : 0;
    
    // PROM compliance
    let promRate = '--';
    try {
        const promResp = await fetch(`/api/prom-compliance?clinic_id=${CLINIC_ID}`);
        const promData = await promResp.json();
        promRate = promData.compliance_rate;
    } catch(e) {}
    
    // RPM eligible
    let rpmEligible = 0;
    try {
        const billingMonth = new Date().toISOString().slice(0, 7);
        const rpmResp = await fetch(`/api/rpm-summary?clinic_id=${CLINIC_ID}&billing_month=${billingMonth}`);
        const rpmData = await rpmResp.json();
        rpmEligible = rpmData.filter(r => r.total_seconds >= 1200).length;
    } catch(e) {}
    
    // Set KPI values with dynamic pill coloring
    var promEl = document.getElementById('nkpiPromRate');
    promEl.textContent = promRate + '%';
    promEl.style.color = '';  // Let CSS class handle it
    var promPill = promEl.closest('.nurse-kpi-pill');
    promPill.className = 'nurse-kpi-pill ' + (promRate >= 80 ? 'nkpi-green' : promRate >= 50 ? 'nkpi-amber' : 'nkpi-red');
    
    var ciEl = document.getElementById('nkpiCheckinRate');
    ciEl.textContent = checkinRate + '%';
    ciEl.style.color = '';
    var ciPill = ciEl.closest('.nurse-kpi-pill');
    ciPill.className = 'nurse-kpi-pill ' + (checkinRate >= 80 ? 'nkpi-green' : checkinRate >= 50 ? 'nkpi-amber' : 'nkpi-red');
    
    document.getElementById('nkpiRpmEligible').textContent = rpmEligible;
    var rpmPill = document.getElementById('nkpiRpmEligible').closest('.nurse-kpi-pill');
    rpmPill.className = 'nurse-kpi-pill ' + (rpmEligible >= 5 ? 'nkpi-green' : rpmEligible >= 1 ? 'nkpi-amber' : '');
    rpmPill.style.borderLeftColor = rpmEligible >= 1 ? '' : 'var(--sro-gray-300)';
    
    document.getElementById('nkpiCriticalCount').textContent = criticalItems.length;
    var critPill = document.getElementById('nkpiCriticalCount').closest('.nurse-kpi-pill');
    critPill.className = 'nurse-kpi-pill ' + (criticalItems.length === 0 ? 'nkpi-green' : 'nkpi-red');
    document.getElementById('nkpiCriticalCount').style.color = '';
    
    // Render tiers
    document.getElementById('nurseCritCount').textContent = criticalItems.length;
    document.getElementById('nurseCompCount').textContent = complianceItems.length;
    document.getElementById('nurseInfoCount').textContent = infoItems.length;
    
    var critBody = document.getElementById('nurseCritBody');
    critBody.innerHTML = criticalItems.length === 0 ?
        '<div class="nt-empty">✅ No critical items — all stable</div>' :
        criticalItems.map(renderNurseTierItem).join('');
    
    var compBody = document.getElementById('nurseCompBody');
    compBody.innerHTML = complianceItems.length === 0 ?
        '<div class="nt-empty">👍 All caught up</div>' :
        complianceItems.map(renderNurseTierItem).join('');
    
    var infoBody = document.getElementById('nurseInfoBody');
    if (infoItems.length === 0) {
        infoBody.innerHTML = '<div class="nt-empty">Nothing upcoming</div>';
    } else {
        var maxShow = 8;
        var shown = infoItems.slice(0, maxShow);
        var hidden = infoItems.slice(maxShow);
        var html = shown.map(renderNurseTierItem).join('');
        if (hidden.length > 0) {
            html += '<div class="tier-show-more" onclick="this.style.display=\'none\';document.getElementById(\'nurseInfoMore\').style.display=\'block\';">+ ' + hidden.length + ' more</div>';
            html += '<div id="nurseInfoMore" style="display:none;">' + hidden.map(renderNurseTierItem).join('') + '</div>';
        }
        infoBody.innerHTML = html;
    }
    
    // Auto-collapse informational if items exist in critical or compliance
    if ((criticalItems.length > 0 || complianceItems.length > 0) && infoItems.length > 3) {
        infoBody.classList.add('collapsed');
        document.getElementById('nurseInfoToggle').textContent = '▶';
    }
}

function renderNurseTierItem(item) {
    var linkBtn = item.token ? '<button class="nt-btn" onclick="event.stopPropagation();nurseQuickCopyLink(\'' + item.token + '\')">📋 Link</button>' : '';
    // Resolve button for adverse events (ER/readmission)
    var resolveBtn = '';
    if (item.aeId) {
        resolveBtn = '<button class="nt-btn nt-resolve" onclick="event.stopPropagation();resolveAdverseEvent(\'' + item.aeId + '\',\'' + item.patientId + '\')" title="Mark resolved">✓ Resolve</button>';
    }
    // Ack button for all other dismissable alerts
    var ackBtn = '';
    if (item.alertType && !item.aeId) {
        ackBtn = '<button class="nt-btn nt-ack" onclick="event.stopPropagation();acknowledgeAlert(\'' + item.patientId + '\',\'' + item.alertType + '\')" title="Suppress for 24h">✓ Ack</button>';
    }
    return '<div class="nt-item" onclick="openPatientModal(\'' + item.patientId + '\')">' +
        '<div class="nt-item-icon">' + item.icon + '</div>' +
        '<div class="nt-item-body">' +
        '<div class="nt-item-patient">' + item.patient + '</div>' +
        '<div class="nt-item-issue ' + item.issueClass + '">' + item.issue + '</div>' +
        '<div class="nt-item-detail">' + item.detail + '</div>' +
        '</div>' +
        '<div class="nt-item-actions">' +
        '<button class="nt-btn nt-primary" onclick="event.stopPropagation();openPatientModal(\'' + item.patientId + '\')">View</button>' +
        linkBtn +
        '<button class="nt-btn" onclick="event.stopPropagation();nurseQuickNote(\'' + item.patientId + '\')">📝 Note</button>' +
        resolveBtn + ackBtn +
        '</div></div>';
}

function toggleNurseTier(bodyId) {
    var body = document.getElementById(bodyId);
    if (!body) return;
    body.classList.toggle('collapsed');
    // Update toggle arrow
    var toggleId = bodyId.replace('Body', 'Toggle');
    var toggle = document.getElementById(toggleId);
    if (toggle) toggle.textContent = body.classList.contains('collapsed') ? '▶' : '▼';
}

let nurseFullTableVisible = false;
function toggleNurseFullTable() {
    var tableEl = document.querySelector('#panelPatients .table-container');
    var toolbarEl = document.querySelector('#panelPatients .toolbar');
    nurseFullTableVisible = !nurseFullTableVisible;
    if (nurseFullTableVisible) {
        if (tableEl) tableEl.style.display = 'block';
        if (toolbarEl) toolbarEl.style.display = 'flex';
    } else {
        if (tableEl) tableEl.style.display = 'none';
        if (toolbarEl) toolbarEl.style.display = 'none';
    }
}

function nurseQuickCopyLink(token) {
    const url = 'https://sro-cloud-relay.onrender.com/checkin.html?t=' + token;
    navigator.clipboard.writeText(url).then(() => {
        showToast('Check-in link copied!');
    });
}

function nurseQuickNote(patientId) {
    // Open patient modal and scroll to notes
    openPatientModal(patientId).then(() => {
        setTimeout(() => {
            const notesSection = document.getElementById('nursingNotesList');
            if (notesSection) notesSection.scrollIntoView({ behavior: 'smooth' });
            openNoteModal();
        }, 500);
    });
}

async function resolveAdverseEvent(aeId, patientId) {
    if (!confirm('Mark this event as resolved?')) return;
    try {
        const resp = await fetch('/api/adverse-events/' + aeId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolved: true, resolved_by: USER_NAME || 'staff' })
        });
        const result = await resp.json();
        if (!resp.ok || !result.success) {
            console.error('Resolve failed:', result);
            showToast('Error: ' + (result.error || 'unknown'), 'error');
            return;
        }
        showToast('Event resolved');
        await loadAlertCaches();
        if (USER_ROLE === 'nurse') await renderNursePanel();
        if (USER_ROLE === 'surgeon') renderSurgeonTieredView();
    } catch(e) {
        console.error('resolveAdverseEvent error:', e);
        showToast('Error resolving event', 'error');
    }
}

async function acknowledgeAlert(patientId, alertType) {
    try {
        const resp = await fetch('/api/nurse-ack', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                patient_id: patientId,
                clinic_id: CLINIC_ID,
                alert_type: alertType,
                acknowledged_by: USER_NAME || 'staff',
                hours: 24
            })
        });
        const result = await resp.json();
        if (!resp.ok || !result.success) {
            console.error('Ack failed:', result);
            showToast('Error: ' + (result.error || 'unknown'), 'error');
            return;
        }
        showToast('Alert acknowledged (24h)');
        await loadAlertCaches();
        if (USER_ROLE === 'nurse') await renderNursePanel();
        if (USER_ROLE === 'surgeon') renderSurgeonTieredView();
    } catch(e) {
        console.error('acknowledgeAlert error:', e);
        showToast('Error acknowledging alert', 'error');
    }
}

// ============ ADMIN EXECUTIVE DASHBOARD ============

let adminFullTableVisible = false;
function toggleAdminFullTable() {
    var tableEl = document.querySelector('#panelPatients .table-container');
    var toolbarEl = document.querySelector('#panelPatients .toolbar');
    adminFullTableVisible = !adminFullTableVisible;
    if (adminFullTableVisible) {
        if (tableEl) tableEl.style.display = 'block';
        if (toolbarEl) toolbarEl.style.display = 'flex';
    } else {
        if (tableEl) tableEl.style.display = 'none';
        if (toolbarEl) toolbarEl.style.display = 'none';
    }
}

// ============ ADMIN EXECUTIVE DASHBOARD ============
// TODO: Pull from a `baselines` or `snapshots` table once we have historical data.
// These represent the practice's metrics BEFORE SRO was implemented.
const ADMIN_BASELINES = {
    promCompliance: 22,    // % — industry average for paper-based PROM collection
    matchedRate: 18,       // % — pre/post matched pair rate before SRO
    readmissionRate: 4.2,  // % — national TKA/THA 90-day readmission average
    rpmRevenue: 0          // $ — no RPM billing before system existed
};

// --- Medicare reimbursement constants ---
// TODO: Update these annually when CMS publishes new rates
const RPM_RATE_99457 = 51;   // First 20 minutes of RPM per patient per month
const RPM_RATE_99458 = 41;   // Each additional 20 minutes
// TEAM APU (Applicable Percentage Update): Penalty range is 0% to -5% of episode spending
// Placeholder: average TKA/THA episode = $25,000. Adjust for actual Medicare volume.
const AVG_EPISODE_COST = 25000;
// Default annual Medicare joint volume for the practice — PLACEHOLDER
// TODO: Replace with actual volume from clinic settings or a config table
const ANNUAL_MEDICARE_JOINTS = 100;

function switchAdminView(view) {
    document.getElementById('adminExecView').style.display = view === 'exec' ? 'block' : 'none';
    document.getElementById('adminDetailView').style.display = view === 'detail' ? 'block' : 'none';
    document.getElementById('adminTabExec').classList.toggle('active', view === 'exec');
    document.getElementById('adminTabDetail').classList.toggle('active', view === 'detail');
}

async function renderAdminPanel() {
    const today = new Date();
    const billingMonth = today.toISOString().slice(0, 7);

    // =========================================================
    // GATHER DATA — all API calls up front
    // =========================================================

    // 1) PROM compliance
    let promData = { compliance_rate: 0, total: 0, completed: 0, overdue: 0, by_surgeon: [], by_window: [] };
    try {
        const resp = await fetch(`/api/prom-compliance?clinic_id=${CLINIC_ID}`);
        promData = await resp.json();
    } catch(e) { console.error('Admin: PROM load error', e); }

    // 2) RPM summary for this month
    let rpmData = [];
    try {
        const resp = await fetch(`/api/rpm-summary?clinic_id=${CLINIC_ID}&billing_month=${billingMonth}`);
        rpmData = await resp.json();
    } catch(e) { console.error('Admin: RPM load error', e); }

    // 3) CMS outcomes (SCB rates)
    let cmsData = { overall_scb_rate: null, tka_scb_rate: null, tha_scb_rate: null };
    try {
        const resp = await fetch(`/api/analytics/cms-outcomes?clinic_id=${CLINIC_ID}`);
        cmsData = await resp.json();
    } catch(e) { console.error('Admin: CMS outcomes load error', e); }

    // =========================================================
    // COMPUTE METRICS
    // =========================================================

    // --- RPM Revenue ---
    const eligible99457 = rpmData.filter(r => (r.total_seconds || 0) >= 1200).length;  // ≥20 min
    const eligible99458 = rpmData.filter(r => (r.total_seconds || 0) >= 2400).length;  // ≥40 min
    const rpmEarned = (eligible99457 * RPM_RATE_99457) + (eligible99458 * RPM_RATE_99458);

    // RPM at risk: patients with 10–19 minutes logged (close to 20-min threshold, recoverable)
    const atRiskPatients = rpmData.filter(r => {
        const sec = r.total_seconds || 0;
        return sec >= 600 && sec < 1200;  // 10–19 min
    });
    const rpmAtRisk = atRiskPatients.length * RPM_RATE_99457; // potential revenue if they hit 20 min

    // --- PROM Matched Rate ---
    // "Matched" = patients with BOTH pre-op and at least one post-op PROM
    // We approximate from CMS data: patients with postop scores / total patients with preop
    const cmsResults = cmsData.results || [];
    const withPreop = cmsResults.filter(r => r.preop_score !== null);
    const withBoth = cmsResults.filter(r => r.has_postop);
    const matchedRate = withPreop.length > 0 ? Math.round((withBoth.length / withPreop.length) * 100) : 0;

    // --- TEAM APU Penalty Exposure ---
    // If PROM matched rate < 50%, practice faces up to -5% APU on TEAM episode spending
    // Formula: (ANNUAL_MEDICARE_JOINTS * AVG_EPISODE_COST) * penalty_percent
    // penalty_percent scales: 0% at ≥50% matched, up to -5% at 0% matched
    // Simplified: linear interpolation between 0% matched → 5% penalty, 50% matched → 0% penalty
    let penaltyPercent = 0;
    if (matchedRate < 50) {
        penaltyPercent = ((50 - matchedRate) / 50) * 5; // linear scale 0-5%
    }
    const annualEpisodeSpend = ANNUAL_MEDICARE_JOINTS * AVG_EPISODE_COST;
    const quarterlySpend = annualEpisodeSpend / 4;
    const apuExposure = Math.round((annualEpisodeSpend * penaltyPercent) / 100);

    // --- Revenue Protected ---
    // What we'd lose without SRO minus what we lose with SRO
    // Baseline penalty (using baseline matched rate):
    let baselinePenaltyPct = 0;
    if (ADMIN_BASELINES.matchedRate < 50) {
        baselinePenaltyPct = ((50 - ADMIN_BASELINES.matchedRate) / 50) * 5;
    }
    const baselinePenalty = Math.round((annualEpisodeSpend * baselinePenaltyPct) / 100);
    const penaltyAvoided = Math.max(0, baselinePenalty - apuExposure);
    const revenueProtected = penaltyAvoided + rpmEarned;

    // --- Readmission & ER rates ---
    const activePatients = patients.filter(p => p.episode_id);
    const postOpPatients = activePatients.filter(p => {
        if (!p.surgery_date) return false;
        return new Date(p.surgery_date) < Date.now();
    });
    let readmitCount = 0;
    let erCount = 0;
    postOpPatients.forEach(p => {
        const ae = adverseEventsCache[p.id] || [];
        if (ae.some(e => e.event_type === 'readmission')) readmitCount++;
        if (ae.some(e => e.event_type === 'er_visit')) erCount++;
    });
    const readmitRate = postOpPatients.length > 0 ? ((readmitCount / postOpPatients.length) * 100) : 0;
    const erRate = postOpPatients.length > 0 ? ((erCount / postOpPatients.length) * 100) : 0;

    // --- Alert counts for detailed view ---
    let alertHighPain = 0, alertNoCheckin = 0, alertOverdueProm = 0, alertAE = 0;
    activePatients.forEach(p => {
        if (p.last_pain_level >= 7) alertHighPain++;
        const days = p.last_checkin_date ? Math.floor((Date.now() - new Date(p.last_checkin_date)) / (1000*60*60*24)) : 999;
        if (days > 3) alertNoCheckin++;
        if ((promScheduleCache[p.id] || []).length > 0) alertOverdueProm++;
        if ((adverseEventsCache[p.id] || []).length > 0) alertAE++;
    });

    // --- Quality Composite Score ---
    // Simple weighted composite: 40% SCB rate, 30% (1 - readmission rate), 30% PROM compliance
    // Normalized to 0-100 scale
    const scbRate = cmsData.overall_scb_rate !== null ? cmsData.overall_scb_rate : 0;
    const qualityScore = Math.round(
        (scbRate * 0.4) +
        ((100 - readmitRate) * 0.3) +
        (promData.compliance_rate * 0.3)
    );
    // Baseline quality score for comparison
    const baselineQuality = Math.round(
        (0 * 0.4) +  // No SCB data at baseline
        ((100 - ADMIN_BASELINES.readmissionRate) * 0.3) +
        (ADMIN_BASELINES.promCompliance * 0.3)
    );

    // =========================================================
    // RENDER SECTION 1: Revenue Protection
    // =========================================================
    document.getElementById('admRevEarned').textContent = '$' + rpmEarned.toLocaleString();
    document.getElementById('admRevEarnedNote').textContent = eligible99457 + ' × 99457 + ' + eligible99458 + ' × 99458 this month';
    
    document.getElementById('admRevAtRisk').textContent = '$' + rpmAtRisk.toLocaleString();
    document.getElementById('admRevAtRiskNote').textContent = atRiskPatients.length + ' patient' + (atRiskPatients.length !== 1 ? 's' : '') + ' at 10–19 min (need 20)';
    
    document.getElementById('admApuExposure').textContent = apuExposure > 0 ? '-$' + apuExposure.toLocaleString() : '$0';
    document.getElementById('admApuNote').textContent = matchedRate >= 50 ? 'Matched rate ≥50% — no penalty' : 'Matched rate ' + matchedRate + '% (<50%) — ' + penaltyPercent.toFixed(1) + '% APU risk';
    var apuEl = document.getElementById('admApuExposure');
    apuEl.style.color = apuExposure > 0 ? '#dc2626' : '#059669';
    
    document.getElementById('admRevProtected').textContent = '$' + revenueProtected.toLocaleString();
    document.getElementById('admRevProtectedNote').textContent = '$' + penaltyAvoided.toLocaleString() + ' penalty avoided + $' + rpmEarned.toLocaleString() + ' RPM earned';

    // =========================================================
    // RENDER SECTION 2: Baseline vs Current
    // =========================================================
    function setCompareCard(arrowId, currentId, currentVal, baselineVal, suffix, invertBetter) {
        var el = document.getElementById(currentId);
        if (el) el.textContent = currentVal + suffix;
        var arrowEl = document.getElementById(arrowId);
        if (!arrowEl) return;
        var better = invertBetter ? currentVal < baselineVal : currentVal > baselineVal;
        var worse = invertBetter ? currentVal > baselineVal : currentVal < baselineVal;
        if (better) {
            arrowEl.textContent = '▲';
            arrowEl.className = 'admin-compare-arrow up';
        } else if (worse) {
            arrowEl.textContent = '▼';
            arrowEl.className = 'admin-compare-arrow down';
        } else {
            arrowEl.textContent = '→';
            arrowEl.className = 'admin-compare-arrow flat';
        }
        // Color the current value
        if (el) el.style.color = better ? '#059669' : worse ? '#dc2626' : '#1a1a2e';
    }
    setCompareCard('admArrowProm', 'admCurrentProm', promData.compliance_rate, ADMIN_BASELINES.promCompliance, '%', false);
    setCompareCard('admArrowMatched', 'admCurrentMatched', matchedRate, ADMIN_BASELINES.matchedRate, '%', false);
    setCompareCard('admArrowReadmit', 'admCurrentReadmit', readmitRate.toFixed(1), ADMIN_BASELINES.readmissionRate, '%', true);
    setCompareCard('admArrowRpm', 'admCurrentRpm', rpmEarned, ADMIN_BASELINES.rpmRevenue, '', false);
    // Format RPM as dollar
    document.getElementById('admCurrentRpm').textContent = '$' + rpmEarned.toLocaleString();
    document.getElementById('admBaselineRpm').textContent = '$' + ADMIN_BASELINES.rpmRevenue.toLocaleString();

    // =========================================================
    // RENDER SECTION 3: TEAM Quality Composite
    // =========================================================
    function setTeamMetric(valId, deltaId, current, baseline, suffix, invertBetter) {
        var el = document.getElementById(valId);
        if (el) el.textContent = (current !== null && current !== undefined ? current + suffix : '--');
        var dEl = document.getElementById(deltaId);
        if (!dEl || baseline === null || baseline === undefined || current === null) { if (dEl) dEl.textContent = ''; return; }
        var diff = current - baseline;
        var better = invertBetter ? diff < 0 : diff > 0;
        var worse = invertBetter ? diff > 0 : diff < 0;
        if (better) {
            dEl.innerHTML = '<span style="color:#059669;">▲ ' + Math.abs(diff).toFixed(1) + suffix + ' improvement</span>';
        } else if (worse) {
            dEl.innerHTML = '<span style="color:#dc2626;">▼ ' + Math.abs(diff).toFixed(1) + suffix + ' decline</span>';
        } else {
            dEl.innerHTML = '<span style="color:#9ca3af;">→ No change</span>';
        }
    }
    setTeamMetric('admScbRate', 'admScbDelta', scbRate, 0, '%', false); // baseline SCB = 0 (no data before)
    setTeamMetric('admTeamReadmit', 'admReadmitDelta', parseFloat(readmitRate.toFixed(1)), ADMIN_BASELINES.readmissionRate, '%', true);
    setTeamMetric('admTeamEr', 'admErDelta', parseFloat(erRate.toFixed(1)), null, '%', true); // no baseline for ER
    setTeamMetric('admQualityScore', 'admQualityDelta', qualityScore, baselineQuality, '', false);

    // =========================================================
    // RENDER SECTION 4: Forecasting
    // =========================================================
    // Quarterly projections: current month × 3
    document.getElementById('admForecastRpm').textContent = '$' + (rpmEarned * 3).toLocaleString();
    document.getElementById('admForecastProm').textContent = promData.compliance_rate + '%';
    
    var readmitTrend = readmitRate < ADMIN_BASELINES.readmissionRate ? '↓ Improving' : readmitRate > ADMIN_BASELINES.readmissionRate ? '↑ Worsening' : '→ Stable';
    var readmitColor = readmitRate < ADMIN_BASELINES.readmissionRate ? '#059669' : readmitRate > ADMIN_BASELINES.readmissionRate ? '#dc2626' : '#6b7280';
    var trendEl = document.getElementById('admForecastReadmit');
    trendEl.textContent = readmitTrend;
    trendEl.style.color = readmitColor;
    
    document.getElementById('admForecastPenalty').textContent = '$' + (revenueProtected * 3).toLocaleString();

    // =========================================================
    // RENDER DETAILED METRICS (surgeon bars, RPM detail, alerts)
    // =========================================================

    // Surgeon PROM bars
    var surgeonDiv = document.getElementById('adminPromBySurgeon');
    if (promData.by_surgeon && promData.by_surgeon.length > 0) {
        surgeonDiv.innerHTML = promData.by_surgeon.map(function(s) {
            var pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
            var barColor = pct >= 80 ? '#059669' : pct >= 50 ? '#d97706' : '#dc2626';
            return '<div class="admin-surgeon-bar">' +
                '<div class="admin-surgeon-bar-header">' +
                '<span>Dr. ' + s.surgeon_name + '</span>' +
                '<span>' + s.completed + '/' + s.total + ' (' + pct + '%)' + (s.overdue > 0 ? ' · <span style="color:#dc2626;">' + s.overdue + ' overdue</span>' : '') + '</span>' +
                '</div>' +
                '<div class="admin-surgeon-bar-track"><div class="admin-surgeon-bar-fill" style="background:' + barColor + ';width:' + pct + '%;"></div></div>' +
                '</div>';
        }).join('');
    } else {
        surgeonDiv.innerHTML = '<div style="color:#9ca3af;text-align:center;padding:16px;">No PROM data yet</div>';
    }

    // RPM billing detail
    var rpmDiv = document.getElementById('adminRpmSummary');
    document.getElementById('adminRpmMonth').textContent = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    var totalMin = rpmData.reduce(function(s, r) { return s + (r.total_seconds || 0); }, 0) / 60;
    var patientsWithTime = rpmData.filter(function(r) { return (r.total_seconds || 0) > 0; }).length;
    rpmDiv.innerHTML =
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px;">' +
        '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;text-align:center;">' +
        '<div style="font-size:1.5rem;font-weight:800;color:#059669;">' + eligible99457 + '</div>' +
        '<div style="font-size:0.72rem;color:#6b7280;">99457 Eligible (≥20m)</div></div>' +
        '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;text-align:center;">' +
        '<div style="font-size:1.5rem;font-weight:800;color:#059669;">' + eligible99458 + '</div>' +
        '<div style="font-size:0.72rem;color:#6b7280;">99458 Eligible (≥40m)</div></div>' +
        '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px;text-align:center;">' +
        '<div style="font-size:1.5rem;font-weight:800;color:#d97706;">' + atRiskPatients.length + '</div>' +
        '<div style="font-size:0.72rem;color:#6b7280;">At Risk (10–19m)</div></div>' +
        '</div>' +
        '<div style="font-size:0.85rem;color:#374151;">' + Math.round(totalMin) + ' total minutes · ' + patientsWithTime + ' patients tracked · Est. revenue: <strong style="color:#059669;">$' + rpmEarned.toLocaleString() + '</strong></div>';

    // Alert breakdown
    var alertDiv = document.getElementById('adminAlertBreakdown');
    var totalAlerts = alertHighPain + alertNoCheckin + alertOverdueProm + alertAE;
    if (totalAlerts === 0) {
        alertDiv.innerHTML = '<div style="color:#059669;text-align:center;padding:16px;">✅ No active alerts — all patients stable</div>';
    } else {
        alertDiv.innerHTML =
            '<div class="admin-alert-row"><div class="admin-alert-badge" style="background:#dc2626;">' + alertHighPain + '</div><div>High pain (≥7/10)</div></div>' +
            '<div class="admin-alert-row"><div class="admin-alert-badge" style="background:#d97706;">' + alertNoCheckin + '</div><div>Check-in overdue (>3 days)</div></div>' +
            '<div class="admin-alert-row"><div class="admin-alert-badge" style="background:#7c3aed;">' + alertOverdueProm + '</div><div>PROM overdue</div></div>' +
            '<div class="admin-alert-row"><div class="admin-alert-badge" style="background:#0891b2;">' + alertAE + '</div><div>Adverse events (ER/readmission)</div></div>';
    }
}

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
        
        // Load nurse alert acknowledgments
        try {
            const ackResp = await fetch(`/api/nurse-acks?clinic_id=${CLINIC_ID}`);
            nurseAcksCache = await ackResp.json();
        } catch(e) { nurseAcksCache = []; }
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
        tabPatients.classList.add('active');
        tabProm.classList.remove('active');
    } else {
        patientsPanel.style.display = 'none';
        promPanel.style.display = 'block';
        tabProm.classList.add('active');
        tabPatients.classList.remove('active');
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
        if (card) card.style.outline = '3px solid var(--sro-blue, #2c5aa0)';
    }
    renderPatientTable();
}

// ============ DATA LOADING ============
async function loadStats() {
    try {
        const surgeonId = document.getElementById('filterSurgeon')?.value || 'all';
        let url = `/api/dashboard-stats?clinic_id=${CLINIC_ID}`;
        if (surgeonId !== 'all') url += `&surgeon_id=${surgeonId}`;
        const response = await fetch(url);
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
                    ${patient.mrn ? ` <span style="color:#6b7280;font-size:0.8rem;font-weight:400;">[${patient.mrn}]</span>` : ''}
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
    loadStats();
    renderPatientTable();
    renderAdminPanel();
}

// ============ PATIENT MODAL ============
async function openPatientModal(patientId) {
    currentPatient = patients.find(p => p.id === patientId);
    if (!currentPatient) return;
    
    currentEpisode = { id: currentPatient.episode_id };
    
    // Show modal
    document.getElementById('patientModal').style.display = 'flex';
    document.getElementById('modalPatientName').innerHTML = 
        `${currentPatient.first_name} ${currentPatient.last_name}` +
        (currentPatient.mrn ? ` <span style="font-size:0.8rem;color:#6b7280;font-weight:400;">[${currentPatient.mrn}]</span>` : '');
    
    // RPM timer: visible for all roles (nurses log call time, surgeons log review time)
    document.getElementById('startReviewBtn').style.display = 'block';
    document.getElementById('rpmTimer').style.display = 'none';
    
    // Show summary card for surgeon AND nurse roles
    const summaryCard = document.getElementById('surgeonSummaryCard');
    if (summaryCard) {
        if (USER_ROLE === 'surgeon' || USER_ROLE === 'nurse') {
            summaryCard.style.display = 'block';
            try { renderSurgeonSummary(patientId); } catch(e) { console.error('Summary card error:', e); }
            // For nurses: hide surgeon-only action buttons, show nurse-relevant ones
            if (USER_ROLE === 'nurse') {
                var projEl = document.getElementById('sumProjected');
                if (projEl) projEl.parentElement.style.display = 'none'; // hide projected score
                var prepLink = document.getElementById('sumSurgPrepLink');
                if (prepLink) prepLink.textContent = '📋 Surg Prep';
            } else {
                var projEl2 = document.getElementById('sumProjected');
                if (projEl2) projEl2.parentElement.style.display = '';
            }
        } else {
            summaryCard.style.display = 'none';
        }
    }
    
    // Load patient details — each wrapped to prevent cascade failures
    renderPatientInfo();
    renderSurgeryInfo();
    renderCheckinLink();
    try { await loadPatientCheckins(patientId); } catch(e) { console.error('Checkins error:', e); }
    try { await loadPatientPreopInfo(patientId); } catch(e) { console.error('Preop error:', e); }
    try { await loadPatientPromSchedule(patientId); } catch(e) { console.error('PROM schedule error:', e); }
    try { await loadPatientAdverseEvents(patientId); } catch(e) { console.error('Adverse events error:', e); }
    try { await loadPatientNotes(patientId); } catch(e) { console.error('Notes error:', e); }
    try { await loadComplianceScorecard(patientId); } catch(e) { console.error('Scorecard error:', e); }
    try { await loadPromTrendChart(patientId); } catch(e) { console.error('PROM trend error:', e); }
    try { await loadPatientTasks(patientId); } catch(e) { console.error('Tasks error:', e); }
}

// ============ SURGEON QUICK SUMMARY CARD ============
function renderSurgeonSummary(patientId) {
    const patient = patients.find(p => p.id === patientId);
    const preop = preopAssessments[patientId];
    
    // Pain (from latest check-in)
    const painEl = document.getElementById('sumPain');
    const painVal = patient?.last_pain_level;
    if (painVal !== null && painVal !== undefined) {
        painEl.textContent = painVal;
        painEl.style.color = painVal <= 3 ? '#22c55e' : painVal <= 6 ? '#fbbf24' : '#ef4444';
    } else {
        painEl.textContent = '-';
        painEl.style.color = '#64748b';
    }
    
    // BMI
    const bmiEl = document.getElementById('sumBMI');
    if (preop?.bmi) {
        bmiEl.textContent = parseFloat(preop.bmi).toFixed(1);
        bmiEl.style.color = preop.bmi >= 40 ? '#ef4444' : preop.bmi >= 35 ? '#f97316' : preop.bmi >= 30 ? '#fbbf24' : '#22c55e';
    } else {
        bmiEl.textContent = '-';
        bmiEl.style.color = '#64748b';
    }
    
    // Joint Score
    const scoreEl = document.getElementById('sumJointScore');
    const labelEl = document.getElementById('sumJointLabel');
    if (preop?.joint_score_preop) {
        scoreEl.textContent = Math.round(preop.joint_score_preop);
        labelEl.textContent = preop.joint_score_type === 'koos_jr' ? 'KOOS Jr' : preop.joint_score_type === 'hoos_jr' ? 'HOOS Jr' : 'SCORE';
        scoreEl.style.color = '#60a5fa';
    } else {
        scoreEl.textContent = '-';
        labelEl.textContent = 'SCORE';
    }
    
    // Projected
    const projEl = document.getElementById('sumProjected');
    if (preop?.projected_postop_score) {
        projEl.textContent = Math.round(preop.projected_postop_score);
    } else {
        projEl.textContent = '-';
        projEl.style.color = '#64748b';
    }
    
    // Risk badge
    const riskEl = document.getElementById('sumRiskBadge');
    if (preop?.risk_tier) {
        const tier = preop.risk_tier.toUpperCase();
        const colors = { LOW: '#22c55e', MODERATE: '#fbbf24', HIGH: '#ef4444' };
        riskEl.innerHTML = '<span style="background:' + (colors[tier] || '#6b7280') + 
            ';color:' + (tier === 'MODERATE' ? '#000' : '#fff') + 
            ';padding:4px 14px;border-radius:12px;font-size:0.85rem;font-weight:700;">' + tier + '</span>';
    } else {
        riskEl.innerHTML = '<span style="color:#64748b;">N/A</span>';
    }
    
    // Surgery + Days + Age
    document.getElementById('sumSurgery').textContent = patient?.surgery_type || '-';
    if (patient?.surgery_date) {
        const days = Math.floor((Date.now() - new Date(patient.surgery_date)) / (1000*60*60*24));
        document.getElementById('sumDays').textContent = days >= 0 ? 'Day ' + days + ' post-op' : Math.abs(days) + ' days to surgery';
    } else {
        document.getElementById('sumDays').textContent = 'No surgery date';
    }
    document.getElementById('sumAge').textContent = preop?.age ? preop.age + ' yo' : (patient?.date_of_birth ? Math.floor((Date.now() - new Date(patient.date_of_birth)) / (365.25*24*60*60*1000)) + ' yo' : '-');
    
    // Alert Badges
    const badgesEl = document.getElementById('sumBadges');
    let badges = [];
    
    // Parse comorbidities
    let comorbidities = [];
    if (preop?.comorbidities) {
        try { comorbidities = JSON.parse(preop.comorbidities); } catch(e) {}
    }
    
    // High-risk comorbidity badges
    const highRiskConditions = {
        'depression': '🧠 Depression',
        'anxiety': '😰 Anxiety', 
        'chf': '❤️ CHF',
        'ckd': '🫘 CKD',
        'copd': '🫁 COPD',
        'diabetes_insulin': '💉 Insulin-Dep Diabetes',
        'diabetes': '🩸 Diabetes',
        'liver_disease': '🟤 Liver Disease',
        'sleep_apnea': '😴 Sleep Apnea',
        'afib': '💗 Afib',
        'anticoagul': '💊 Anticoagulant',
        'rheumatoid': '🦴 RA/Inflammatory',
        'anemia': '🩸 Anemia',
        'smoking': '🚬 Active Smoker',
        'dental': '🦷 Dental Risk'
    };
    
    comorbidities.forEach(c => {
        const key = typeof c === 'string' ? c : c.id || c.code || '';
        const keyLower = key.toLowerCase();
        for (const [match, label] of Object.entries(highRiskConditions)) {
            if (keyLower.includes(match)) {
                badges.push({ label: label, color: '#dc2626', bg: 'rgba(220,38,38,0.15)' });
                break;
            }
        }
    });
    
    // BMI flag
    if (preop?.bmi >= 40) {
        badges.push({ label: '⚠️ Morbid Obesity', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' });
    } else if (preop?.bmi >= 35) {
        badges.push({ label: '⚠️ Obesity II', color: '#f97316', bg: 'rgba(249,115,22,0.15)' });
    }
    
    // Opioid flag
    if (preop?.chronic_narcotics_use === 1) {
        badges.push({ label: '💊 Chronic Opioids', color: '#dc2626', bg: 'rgba(220,38,38,0.15)' });
    }
    
    // Mental health (PROMIS Mental T-score < 42 = concern)
    if (preop?.promis_mental_tscore && preop.promis_mental_tscore < 42) {
        badges.push({ label: '🧠 Mental Health Flag', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' });
    }
    
    // Low back pain
    if (preop?.low_back_pain === 1) {
        badges.push({ label: '🔙 Low Back Pain', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' });
    }
    
    // ER visits / readmissions from cache
    const aeList = adverseEventsCache[patientId] || [];
    const erCount = aeList.filter(e => e.event_type === 'er_visit').length;
    const readmitCount = aeList.filter(e => e.event_type === 'readmission').length;
    if (erCount > 0) {
        badges.push({ label: '🏥 ER Visit (' + erCount + ')', color: '#7c3aed', bg: 'rgba(124,58,237,0.15)' });
    }
    if (readmitCount > 0) {
        badges.push({ label: '🔄 Readmission (' + readmitCount + ')', color: '#6366f1', bg: 'rgba(99,102,241,0.15)' });
    }
    
    // PROM overdue
    const overdueProms = promScheduleCache[patientId] || [];
    if (overdueProms.length > 0) {
        badges.push({ label: '📋 PROM Overdue (' + overdueProms.length + ')', color: '#dc2626', bg: 'rgba(220,38,38,0.15)' });
    }
    
    // No issues
    if (badges.length === 0 && preop) {
        badges.push({ label: '✅ No Flags', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' });
    }
    
    badgesEl.innerHTML = badges.map(b => 
        '<span style="display:inline-block;padding:4px 10px;border-radius:8px;font-size:0.75rem;font-weight:600;color:' + b.color + ';background:' + b.bg + ';border:1px solid ' + b.color + '22;">' + b.label + '</span>'
    ).join('');
    
    // PreOp link
    document.getElementById('sumPreopLink').href = '/preop.html?patient=' + patientId;
    document.getElementById('sumNonopLink').href = '/nonop-plan.html?patient=' + patientId;
    document.getElementById('sumSurgPrepLink').href = '/surgical-prep.html?patient=' + patientId;
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
    showToast('Check-in link copied!');
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

function openEpisodeTimeline() {
    if (!currentPatient) return;
    window.open(`/episode-timeline.html?patient=${currentPatient.id}`, '_blank');
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
        
        showToast('Patient added successfully!');
    } catch (error) {
        console.error('Error adding patient:', error);
        showToast('Error adding patient.', 'error');
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
        showToast('Review time logged!');
    } catch (error) {
        console.error('Error saving RPM log:', error);
        showToast('Error saving review time.', 'error');
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
        
        showToast('Manual check-in saved!');
    } catch (error) {
        console.error('Error saving manual check-in:', error);
        showToast('Error saving check-in.', 'error');
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
        showToast(`Logged ${minutes} min of RPM time!`);
    } catch (error) {
        console.error('Error saving RPM log:', error);
        showToast('Error saving RPM time.', 'error');
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
                <div style="padding: 6px 0; border-bottom: 1px solid #f3f4f6; display: flex; justify-content: space-between; align-items: center;">
                    <span style="cursor:pointer;" onclick="switchTab('patients');openPatientModal('${p.patient_id}')"><strong style="color:#2c5aa0;text-decoration:underline;">${p.last_name}, ${p.first_name}</strong>${p.mrn ? ' <span style="color:#6b7280;font-weight:400;">[' + p.mrn + ']</span>' : ''} — ${p.assessment_type === 'koos_jr' ? 'KOOS Jr' : p.assessment_type === 'hoos_jr' ? 'HOOS Jr' : 'PROMIS-10'} (${(p.window_name || '').replace('_', ' ')})</span>
                    <div style="display:flex;align-items:center;gap:6px;">
                        <span style="color: #dc2626;font-size:0.8rem;">Due ${p.due_date}</span>
                        ${p.token ? '<button class="btn btn-sm" style="font-size:0.7rem;padding:3px 8px;background:#eff6ff;border:1px solid #bfdbfe;color:#2563eb;border-radius:5px;cursor:pointer;" onclick="event.stopPropagation();navigator.clipboard.writeText(\'https://sro-cloud-relay.onrender.com/checkin.html?t=' + p.token + '\').then(function(){showToast(\'PROM link copied!\')})">📋 Link</button>' : ''}
                    </div>
                </div>
            `).join('');
        }
        
        // Due soon list
        const dueSoonDiv = document.getElementById('promDueSoonList');
        if (data.due_soon_patients.length === 0) {
            dueSoonDiv.innerHTML = '<p style="color: #999;">No PROMs due in the next 14 days.</p>';
        } else {
            dueSoonDiv.innerHTML = data.due_soon_patients.map(p => `
                <div style="padding: 6px 0; border-bottom: 1px solid #f3f4f6; display: flex; justify-content: space-between; align-items: center;">
                    <span style="cursor:pointer;" onclick="switchTab('patients');openPatientModal('${p.patient_id}')"><strong style="color:#2c5aa0;text-decoration:underline;">${p.last_name}, ${p.first_name}</strong>${p.mrn ? ' <span style="color:#6b7280;font-weight:400;">[' + p.mrn + ']</span>' : ''} — ${p.assessment_type === 'koos_jr' ? 'KOOS Jr' : p.assessment_type === 'hoos_jr' ? 'HOOS Jr' : 'PROMIS-10'}</span>
                    <div style="display:flex;align-items:center;gap:6px;">
                        <span style="color: #d97706;font-size:0.8rem;">Due ${p.due_date}</span>
                        ${p.token ? '<button class="btn btn-sm" style="font-size:0.7rem;padding:3px 8px;background:#eff6ff;border:1px solid #bfdbfe;color:#2563eb;border-radius:5px;cursor:pointer;" onclick="event.stopPropagation();navigator.clipboard.writeText(\'https://sro-cloud-relay.onrender.com/checkin.html?t=' + p.token + '\').then(function(){showToast(\'PROM link copied!\')})">📋 Link</button>' : ''}
                    </div>
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
            
            const resolvedBadge = evt.resolved ? '<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:4px;font-size:0.72rem;font-weight:600;">✓ Resolved' + (evt.resolved_by ? ' by ' + evt.resolved_by : '') + '</span>' : '';
            const resolveBtn = evt.resolved
                ? '<button onclick="unresolveAdverseEvent(\'' + evt.id + '\')" style="font-size:0.72rem;padding:3px 8px;background:#f3f4f6;border:1px solid #d1d5db;border-radius:5px;cursor:pointer;color:#6b7280;">Undo Resolve</button>'
                : '<button onclick="resolveAdverseEventModal(\'' + evt.id + '\')" style="font-size:0.72rem;padding:3px 8px;background:#dbeafe;border:1px solid #93c5fd;border-radius:5px;cursor:pointer;color:#1d4ed8;font-weight:600;">✓ Resolve</button>';
            
            return `
                <div style="padding: 12px; border-bottom: 1px solid #eee; ${evt.resolved ? 'background:#f9fafb;' : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display:flex;gap:8px;align-items:center;">
                            <strong style="color: ${evt.resolved ? '#6b7280' : evt.event_type === 'readmission' ? '#7c3aed' : '#dc3545'};">${typeLabel}</strong>
                            ${resolvedBadge}
                        </div>
                        <div style="display:flex;gap:8px;align-items:center;">
                            <span class="text-muted" style="font-size: 13px;">${evt.event_date}</span>
                            ${resolveBtn}
                        </div>
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

async function resolveAdverseEventModal(aeId) {
    try {
        await fetch('/api/adverse-events/' + aeId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolved: true, resolved_by: USER_NAME || 'staff' })
        });
        showToast('Event resolved');
        if (currentPatient) loadPatientAdverseEvents(currentPatient.id);
        await loadAlertCaches();
        if (USER_ROLE === 'nurse') await renderNursePanel();
    } catch(e) { showToast('Error resolving event', 'error'); }
}

async function unresolveAdverseEvent(aeId) {
    try {
        await fetch('/api/adverse-events/' + aeId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolved: false })
        });
        showToast('Resolution undone');
        if (currentPatient) loadPatientAdverseEvents(currentPatient.id);
        await loadAlertCaches();
        if (USER_ROLE === 'nurse') await renderNursePanel();
    } catch(e) { showToast('Error', 'error'); }
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
        showToast('Adverse event logged.');
    } catch (error) {
        console.error('Error logging adverse event:', error);
        showToast('Error logging event.', 'error');
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
        showToast('Error saving note.', 'error');
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
            showToast(data.message);
            await loadPreopAssessments();
            await loadStats();
            await loadPatients();
            await loadPromCompliance();
        } else {
            showToast('Error: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error seeding demo data:', error);
        showToast('Error seeding demo data.', 'error');
    }
}

async function clearDemoData() {
    if (!confirm('This will remove all demo patients and their data. Your real patients will not be affected. Continue?')) return;
    
    try {
        const response = await fetch('/api/clear-demo', { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            showToast(data.message);
            await loadPreopAssessments();
            await loadStats();
            await loadPatients();
            await loadPromCompliance();
        } else {
            showToast('Error: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Error clearing demo data:', error);
    }
}

// ============ TASKS / TO-DO ============
async function loadPatientTasks(patientId) {
    try {
        const resp = await fetch(`/api/tasks?patient_id=${patientId}`);
        const tasks = await resp.json();
        const container = document.getElementById('tasksList');
        if (!tasks.length) {
            container.innerHTML = '<p class="text-muted">No tasks.</p>';
            return;
        }

        const priorityIcons = { high: '🔴', medium: '🟡', low: '🟢' };
        const categoryIcons = { follow_up: '📞', workup: '🔬', prom: '📈', referral: '📋', documentation: '📄', other: '📌' };

        let html = '';
        tasks.forEach(t => {
            const isDone = t.status === 'completed';
            const overdue = t.due_date && !isDone && new Date(t.due_date) < new Date();
            const bgColor = isDone ? '#f0fdf4' : overdue ? '#fef2f2' : '#ffffff';
            const textDecor = isDone ? 'line-through' : 'none';
            const opacity = isDone ? '0.6' : '1';

            html += `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;margin-bottom:6px;background:${bgColor};border-radius:6px;border:1px solid #f3f4f6;opacity:${opacity};">`;
            html += `<input type="checkbox" ${isDone ? 'checked' : ''} onchange="toggleTask('${t.id}', this.checked)" style="width:18px;height:18px;cursor:pointer;">`;
            html += `<div style="flex:1;text-decoration:${textDecor};">`;
            html += `<div style="font-weight:600;font-size:0.85rem;">${categoryIcons[t.category] || '📌'} ${t.description}</div>`;
            const meta = [];
            if (t.priority) meta.push(`${priorityIcons[t.priority] || ''} ${t.priority}`);
            if (t.due_date) {
                const dueStr = new Date(t.due_date + 'T00:00:00').toLocaleDateString();
                meta.push(overdue ? `<span style="color:#dc2626;font-weight:700;">Due: ${dueStr} (OVERDUE)</span>` : `Due: ${dueStr}`);
            }
            if (t.assigned_to) meta.push(`→ ${t.assigned_to}`);
            if (meta.length) html += `<div style="font-size:0.75rem;color:#9ca3af;margin-top:2px;">${meta.join(' &nbsp;•&nbsp; ')}</div>`;
            html += `</div>`;
            html += `<button onclick="deleteTask('${t.id}')" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:1rem;padding:4px;" title="Delete">×</button>`;
            html += `</div>`;
        });
        container.innerHTML = html;
    } catch(e) { console.error('Load tasks error:', e); }
}

function openTaskModal() {
    document.getElementById('taskModal').style.display = 'flex';
    document.getElementById('taskDescription').value = '';
    document.getElementById('taskCategory').value = 'follow_up';
    document.getElementById('taskPriority').value = 'medium';
    document.getElementById('taskDueDate').value = '';
    document.getElementById('taskAssignedTo').value = '';
    document.getElementById('taskDescription').focus();
}

function closeTaskModal() {
    document.getElementById('taskModal').style.display = 'none';
}

async function saveTask() {
    if (!currentPatient) return;
    const desc = document.getElementById('taskDescription').value.trim();
    if (!desc) { showToast('Enter a task description.', 'error'); return; }

    const body = {
        patient_id: currentPatient.id,
        episode_id: currentPatient.episode_id || null,
        clinic_id: CLINIC_ID,
        description: desc,
        category: document.getElementById('taskCategory').value,
        priority: document.getElementById('taskPriority').value,
        due_date: document.getElementById('taskDueDate').value || null,
        assigned_to: document.getElementById('taskAssignedTo').value.trim() || null,
        created_by: USER_NAME
    };

    try {
        await fetch('/api/tasks', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
        closeTaskModal();
        await loadPatientTasks(currentPatient.id);
    } catch(e) { console.error('Save task error:', e); }
}

async function toggleTask(taskId, completed) {
    try {
        await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ status: completed ? 'completed' : 'pending' })
        });
        if (currentPatient) await loadPatientTasks(currentPatient.id);
    } catch(e) { console.error('Toggle task error:', e); }
}

async function deleteTask(taskId) {
    if (!confirm('Delete this task?')) return;
    try {
        await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
        if (currentPatient) await loadPatientTasks(currentPatient.id);
    } catch(e) { console.error('Delete task error:', e); }
}

// ============ PDF EPISODE SUMMARY EXPORT ============
async function exportEpisodePDF() {
    if (!currentPatient) return;
    const p = currentPatient;

    // Gather all data
    let checkins = [], proms = [], preops = [], adverse = [], notes = [], tasks = [];
    try { checkins = await (await fetch(`/api/checkins?patient_id=${p.id}`)).json(); } catch(e){}
    try { proms = await (await fetch(`/api/pro-assessments?patient_id=${p.id}`)).json(); } catch(e){}
    try { preops = await (await fetch(`/api/preop-assessments?patient_id=${p.id}`)).json(); } catch(e){}
    try { adverse = await (await fetch(`/api/adverse-events?patient_id=${p.id}`)).json(); } catch(e){}
    try { notes = await (await fetch(`/api/nursing-notes?patient_id=${p.id}`)).json(); } catch(e){}
    try { tasks = await (await fetch(`/api/tasks?patient_id=${p.id}`)).json(); } catch(e){}

    const age = p.date_of_birth ? Math.floor((Date.now() - new Date(p.date_of_birth)) / (365.25*24*60*60*1000)) : '-';

    let html = `<!DOCTYPE html><html><head><title>Episode Summary — ${p.first_name} ${p.last_name}</title>
    <style>
        body { font-family: Arial, Helvetica, sans-serif; padding: 32px; font-size: 11px; color: #1e293b; line-height: 1.5; }
        h1 { font-size: 18px; color: #1e3a5f; margin: 0 0 4px 0; }
        h2 { font-size: 13px; color: #1e3a5f; border-bottom: 2px solid #2c5aa0; padding-bottom: 3px; margin: 18px 0 8px 0; }
        .header { display: flex; justify-content: space-between; border-bottom: 3px solid #1e3a5f; padding-bottom: 8px; margin-bottom: 16px; }
        .header-right { text-align: right; font-size: 10px; color: #6b7280; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 12px; }
        .info-item { padding: 6px 8px; background: #f8fafc; border-radius: 4px; }
        .info-label { font-size: 9px; color: #6b7280; text-transform: uppercase; font-weight: 700; }
        .info-val { font-size: 12px; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px; }
        th { background: #f1f5f9; padding: 5px 6px; text-align: left; font-weight: 700; border-bottom: 1px solid #cbd5e1; }
        td { padding: 4px 6px; border-bottom: 1px solid #f1f5f9; }
        .badge { display: inline-block; padding: 1px 6px; border-radius: 8px; font-size: 9px; font-weight: 700; }
        .red { background: #fef2f2; color: #dc2626; }
        .green { background: #f0fdf4; color: #059669; }
        .yellow { background: #fffbeb; color: #d97706; }
        .footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #9ca3af; text-align: center; }
        @media print { body { padding: 16px; } }
    </style></head><body>`;

    // Header
    html += `<div class="header"><div><h1>${p.first_name} ${p.last_name}</h1>`;
    html += `<div style="font-size:10px;color:#6b7280;">MRN: ${p.mrn || '-'} &nbsp;|&nbsp; DOB: ${p.date_of_birth || '-'} (Age ${age}) &nbsp;|&nbsp; ${p.procedure_type || '-'}</div></div>`;
    html += `<div class="header-right">Episode Summary Report<br>Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}<br>SRO Intelligence</div></div>`;

    // Patient Info Grid
    html += `<div class="info-grid">`;
    html += `<div class="info-item"><div class="info-label">Surgeon</div><div class="info-val">${p.surgeon_name || '-'}</div></div>`;
    html += `<div class="info-item"><div class="info-label">Surgery Date</div><div class="info-val">${p.surgery_date ? new Date(p.surgery_date).toLocaleDateString() : 'Not scheduled'}</div></div>`;
    html += `<div class="info-item"><div class="info-label">Procedure</div><div class="info-val">${p.procedure_type || '-'}</div></div>`;
    html += `</div>`;

    // PreOp Assessment
    if (preops.length) {
        const pre = preops[0];
        html += `<h2>Pre-Operative Assessment</h2>`;
        html += `<div class="info-grid">`;
        html += `<div class="info-item"><div class="info-label">BMI</div><div class="info-val">${pre.bmi ? parseFloat(pre.bmi).toFixed(1) : '-'}</div></div>`;
        html += `<div class="info-item"><div class="info-label">ASA Class</div><div class="info-val">${pre.asa_class || '-'}</div></div>`;
        html += `<div class="info-item"><div class="info-label">Pre-Op Score</div><div class="info-val">${pre.joint_score_preop ? Math.round(pre.joint_score_preop) : '-'}</div></div>`;
        html += `</div>`;
        if (pre.comorbidities) {
            const cList = pre.comorbidities.split(',').filter(c => c.trim());
            if (cList.length) html += `<div style="margin-bottom:8px;"><strong>Comorbidities:</strong> ${cList.join(', ')}</div>`;
        }
    }

    // PROMs
    if (proms.length) {
        html += `<h2>Patient-Reported Outcome Measures</h2>`;
        html += `<table><tr><th>Date</th><th>Type</th><th>Period</th><th>Score</th></tr>`;
        proms.forEach(pr => {
            const type = pr.assessment_type === 'koos_jr' ? 'KOOS Jr' : pr.assessment_type === 'hoos_jr' ? 'HOOS Jr' : 'PROMIS-10';
            const period = (pr.collection_period || 'preop').replace(/_/g, ' ');
            const score = Math.round(pr.score || pr.interval_score || 0);
            html += `<tr><td>${pr.assessment_date ? new Date(pr.assessment_date).toLocaleDateString() : '-'}</td><td>${type}</td><td>${period}</td><td><strong>${score}</strong>/100</td></tr>`;
        });
        html += `</table>`;
    }

    // Check-ins (last 14)
    if (checkins.length) {
        html += `<h2>Check-in History (Last 14)</h2>`;
        html += `<table><tr><th>Date</th><th>Pain</th><th>PT</th><th>ROM</th><th>Swelling</th><th>Concerns</th></tr>`;
        checkins.slice(0, 14).forEach(c => {
            const pc = c.pain_level <= 3 ? 'green' : c.pain_level <= 6 ? 'yellow' : 'red';
            html += `<tr><td>${c.checkin_date ? new Date(c.checkin_date).toLocaleDateString() : '-'}</td>`;
            html += `<td><span class="badge ${pc}">${c.pain_level}/10</span></td>`;
            html += `<td>${c.pt_exercises ? '✅' : '❌'}</td>`;
            html += `<td>${c.rom_flexion ? c.rom_flexion + '°' : '-'}</td>`;
            html += `<td>${c.swelling || '-'}</td>`;
            html += `<td>${(c.concerns || '-').substring(0, 60)}</td></tr>`;
        });
        html += `</table>`;
    }

    // Adverse Events
    if (adverse.length) {
        html += `<h2>Adverse Events</h2>`;
        html += `<table><tr><th>Date</th><th>Type</th><th>Description</th></tr>`;
        adverse.forEach(a => {
            html += `<tr><td>${a.event_date ? new Date(a.event_date).toLocaleDateString() : '-'}</td>`;
            html += `<td><span class="badge red">${(a.event_type || '').replace(/_/g, ' ')}</span></td>`;
            html += `<td>${a.description || '-'}</td></tr>`;
        });
        html += `</table>`;
    }

    // Notes
    if (notes.length) {
        html += `<h2>Nursing Notes</h2>`;
        html += `<table><tr><th>Date</th><th>Type</th><th>Note</th></tr>`;
        notes.forEach(n => {
            html += `<tr><td>${new Date(n.created_at).toLocaleDateString()}</td>`;
            html += `<td>${(n.note_type || 'note').replace(/_/g, ' ')}</td>`;
            html += `<td>${(n.note_text || '').substring(0, 120)}</td></tr>`;
        });
        html += `</table>`;
    }

    // Open Tasks
    const openTasks = tasks.filter(t => t.status !== 'completed');
    if (openTasks.length) {
        html += `<h2>Open Tasks (${openTasks.length})</h2>`;
        html += `<table><tr><th>Priority</th><th>Task</th><th>Category</th><th>Due</th><th>Assigned</th></tr>`;
        openTasks.forEach(t => {
            const pc = t.priority === 'high' ? 'red' : t.priority === 'low' ? 'green' : 'yellow';
            html += `<tr><td><span class="badge ${pc}">${t.priority}</span></td>`;
            html += `<td>${t.description}</td>`;
            html += `<td>${(t.category || '').replace(/_/g, ' ')}</td>`;
            html += `<td>${t.due_date ? new Date(t.due_date + 'T00:00:00').toLocaleDateString() : '-'}</td>`;
            html += `<td>${t.assigned_to || '-'}</td></tr>`;
        });
        html += `</table>`;
    }

    html += `<div class="footer">Generated by SRO Intelligence &nbsp;|&nbsp; ${new Date().toLocaleDateString()} &nbsp;|&nbsp; CONFIDENTIAL — Contains Protected Health Information</div>`;
    html += `</body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
}

// ============ LOGOUT ============
function logout() {
    sessionStorage.clear();
    window.location.href = '/index.html';
}
