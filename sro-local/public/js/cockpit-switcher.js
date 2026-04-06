(function() {
    var params = new URLSearchParams(window.location.search);
    var patientId = params.get('patient') || '';
    var returnTo = params.get('returnTo') || '';
    var date = params.get('date') || '';
    var currentTheme = getCockpitTheme();

    var path = window.location.pathname;
    var thisLayout = 'circle';
    if (path.includes('cockpit-grid-img')) thisLayout = 'gridimg';
    else if (path.includes('cockpit-grid')) thisLayout = 'grid';

    // ── Layout switcher ──
    var switcherDiv = document.createElement('div');
    switcherDiv.style.cssText = 'position:fixed;top:12px;right:220px;z-index:70;display:flex;gap:0;border-radius:4px;overflow:hidden;border:1px solid rgba(255,255,255,0.15);';

    var layouts = [
        { key: 'circle', label: 'CIRCLE' },
        { key: 'grid', label: 'GRID' },
        { key: 'gridimg', label: 'GRID+' }
    ];

    layouts.forEach(function(l) {
        var btn = document.createElement('a');
        btn.textContent = l.label;
        btn.href = cockpitUrl(l.key, patientId, returnTo, date);
        btn.style.cssText = 'padding:5px 12px;font-family:Orbitron,monospace;font-size:10px;letter-spacing:1px;text-decoration:none;transition:all 0.2s;cursor:pointer;';
        if (l.key === thisLayout) {
            btn.style.background = 'rgba(255,255,255,0.15)';
            btn.style.color = '#ffffff';
        } else {
            btn.style.background = 'rgba(0,0,0,0.5)';
            btn.style.color = 'rgba(255,255,255,0.5)';
        }
        btn.onclick = function(e) {
            e.preventDefault();
            setCockpitLayout(l.key);
            window.location.href = cockpitUrl(l.key, patientId, returnTo, date);
        };
        switcherDiv.appendChild(btn);
    });
    document.body.appendChild(switcherDiv);

    // ── Theme picker button + dropdown ──
    var themeBtn = document.createElement('div');
    themeBtn.style.cssText = 'position:fixed;top:12px;right:16px;z-index:70;font-family:Orbitron,monospace;font-size:10px;letter-spacing:1px;color:rgba(255,255,255,0.7);padding:5px 14px;border-radius:4px;border:1px solid rgba(255,255,255,0.15);background:rgba(0,0,0,0.5);cursor:pointer;transition:all 0.2s;';
    themeBtn.textContent = 'THEME \u25BE';
    themeBtn.onclick = function() {
        var existing = document.getElementById('theme-dropdown');
        if (existing) { existing.remove(); return; }

        var dropdown = document.createElement('div');
        dropdown.id = 'theme-dropdown';
        dropdown.style.cssText = 'position:fixed;top:40px;right:16px;z-index:80;background:rgba(10,15,25,0.97);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:8px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;min-width:280px;backdrop-filter:blur(10px);';

        COCKPIT_THEME_ORDER.forEach(function(key) {
            var t = COCKPIT_THEMES[key];
            var item = document.createElement('div');
            item.style.cssText = 'padding:8px 10px;border-radius:6px;cursor:pointer;text-align:center;font-family:Rajdhani,sans-serif;font-size:11px;font-weight:600;transition:all 0.2s;border:2px solid ' + (key === currentTheme ? 'rgba(255,255,255,0.5)' : 'transparent') + ';';
            item.style.background = t.type === 'solid' ? t.pageBg : 'linear-gradient(135deg, ' + t.pageBg + ', ' + (t.accent || '#333') + ')';
            item.style.color = t.textCenter;
            item.textContent = t.name;
            item.onmouseover = function() { item.style.borderColor = 'rgba(255,255,255,0.4)'; };
            item.onmouseout = function() { item.style.borderColor = key === currentTheme ? 'rgba(255,255,255,0.5)' : 'transparent'; };
            item.onclick = function() {
                setCockpitTheme(key);
                window.location.reload();
            };
            dropdown.appendChild(item);
        });

        document.body.appendChild(dropdown);
        setTimeout(function() {
            document.addEventListener('click', function closer(e) {
                if (!dropdown.contains(e.target) && e.target !== themeBtn) {
                    dropdown.remove();
                    document.removeEventListener('click', closer);
                }
            });
        }, 100);
    };
    document.body.appendChild(themeBtn);
})();
