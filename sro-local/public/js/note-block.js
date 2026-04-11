/**
 * NoteBlock — EMR Bridge
 * Fetches structured SRO patient data and formats it as a clinical text block
 * for copy-paste into any EMR.
 */
const NoteBlock = (function () {

  function fmt(val, fallback) {
    return (val !== null && val !== undefined && val !== '') ? val : (fallback || '—');
  }

  function fmtDate(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }); }
    catch (e) { return d; }
  }

  function fmtRisk(r) {
    if (r === null || r === undefined) return '—';
    return (parseFloat(r) * 100).toFixed(1) + '%';
  }

  function generate(data) {
    const p = data.patient || {};
    const c = data.recentCheckin || null;
    const pre = data.recentPreop || null;
    const pro = data.recentPro || null;

    const surgeonName = (p.surgeon_first_name || p.surgeon_last_name)
      ? ((p.surgeon_last_name || '') + ', ' + (p.surgeon_first_name || '')).trim().replace(/^,\s*/, '')
      : '—';

    const lines = [];

    lines.push('=== SRO INTELLIGENCE NOTE BLOCK ===');
    lines.push('Generated: ' + new Date().toLocaleString('en-US'));
    lines.push('');

    // --- Patient Header ---
    lines.push('PATIENT');
    lines.push('  Name:       ' + fmt(p.last_name) + ', ' + fmt(p.first_name));
    lines.push('  DOB:        ' + fmtDate(p.date_of_birth));
    lines.push('  MRN:        ' + fmt(p.mrn));
    lines.push('');

    // --- Episode ---
    lines.push('EPISODE');
    lines.push('  Surgery:    ' + fmt(p.surgery_type));
    lines.push('  Date:       ' + fmtDate(p.surgery_date));
    lines.push('  Surgeon:    ' + surgeonName);
    lines.push('  Status:     ' + fmt(p.episode_status));
    lines.push('');

    // --- Most Recent Check-In ---
    if (c) {
      lines.push('MOST RECENT CHECK-IN (' + fmtDate(c.checkin_date) + ')');
      lines.push('  Pain Level: ' + fmt(c.pain_level) + '/10');
      lines.push('  Location:   ' + fmt(c.pain_location));
      lines.push('  Swelling:   ' + fmt(c.swelling));
      lines.push('  PT Exercises: ' + (c.pt_exercises ? 'Done' : 'Not done'));
      lines.push('  Medication:   ' + (c.medication_taken ? 'Taken' : 'Not taken'));
      if (c.concerns) lines.push('  Concerns:   ' + c.concerns);
      if (c.notes)    lines.push('  Notes:      ' + c.notes);
      lines.push('');
    }

    // --- PreOp Assessment ---
    if (pre) {
      lines.push('PREOP ASSESSMENT (' + fmtDate(pre.assessed_at) + ')');
      lines.push('  Age: ' + fmt(pre.age) + '  Sex: ' + fmt(pre.sex) + '  BMI: ' + fmt(pre.bmi) + '  ASA: ' + fmt(pre.asa_class));
      lines.push('  Risk Tier:           ' + fmt(pre.risk_tier));
      lines.push('  Mortality Risk:      ' + fmtRisk(pre.mortality_risk));
      lines.push('  Readmission Risk:    ' + fmtRisk(pre.readmission_risk));
      lines.push('  Prolonged LOS Risk:  ' + fmtRisk(pre.prolonged_los_risk));
      if (pre.joint_score_type) {
        lines.push('  ' + pre.joint_score_type + ' Pre-Op:    ' + fmt(pre.joint_score_preop));
        lines.push('  ' + pre.joint_score_type + ' Projected: ' + fmt(pre.projected_postop_score));
      }
      if (pre.promis_physical_tscore || pre.promis_mental_tscore) {
        lines.push('  PROMIS Physical T:   ' + fmt(pre.promis_physical_tscore));
        lines.push('  PROMIS Mental T:     ' + fmt(pre.promis_mental_tscore));
      }
      if (pre.comorbidities) {
        try {
          const comorbObj = typeof pre.comorbidities === 'string' ? JSON.parse(pre.comorbidities) : pre.comorbidities;
          const active = Object.keys(comorbObj).filter(k => comorbObj[k] && comorbObj[k].checked);
          if (active.length) lines.push('  Comorbidities: ' + active.join(', '));
        } catch (e) {
          lines.push('  Comorbidities: ' + pre.comorbidities);
        }
      }
      lines.push('');
    }

    // --- Most Recent PRO ---
    if (pro) {
      lines.push('MOST RECENT PRO SCORE (' + fmtDate(pro.assessment_date) + ')');
      lines.push('  Type:  ' + fmt(pro.assessment_type));
      lines.push('  Score: ' + fmt(pro.score));
      lines.push('');
    }

    lines.push('=== END NOTE BLOCK ===');
    return lines.join('\n');
  }

  async function fetch(patientId) {
    const resp = await window.fetch('/api/patients/' + patientId + '/note-block');
    if (!resp.ok) throw new Error('Failed to load note block (HTTP ' + resp.status + ')');
    return await resp.json();
  }

  async function copyToClipboard(patientId) {
    const data = await fetch(patientId);
    const text = generate(data);
    await navigator.clipboard.writeText(text);
    return text;
  }

  function showModal(patientId) {
    // Remove any existing modal
    var existing = document.getElementById('noteBlockModal');
    if (existing) existing.remove();

    // Create overlay + modal
    var overlay = document.createElement('div');
    overlay.id = 'noteBlockModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';

    var box = document.createElement('div');
    box.style.cssText = 'background:#0f172a;border:1px solid #2a4a6b;border-radius:12px;padding:24px;width:680px;max-width:95vw;max-height:85vh;display:flex;flex-direction:column;gap:12px;';

    var header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';
    header.innerHTML = '<span style="color:#60a5fa;font-weight:700;font-size:1rem;letter-spacing:0.05em;">NOTE BLOCK — EMR COPY</span>' +
      '<button onclick="document.getElementById(\'noteBlockModal\').remove()" style="background:none;border:none;color:#94a3b8;font-size:1.4rem;cursor:pointer;line-height:1;">&times;</button>';

    var status = document.createElement('div');
    status.style.cssText = 'color:#94a3b8;font-size:0.8rem;';
    status.textContent = 'Loading…';

    var textarea = document.createElement('textarea');
    textarea.style.cssText = 'flex:1;min-height:360px;background:#1e293b;color:#e2e8f0;border:1px solid #2a4a6b;border-radius:8px;padding:14px;font-family:monospace;font-size:0.8rem;line-height:1.55;resize:vertical;';
    textarea.readOnly = true;
    textarea.value = '';

    var footer = document.createElement('div');
    footer.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';

    var copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy to Clipboard';
    copyBtn.style.cssText = 'background:#2563eb;color:white;border:none;border-radius:8px;padding:8px 20px;font-weight:600;cursor:pointer;font-size:0.875rem;';

    var closeBtn2 = document.createElement('button');
    closeBtn2.textContent = 'Close';
    closeBtn2.style.cssText = 'background:#334155;color:#e2e8f0;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:0.875rem;';
    closeBtn2.onclick = function () { overlay.remove(); };

    copyBtn.onclick = function () {
      navigator.clipboard.writeText(textarea.value).then(function () {
        copyBtn.textContent = '✓ Copied!';
        copyBtn.style.background = '#16a34a';
        setTimeout(function () {
          copyBtn.textContent = 'Copy to Clipboard';
          copyBtn.style.background = '#2563eb';
        }, 2000);
      });
    };

    footer.appendChild(copyBtn);
    footer.appendChild(closeBtn2);
    box.appendChild(header);
    box.appendChild(status);
    box.appendChild(textarea);
    box.appendChild(footer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Close on backdrop click
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

    // Fetch data
    fetch(patientId).then(function (data) {
      var text = generate(data);
      textarea.value = text;
      status.textContent = 'Patient: ' + (data.patient.last_name || '') + ', ' + (data.patient.first_name || '');
      status.style.color = '#60a5fa';
    }).catch(function (err) {
      status.textContent = 'Error: ' + err.message;
      status.style.color = '#f87171';
      textarea.value = 'Failed to load note block.';
    });
  }

  return { generate, copyToClipboard, showModal };
})();
