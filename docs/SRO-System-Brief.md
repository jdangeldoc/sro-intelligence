# SRO Intelligence — Complete System Brief

**Prepared for:** Business partner review & LLM-assisted analysis
**Date:** February 18, 2026
**Version:** 1.0 (All core phases complete)
**Contact:** Jeff Angel, jangel@mpoc.cc

---

## HOW TO USE THIS DOCUMENT

Paste this entire document into ChatGPT, Claude, Gemini, or any LLM. Then ask whatever you want — marketing strategy, competitive analysis, pricing models, investor pitch, regulatory questions, go-to-market, sales copy, risk assessment, etc. The LLM will have full context on the product, market, technology, and competitive landscape.

**Example prompts after pasting:**
- "What's the strongest value proposition for hospital administrators?"
- "Draft a one-page sales sheet for orthopedic practices"
- "What are the biggest risks to this business model?"
- "Compare this to Force Therapeutics and identify our advantages"
- "Write an investor pitch deck outline"
- "What should our pricing model be?"
- "Identify regulatory risks and how to mitigate them"
- "Draft marketing copy for the website"
- "What's our TAM/SAM/SOM?"
- "Write a cold email to an orthopedic practice administrator"
- "What questions would a hospital CIO ask and how do we answer them?"
- "Design a pilot program proposal for a 5-surgeon practice"

---

## SECTION 1: THE PROBLEM

Every total joint replacement (hip or knee) generates a 90-day episode of care. The US performs approximately 1.4 million total knee and total hip replacements per year, growing 4-6% annually as the population ages.

During each episode, CMS (Medicare) and commercial payers now require orthopedic practices to:

1. **Collect patient-reported outcome measures (PROMs)** at specific time windows — pre-operative, 6 weeks, 3 months, and 1 year post-surgery
2. **Monitor patients** remotely for complications, ER visits, and readmissions throughout the 90-day episode
3. **Document shared decision-making** — prove the patient participated in an informed discussion about risks, benefits, and expected outcomes before surgery
4. **Optimize patients before surgery** — manage comorbidities, complete medical clearances, document conservative care exhausted
5. **Report compliance data** to CMS programs or face financial penalties

### Regulatory Programs Driving Demand

- **CMS TEAM (Transforming Episode Accountability Model)** — Mandatory bundled payment model launching for hip/knee replacements. Practices are financially accountable for the full episode cost and quality.
- **PRO-PM (Patient-Reported Outcome Performance Measure)** — CMS requires PROM collection at pre-op and 1 year. Non-compliance affects quality scores and reimbursement.
- **BPCI-A (Bundled Payments for Care Improvement - Advanced)** — Voluntary bundled payment model. Practices share savings or losses based on episode cost and quality.
- **Commercial bundles** — United Healthcare, Aetna, Blue Cross, and others increasingly requiring episode-level outcome reporting for joint replacement.

### How Practices Manage This Today

Paper forms, Excel spreadsheets, sticky notes, and phone calls. Nurses spend hours calling patients to complete surveys. Surgeons review risk factors on paper charts during 10-minute pre-op visits. Nobody knows their PROM compliance rates until CMS audit time. Pre-operative clearances tracked on whiteboards. Insurance precertification letters typed from scratch.

It's labor-intensive, error-prone, and doesn't scale. A practice doing 500 joints per year needs a dedicated staff person just to manage PROM collection — and most still achieve below 50% compliance.

---

## SECTION 2: THE SOLUTION

### What SRO Intelligence Is

SRO Intelligence is a purpose-built **episode command system** for orthopedic joint replacement practices. It connects three stakeholders — the patient, the surgeon, and the nursing staff — across the complete surgical episode, from first office visit through 1-year post-operative follow-up.

It is **NOT** an electronic health record (EHR). It sits alongside the practice's existing EHR (Epic, Cerner, Meditech, athenaOne, ModMed, etc.) as a specialized episode management layer that handles everything the EHR doesn't do well.

### What Makes It Different

