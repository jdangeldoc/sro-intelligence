// ============================================================
// SRO Stage Tracker Strip — Reusable Component
// ============================================================
// Include on any page that shows a patient/episode context.
// Usage:
//   <div id="stageTracker"></div>
//   <script src="/js/stage-tracker.js"></script>
//   <script>
//     StageTracker.init('stageTracker', EPISODE_ID, { showActions: true, patientId: PATIENT_ID });
//   </script>
// ============================================================

const StageTracker = (function() {

  let containerId = null;
  let episodeId = null;
  let options = {};
  let stageInfo = null;

  // Inject styles once
  function injectStyles() {
    if (document.getElementById('stage-tracker-styles')) return;
    const style = document.createElement('style');
    style.id = 'stage-tracker-styles';
    style.textContent = `
      .stage-strip {
        display: flex;
        align-items: center;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        padding: 10px 24px;
        gap: 0;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }
      .stage-strip.dark-mode {
        background: transparent;
        border-bottom: none;
        padding: 0;
      }
      .stage-strip::-webkit-scrollbar { height: 0; }

      .stage-node {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 21px;
        border-radius: 10px;
        font-size: 1.0rem;
        font-weight: 500;
        white-space: nowrap;
        cursor: pointer;
        transition: all 0.15s;
        position: relative;
        color: #94a3b8;
        background: transparent;
      }
      .stage-node:hover {
        background: rgba(0,0,0,0.04);
      }
      .stage-node.no-page {
        cursor: default;
      }
      .stage-node.no-page:hover {
        background: transparent;
      }
      .stage-node.blocked {
        cursor: not-allowed;
        opacity: 0.5;
      }
      .stage-node.blocked:hover {
        background: transparent;
      }
      .stage-strip.dark-mode .stage-node {
        padding: 9px 12px;
        margin: 0 4px;
      }
      .stage-strip.dark-mode .stage-node:hover {
        background: rgba(255,255,255,0.08);
      }
      .stage-strip.dark-mode .stage-node.no-page:hover,
      .stage-strip.dark-mode .stage-node.blocked:hover {
        background: transparent;
      }
      .stage-strip.dark-mode .stage-node.completed {
        color: #86efac;
      }
      .stage-strip.dark-mode .stage-node.current {
        background: rgba(255,255,255,0.15);
        color: white;
        box-shadow: 0 0 0 2px white;
      }
      .stage-strip.dark-mode .stage-node.upcoming {
        color: #475569;
      }
      .stage-strip.dark-mode .stage-node.skipped {
        color: #fbbf24;
      }
      .stage-node .stage-icon {
        font-size: 1.4rem;
        line-height: 1;
        opacity: 0.5;
      }
      .stage-node .stage-label {
        line-height: 1.2;
      }
      .stage-node .stage-check {
        display: none;
        font-size: 0.9rem;
        color: #059669;
        font-weight: 700;
      }

      /* Completed */
      .stage-node.completed {
        color: #059669;
      }
      .stage-node.completed:hover {
        background: #f0fdf4;
      }
      .stage-node.completed .stage-icon { opacity: 0.7; }
      .stage-node.completed .stage-check { display: inline; }
      .stage-node.completed .stage-label {
        text-decoration: none;
      }

      /* Skipped (completed but via override) */
      .stage-node.skipped {
        color: #d97706;
      }
      .stage-node.skipped:hover { background: #fffbeb; }
      .stage-node.skipped .stage-icon { opacity: 0.6; }
      .stage-node.skipped .stage-check { display: inline; color: #d97706; }

      /* Current */
      .stage-node.current {
        color: #1e3a5f;
        background: #e0ecff;
        font-weight: 700;
        box-shadow: 0 0 0 2px #2c5aa0;
      }
      .stage-node.current:hover {
        background: #d0dffc;
      }
      .stage-node.current .stage-icon { opacity: 1; }

      /* Upcoming */
      .stage-node.upcoming {
        color: #cbd5e1;
      }
      .stage-node.upcoming .stage-icon { opacity: 0.3; }

      /* Connector arrow between nodes */
      .stage-connector {
        display: flex;
        align-items: center;
        padding: 0 2px;
        color: #d1d5db;
        font-size: 0.85rem;
        flex-shrink: 0;
      }
      .stage-connector.completed { color: #86efac; }
      .stage-connector.current { color: #2c5aa0; }
      .stage-strip.dark-mode .stage-connector.completed { color: #86efac; }
      .stage-strip.dark-mode .stage-connector.current { color: white; }

      /* Actions area */
      .stage-actions {
        margin-left: auto;
        display: flex;
        gap: 6px;
        align-items: center;
        padding-left: 16px;
        flex-shrink: 0;
      }
      .stage-btn {
        padding: 8px 18px;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: all 0.15s;
      }
      .stage-btn-advance {
        background: #2c5aa0;
        color: white;
      }
      .stage-btn-advance:hover { background: #1e3a5f; }
      .stage-btn-advance:disabled {
        background: #94a3b8;
        cursor: not-allowed;
      }
      .stage-btn-skip {
        background: transparent;
        color: #6b7280;
        border: 1px solid #d1d5db;
        font-weight: 500;
      }
      .stage-btn-skip:hover { background: #f9fafb; border-color: #9ca3af; }
      .stage-strip.dark-mode .stage-btn-advance {
        background: #2c5aa0;
        color: white;
      }
      .stage-strip.dark-mode .stage-btn-advance:hover { background: #1e3a5f; }
      .stage-strip.dark-mode .stage-btn-skip {
        background: transparent;
        color: white;
        border: 1px solid rgba(255,255,255,0.5);
      }
      .stage-strip.dark-mode .stage-btn-skip:hover {
        background: rgba(255,255,255,0.1);
        border-color: white;
      }

      /* Tooltip */
      .stage-node[data-tooltip]:hover::after {
        content: attr(data-tooltip);
        position: absolute;
        bottom: calc(100% + 6px);
        left: 50%;
        transform: translateX(-50%);
        background: #1e293b;
        color: white;
        padding: 5px 12px;
        border-radius: 6px;
        font-size: 0.78rem;
        font-weight: 400;
        white-space: nowrap;
        z-index: 100;
        pointer-events: none;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      }

      /* Responsive: stack on very narrow */
      @media (max-width: 640px) {
        .stage-strip { padding: 8px 12px; }
        .stage-node { padding: 6px 12px; font-size: 0.85rem; }
        .stage-node .stage-icon { font-size: 1.1rem; }
        .stage-actions { padding-left: 8px; }
        .stage-btn { padding: 6px 14px; font-size: 0.82rem; }
      }

      /* Launch Intake button under intake node */
      .stage-launch-intake {
        font-size: 0.72rem;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: 6px;
        border: none;
        cursor: pointer;
        background: #0d9488;
        color: white;
        white-space: nowrap;
        transition: background 0.15s;
      }
      .stage-launch-intake:hover { background: #0f766e; }
      .stage-strip.dark-mode .stage-launch-intake {
        background: rgba(13,148,136,0.85);
        color: white;
      }
      .stage-strip.dark-mode .stage-launch-intake:hover { background: rgba(13,148,136,1); }

      @media print {
        .stage-strip { border-bottom: 1px solid #ccc; }
        .stage-actions { display: none; }
        .stage-launch-intake { display: none; }
      }
    `;
    document.head.appendChild(style);
  }

  // Fetch stage data from API
  async function fetchStageInfo(epId) {
    try {
      const resp = await fetch(`/api/episodes/${epId}/stage`);
      if (!resp.ok) return null;
      return await resp.json();
    } catch(e) {
      console.error('Stage tracker fetch error:', e);
      return null;
    }
  }

  // Check if conservative care is completed
  function isConservativeCareCompleted() {
    if (!stageInfo) return false;
    const ccStage = stageInfo.stages.find(s => s.key === 'conservative_care');
    return ccStage && (ccStage.status === 'completed' || ccStage.status === 'skipped');
  }

  // Handle stage node click — navigate to the stage's page
  function handleStageClick(stageKey) {
    if (!stageInfo) return;
    const stage = stageInfo.stages.find(s => s.key === stageKey);
    if (!stage || !stage.page) return;

    // If intake/dashboard, don't navigate — we're already on the dashboard
    if (stageKey === 'intake') return;

    // Navigate with patient context
    var patientId = options.patientId;
    // Fallback: try URL param
    if (!patientId) {
      var urlParams = new URLSearchParams(window.location.search);
      patientId = urlParams.get('patient');
    }

    if (patientId) {
      // postop stage goes to dashboard patient detail panel
      var param = stageKey === 'postop' ? '?openPatient=' : '?patient=';
      window.location.href = stage.page + param + patientId;
    } else {
      window.location.href = stage.page;
    }
  }

  // Render the strip
  function render() {
    const container = document.getElementById(containerId);
    if (!container || !stageInfo) return;

    const stages = stageInfo.stages;
    const ccCompleted = isConservativeCareCompleted();

    let html = '<div class="stage-strip ' + (options.darkMode ? 'dark-mode' : '') + '">';

    stages.forEach((stage, idx) => {
      // Connector
      if (idx > 0) {
        const connClass = stage.status === 'completed' || stage.status === 'current' ?
          (stages[idx-1].status === 'completed' ? 'completed' : 'current') : '';
        html += '<div class="stage-connector ' + connClass + '">\u25B8</div>';
      }

      // Tooltip text
      let tooltip = stage.description;
      if (stage.completed_at) {
        tooltip += ' \u2014 Completed ' + new Date(stage.completed_at).toLocaleDateString();
        if (stage.completed_by) tooltip += ' by ' + stage.completed_by;
      }

      // Node classes
      let extraClasses = stage.status;
      // No page (surgery stage)
      if (!stage.page) extraClasses += ' no-page';

      // Click handler — all stages with a page are clickable
      var clickHandler = stage.page ?
        'onclick="StageTracker._handleClick(\'' + stage.key + '\')"' : '';

        html += '<div class="stage-node-wrap" style="display:inline-flex;flex-direction:column;align-items:center;gap:4px;">';
      html += '<div class="stage-node ' + extraClasses + '" data-stage="' + stage.key + '" data-tooltip="' + tooltip + '" ' + clickHandler + '>';
      html += '<span class="stage-icon">' + stage.icon + '</span>';
      html += '<span class="stage-label">' + stage.label + '</span>';
      html += '<span class="stage-check">\u2713</span>';
      html += '</div>';
      // Launch Intake button — only on intake node, always clickable
      if (stage.key === 'intake' && options.launchIntake) {
        html += '<button class="stage-launch-intake" onclick="StageTracker._launchIntake()" title="Open patient intake form — can be re-run any time">&#128203; Launch Intake</button>';
      }
      html += '</div>';
    });

    // Action buttons (only if showActions is true)
    if (options.showActions !== false) {
      const currentIdx = stageInfo.current_stage_index;
      const isLast = currentIdx >= stages.length - 1;
      const currentStage = stages[currentIdx];
      const canAutoComplete = currentStage && currentStage.auto_completable;

      html += '<div class="stage-actions">';

      if (!isLast) {
        const btnLabel = canAutoComplete ?
          '\u2713 Complete & Advance' :
          'Mark Complete & Advance';
        html += '<button class="stage-btn stage-btn-advance" onclick="StageTracker.advanceStage()" title="Complete ' + currentStage.label + ' and move to next stage">' + btnLabel + '</button>';
      }

      // Skip button (only show for stages that can be skipped, like conservative care)
      if (!isLast && currentStage && ['conservative_care'].includes(currentStage.key)) {
        html += '<button class="stage-btn stage-btn-skip" onclick="StageTracker.skipStage()" title="Skip this stage (e.g., patient already completed conservative care elsewhere)">Skip \u2192</button>';
      }

      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
  }

  // Public API
  return {
    init: async function(elId, epId, opts) {
      containerId = elId;
      episodeId = epId;
      options = opts || {};

      if (!episodeId) {
        const container = document.getElementById(containerId);
        if (container) container.innerHTML = ''; // No episode, no tracker
        return;
      }

      injectStyles();
      stageInfo = await fetchStageInfo(episodeId);
      if (stageInfo) render();
    },

    // Refresh (call after data changes)
    refresh: async function() {
      if (!episodeId) return;
      stageInfo = await fetchStageInfo(episodeId);
      if (stageInfo) render();
    },

    // Internal click handler (called from rendered HTML)
    _handleClick: function(stageKey) {
      handleStageClick(stageKey);
    },

    // Launch intake (called from rendered HTML button)
    _launchIntake: function() {
      if (typeof options.launchIntake === 'function') options.launchIntake();
    },

    // Navigate to a stage's page (legacy — still used for programmatic nav)
    navigateTo: function(page, epId) {
      if (!page) return;
      var patientId = options.patientId;
      if (!patientId) {
        var urlParams = new URLSearchParams(window.location.search);
        patientId = urlParams.get('patient');
      }
      var url = page;
      if (patientId) url += '?patient=' + patientId;
      window.location.href = url;
    },

    // Advance to next stage
    advanceStage: async function() {
      if (!episodeId) return;

      const currentStage = stageInfo.stages[stageInfo.current_stage_index];
      const nextStage = stageInfo.stages[stageInfo.current_stage_index + 1];

      if (!nextStage) return;

      const confirmResult = window.confirm(
        'Mark "' + currentStage.label + '" as complete and advance to "' + nextStage.label + '"?'
      );
      if (!confirmResult) return;

      try {
        const userName = sessionStorage.getItem('userName') || 'Unknown';
        const resp = await fetch('/api/episodes/' + episodeId + '/advance-stage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed_by: userName })
        });
        const data = await resp.json();
        if (data.success) {
          stageInfo = await fetchStageInfo(episodeId);
          render();
          // Fire custom event so host page can react
          document.dispatchEvent(new CustomEvent('stage-advanced', { detail: data }));
          if (typeof showToast === 'function') {
            showToast('Advanced to ' + nextStage.label, 'success');
          }
        }
      } catch(e) {
        console.error('Advance stage error:', e);
        if (typeof showToast === 'function') {
          showToast('Error advancing stage', 'error');
        }
      }
    },

    // Skip current stage (clinician override)
    skipStage: async function() {
      if (!episodeId) return;

      const currentStage = stageInfo.stages[stageInfo.current_stage_index];
      const nextStage = stageInfo.stages[stageInfo.current_stage_index + 1];

      const reason = window.prompt(
        'Skip "' + currentStage.label + '"?\n\nEnter reason (e.g., "Patient completed conservative care with PCP"):',
        ''
      );
      if (reason === null) return; // Cancelled

      try {
        const userName = sessionStorage.getItem('userName') || 'Unknown';
        const resp = await fetch('/api/episodes/' + episodeId + '/set-stage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stage: nextStage.key,
            completed_by: userName,
            reason: reason || 'Clinician override'
          })
        });
        const data = await resp.json();
        if (data.success) {
          stageInfo = await fetchStageInfo(episodeId);
          render();
          document.dispatchEvent(new CustomEvent('stage-advanced', { detail: data }));
          if (typeof showToast === 'function') {
            showToast('Skipped to ' + nextStage.label, 'success');
          }
        }
      } catch(e) {
        console.error('Skip stage error:', e);
      }
    },

    // Get current stage info (for other scripts to check)
    getCurrentStage: function() {
      return stageInfo ? stageInfo.current_stage : null;
    },

    getStageInfo: function() {
      return stageInfo;
    }
  };
})();
