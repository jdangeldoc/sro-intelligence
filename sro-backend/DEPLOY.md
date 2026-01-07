# SRO Intelligence - Deployment Guide

## Quick Start (15 minutes)

### 1. Database (Supabase - Free tier, HIPAA-ready on paid)

1. Go to https://supabase.com and create account
2. Create new project
3. Go to SQL Editor, paste contents of `schema.sql`, run it
4. Go to Settings > Database > Connection string, copy it

### 2. Backend (Railway - $5/mo)

1. Go to https://railway.app
2. Connect your GitHub
3. Create new project from this repo
4. Add environment variables:
   - `DATABASE_URL` = your Supabase connection string
   - `JWT_SECRET` = generate at https://randomkeygen.com (256-bit)
   - `NODE_ENV` = production
5. Deploy

Your API is now live at `https://your-app.railway.app`

### 3. Frontend

Update the patient app and clinician dashboard to point to your API URL.

---

## HIPAA-Compliant Setup (When Ready for Real Patients)

### Option A: Aptible ($500/mo)

1. Sign up at https://aptible.com
2. They provide HIPAA-compliant hosting with BAA
3. Deploy using their CLI

### Option B: AWS with BAA ($300-500/mo)

1. AWS Business Support + BAA
2. Use RDS PostgreSQL (encrypted)
3. Use Elastic Beanstalk or ECS for API
4. Enable CloudTrail for audit logging

---

## API Endpoints

### Auth
- `POST /api/clinics/register` - New clinic signup
- `POST /api/auth/login` - User login

### Patients
- `GET /api/patients` - List all patients
- `GET /api/patients/:id` - Get patient detail
- `POST /api/patients` - Create patient

### Episodes
- `POST /api/episodes` - Create surgery/episode

### Check-ins
- `POST /api/checkin/:episodeId` - Patient submits check-in
- `GET /api/episodes/:id/checkins` - Get check-in history
- `POST /api/checkins/:id/review` - Mark as reviewed

### Dashboard
- `GET /api/dashboard/stats` - Get red/yellow/green counts

### Users (Admin)
- `GET /api/users` - List clinic users
- `POST /api/users` - Create user

---

## Connecting Frontend

Add to your HTML files:

```javascript
const API_URL = 'https://your-api.railway.app';

// Login
const response = await fetch(`${API_URL}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
const { token } = await response.json();
localStorage.setItem('token', token);

// Authenticated requests
const patients = await fetch(`${API_URL}/api/patients`, {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());
```

---

## Total Costs

| Service | Cost |
|---------|------|
| Supabase (free tier) | $0 |
| Railway | $5/mo |
| Domain | $12/yr |
| **Development total** | **~$5/mo** |

| HIPAA Production | Cost |
|------------------|------|
| Aptible | $500/mo |
| OR AWS with BAA | $300-500/mo |
