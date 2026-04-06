(function() {
    var params = new URLSearchParams(window.location.search);
    var patientId = params.get('patient') || params.get('patient_id');
    if (!patientId) return;
    if (window.location.pathname.includes('cockpit')) return;

    var isNurse = params.get('role') === 'nurse' || localStorage.getItem('sro-role') === 'nurse';
    var layout = localStorage.getItem('sro-cockpit-layout') || 'circle';
    var pages = { circle: '/cockpit-view.html', grid: '/cockpit-grid.html', gridimg: '/cockpit-grid-img.html' };
    var cockpitUrl = isNurse ? '/nurse-cockpit.html?patient=' : ((pages[layout] || '/cockpit-view.html') + '?patient=');

    var btn = document.createElement('a');
    btn.href = cockpitUrl + patientId;
    btn.id = 'floating-cockpit-btn';
    btn.textContent = 'COCKPIT';

    if (isNurse) {
        btn.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:9999; ' +
            'font-family:Cinzel Decorative,serif; font-size:12px; letter-spacing:2px; ' +
            'color:#d4a04a; background:rgba(42,31,20,0.92); ' +
            'border:1px solid rgba(212,160,74,0.3); border-radius:8px; ' +
            'padding:12px 20px; cursor:pointer; text-decoration:none; ' +
            'transition:all 0.2s ease; box-shadow:0 0 15px rgba(212,160,74,0.1);';
        btn.onmouseover = function() {
            btn.style.background = 'rgba(212,160,74,0.15)';
            btn.style.borderColor = 'rgba(212,160,74,0.6)';
            btn.style.boxShadow = '0 0 25px rgba(212,160,74,0.2)';
        };
        btn.onmouseout = function() {
            btn.style.background = 'rgba(42,31,20,0.92)';
            btn.style.borderColor = 'rgba(212,160,74,0.3)';
            btn.style.boxShadow = '0 0 15px rgba(212,160,74,0.1)';
        };
    } else {
        btn.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:9999; ' +
            'font-family:Orbitron,monospace; font-size:12px; letter-spacing:2px; ' +
            'color:#00e5ff; background:rgba(6,10,18,0.92); ' +
            'border:1px solid rgba(0,229,255,0.3); border-radius:8px; ' +
            'padding:12px 20px; cursor:pointer; text-decoration:none; ' +
            'transition:all 0.2s ease; box-shadow:0 0 15px rgba(0,229,255,0.1);';
        btn.onmouseover = function() {
            btn.style.background = 'rgba(0,229,255,0.15)';
            btn.style.borderColor = 'rgba(0,229,255,0.6)';
            btn.style.boxShadow = '0 0 25px rgba(0,229,255,0.2)';
        };
        btn.onmouseout = function() {
            btn.style.background = 'rgba(6,10,18,0.92)';
            btn.style.borderColor = 'rgba(0,229,255,0.3)';
            btn.style.boxShadow = '0 0 15px rgba(0,229,255,0.1)';
        };
    }

    document.body.appendChild(btn);
})();
