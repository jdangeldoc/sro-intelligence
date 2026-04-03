# SRO Intelligence (Surgical Radiology Operations)

## Stack
Node.js + Express, SQLite (better-sqlite3), plain HTML/CSS/JS frontend (no framework),
Render.com cloud relay, local deployment on Intel NUC

## Goal
HIPAA-compliant AI-powered surgical workflow intelligence — orthopedic post-op recovery
tracking with token-based de-identification and remote patient monitoring (RPM).

## Key Files
- `sro-local/server.js` — Express API + SQLite backend
- `sro-local/public/` — Dashboard, check-in, analytics, RPM reports, cockpit view
- `sro-cloud-relay/` — Cloud relay service (Render.com free tier)
- `sro-local/sro.db` — SQLite database

## Architecture
Three-tier: (1) Cloud Relay on Render receives de-identified check-ins;
(2) Clinic NUC (local SQLite) holds all PHI, polls relay every 15 min, matches tokens;
(3) Surgeon Dashboard at http://192.168.x.x:3000.

## Done
- Patient check-in flow (pain, PT, ROM, medications)
- Clinician dashboard with red/yellow/green flags
- RPM time tracking for CMS billing (99457/99458)
- Analytics and surgeon comparison views
- Pre-op risk assessments (KOOS Jr, HOOS Jr, PROMIS-10)
- Cockpit radial patient view (HUD-inspired fighter-jet UI)
- Chrome extension for clinic integration

## Next
- iPhone ROM measurement via ARKit motion sensors
- PROM questionnaires in check-in flow
- SMS/email reminders (Twilio)
- PDF report generation
- Auto-backup to clinic cloud account