SRO is the only system that covers BOTH sides of the surgical episode in one platform:

**Pre-operative side (no competitor does this):**
- Patient intake with validated outcome instruments (KOOS Jr, HOOS Jr, PROMIS-10, PHQ-2, GAD-2, STOP-BANG)
- 19-category comorbidity assessment with evidence-based outcome impact scoring
- Clinical decision support tool predicting patient-specific post-operative outcomes
- Shared decision-making infographics meeting CMS documentation requirements
- Readmission and mortality risk scoring with printable patient-facing cards
- 10-tab surgical preparation workflow (history/PE, x-ray documentation, prosthesis calculator, equipment lists, precertification letter generation, patient contract, informed consent, insurance tracking, surgical setting recommendation, prehab plan, patient education materials)
- Non-operative treatment plan module based on AAOS clinical practice guidelines
- Pre-op workup tracking with auto-generated clearance requirements

**Post-operative side (competitors exist here, but fragmented):**
- Patient home check-ins via phone browser — no app download, no login, no PHI in URL
- PROM collection scheduling at pre-op, 6-week, 3-month, and 1-year windows
- PROM compliance tracking and reporting dashboard
- Nurse priority queue ranked by clinical urgency
- ER visit and readmission capture
- Adverse event tracking
- Nursing notes and task management
- RPM (Remote Patient Monitoring) time tracking for billing (CPT 99457/99458)
- Episode timeline showing all events chronologically
- PDF episode summary export

---

## SECTION 3: THREE USERS, THREE EXPERIENCES

### The Surgeon — "Show me the story in 30 seconds"

When a surgeon logs in, they see their patient list with color-coded flags. Click any patient and a summary card shows everything on one screen:

- Current pain level with trend arrow
- BMI with category badge
- Joint function score (KOOS Jr or HOOS Jr)
- Projected surgical outcome from the Decision Tool
- Risk tier: Low / Moderate / High / Very High
- Visual comorbidity badges for high-risk conditions (depression, anxiety, CHF, CKD, COPD, diabetes, liver disease, sleep apnea, Afib, morbid obesity, chronic opioids, low back pain, RA, anemia, active smoker, dental risk, anticoagulant use)
- ER visits and readmissions (red badges if any)
- PROM completion status

One-click buttons to: Open Pre-Op Assessment, Open Non-Op Treatment Plan, Open Surgical Prep, view Pain Trend chart, view PROM Trend chart, open Episode Timeline.

**Zero data entry for the surgeon.** Everything is pre-populated from patient intake, check-ins, and nursing documentation.

### The Nurse — "What do I need to chase today?"

The nurse sees a "Today's Priorities" panel — a ranked action queue sorted by urgency:

🔴 **Critical:** Readmissions reported, ER visits, high pain ≥7, pre-op workup incomplete with surgery approaching
🟡 **Warning:** Check-in overdue >3 days, PROM overdue, workup items pending
🟢 **Informational:** Upcoming PROMs due within 14 days, routine follow-ups

Each item shows patient name with MRN, the issue, and quick-action buttons: copy check-in link, add nursing note, view patient detail.

The nurse does NOT see: analytics, HCC scoring, Decision Tool, prosthesis calculator. Just what they need to act on.

### The Admin — "Are we compliant? Are we getting paid?"

Practice-wide KPIs:
- PROM compliance rate (the number hospitals pay for)
- Check-in adherence rate
- RPM-eligible patient count
- Per-surgeon compliance comparison bars
- RPM billing summary
- Exportable data for CMS submissions

---

## SECTION 4: DETAILED FEATURE INVENTORY

### Patient Intake (full-screen, one-question-at-a-time, elderly-friendly)

