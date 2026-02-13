# SRO Intelligence - Master Context

**LAST UPDATED:** February 4, 2026
**LOCATION:** `C:\Users\jdang\OneDrive - Jefferygroup\DocProjectVault\02_Products\SRO_Intelligence`

---

## ARCHITECTURE (FINAL - DO NOT CHANGE)

```
PATIENT AT HOME
     │
     │ Token + health data only (NO names, NO PHI)
     ▼
CLOUD RELAY (Render.com)
     │ URL: https://sro-cloud-relay.onrender.com
     │ Temporary storage only - auto-deletes after NUC confirms
     ▼
CLINIC NUC (Intel NUC or mini PC in clinic)
     │ Runs: sro-local with SQLite
     │ Token → Patient mapping happens HERE
     │ ALL PHI stays here
     ▼
SURGEON DASHBOARD
     │ Accessed via browser: http://192.168.x.x:3000 or http://sro.local
```

**ONE DATABASE** — SQLite on clinic NUC only.
**HIPAA** — Near zero liability. Cloud only sees tokens + numbers, never names/DOB/PHI.

---

## FOLDER STRUCTURE (FINAL)

```
SRO_Intelligence/
├── sro-local/                 ← NUC SERVER (main app)
│   ├── server.js              ← Express + SQLite + all APIs
│   ├── package.json
│   ├── sro.db                 ← SQLite database (created on first run)
│   └── public/
│       ├── index.html         ← Login page
│       ├── dashboard.html     ← Clinician dashboard
│       ├── checkin.html       ← Patient check-in (for in-clinic use)
│       ├── analytics.html     ← Analytics
│       ├── rpm-report.html    ← RPM billing (99457/99458)
│       ├── settings.html      ← Settings
│       ├── css/
│       └── js/
│
├── sro-cloud-relay/           ← CLOUD RELAY (Render.com)
│   ├── server.js              ← Receives de-identified check-ins
│   ├── package.json
│   ├── checkin.html           ← Patient check-in (for home use)
│   └── public/
│
├── docs/                      ← Documentation
│   ├── architecture.md
│   ├── hipaa-analysis.md
│   └── deployment-guide.md
│
├── CONTEXT.md                 ← THIS FILE - READ FIRST
└── .gitignore
```

---

## WHAT EACH COMPONENT DOES

### sro-local (Clinic NUC)
- Runs 24/7 at clinic on Intel NUC or mini PC
- SQLite database stores ALL patient data (PHI stays local)
- Staff access via browser on clinic network
- Polls cloud relay every 15 min for home check-ins
- Matches tokens to patients locally

### sro-cloud-relay (Render.com)
- Receives patient home check-ins
- ONLY stores: token + pain + PT + ROM (NO names, NO PHI)
- Auto-deletes after NUC confirms receipt (max 24 hours)
- Hosted at: https://sro-cloud-relay.onrender.com

---

## PATIENT CHECK-IN FLOW

1. Patient gets link: `https://sro-cloud-relay.onrender.com/checkin.html?t=abc123`
2. Patient fills out: pain level, PT done, medications, ROM, concerns
3. Data goes to cloud relay (token + data, NO name)
4. NUC polls relay every 15 minutes
5. NUC matches token → patient in local database
6. NUC confirms receipt, relay deletes data
7. Surgeon sees check-in on dashboard

---

## DATABASE (SQLite on NUC)

Tables:
- `clinics` - Clinic info
- `users` - Surgeons and staff
- `patients` - Patient records (PHI here only)
- `patient_tokens` - Token → patient mapping
- `checkins` - Daily check-in data
- `rpm_logs` - RPM time tracking for billing
- `preop_assessments` - Pre-op risk assessments

---

## URLS

| Environment | URL |
|-------------|-----|
| Cloud relay (patient home check-in) | https://sro-cloud-relay.onrender.com/checkin.html?t=TOKEN |
| Clinic NUC (staff dashboard) | http://192.168.x.x:3000 or http://sro.local |

---

## TECH STACK

- **Backend:** Node.js + Express
- **Database:** SQLite (better-sqlite3)
- **Frontend:** Plain HTML/CSS/JS (no React, no build step)
- **Cloud hosting:** Render.com (free tier)
- **Local hosting:** Intel NUC or mini PC running Ubuntu or Windows

---

## TO RUN LOCALLY (for development)

```bash
cd sro-local
npm install
npm start
# Open http://localhost:3000
```

---

## TO DEPLOY CLOUD RELAY

1. Push sro-cloud-relay to GitHub
2. Connect to Render.com
3. Deploy as Web Service
4. URL: https://sro-cloud-relay.onrender.com

---

## TO DEPLOY AT CLINIC

1. Get Intel NUC or mini PC (~$400)
2. Install Node.js
3. Copy sro-local folder
4. Run `npm install` then `npm start`
5. Set to auto-start on boot
6. Staff access via http://192.168.x.x:3000

---

## FEATURES BUILT

- [x] Patient check-in (pain, PT, medications, ROM)
- [x] Clinician dashboard with patient flags (red/yellow/green)
- [x] RPM time tracking and billing reports
- [x] Analytics and surgeon comparison
- [x] Settings and user management
- [x] Cloud relay for home check-ins
- [x] Token-based de-identification (HIPAA compliant)
- [x] Pre-op risk assessment (KOOS Jr, HOOS Jr, PROMIS-10)

---

## FEATURES TO BUILD

- [ ] iPhone ROM measurement (ARKit motion sensors)
- [ ] PROM questionnaires in check-in flow (CMS compliance)
- [ ] SMS/email reminders (Twilio integration)
- [ ] PDF report generation
- [ ] Auto-backup to clinic cloud account

---

## SUPABASE CREDENTIALS (for reference only - NOT primary system)

The Supabase/Netlify version was a prototype. The real system uses SQLite on NUC.

- URL: https://kutnednztssloqluygse.supabase.co
- Key: sb_publishable_Bs41LPV6lzVSk3RvdNGnOg_Io1z1m-o
- Clinic ID: 11111111-1111-1111-1111-111111111111

---

## GITHUB

Repository: jdangeldoc/sro-intelligence

---

## IMPORTANT RULES FOR CLAUDE

1. **NEVER scatter files** — everything goes in SRO_Intelligence folder
2. **sro-local is the main app** — not Netlify, not Supabase
3. **Read this file first** every session
4. **Don't ask questions already answered here**
5. **Don't recreate the wheel** — check what's built before building

---

## DELETED (DO NOT RECREATE)

- `archive/` folder — old duplicates, deleted Feb 4 2026
- `deploy/` folder — Supabase prototype, deleted Feb 4 2026
- Netlify deployment — was prototype only
- Any HTML files in SRO_Intelligence root — moved to sro-local/public

---

## CONTACT

Jeff Angel
jangel@mpoc.cc