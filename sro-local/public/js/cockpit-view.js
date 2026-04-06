// ============ COCKPIT VIEW JAVASCRIPT ============

let currentPatientId = null;
let currentEpisodeId = null;
let cockpitData = null;

// ============ INITIALIZATION ============

document.addEventListener('DOMContentLoaded', () => {
  initializeCockpit();
});

async function initializeCockpit() {
  // Get patient ID from URL query parameter
  const params = new URLSearchParams(window.location.search);
  currentPatientId = params.get('patient');
  
  if (!currentPatientId) {
    alert('No patient ID specified');
    window.location.href = '/dashboard.html';
    return;
  }
  
  // Fetch patient episode data
  try {
    const patientRes = await fetch(`/api/patients/${currentPatientId}`);
    const patient = await patientRes.json();
    
    if (!patient.episode_id) {
      alert('Patient has no active episode');
      window.location.href = '/dashboard.html';
      return;
    }
    
    currentEpisodeId = patient.episode_id;
    
    // Fetch cockpit data from API
    const cockpitRes = await fetch(`/api/episodes/${currentEpisodeId}/cockpit`);
    cockpitData = await cockpitRes.json();
    
    // Render the cockpit
    renderCockpit(cockpitData);
  } catch (error) {
    console.error('Error loading cockpit data:', error);
    alert('Failed to load cockpit data');
  }
}

// ============ RENDERING ============

function renderCockpit(data) {
  if (!data) return;
  
  // Render patient hub
  renderPatientHub(data.patient);
  
  // Render sectors
  renderSectors(data.sectors, data.episode_stage);
}

function renderPatientHub(patient) {
  // Patient name
  document.getElementById('patient-name').textContent = patient.name;
  
  // Demographics
  const demo = patient.age ? `${patient.age}/${patient.sex}` : patient.sex;
  document.getElementById('patient-demographics').textContent = demo;
  
  // MRN
  document.getElementById('patient-mrn').textContent = patient.mrn ? `MRN: ${patient.mrn}` : 'MRN: --';
  
  // Vitals
  const vitalsContainer = document.getElementById('patient-vitals');
  if (patient.vitals) {
    const tempdiv = document.createElement('div');
    tempdiv.innerHTML = `
      <div class="vital">
        <span class="vital-label">HR</span>
        <span class="vital-value">${patient.vitals.hr || '--'}</span>
      </div>
      <div class="vital">
        <span class="vital-label">BP</span>
        <span class="vital-value">${patient.vitals.bp || '--/--'}</span>
      </div>
      <div class="vital">
        <span class="vital-label">SpO2</span>
        <span class="vital-value">${patient.vitals.spo2 || '--'}</span>
      </div>
    `;
    vitalsContainer.innerHTML = tempdiv.innerHTML;
  }
  
  // Alerts
  renderAlerts(patient.alerts);
}

function renderAlerts(alerts) {
  const container = document.getElementById('alerts-container');
  container.innerHTML = '';
  
  if (!alerts || alerts.length === 0) return;
  
  alerts.forEach(alert => {
    const alertEl = document.createElement('div');
    alertEl.className = `alert-item alert-${alert.type || 'ok'}`;
    alertEl.innerHTML = `<span>${alert.icon || '◆'}</span><span>${alert.text}</span>`;
    container.appendChild(alertEl);
  });
}

function renderSectors(sectors, currentStage) {
  const sectorConfig = {
    decision: { el: 'sector-decision', label: 'Decision', defaultStatus: 'needs_review', color: 'alert' },
    preop: { el: 'sector-preop', label: 'Pre-Op', defaultStatus: 'ready', color: 'ready' },
    surgery: { el: 'sector-surgery', label: 'Surgery', defaultStatus: 'scheduled', color: 'warning' },
    billing: { el: 'sector-billing', label: 'Billing', defaultStatus: 'complete', color: 'ready' },
    postop: { el: 'sector-postop', label: 'Post-Op', defaultStatus: 'monitoring', color: 'ready' },
    engagement: { el: 'sector-engagement', label: 'Engagement', defaultStatus: 'active', color: 'ready' },
    pt: { el: 'sector-pt', label: 'PT', defaultStatus: 'scheduled', color: 'warning' }
  };
  
  Object.entries(sectorConfig).forEach(([sectorId, config]) => {
    const sectorEl = document.getElementById(config.el);
    const items = sectors[sectorId] || [];
    
    // Determine status and colors
    let status = config.defaultStatus;
    let statusIcon = '○';
    let statusColor = config.color;
    
    if (items.length > 0) {
      const hasAlert = items.some(i => i.status === 'alert');
      const hasWarning = items.some(i => i.status === 'warning');
      const allOk = items.every(i => i.status === 'ok');
      
      if (hasAlert) {
        status = 'alert';
        statusIcon = '⚠';
        statusColor = 'alert';
      } else if (hasWarning) {
        status = 'warning';
        statusIcon = '△';
        statusColor = 'warning';
      } else if (allOk) {
        status = 'complete';
        statusIcon = '✓';
        statusColor = 'ready';
      }
    }
    
    // Update status indicator
    const statusEl = document.getElementById(`${config.el}-status`);
    statusEl.textContent = statusIcon;
    
    // Set sector styling based on status
    sectorEl.className = `cockpit-sector ${config.el}`;
    if (currentStage === sectorId) {
      sectorEl.classList.add('active');
    }
    sectorEl.classList.add(`status-${statusColor}`);
    
    // Update items
    const itemsContainer = document.getElementById(`${config.el}-items`);
    itemsContainer.innerHTML = '';
    items.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = `sector-item status-${item.status}`;
      itemEl.innerHTML = `
        <div class="sector-item-icon">${item.icon}</div>
        <div class="sector-item-text">${item.text}</div>
      `;
      itemsContainer.appendChild(itemEl);
    });
    
    // Update summary
    const summaryEl = document.getElementById(`${config.el}-summary`);
    const summaryStatus = status.replace('_', ' ').toUpperCase();
    summaryEl.textContent = summaryStatus;
  });
}