| Instrument | Purpose | Scoring |
|---|---|---|
| KOOS Jr (7 questions) | Knee function | HSS Rasch conversion, 0-100 |
| HOOS Jr (6 questions) | Hip function | HSS Rasch conversion, 0-100 |
| PROMIS-10 (10 questions) | Global health | Physical + Mental Health T-scores |
| PHQ-2 (2 questions) | Depression screen | Score ≥3 flags for follow-up |
| GAD-2 (2 questions) | Anxiety screen | Score ≥3 flags for follow-up |
| STOP-BANG (8 items) | Sleep apnea screen | ≥3 intermediate risk, ≥5 high risk |
| Demographics | Height, weight, home situation | BMI auto-calculated |
| Nutrition | Diet, GLP-1 meds, weight loss | GLP-1 flagged for surgical hold |

### Comorbidity Assessment (19 categories)

Each comorbidity has: ICD-10 code, HCC code, evidence-based outcome reduction (1-3 points), workup requirements. Auto-populated from intake where possible (BMI ≥40 → morbid obesity, PHQ-2 ≥3 → depression, etc.).

Categories: CHF, CAD, Afib (Cardiovascular group), Diabetes, CKD, COPD, Liver disease, Depression, Anxiety, Chronic opioid use, Morbid obesity, Active smoking, Anemia, Rheumatoid arthritis, Anticoagulant use, Low back pain, Sleep apnea, Dental problems, Urinary issues. Plus free-text "Other" field.

### Decision Tool (Clinical Decision Support)

Target-based outcome prediction:
- **TKA target:** 77 KOOS Jr | **THA target:** 81 HOOS Jr
- **SCB (Substantial Clinical Benefit):** ≥20 point improvement KOOS Jr, ≥22 HOOS Jr
- **PASS (Patient-Acceptable Symptom State):** 71 KOOS Jr, 81 HOOS Jr
- Predicted post-op = Target minus comorbidity reductions (1-3 points each)
- Risk tier, SCB probability, PASS probability displayed
- Surgeon justification field feeds directly into precertification letter

### Shared Decision-Making (meets CMS documentation requirements)

1. **"Your Recovery Path"** — Patient-facing infographic showing current score, predicted post-op score, PASS zone, plain-language narrative. Printable.
2. **"Surgery Safety"** — Readmission and mortality risk adjusted by comorbidity profile, compared to national averages. Printable.

### 10-Tab Surgical Preparation Workflow

| Tab | What It Does |
|---|---|
| 1. History & PE | Diagnosis, surgical history, prior treatments, allergies, medications, full X-ray assessment modal (procedure-specific: knee compartments or hip anatomy) |
| 2. Prosthesis Calculator | Clinical decision logic for implant selection — fixation (cemented vs press-fit), bearing type (CR vs PS for knee, head size for hip), constraint level, stem selection. Full clinical rationale. Procedure-specific (knee vs hip auto-switches). |
| 3. Equipment List | Auto-generated OR supply list from prosthesis recommendation. Printable for OR staff. |
| 4. Precertification | Auto-generated letter of medical necessity with CPT codes, ICD-10 codes, x-ray findings, conservative care documented, PROM scores, predicted improvement, surgeon justification. One-click print/copy. |
| 5. Patient Contract | Digital contract — patient responsibilities, survey commitment, emergency contacts, transportation plan, caregiver info. Signature capture. Printable. |
| 6. Informed Consent | Procedure-specific risk templates (general + procedure-specific risks), readmission/mortality data auto-populated, patient and witness signature fields. Printable. |
| 7. Insurance | Plan type, quality programs auto-selected by plan, prior authorization tracking with status badges (Not Submitted → Submitted → Approved/Denied/Appeal). |
| 8. Post-Op Disposition | Surgical setting score (ASC vs HOPD vs Inpatient) based on published criteria. Discharge destination recommendation (home + outpatient PT, home health, SNF/rehab). Clinical rationale. |
| 9. Prehab/Prep | Personalized pre-operative plan from comorbidity profile: labs, medication management (stop/continue/hold), exercise program, nutrition, weight management, smoking cessation, mental health support. Printable patient handout. |
| 10. Patient Education | Comprehensive pre-op education: skin care protocol (surgery cancellation criteria highlighted), nutrition, supplements (Vitamin D, protein, calcium, iron), walking/exercise program (knee-specific vs hip-specific auto-switches), medication stop/continue/hold lists with timing, joint class info, home preparation checklist, NPO instructions. One-click printable handout. |

