# SRO Intelligence — System Demonstration Guide

**For:** Partner presentation & stakeholder demos
**System:** SRO Intelligence v1.0
**URL:** http://localhost:3000 (clinic NUC) | https://sro-intelligence.com (patient-facing)

---

## How to Use This Guide

This is a click-by-click demo script. Walk through the live system while following each section. The guide mirrors the patient journey from first contact through post-op recovery and CMS reporting. Each section tells you what to show, what to click, and what to say.

**Demo prep:** Before presenting, seed demo data using the button on the dashboard (Admin role → "Seed Demo Data"). This creates realistic patients at various stages of their episode.

**Recommended demo time:** 45-60 minutes for full walkthrough. 25-30 minutes for highlights only (skip sections marked ⏩).

---

## PART 1: THE BIG PICTURE (5 minutes)

### What Problem Does SRO Solve?

Open the login page (localhost:3000). Before logging in, explain the problem:

Every total joint replacement generates a 90-day episode of care. During that episode, CMS (Medicare) and commercial payers now require practices to track patient-reported outcomes (PROMs), monitor for complications, document shared decision-making, and report compliance data — or face financial penalties.

Today, most practices do this with paper forms, spreadsheets, and phone calls. It's labor-intensive, unreliable, and impossible to scale. Nurses chase patients for surveys. Surgeons don't see risk data before operating. Nobody knows their compliance rates until it's too late.

SRO Intelligence is a purpose-built episode command system that connects three stakeholders — the patient, the surgeon, and the nursing staff — across the full surgical episode. It automates the data collection CMS requires, gives surgeons 30-second patient summaries, and gives nurses a prioritized daily action queue.

### Architecture (show briefly)

The system runs on a small computer in the clinic (Intel NUC, ~$400). All patient data stays local — never in the cloud. When patients do check-ins from home, only de-identified data (a token + numbers) touches the internet. The clinic server matches tokens to patients locally. Near-zero HIPAA liability.

**Login now.** Show the three roles: Surgeon, Nurse, Admin. Each sees a different view of the same data.

---

## PART 2: NEW PATIENT ONBOARDING (10 minutes)

### 2A. Adding a Patient to the System

**Login as:** Admin or Nurse

**Navigate to:** Dashboard → "+ Add Patient" button (top right)

**Show the form fields:**

- First name, Last name
- MRN (clinic medical record number) — this is how we distinguish patients with the same name. The MRN shows everywhere: patient lists, dropdowns, modals, printed reports
- Date of birth
- Email, Phone
- Surgeon assignment (dropdown of all surgeons in the system)
- Surgery type: Total Knee (TKA), Total Hip (THA), Partial Knee (UKA), Partial Hip, Hip Fracture, Total Shoulder (TSA)
- Surgery date
- Operative side

**Key point:** When you add a patient, the system automatically creates an episode, generates a unique token for de-identified check-ins, and schedules PROM collection windows at pre-op, 6 weeks, 3 months, and 1 year.

**Click "Add Patient."** The patient now appears in the patient list with their MRN in brackets.

### 2B. Pre-Operative Assessment — Patient Intake

**Navigate to:** Pre-Op (nav bar)

**Select the patient** from the dropdown.

**Click "Launch Patient Intake."** This opens a full-screen, one-question-at-a-time interface designed for elderly patients.

**Walk through the intake flow — show on screen:**

The patient (or a staff member with the patient) sees large-font questions, one at a time. No scrolling, no forms. Just answer and advance.

**Questions collected (in order):**

1. **Joint-specific PROM** — If knee: KOOS Jr (7 questions about stiffness, pain, daily activities, recreation, quality of life). If hip: HOOS Jr (6 questions). These use the official HSS Rasch conversion tables to produce a 0-100 score. Not percentages — validated interval-level scores.

2. **PROMIS-10 Global Health** — 10 questions covering physical function, pain, fatigue, emotional health, social function. Produces Physical Health (T-score) and Mental Health (T-score).

3. **PHQ-2** — Two-question depression screen. Scores ≥3 flag for follow-up.

4. **GAD-2** — Two-question anxiety screen. Scores ≥3 flag for follow-up.

5. **STOP-BANG** — Sleep apnea screening. Snoring, tiredness, observed apnea, blood pressure, BMI, age, neck circumference, gender. Score ≥3 = intermediate risk, ≥5 = high risk. Generates workup requirements (sleep study referral).