// ============ DETAIL PANEL ============

let currentDetailSector = null;

function openSectorDetail(sectorId) {
  currentDetailSector = sectorId;
  const panel = document.getElementById('detail-panel');
  const title = document.getElementById('detail-title');
  const content = document.getElementById('detail-content');
  
  // Set title
  const sectorLabels = {
    decision: 'Decision Point',
    preop: 'Pre-Operative Phase',
    surgery: 'Surgical Procedure',
    billing: 'Billing & Authorization',
    postop: 'Post-Operative Recovery',
    engagement: 'Patient Engagement',
    pt: 'Physical Therapy'
  };
  
  title.textContent = sectorLabels[sectorId] || sectorId;
  
  // Get items for this sector
  const items = cockpitData.sectors[sectorId] || [];
  
  // Build content
  let html = '';
  
  if (items.length === 0) {
    html = '<p>No items in this sector yet.</p>';
  } else {
    items.forEach((item, idx) => {
      const statusClass = item.status || 'pending';
      const statusText = statusClass.toUpperCase();
      
      html += `
        <div class="detail-item">
          <div class="detail-item-title">${item.icon} ${statusText}</div>
          <div class="detail-item-content">${item.text}</div>
        </div>
      `;
    });
  }
  
  // Add actions based on sector
  html += `
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(0, 229, 255, 0.2);">
      <button class="detail-action-btn" onclick="editSectorItems('${sectorId}')">
        ✎ Edit Items
      </button>
      <button class="detail-action-btn" onclick="closeSectorDetail()" style="margin-top: 10px;">
        Close
      </button>
    </div>
  `;
  
  content.innerHTML = html;
  
  // Add CSS for buttons if not already present
  if (!document.querySelector('[data-cockpit-buttons]')) {
    const style = document.createElement('style');
    style.setAttribute('data-cockpit-buttons', 'true');
    style.textContent = `
      .detail-action-btn {
        display: block;
        width: 100%;
        padding: 10px;
        background: rgba(0, 229, 255, 0.15);
        border: 1px solid rgba(0, 229, 255, 0.4);
        color: #00e5ff;
        border-radius: 6px;
        font-family: 'Rajdhani', sans-serif;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.2s;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .detail-action-btn:hover {
        background: rgba(0, 229, 255, 0.25);
        border-color: #00e5ff;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Show panel
  panel.classList.add('open');
}

function closeSectorDetail() {
  const panel = document.getElementById('detail-panel');
  panel.classList.remove('open');
  currentDetailSector = null;
}

function editSectorItems(sectorId) {
  // Placeholder for editing items (would typically open a modal or navigate to editor)
  alert(`Edit mode for ${sectorId} sector - not yet implemented in demo`);
}

// ============ NAVIGATION ============

function goBack() {
  window.location.href = '/dashboard.html';
}

function updateRole(role) {
  console.log('Role changed to:', role);
  // Store in local storage or session
  localStorage.setItem('cockpit-role', role);
  // Could trigger UI changes based on role here
}

// ============ AUTO-POPULATE DEMO DATA ============

// This function would be called if no API data is available, for dev/demo purposes
function seedDemoSectorItems() {
  const demoItems = {
    decision: [
      { icon: '⚠', status: 'alert', text: 'Risk Assessment' },
      { icon: '⚠', status: 'alert', text: 'Clearance Needed' }
    ],
    preop: [
      { icon: '✓', status: 'ok', text: 'NPO Confirmed' },
      { icon: '✓', status: 'ok', text: 'Consent Signed' }
    ],
    surgery: [
      { icon: '✓', status: 'ok', text: 'OR Prepped' },
      { icon: '✓', status: 'ok', text: 'Implants Set' }
    ],
    billing: [
      { icon: '✓', status: 'ok', text: 'Auth Approved' },
      { icon: '✓', status: 'ok', text: 'Est. Cost: $14,500' }
    ],
    postop: [
      { icon: '✓', status: 'ok', text: 'Stable' },
      { icon: '✓', status: 'ok', text: 'Pain Control: Adequate' },
      { icon: '○', status: 'pending', text: 'Monitor Vitals' }
    ],
    engagement: [
      { icon: '✓', status: 'ok', text: 'Family Update Sent' },
      { icon: '✓', status: 'ok', text: 'Discharge Planning' }
    ],
    pt: [
      { icon: '✓', status: 'ok', text: 'PT Eval Scheduled' },
      { icon: '✓', status: 'ok', text: 'Exercise Plan' }
    ]
  };
  
  cockpitData = {
    episode_id: 'demo-episode',
    patient: {
      name: 'Smith, John',
      age: 56,
      sex: 'M',
      mrn: '12345678',
      photo: '/img/patients/default-avatar.png',
      vitals: {
        hr: 82,
        bp: '132/78',
        temp: 98.6,
        spo2: 98
      },
      alerts: [
        { type: 'alert', icon: '⚠', text: 'Elevated BP' },
        { type: 'warning', icon: '△', text: 'A1C > 7.0' },
        { type: 'ok', icon: '✓', text: 'Labs current' }
      ]
    },
    episode_stage: 'decision',
    surgery_type: 'TKA',
    surgery_date: '2024-03-20',
    sectors: demoItems
  };
  
  renderCockpit(cockpitData);
}

// Uncomment to use demo data:
// document.addEventListener('DOMContentLoaded', () => {
//   seedDemoSectorItems();
// });