### Non-Operative Treatment Plan

Standalone module for patients not having surgery. Based on AAOS Clinical Practice Guidelines for knee OA (3rd Edition, 2021) and hip OA (2nd Edition, 2023). Toggle between knee and hip — content auto-adjusts.

Every treatment shows AAOS evidence strength badge. Covers: weight management, PT/exercise, activity modification, self-management programs, oral NSAIDs, topical NSAIDs, acetaminophen, corticosteroid injections (with injection history tracker), hyaluronic acid, PRP (marked NOT COVERED BY INSURANCE with cost), stem cell/orthobiologics (marked NOT COVERED with FDA status), acupuncture, thermal therapy, aquatic therapy, supplements, arthroscopy, osteotomy.

Provider notes section with follow-up interval, conservative care duration, and escalation plan. Printable patient handout.

### Patient Home Check-Ins

Patient gets a link via text or email: `https://[cloud-url]/checkin.html?t=TOKEN`

No app download. No login. No PHI in the URL. Full-screen, one-question-at-a-time:

1. Pain level (0-10 slider with color gradient)
2. PT exercise compliance (Yes/No)
3. Swelling assessment
4. ROM measurement (drag a cartoon leg — independent flexion/extension peak tracking)
5. Warning signs (chest pain, difficulty breathing, calf swelling, fever, wound drainage, numbness)
6. ER visit / readmission capture (critical for CMS TEAM reporting)
7. Medication compliance
8. Free-text concerns
9. Progress chart showing their pain trend over time

Text-to-speech support for accessibility.

### Post-Op Monitoring & Compliance

- **PROM scheduling:** Auto-generated collection windows at pre-op, 6-week, 3-month, 1-year. Overdue flagging. Link-based reminders (clipboard copy for now, SMS planned).
- **PROM compliance dashboard:** Collection rates by window, by surgeon. Overdue patients. Due-soon patients. The monetization wedge.
- **Check-in adherence tracking:** Per-patient adherence percentage.
- **Adverse event tracking:** ER visits and readmissions logged from patient check-ins or staff entry.
- **Nursing notes:** Free-text with event type tags (phone call, clinic visit, nurse note, complication, care coordination).
- **Task management:** Per-patient action items with categories, priority levels, due dates, completion tracking.
- **RPM time logging:** Start/stop timer, cumulative minutes per patient per month, CPT 99457/99458 billing.
- **Episode timeline:** Chronological view of every event — check-ins, PROMs, assessments, adverse events, notes, tasks.
- **PDF export:** Comprehensive episode summary report.
- **Auto-refresh:** Dashboard polls every 60 seconds.

### Analytics & Reporting

- Surgeon comparison: volume, average scores, improvement rates, complication rates, compliance rates
- CMS Outcomes: SCB (Substantial Clinical Benefit) achievement rates by surgeon and joint type
- CSV export for payer submissions and quality reporting
- Per-surgeon compliance bars for internal benchmarking

### Printable Documents Generated by the System

| Document | Purpose | When |
|---|---|---|
| Patient Education Packet | Give to patient at pre-op visit | Pre-op |
| Prehab Plan | Personalized pre-op preparation | Pre-op |
| Equipment/Supply List | Give to OR staff for case setup | Pre-op |
| Precertification Letter | Submit to insurance | Pre-op |
| Patient Contract | Patient signature | Pre-op |
| Informed Consent | Patient signature | Pre-op |
| Recovery Path Infographic | Shared decision-making | Pre-op |
| Surgery Safety Card | Risk discussion with patient | Pre-op |
| Non-Op Treatment Plan | Patient handout for conservative care | Office visit |
| Episode PDF Summary | For chart, referrals, audits | Anytime |

---

## SECTION 5: TECHNICAL ARCHITECTURE

