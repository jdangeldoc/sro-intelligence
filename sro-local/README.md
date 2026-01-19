# SRO Intelligence - Local Deployment

Post-Surgical Recovery Monitoring Platform for Orthopedic Practices

## Quick Start

### 1. Install Node.js

Download and install Node.js from: https://nodejs.org (LTS version)

### 2. Install Dependencies

Open a terminal/command prompt in this folder and run:

```bash
npm install
```

### 3. Start the Server

```bash
npm start
```

### 4. Open in Browser

Go to: **http://localhost:3000**

---

## What's Included

| Page | URL | Description |
|------|-----|-------------|
| Login | / | Select clinic and user |
| Dashboard | /dashboard.html | View all patients, status flags |
| Patient Check-in | /checkin.html?t=TOKEN | Patient daily check-in form |
| Analytics | /analytics.html | Surgeon comparisons |
| RPM Billing | /rpm-report.html | CPT 99457/99458 tracking |
| Settings | /settings.html | Manage surgeons |

---

## Features

### For Clinicians
- **Dashboard**: See all patients at a glance with red/yellow/green status
- **Patient Detail**: View pain trends, check-in history, PT compliance
- **RPM Timer**: One-click time tracking for billing
- **Export**: CSV exports for patients and RPM billing

### For Patients
- **Simple Check-in**: Large buttons, 30-second form
- **Voice Support**: Questions can be read aloud
- **No App Download**: Works in any browser

### For Billing
- **RPM Time Tracking**: Start/End Review button logs time
- **Monthly Reports**: CPT 99457 and 99458 eligible patients
- **Revenue Estimates**: See potential billing by physician

---

## Database

The application uses SQLite. The database file `sro.db` is created automatically on first run.

### Backup

Copy the `sro.db` file to back up all data.

### Reset

Delete `sro.db` to start fresh (all data will be lost).

---

## For NUC Deployment

### Auto-Start on Boot (Linux/Ubuntu)

Create a systemd service:

```bash
sudo nano /etc/systemd/system/sro.service
```

Paste:

```ini
[Unit]
Description=SRO Intelligence
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/path/to/sro-local
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable sro
sudo systemctl start sro
```

### Access from Other Computers

Replace `localhost` with the NUC's IP address:

```
http://192.168.1.XXX:3000
```

Or set up mDNS for `http://sro.local:3000`

---

## File Structure

```
sro-local/
├── server.js           # Express server + API
├── package.json        # Dependencies
├── sro.db              # SQLite database (auto-created)
├── README.md           # This file
└── public/
    ├── index.html      # Login page
    ├── dashboard.html  # Main clinician dashboard
    ├── checkin.html    # Patient check-in form
    ├── analytics.html  # Analytics page
    ├── rpm-report.html # RPM billing report
    ├── settings.html   # Settings page
    ├── css/
    │   └── styles.css  # Stylesheet
    └── js/
        └── dashboard.js # Dashboard logic
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/clinics | List clinics |
| GET | /api/users | List users/surgeons |
| POST | /api/users | Create user |
| GET | /api/patients | List patients |
| POST | /api/patients | Create patient |
| GET | /api/patient-by-token/:token | Get patient by check-in token |
| GET | /api/checkins | List check-ins |
| POST | /api/checkins | Create check-in |
| GET | /api/rpm-logs | List RPM time logs |
| POST | /api/rpm-logs | Create RPM time log |
| GET | /api/rpm-summary | RPM billing summary |
| GET | /api/dashboard-stats | Dashboard statistics |
| GET | /api/analytics/surgeon-comparison | Surgeon analytics |

---

## Support

Email: support@sro-intelligence.com