6. **Demographics** — Height, weight (stated AND actual), BMI auto-calculates. Home situation: lives alone vs. with someone, stairs at home, caregiver available.

7. **Nutrition** — Diet quality, GLP-1 medication use (Ozempic, Wegovy, Mounjaro — critical because these must be held before surgery for aspiration risk), weight loss history.

**After completion, click "Finish Intake."** The system scores everything and populates five tabs.

### 2C. Pre-Op Results — The Five Tabs

**Tab 1: Intake Results**

Shows all scored instruments in a summary card:

- KOOS Jr or HOOS Jr score (0-100)
- PROMIS Physical and Mental Health T-scores
- PHQ-2 and GAD-2 with flag badges if ≥3
- STOP-BANG score with risk level
- BMI with category badge (normal/overweight/obese/morbidly obese)
- Demographics and home situation

**Tab 2: Comorbidities / HCC**

19 structured comorbidity categories, each with:

- ICD-10 / HCC code
- Comorbidity weight (outcome reduction in points: 1-3 per condition)
- "Present" toggle
- "Needs Workup" toggle

Categories include: CHF, CAD, Afib (grouped under Cardiovascular), Diabetes, CKD, COPD, Liver disease, Depression, Anxiety, Chronic opioid use, Morbid obesity, Active smoking, Anemia, Rheumatoid arthritis, Anticoagulant use, Low back pain, Sleep apnea, Dental problems, Urinary issues.

The system auto-populates comorbidities from intake answers (e.g., BMI ≥40 auto-checks morbid obesity, PHQ-2 ≥3 auto-checks depression).

Also shows: "Other Medical Problems" free-text field, Social Determinants of Health flags.

**Tab 3: Workup Tracking**

Auto-generates required pre-operative workup items based on the comorbidity profile:

- Standard labs (CBC, BMP, Type & Screen)
- Condition-specific tests (HbA1c for diabetics, Echo for CHF, Coags for anticoagulant users, PFTs for severe COPD, Sleep study for high STOP-BANG, etc.)
- Clearance requirements (Cardiology, Pulmonology, Endocrine)

Each item has a checkbox: cleared or pending. The workup status feeds the nurse's daily queue.

**Tab 4: Decision Tool**

This is the clinical decision support engine. It uses a target-based model:

- **Pre-op score:** Patient's current KOOS Jr or HOOS Jr
- **Target post-op score:** 77 for TKA, 81 for THA (evidence-based population means)
- **Comorbidity reductions:** Subtract 1-3 points per active comorbidity
- **Predicted post-op score:** Target minus total comorbidity reductions
- **Predicted improvement (delta):** Predicted post-op minus pre-op
- **SCB likelihood:** Will the patient achieve a Substantial Clinical Benefit? (≥20 points KOOS Jr, ≥22 HOOS Jr)
- **PASS likelihood:** Will they reach the Patient-Acceptable Symptom State? (71 KOOS Jr, 81 HOOS Jr)

Shows a risk tier badge: Low / Moderate / High / Very High.

The surgeon adds a **justification statement** — free text explaining why surgery is indicated despite any risk factors. This feeds directly into the precertification letter.

The surgeon can also mark "Surgery Not Indicated" — this closes the episode and documents the clinical reasoning.

**Tab 5: Patient View — Shared Decision Making**

Two sub-tabs:

**"Your Recovery Path"** — A visual infographic designed to show the patient:

- Their current score on a visual scale
- Where they're expected to land after surgery
- The "PASS zone" (green band showing the score range where most patients say they're satisfied)
- A narrative explanation in plain language

This is designed to be printed and given to the patient as part of the shared decision-making conversation. It meets CMS requirements for documenting that the patient participated in an informed discussion about expected outcomes.

**"Surgery Safety"** — Shows:

- Readmission risk based on their comorbidity profile (TKA national average ~4%, adjusted by risk factors)
- Mortality risk (TKA national average ~0.1%, adjusted)
- Key risk factors listed with visual badges
- Comparison to population averages
- Printable for the patient's records

---

## PART 3: SURGICAL PREPARATION (15 minutes)

### Show: The 10-Tab Surgical Prep Workflow

**Navigate to:** Surg Prep (nav bar)

**Select a patient.** Notice the procedure is locked to match the episode — a TKA patient cannot be accidentally switched to THA.

**Walk through each tab:**

### Tab 1: 📋 Hist/PE (History & Physical Exam)

**Left column:**

- Planned procedure (locked to episode, shows CPT code badge)
- Primary diagnosis (ICD-10 dropdown organized by joint: knee OA, hip OA, post-traumatic, etc.)
- Surgical history — add entries for prior surgeries (date, procedure, notes)

**Right column:**

- Prior injuries to this joint (free text)
- Prior treatments checklist: Physical therapy (with weeks count), Corticosteroid injections (with date — triggers **hard stop** if <90 days before surgery), HA injections, PRP, Arthroscopy, Bracing, NSAIDs (with allergy check)
- Allergies (medications, latex, metals)
- Current medications
- Surgeon notes

**X-Ray Assessment** — Click the "Open X-Ray Assessment" button. This opens a full modal window.

For **knee** patients: Alignment (radio buttons — all visible, no dropdowns), Joint space narrowing by compartment (medial/lateral/patellofemoral — each with severity and mm measurement), Osteophytes by compartment with severity, Subchondral sclerosis by compartment, Kellgren-Lawrence grade, additional findings.

For **hip** patients: The modal automatically switches to show hip-specific findings — Joint space narrowing (superior/medial/global), Femoral head shape (round/flattened/collapsed/large cysts), Acetabular changes (sclerosis, cysts, osteophytes, protrusio, dysplasia), Femoral osteophytes, Additional findings (heterotopic ossification, leg length discrepancy with mm measurement, CAM/Pincer impingement).

Everything saves and shows a summary preview on the Hist/PE tab. X-ray findings auto-populate into the Precertification tab.

### Tab 2: 🦴 Prosthesis Calculator

**For knee patients:** Enter age, BMI, bone quality, PCL status, collateral ligaments, deformity (auto-populated from x-ray alignment). The system recommends:

- Fixation: Cemented vs. Press-fit (uncemented)
- Bearing: Cruciate Retaining (CR) vs. Posterior Stabilized (PS)
- Constraint level: Standard, PS, CCK (constrained condylar knee)
- Stem: None vs. Tibial stem extension
- Full clinical rationale for each decision

**For hip patients:** The calculator automatically switches. It recommends:

- Fixation: Cemented vs. Uncemented
- Stem type: Short stem, Standard taper, Polished taper
- Head size: 32mm vs. 36mm
- Bearing surface: Cobalt-Chrome on poly vs. Ceramic on poly
- Cup type: Uncemented porous-coated vs. Cemented all-poly
- Full clinical rationale

### Tab 3: 📦 Equipment List

Auto-generated from the prosthesis recommendation. Lists every item needed for the OR:

- Implant system components (procedure-specific)
- Cement and mixing supplies (if cemented)
- Augments/stems (if needed)
- Instruments and cutting guides
- Surgical supplies

Printable — hand to OR staff for case setup.

### Tab 4: 📋 Precertification

Auto-generates a letter of medical necessity:

- CPT code (auto from procedure)
- ICD-10 codes (auto from diagnosis)
- X-ray findings summary (auto-pulled from Hist/PE tab)
- Conservative care already exhausted (auto-checked from treatment history: PT, injections, NSAIDs, bracing)
- Patient-reported outcome scores (auto from pre-op assessment)
- Predicted improvement delta
- Surgeon justification (auto from Decision Tool)
- Full narrative letter with all supporting documentation

One click to print or copy the entire precertification packet.

### Tab 5: ✍️ Patient Contract

Digital contract template. The patient acknowledges:

- Their responsibilities during the episode (check-ins, PT compliance, medication adherence)
- Commitment to complete post-op surveys (PROMs)
- Emergency contact and caregiver information
- Transportation plan
- Contact method preferences

Signature capture (checkbox + timestamp). Printable.

### Tab 6: ⚕️ Informed Consent

Procedure-specific consent template with:

- General surgical risks (infection, blood clots, nerve damage, etc.)
- Procedure-specific risks (dislocation for hip, instability for knee, etc.)
- Readmission and mortality risk data (auto-populated from Pre-Op Safety view)
- Patient and witness signature fields
- Printable

### Tab 7: 🏥 Insurance

- Plan type: Medicare FFS, Medicare Advantage, Medicaid, Commercial HMO/PPO/EPO, TRICARE, Workers' Comp, Self-Pay
- Quality programs auto-select based on plan type (TEAM, BPCI, CJR, Commercial Bundles, MSSP/ACO)
- Prior authorization status tracking: Not submitted → Submitted → Approved/Denied/Appeal
- Authorization number, date range
- Color-coded status badge

### Tab 8: 🏠 Post-Op Disposition

Dual-purpose: determines the surgical setting AND post-discharge destination.

**Surgical Setting Score** — Based on published criteria (AAHKS 2024, Meneghini risk stratification):

- Evaluates: age, BMI, ASA class, cardiac history, pulmonary disease, diabetes, anticoagulation, home support, sleep apnea, opioid use, prior anesthesia complications
- Recommends: ASC (ambulatory surgery center), HOPD (hospital outpatient), or Inpatient
- With clinical rationale for each recommendation

**Discharge Destination** — Based on home support, mobility, and risk profile:

- Home with outpatient PT
- Home with home health (PT comes to patient)
- Skilled nursing facility / inpatient rehab

### Tab 9: 💪 Prehab/Prep

Generates a personalized prehabilitation plan from the patient's comorbidity profile:

- Required pre-op labs and tests (condition-specific)
- Medication management (what to stop, what to continue, timing)
- Exercise program (walking goals, joint-specific exercises)
- Nutrition recommendations (protein, supplements)
- Weight management if BMI elevated
- Smoking cessation if active smoker
- Mental health support if PHQ-2/GAD-2 elevated

Printable patient handout.

### Tab 10: 📚 Patient Education

Comprehensive pre-operative education materials covering:

**Skin Care (CRITICAL — highlighted in red):**

- Surgery WILL BE CANCELLED if: open wounds, scratches, pimples, infections on operative limb, or severe infection anywhere on the body
- Instructions: Hibiclens shower protocol, no shaving 2 weeks prior, fresh linens, clean clothes, remove polish/jewelry

**Nutrition:**

- Pre-op: High protein (1.2-1.5 g/kg/day), protein shakes, fruits/vegetables, hydration, limit processed food
- Post-op: Continue protein, high-fiber for constipation prevention, extra hydration, iron if anemic

**Supplements:**

- Vitamin D3 (2,000 IU daily)
- Protein supplement (20-30g, 1-2x daily)
- Calcium (1,200 mg if age >65 or female)
- Iron (only if anemic)

**Walking & Exercises:**

- Walking: 10-15 min → 30 min daily, 5,000-7,000 steps
- Exercises switch automatically between knee-specific (quad sets, SLR, heel slides) and hip-specific (glute bridges, clamshells, hip abduction)

**Medications — Stop vs. Continue:**

- STOP: NSAIDs (7 days), Warfarin (5 days), DOACs (48-72 hrs), Methotrexate (1 week), Biologics (1-2 cycles), GLP-1 (1 week), Herbals (2 weeks)
- CONTINUE: BP meds, Heart meds, Aspirin 81mg, Anxiety/depression meds, Thyroid meds
- HOLD: Metformin (day of + 48 hrs), Insulin (half dose morning of)

**Joint Class & Home Prep:**

- Class link field (customizable per practice)
- Home preparation checklist (raised toilet seat, grab bars, trip hazard removal, etc.)
- NPO instructions

**One-click print** generates a clean patient handout.

---

## PART 4: THE PATIENT AT HOME — CHECK-INS (5 minutes)

### How Patients Check In

After surgery, the patient receives a link (text or email — staff copies from dashboard):

`https://sro-cloud-relay.onrender.com/checkin.html?t=abc123`

No app to download. No login. No PHI in the URL.

**Show the check-in flow** (open on phone or browser):

Full-screen, one question at a time, designed for elderly patients:

1. **Pain level** — Large slider (0-10) with color gradient and emoji faces
2. **PT exercises** — "Did you do your exercises today?" (Yes/No)
3. **Swelling** — Pain and swelling assessment
4. **ROM measurement** — Drag a cartoon leg to measure flexion and extension. Independent peak tracking (the system remembers your best flexion and best extension separately, even if they didn't happen in the same measurement)
5. **Warning signs** — Chest pain, difficulty breathing, calf swelling, fever, wound drainage, new numbness
6. **ER visit / readmission** — "Have you been to the ER?" / "Have you been readmitted?" (critical for CMS TEAM reporting)
7. **Medications** — Taking as prescribed?
8. **Free text** — Any concerns or questions
9. **Progress chart** — Shows their pain trend over time so they can see improvement

Supports text-to-speech for accessibility.

**Data flow:** Check-in goes to cloud relay (token + numbers only, no name). Clinic NUC polls every 15 minutes, matches token → patient, stores locally, relay deletes. All PHI stays on the clinic server.

---

## PART 5: ONGOING MONITORING & NAVIGATION (10 minutes)

### 5A. The Surgeon's View

**Login as:** Surgeon

The surgeon's patient list auto-filters to their own patients. Color-coded flags show status at a glance.

**Click any patient** to open the detail modal.

**Surgeon Quick Summary Card** — everything on one screen:

- **Pain:** Current level with trend arrow (↑ worsening, ↓ improving)
- **BMI:** With category badge
- **Joint Score:** Current KOOS Jr or HOOS Jr
- **Projected Outcome:** From the Decision Tool
- **Risk Tier:** Low/Moderate/High/Very High badge
- **Comorbidity Badges:** Visual icons for high-risk conditions — depression, anxiety, CHF, CKD, COPD, diabetes, liver disease, sleep apnea, Afib, morbid obesity, chronic opioids, mental health flag, low back pain, RA/inflammatory, anemia, active smoker, dental risk, anticoagulant use
- **ER Visits / Readmissions:** Red badges if any
- **PROM Status:** Overdue badge if scheduled PROM not completed

**Quick action buttons:**

- "View Timeline" → Opens Episode Timeline (chronological view of every event)
- "Open PreOp" → Opens Pre-Op Optimizer
- "Open Surg Prep" → Opens Surgical Prep
- "Copy Check-in Link" / "Copy PreOp Link" → For sending to patient

**Zero data entry for the surgeon.** Everything is pre-populated from intake, check-ins, and nursing documentation.

### 5B. The Nurse's View

**Login as:** Nurse

**"Today's Priorities"** panel appears at the top. This is the nurse's daily action queue, sorted by urgency:

🔴 **Critical (Red):**
- Readmissions reported
- ER visits reported
- High pain ≥7
- Pre-op workup incomplete with surgery approaching

🟡 **Warning (Yellow):**
- Check-in overdue >3 days
- PROM overdue (scheduled assessment not completed)
- Workup items pending

🟢 **Informational:**
- Upcoming PROMs due within 14 days
- Routine follow-ups

Each priority item shows: Patient name [MRN], the issue, and quick-action buttons:

- "Copy Link" — Copies check-in or PROM link to clipboard for texting/emailing
- "Add Note" — Opens nursing note modal
- "View" — Opens patient detail

**What the nurse does NOT see:** Analytics, HCC scoring, Decision Tool, prosthesis calculator. These are surgeon tools. The nurse interface is stripped down to action items.

### 5C. The Admin's View

**Login as:** Admin

**Practice Metrics Panel** shows clinic-wide KPIs:

- PROM compliance rate (% of scheduled PROMs completed — this is the number hospitals pay for)
- Check-in adherence rate
- RPM-eligible patient count
- Active alert count
- Average pain across all patients
- Per-surgeon compliance bars (horizontal bar chart comparing surgeons)
- RPM billing summary

**Click through to PROM Compliance tab** (Dashboard → PROM Compliance sub-tab):

- Overall completion rates by window (pre-op, 6-week, 3-month, 1-year)
- Overdue patients with names and what's due
- Due-soon patients (next 14 days)
- Per-surgeon breakdown

### 5D. Patient Detail — What Everyone Sees

**Inside the patient modal:**

**Check-in History** — Every check-in listed with date, pain, PT, ROM, concerns. Click any to expand details.

**Pain Trend Chart** — Line graph of pain scores over time. Visual trend showing recovery trajectory.

**PROM Trend Chart** — KOOS Jr or HOOS Jr scores plotted at pre-op, 6-week, 3-month, 1-year. Shows SCB target line so you can see if the patient is tracking toward meaningful improvement.

**PROM Schedule** — Shows all scheduled assessments with status badges: completed, due, overdue, upcoming.

**Compliance Scorecard** — Per-patient card showing:
- Check-in adherence % (how many days they've checked in vs. expected)
- PROM completion % (how many scheduled PROMs completed)
- Workup clearance status

**Adverse Events** — ER visits and readmissions logged (from patient check-ins or staff entry). Date, type, description, resolution.

**Nursing Notes** — Free-text notes with event type tags: phone call, clinic visit, nurse note, complication, care coordination.

**Tasks** — Actionable to-do items for the care team:
- Categories: Follow-up call, Lab/test order, Referral, Patient education, Documentation, Insurance/Auth, Care coordination, Other
- Priority levels: Low, Medium, High, Urgent
- Due dates
- Completion tracking
- Assigned by/completed by

**RPM Time Logging** — Start/stop timer for remote patient monitoring:
- Tracks cumulative minutes per patient per month
- Feeds RPM billing (CPT 99457: first 20 min, 99458: each additional 20 min)
- Shows total time logged this month

**Episode Timeline** — Click "View Timeline" to open a dedicated chronological view showing every event in one place: check-ins, PROMs, pre-op assessment, surgical prep documentation, adverse events, nursing notes, tasks. Each event is color-coded and expandable.

**Manual Check-in** — Staff can enter a check-in on behalf of the patient (for phone-based encounters).

**Episode PDF Export** — Click "Export PDF" to generate a comprehensive episode summary report:
- Patient header with MRN, DOB, age, procedure
- Pre-operative assessment (BMI, ASA, scores, risk tier, comorbidities)
- PROM scores table (all time points)
- Check-in history
- Adverse events
- Nursing notes
- Open tasks
- Formatted for print/save via browser Print-to-PDF

---

## PART 6: REPORTS & EXPORTS (10 minutes)

### 6A. Analytics — Surgeon Comparison

**Navigate to:** Analytics (nav bar)

**Surgeon Comparison View:**

- Side-by-side metrics for each surgeon
- Patient volume, average pre-op scores, average post-op scores, average improvement
- Complication rates
- PROM compliance rates by surgeon

### 6B. CMS Outcomes Tab

Shows Substantial Clinical Benefit (SCB) achievement rates:

- **SCB Rate Cards:** What percentage of each surgeon's patients achieved meaningful improvement
- **By joint type:** TKA vs. THA
- **Benchmarks:** National average comparisons
- **CSV Export:** Download raw data for payer submissions and quality reporting

### 6C. PROM Compliance Dashboard

**(Dashboard → PROM Compliance tab)**

This is the monetization wedge — the first thing hospitals and practices pay for:

- Overall PROM collection rates
- Rates by time window (pre-op, 6-week, 3-month, 1-year)
- CMS PRO-PM compliance tracking
- Overdue patient lists with actionable follow-up
- Exportable for CMS submission

### 6D. RPM Billing Reports

**Navigate to:** RPM Billing (nav bar)

- Per-patient monthly time logs
- CPT 99457 (first 20 minutes) and 99458 (each additional 20) eligibility
- Revenue projections
- Exportable billing summaries

### 6E. Printable Patient Materials

Summary of everything that prints:

| Document | Source | When |
|---|---|---|
| Patient Education Packet | Surg Prep → Patient Ed tab | Pre-op visit — give to patient |
| Prehab Plan | Surg Prep → Prehab tab | Pre-op visit — personalized from comorbidities |
| Equipment/Supply List | Surg Prep → Equipment tab | Pre-op — give to OR staff |
| Precertification Letter | Surg Prep → Precert tab | For insurance submission |
| Patient Contract | Surg Prep → Contract tab | For patient signature |
| Informed Consent | Surg Prep → Consent tab | For patient signature |
| Shared Decision Infographic | Pre-Op → Patient View tab | Pre-op visit — give to patient |
| Surgery Safety Card | Pre-Op → Patient View → Safety tab | Pre-op visit — give to patient |
| Episode PDF Summary | Dashboard → Patient modal → Export PDF | Anytime — for chart, referrals |

### 6F. Electronic Exports

| Export | Format | Purpose |
|---|---|---|
| Patient list with outcomes | CSV | Quality reporting, payer submissions |
| CMS Outcomes / SCB rates | CSV | PRO-PM and TEAM program compliance |
| PROM compliance data | On-screen dashboard | Internal QA, CMS audits |
| RPM billing data | On-screen report | Monthly billing submission |

---

## PART 7: TECHNICAL & COMPLIANCE HIGHLIGHTS (5 minutes)

### HIPAA Compliance

- All PHI stored on clinic's local server (Intel NUC) — never in the cloud
- Patient home check-ins use token-based de-identification
- Cloud relay stores only: token + pain number + PT boolean + ROM degrees
- Cloud data auto-deletes within 24 hours after clinic server confirms receipt
- No patient names, DOB, or identifiers ever leave the clinic network

### CMS Program Support

- **PRO-PM (Patient-Reported Outcome Performance Measure):** KOOS Jr / HOOS Jr collected at required time windows with validated scoring
- **TEAM (Transforming Episode Accountability Model):** Episode tracking, adverse event capture, quality reporting
- **BPCI-A and CJR:** Episode cost and outcome tracking
- **MIPS Quality Reporting:** PROM data feeds quality measures

### Clinical Scoring Standards

- KOOS Jr and HOOS Jr use official HSS Rasch conversion tables (not percentage scoring)
- PROMIS-10 produces validated T-scores
- Comorbidity impact uses published literature values (1-3 point reductions, not inflated)
- SCB thresholds: ≥20 KOOS Jr, ≥22 HOOS Jr (published minimally important differences)
- PASS thresholds: 71 KOOS Jr, 81 HOOS Jr (published patient-acceptable symptom states)

### Technology

- Node.js + Express + SQLite — runs on any hardware, no cloud subscription
- Plain HTML/JavaScript — no framework dependencies, no build step
- One-click startup (SRO-Start.bat on desktop)
- Under $500 total hardware cost per clinic

---

## DEMO FLOW CHEAT SHEET (Quick Reference)

For a 25-minute highlight demo, hit these stops in order:

1. **Login** → Show role selection (1 min)
2. **Dashboard** → Patient list with flags, click a patient (2 min)
3. **Surgeon Summary Card** → Comorbidity badges, risk tier, scores (2 min)
4. **Pre-Op → Launch Intake** → Show 3-4 questions of the flow, then skip to results (3 min)
5. **Pre-Op → Decision Tool** → Target-based prediction, SCB/PASS (2 min)
6. **Pre-Op → Patient View** → Recovery path infographic (1 min)
7. **Surg Prep → Hist/PE** → X-ray modal (2 min)
8. **Surg Prep → Prosthesis** → Run calculator, show recommendation (2 min)
9. **Surg Prep → Precert** → Auto-generated letter (1 min)
10. **Surg Prep → Patient Ed** → Skin care warning, print (2 min)
11. **Dashboard → Nurse login** → Today's Priorities queue (2 min)
12. **Dashboard → PROM Compliance** → Collection rates (2 min)
13. **Patient check-in link** → Open on phone, show flow (2 min)
14. **Episode PDF Export** → Generate and show (1 min)

---

## OBJECTION HANDLING

**"We already use our EMR for this."**
EMRs track clinical documentation. SRO tracks the episode across all touchpoints — patient home check-ins, PROM scheduling, compliance rates, shared decision-making documentation, surgical prep workflows. No EMR does this end-to-end. SRO is the layer between the EMR and the patient.

**"How is patient data secured?"**
All PHI stays on a computer in your clinic. The cloud component only sees anonymous tokens and numbers. There's nothing to hack in the cloud — no names, no DOB, no medical records. This is more secure than most cloud-based solutions.

**"What happens if the NUC fails?"**
SQLite database can be backed up nightly to a USB drive or cloud storage account. Recovery is copy the backup to a new NUC and restart. Total downtime: minutes, not days.

**"How much does it cost?"**
Hardware: ~$400 one-time (Intel NUC). Software: TBD (subscription model). No per-patient fees for the core system. Compare to: the cost of a single denied precertification, a single CMS penalty for non-compliance, or a single preventable readmission.

**"Can it integrate with Meditech / Epic / Cerner?"**
The system is designed with integration in mind. Patient data can be exported in standard formats. Full EMR integration (HL7/FHIR) is on the roadmap. For now, it operates as a standalone episode management layer.