### HIPAA Compliance — Near Zero Cloud Liability

The system uses a split architecture designed to minimize HIPAA exposure:

**Clinic NUC (Intel NUC mini PC, ~$400):**
- Runs the main application: Node.js + Express + SQLite
- ALL patient data (PHI) stays on this local machine
- Staff access via browser on clinic network: http://192.168.x.x:3000
- Matches de-identified tokens to patient records locally

**Cloud Relay (Render.com):**
- ONLY handles patient home check-ins
- ONLY stores: random token + pain number + PT boolean + ROM degrees
- NO names, NO dates of birth, NO medical record numbers, NO PHI ever
- Auto-deletes data within 24 hours after clinic server confirms receipt
- Clinic NUC polls the relay every 15 minutes

**Result:** Even if the cloud server were completely compromised, an attacker would get: random tokens and numbers. No way to identify any patient. This is fundamentally more secure than cloud-first platforms that store PHI.

### Technology Stack

- **Backend:** Node.js + Express
- **Database:** SQLite (better-sqlite3) — single file, no database server needed
- **Frontend:** Plain HTML/CSS/JavaScript — no React, no build step, no framework dependencies
- **Cloud hosting:** Render.com free tier for the relay
- **Local hosting:** Intel NUC or any mini PC running Windows or Ubuntu

### Deployment Cost

- Hardware: ~$400 one-time (Intel NUC)
- Cloud relay: Free (Render.com free tier)
- Software dependencies: All open-source
- No per-patient fees in the current model
- One-click startup: SRO-Start.bat on desktop opens everything

### Codebase Size

~12,000 lines of code across 8 main files. No external framework dependencies. Entire system fits on a USB drive.

### Database Tables

clinics, users, patients, episodes, checkins, pro_assessments, preop_assessments, rpm_time_logs, prom_schedule, nursing_notes, adverse_events, surgical_prep, nonop_plans, tasks

---

## SECTION 6: COMPETITIVE LANDSCAPE

### The Key Insight: Nobody Does Both Sides

The market is fragmented into silos. No single product covers the full surgical episode the way SRO does. Every competitor addresses one slice:

### Closest Competitor: Force Therapeutics

Force is a digital care management platform focused on surgical episodes. They do the POST-OPERATIVE side well:
- PROM collection and scheduling
- Patient education (video-based, production studio quality)
- Care pathway automation
- Risk stratification into care cohorts
- Nurse navigator workflows
- CMS compliance reporting (PRO-PM, TEAM, BPCI)
- Bidirectional patient messaging
- Wound image uploads
- RTM billing codes
- AJRR registry auto-submission
- EHR integration (Epic, Cerner)
- Used by Northwell, Geisinger, Scripps, Vanderbilt, Hartford HealthCare
- 165+ peer-reviewed publications
- Claims 89% patient opt-in rates

**What Force does NOT do (and SRO does):**
- No prosthesis calculator with clinical decision logic
- No x-ray assessment documentation
- No auto-generated equipment/supply lists
- No precertification letter generation
- No comorbidity-based outcome prediction
- No shared decision infographic with score trajectory
- No readmission/mortality risk scoring
- No surgical setting recommendation (ASC vs HOPD vs Inpatient)
- No prehab plan generation from comorbidity profile
- No patient education with medication stop/continue lists
- No informed consent or patient contract
- No STOP-BANG sleep apnea screening in intake
- No PHQ-2/GAD-2 mental health screening in intake
- No non-operative treatment plan module

**Force is fundamentally a patient engagement and monitoring platform.** It excels post-operatively. It doesn't touch the surgeon's pre-operative clinical workflow at all.

### Other Market Segments (Not Direct Competitors)

**Orthopedic EHRs** (ModMed, athenaOne, CureMD, etc.): Practice management and documentation. Don't do episode management, PROM scheduling, patient home check-ins, outcome prediction, or surgical prep workflows. SRO sits on top of the EHR.

