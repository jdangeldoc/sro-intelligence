// ============ CONFIGURATION ============
const CLINIC_ID = sessionStorage.getItem('clinicId') || '11111111-1111-1111-1111-111111111111';
const USER_ID = sessionStorage.getItem('userId');
const USER_NAME = sessionStorage.getItem('userName') || 'User';

// ============ STATE ============
let patients = [];
let surgeons = [];
let currentPatient = null;
let currentEpisode = null;

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
    await loadStats();
    await loadPatients();
});

// ============ DATA LOADING ============
async function loadStats() {
    try {
        const response = await fetch(`/api/dashboard-stats?clinic_id=${CLINIC_ID}`);
        const stats = await response.json();
        
        document.getElementById('statActive').textContent = stats.active_patients || 0;
        document.getElementById('statOnTrack').textContent = (stats.active_patients - stats.needs_attention - stats.overdue) || 0;
        document.getElementById('statAttention').textContent = stats.needs_attention || 0;
        document.getElementById('statOverdue').textContent = stats.overdue || 0;
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
            '<tr><td colspan="9" class="error">Error loading patients</td></tr>';
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
        
        return true;
    });
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty">No patients found</td></tr>';
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
            <tr onclick="openPatientModal('${patient.id}')" class="clickable">
                <td>
                    <strong>${patient.last_name}, ${patient.first_name}</strong>
                    ${patient.mrn ? `<br><small class="text-muted">MRN: ${patient.mrn}</small>` : ''}
                </td>
                <td>${patient.surgery_type || '-'}</td>
                <td>${daysPostOp}</td>
                <td>${patient.surgeon_first_name ? `Dr. ${patient.surgeon_last_name}` : '-'}</td>
                <td>${patient.last_checkin_date || 'Never'}</td>
                <td>
                    ${patient.last_pain_level !== null ? 
                        `<span class="pain-badge pain-${getPainClass(patient.last_pain_level)}">${patient.last_pain_level}/10</span>` : 
                        '-'}
                </td>
                <td>${patient.last_pt_exercises === 1 ? '✅' : patient.last_pt_exercises === 0 ? '❌' : '-'}</td>
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
    const headers = ['Patient Name', 'MRN', 'Surgery Type', 'Surgery Date', 'Surgeon', 'Last Check-in', 'Pain', 'PT Status'];
    const rows = patients.map(p => [
        `${p.last_name}, ${p.first_name}`,
        p.mrn || '',
        p.surgery_type || '',
        p.surgery_date || '',
        p.surgeon_first_name ? `Dr. ${p.surgeon_last_name}` : '',
        p.last_checkin_date || '',
        p.last_pain_level !== null ? p.last_pain_level : '',
        p.last_pt_exercises === 1 ? 'Yes' : p.last_pt_exercises === 0 ? 'No' : ''
    ]);
    
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

// ============ LOGOUT ============
function logout() {
    sessionStorage.clear();
    window.location.href = '/index.html';
}
