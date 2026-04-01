# Cockpit Radial Patient View + Hotspot Mapper Implementation

## Overview

You now have a complete fighter-jet HUD-inspired cockpit UI for SRO Intelligence with a visual hotspot mapping tool.

---

## PART 1: Cockpit Radial Patient View ✅

### Files Created

- **`public/cockpit-view.html`** — Main cockpit page (new)
- **`public/css/cockpit.css`** — All styling (new)
- **`public/js/cockpit-view.js`** — Rendering logic (new)
- **`public/js/dashboard.js`** — UPDATED with cockpit button
- **`server.js`** — UPDATED with new table + API route

### Database Schema

Added `cockpit_sector_items` table:

```sql
CREATE TABLE cockpit_sector_items (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL,
  sector_id TEXT NOT NULL,
  item_text TEXT NOT NULL,
  item_status TEXT DEFAULT 'pending',    -- 'ok', 'alert', 'warning', 'pending'
  item_icon TEXT DEFAULT '○',
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### API Endpoint

**GET `/api/episodes/:id/cockpit`**

Returns cockpit view data structure:

```json
{
  "episode_id": "uuid",
  "patient": {
    "name": "Smith, John",
    "age": 56,
    "sex": "M",
    "mrn": "12345678",
    "vitals": { "hr": 82, "bp": "132/78", "temp": 98.6, "spo2": 98 },
    "alerts": []
  },
  "sectors": {
    "decision": [ { "icon": "⚠", "status": "alert", "text": "..." } ],
    "preop": [ { "icon": "✓", "status": "ok", "text": "..." } ],
    ...
  }
}
```

### Design Features

✅ **Dark theme**: `#0a0e17` background with cyan (`#00e5ff`) and amber (`#ffab00`) accents  
✅ **Radial layout**: 7 sectors positioned around central patient hub  
✅ **Central hub**: Patient photo, name, age/sex, MRN, vitals, alerts  
✅ **Decorative ring**: Animated radar sweep (8s rotation)  
✅ **Sector cards**: Status icons (✓ ⚠ △ ○), checklist items, summary label  
✅ **Detail panel**: Slides in from right when sector clicked  
✅ **Hover effects**: Cyan glow on cards and hotspots  
✅ **Responsive**: Scales to mobile with adjusted positioning  

### Usage

1. Navigate to dashboard
2. Click the **🎛 Cockpit** button on any patient card
3. View sectors arranged radially around patient
4. Click any sector to see full details in slide-in panel
5. Change role via dropdown (Surgeon/Nurse/Coordinator)

### Styling Highlights

```css
/* Central hub with glow */
.patient-hub {
  width: 280px; height: 280px;
  border-radius: 50%;
  box-shadow: 0 0 40px rgba(0, 229, 255, 0.1);
}

/* Sector cards with hover glow */
.cockpit-sector:hover {
  box-shadow: 0 0 20px rgba(0, 229, 255, 0.15);
}

/* Animated radar sweep */
@keyframes radar-sweep {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

---

## PART 2: Hotspot Mapper Tool ✅

### File Created

- **`public/cockpit/tuner.html`** — Complete visual mapper (new)

### Features

✅ **Two-mode toggle**: WINDOW TUNER (placeholder) and HOTSPOT MAPPER  
✅ **Draw hotspots**: Click-and-drag to draw cyan dashed rectangles on background image  
✅ **Name prompts**: After drawing, prompted to name hotspot and specify JS function  
✅ **Percentage-based coords**: All coordinates as % of viewport for responsive scaling  
✅ **Hover labels**: See hotspot name when hovering  
✅ **Delete on hover**: × button appears on hover; click to remove  
✅ **Toolbar controls**:
  - 💾 SAVE — Store to browser localStorage
  - 📂 LOAD — Restore from localStorage
  - 📋 COPY OUTPUT — Export HTML to clipboard ready to paste
  - 🗑 CLEAR ALL — Remove all hotspots
  - Hotspot counter

### Usage

1. Open `http://localhost:3000/cockpit/tuner.html`
2. Click **HOTSPOT MAPPER** tab
3. Click-and-drag to draw rectangle on background image
4. Enter hotspot name (e.g., "Decision") and function (e.g., `openSectorDetail('decision')`)
5. Hotspot appears as cyan overlay with label
6. Hover to see delete button (×)
7. Click **COPY OUTPUT** to get HTML
8. Paste exported HTML into `cockpit-view.html` to create clickable regions

### Exported HTML Format

```html
<!-- HOTSPOT: Decision -->
<div class="cockpit-hotspot" 
     style="left:25%;top:5%;width:50%;height:15%"
     onclick="openSectorDetail('decision')" 
     title="Decision">
</div>
```

### CSS for Exported Hotspots

Already included in `cockpit.css`:

```css
.cockpit-hotspot {
  position: fixed;
  cursor: pointer;
  z-index: 50;
  background: transparent;
  border: 1px dashed transparent;
  transition: all 0.1s;
}
.cockpit-hotspot:hover {
  background: rgba(0, 229, 255, 0.08);
  border-color: rgba(0, 229, 255, 0.4);
  box-shadow: 0 0 12px rgba(0, 229, 255, 0.2);
}
```

---

## Integration Points

### Dashboard Integration

The **🎛 Cockpit** button was added to all three patient tiers in `dashboard.js`:

- **Decision tier** (red focus items)
- **Review tier** (medium priority)
- **Done tier** (completed items)

All buttons navigate to `/cockpit-view.html?patient={patientId}`

---

## Demo Data

To test with demo data, seed test records using:

```bash
# Connect to SQLite
sqlite3 sro.db

# Insert test cockpit items for a demo episode
INSERT INTO cockpit_sector_items (id, episode_id, sector_id, item_text, item_status, item_icon)
VALUES 
  ('hs-1', 'demo-episode-1', 'decision', 'Risk Assessment', 'alert', '⚠'),
  ('hs-2', 'demo-episode-1', 'preop', 'NPO Confirmed', 'ok', '✓'),
  ('hs-3', 'demo-episode-1', 'surgery', 'OR Prepped', 'ok', '✓');
```

Or use the demo mode in `cockpit-view.js`:

```javascript
// Uncomment in cockpit-view.js to use mock data:
document.addEventListener('DOMContentLoaded', () => {
  seedDemoSectorItems();
});
```

---

## Fonts

Both components use Google Fonts:

- **`Orbitron`** — Headers, labels (futuristic monospace)
- **`Rajdhani`** — Body text, data (tech-friendly sans-serif)

Load in HTML:

```html
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;400;600;700&display=swap" rel="stylesheet">
```

---

## Color Palette

```css
--cockpit-bg:      #0a0e17   /* Near-black */
--cockpit-cyan:    #00e5ff   /* Bright cyan */
--cockpit-amber:   #ffab00   /* Warm amber */
--cockpit-green:   #4caf50   /* Success green */
--cockpit-red:     #f44336   /* Alert red */
--cockpit-orange:  #ff9800   /* Warning orange */
```

---

## File Structure

```
sro-local/
├── public/
│   ├── cockpit-view.html           ← Main radial UI
│   ├── cockpit/
│   │   └── tuner.html              ← Hotspot mapper
│   ├── css/
│   │   ├── cockpit.css             ← All cockpit styling
│   │   └── styles.css              (existing)
│   ├── js/
│   │   ├── cockpit-view.js         ← Cockpit rendering logic
│   │   ├── dashboard.js            ← UPDATED with cockpit button
│   │   └── server.js               (in public dir? check if needed)
│   └── dashboard.html              (existing, unchanged structure)
├── server.js                       ← UPDATED with new table + API
└── sro.db                          ← SQLite database (auto-migrated)
```

---

## Quick Start Checklist

- [x] Database table created
- [x] API endpoint functional
- [x] Cockpit HTML page created
- [x] Cockpit CSS with radial layout
- [x] Cockpit JavaScript logic
- [x] Dashboard button links added
- [x] Hotspot mapper tool created
- [x] All files syntactically valid

---

## Next Steps (Optional Enhancements)

1. **Populate cockpit_sector_items**: Add business logic to populate table based on episode stage/tasks
2. **Add background image**: Create or upload `cockpit_bg.png` for tuner
3. **Edit mode**: Add ability to edit sector items from detail panel
4. **Real vitals**: Hook to latest checkin vitals fetching
5. **Animations**: Add more transitions (pulse on active sector, etc.)
6. **Mobile UX**: Optimize touch interactions
7. **Keyboard shortcuts**: Hotkeys to jump between sectors
8. **Print/export**: Download cockpit view as PDF

---

## API Testing

Test the new cockpit endpoint:

```bash
curl http://localhost:3000/api/episodes/{EPISODE_ID}/cockpit
```

Replace `{EPISODE_ID}` with a real episode ID from your database.

---

## Troubleshooting

**Q: Cockpit button not showing on dashboard?**  
A: Clear browser cache, verify dashboard.js was updated with the cockpit button code.

**Q: Hotspot mapper not drawing?**  
A: Ensure browser allows pointer events, check browser console for JS errors.

**Q: API returning empty sectors?**  
A: No cockpit_sector_items exist for that episode. Seed test data or use demo mode.

**Q: Fonts not loading?**  
A: Check Google Fonts CDN is accessible, verify HTML has font-face declarations.

---

## Support

Refer to the spec document provided for complete design details, color codes, and animation timings.

Good luck! 🎛