**Implant Templating Software** (TraumaCad/Brainlab, OrthoView/Materialise, PeekMed): Imaging tools that overlay prosthesis templates on x-rays for sizing. SRO's prosthesis calculator is a clinical decision tool (cemented vs press-fit? CR vs PS?), not an imaging-based sizing tool. Complementary, not competing.

**Prior Auth Automation** (Infinx, Waystar, Cohere Health): Connect to payer portals for electronic submission. SRO generates the clinical content (letter of medical necessity with all supporting documentation). Complementary — SRO produces the content, these tools submit it.

**PROM-Only Vendors** (Mytonomy, OBERD, Codabox): Narrowly focused on survey collection and registry reporting. Don't do surgical prep, clinical decision support, or nurse workflow queues.

### SRO's Positioning

SRO is the only system treating the entire surgical episode — from the moment a patient walks in for evaluation to 1-year PROM collection — as one integrated workflow. The market forces practices to buy Force for post-op monitoring, TraumaCad for implant planning, their EHR for documentation, and a separate prior auth tool for insurance — then manually stitch them together. SRO replaces the stitching.

---

## SECTION 7: MONETIZATION & BUSINESS MODEL

### The Wedge: PROM Compliance

The first thing hospitals and practices will pay for is PROM compliance tracking and reporting. CMS is tightening requirements. Practices that can't prove they're collecting PROMs at required intervals face financial penalties under TEAM and quality score reductions under MIPS/PRO-PM.

SRO automates PROM scheduling, collection (patient-friendly one-question-at-a-time interface), compliance tracking (which patients completed, which are overdue), and reporting (per-surgeon rates, per-window rates, exportable data).

A practice doing 500 joints/year that improves PROM compliance from 40% to 85% could avoid significant CMS penalties and qualify for quality bonuses.

### Revenue Streams (Potential)

1. **SaaS subscription per practice** — Monthly fee for the platform
2. **Per-episode fee** — Charge per surgical episode managed (aligns cost with value)
3. **RPM billing enablement** — System tracks time for CPT 99457/99458. At $50-75 per patient per month, RPM revenue can exceed the software cost
4. **Implementation + training fees** — One-time setup
5. **Hardware margin** — Pre-configured NUC appliance with SRO pre-installed

### Revenue Opportunity Per Practice

A 5-surgeon practice doing 800 joints/year:
- 800 episodes × $X per episode
- RPM billing on 400 patients × $50/month × 3 months = $60,000/year in RPM revenue enabled
- Avoided CMS penalties (hard to quantify but real)
- Staff time savings: 1-2 FTEs of nurse time for PROM chasing, precertification, manual tracking

### Market Size

- ~1.4 million TKA + THA per year in the US
- ~6,000+ orthopedic practices
- Growing 4-6% annually
- CMS TEAM making compliance mandatory, not optional — this is a forcing function

---

## SECTION 8: CURRENT STATUS & ROADMAP

### What's Built and Working (as of February 2026)

✅ All core phases complete (A through F)
✅ Patient intake with 6 validated instruments
✅ 19-category comorbidity assessment
✅ Clinical decision tool with target-based outcome prediction
✅ Shared decision-making infographics (recovery path + safety)
✅ 10-tab surgical preparation workflow (including prosthesis calculator for knee AND hip)
✅ Non-operative treatment plan (AAOS guideline-based)
✅ Patient home check-ins (de-identified cloud relay)
✅ PROM scheduling, tracking, and compliance dashboard
✅ Role-based dashboards (surgeon, nurse, admin)
✅ Nurse priority queue with alert ranking
✅ ER visit / readmission capture
✅ Adverse event tracking
✅ Nursing notes and task management
✅ RPM time tracking and billing
✅ Episode timeline
✅ PDF export
✅ Analytics with surgeon comparison and CMS outcomes
✅ Auto-refresh dashboard
✅ ~12,000 lines of code, fully functional

### What's Not Built Yet

- **SMS/email reminders via Twilio** — Currently staff copies links to clipboard and pastes into their own text/email. No automated reminders.
- **EHR integration (HL7/FHIR)** — System operates standalone. Integration with Epic, Cerner, etc. is on roadmap.
- **Shoulder surgery support** — TSA is selectable but prosthesis calculator, x-ray assessment, and education content are knee/hip only.
- **Revision surgery logic** — Revision TKA/THA use primary surgery logic. Revisions need different implant recommendations.
- **Mobile native app** — Everything is web-based. Works on phone browsers but no native iOS/Android app.
- **AI features** — System uses deterministic logic. Opportunities exist for predictive outcome modeling, smart alert prioritization, NLP precertification letters, check-in anomaly detection.

### Where the Product Is Going

**Near-term:** SMS integration, demo environment for partner presentations, seed data for demos
**Medium-term:** EHR integration, shoulder/revision support, AI-powered outcome prediction
**Long-term:** Multi-site deployment, payer integration, national outcome benchmarking, AJRR registry submission

---

## SECTION 9: STRENGTHS, WEAKNESSES, OPPORTUNITIES, THREATS

### Strengths
- Only product covering full episode (pre-op clinical workflow through post-op monitoring)
- HIPAA architecture with near-zero cloud liability
- Low deployment cost (~$400 hardware, open-source stack)
- Evidence-based clinical content (AAOS guidelines, HSS scoring, published literature)
- No framework dependencies — simple, maintainable code
- Works without internet (clinic NUC is self-contained for all clinical functions)

### Weaknesses
- Single developer — bus factor of 1
- No EHR integration yet (manual data entry for patient demographics)
- No mobile native app
- No automated patient reminders (clipboard copy only)
- No clinical validation studies (no published outcomes data yet)
- SQLite limits concurrent users (fine for single clinic, not for enterprise)

### Opportunities
- CMS TEAM making episode accountability mandatory — massive demand driver
- No competitor covers the pre-operative clinical workflow
- RPM billing (99457/99458) creates revenue that pays for the system
- AI features could become major differentiator
- Practices desperate for PROM compliance solutions
- Could expand beyond joints to spine, shoulder, sports medicine

### Threats
- Force Therapeutics could build pre-op features (they have 15 years and VC funding)
- EHR vendors (Epic, Cerner) could add episode management modules
- Practice inertia — "we've always done it with paper"
- Regulatory changes could reduce PROM requirements (unlikely given trend)
- Larger health IT companies could acquire competitors and bundle

---

## SECTION 10: KEY CLINICAL STANDARDS (for accuracy in marketing/sales)

These are non-negotiable clinical standards built into the system. Any marketing or sales materials must accurately represent these:

- **KOOS Jr and HOOS Jr** use official HSS Rasch conversion tables — NOT percentage scoring
- **Comorbidity outcome reductions** are 1-3 points each — based on published literature, not inflated
- **TKA target:** 77 KOOS Jr | **THA target:** 81 HOOS Jr
- **SCB thresholds:** ≥20 KOOS Jr improvement, ≥22 HOOS Jr improvement
- **PASS thresholds:** 71 KOOS Jr, 81 HOOS Jr
- **Non-operative recommendations** cite AAOS Clinical Practice Guidelines (Knee OA 3rd Ed 2021, Hip OA 2nd Ed 2023)
- The system does NOT provide medical diagnoses, does NOT replace clinical judgment, and does NOT make treatment decisions — it provides clinical decision SUPPORT

---

## SECTION 11: DEPLOYMENT OPTIONS

| Option | Cost | Best For |
|---|---|---|
| Intel NUC in clinic | ~$400 one-time | Production deployment |
| ngrok tunnel from dev machine | Free | Live demo on a call |
| Render.com cloud deployment | Free (cold starts) or $7/month (always-on) | Persistent demo URL |
| VPS (DigitalOcean/Linode) | $5-10/month | Permanent demo environment |

The production architecture (NUC in clinic) is also the most HIPAA-secure option. Cloud deployments are for demos and development only.

---

*End of System Brief. Paste this into any LLM and start asking questions.*
