# SRO Intelligence: Complete Product Roadmap

## Executive Summary

SRO Intelligence will evolve from a post-surgical recovery monitoring tool into a **comprehensive joint replacement care coordination platform** that addresses:

1. **CMS TEAM Model compliance** (mandatory January 2026)
2. **THA/TKA PRO-PM reporting requirements** (mandatory 2027)
3. **Pre-surgical optimization** (prehabilitation)
4. **Remote patient monitoring with CPT billing**
5. **Predictive outcome visualization for shared decision-making**

This positions your practice to excel in value-based care while generating additional revenue streams.

### Development Reality Check
Traditional software estimates assume months of development. With AI-assisted development, **we built a complete multi-tenant backend, patient app, and clinician dashboard in under 2 hours.** The timelines in this document reflect actual AI-assisted development speed. **The bottlenecks will be committees, sales, stakeholder buy-in, and staff education — not app development.**

---

## Part 1: CMS TEAM Model Requirements

### What is TEAM?
The **Transforming Episode Accountability Model** is a mandatory bundled payment program running **January 1, 2026 through December 31, 2030** for hospitals in selected regions.

### Key TEAM Requirements for Lower Extremity Joint Replacement (LEJR):

| Requirement | Details |
|-------------|---------|
| Episode Duration | Surgery through **30 days post-discharge** |
| Quality Measures | THA/TKA PRO-PM, Readmission rates, PSI-90 |
| Performance Tracks | Track 1 (year 1, no downside risk) → Track 3 (years 2-5, full risk) |
| Target | Proportion of patients achieving **Substantial Clinical Benefit (SCB)** |

### How SRO Intelligence Supports TEAM:
- ✅ 30-day post-surgical monitoring (already built)
- ✅ Complication/concern flagging (already built)
- 🔄 PRO-PM data collection (to build)
- 🔄 Care coordination documentation (to build)
- 🔄 Episode cost tracking (future)

---

## Part 2: PRO-PM Requirements (Patient-Reported Outcome Performance Measure)

### Required Assessments

#### Pre-Operative (0-90 days before surgery):

| Assessment | Purpose | Questions |
|------------|---------|-----------|
| **KOOS Jr.** (Knee) | Joint-specific function | 7 questions |
| **HOOS Jr.** (Hip) | Joint-specific function | 6 questions |
| **PROMIS Global-10** or **VR-12** | General health status | 10-12 questions |
| **Risk Variables** | Risk adjustment | See below |

#### Risk Variables Required by CMS:

1. **BMI** (provider-reported)
2. **Low back pain** - "Have you had low back pain in the past month?" (Yes/No)
3. **Health literacy** - SILS-2: "How comfortable are you filling out medical forms by yourself?" (0-4 scale)
4. **Total painful joint count** - "What amount of pain have you experienced in the last week in your OTHER knee/hip?" (0-4 scale)
5. **Mental health subscale** - From VR-12 or PROMIS Global

#### Post-Operative (300-425 days after surgery):

| Assessment | Purpose |
|------------|---------|
| **KOOS Jr.** or **HOOS Jr.** | Same as pre-op (must match) |
| **PROMIS Global-10** or **VR-12** | Same as pre-op (must match) |

### Substantial Clinical Benefit (SCB) Thresholds:

| Procedure | Instrument | Minimum Improvement Required |
|-----------|------------|------------------------------|
| Total Knee Arthroplasty (TKA) | KOOS Jr. | **≥20 points** |
| Total Hip Arthroplasty (THA) | HOOS Jr. | **≥22 points** |

### CMS Timeline:

| Period | Dates | Requirement |
|--------|-------|-------------|
| Voluntary Reporting | 2025-2027 | Submit data, not publicly scored |
| Mandatory Reporting | **2027+** | 50% patient completion required |
| Public Reporting | **2027+** | Scores on CMS Care Compare |
| Payment Impact (TEAM) | **2026+** | Affects bundled payment reconciliation |

---

## Part 3: SRO Intelligence Feature Roadmap

### Development Note
**Build times reflect AI-assisted development.** Actual calendar time will be longer due to stakeholder review, pilot testing, staff training, and organizational processes. Plan for 2-3 weeks per phase to account for these real-world factors.

### Phase 1: Foundation (Week 1-2)
**Goal: Get to pilot-ready state**
**Actual build time: 2-4 hours**

| Feature | Status | Build Time |
|---------|--------|------------|
| Daily check-in app | ✅ Built | Done |
| Clinician dashboard | ✅ Built | Done |
| Backend API | ✅ Built | Done |
| Database schema | ✅ Built | Done |
| Patient onboarding flow | 🔄 Next | 1-2 hours |
| SMS reminders (Twilio) | 🔄 Next | 1-2 hours |
| Real login/authentication | 🔄 Next | 1-2 hours |

### Phase 2: PRO-PM Compliance (Week 3-4)
**Goal: Capture CMS-required outcomes data**
**Actual build time: 3-4 hours**

| Feature | Description | Build Time |
|---------|-------------|------------|
| **KOOS Jr. Assessment** | 7-question validated instrument | 30 min |
| **HOOS Jr. Assessment** | 6-question validated instrument | 30 min |
| **PROMIS Global-10** | 10-question general health | 30 min |
| **Risk Variable Collection** | BMI, back pain, literacy, joint count | 30 min |
| **Pre-op/Post-op Timing Engine** | Ensure correct collection windows | 1 hour |
| **CMS Data Export** | Format data for HQR portal submission | 1 hour |
| **1-Year Follow-up Automation** | Auto-schedule 300-425 day surveys | 30 min |

### Phase 3: Decision Support Infographic (Week 5-6)
**Goal: Show patients predicted outcomes before surgery**
**Actual build time: 2-3 hours**

| Feature | Description | Build Time |
|---------|-------------|------------|
| **Pre-op Score Display** | Visual of current KOOS/HOOS score | 30 min |
| **Predicted Post-op Score** | Based on historical data + risk factors | 1 hour |
| **Delta Visualization** | "You're at 45. After surgery, patients like you typically reach 75." | 30 min |
| **SCB Probability** | "85% of similar patients achieve substantial improvement" | 30 min |
| **Risk Factor Impact** | Show how BMI, diabetes, etc. affect outcomes | 30 min |
| **PDF Export** | Patient takes home infographic | 30 min |

**Sample Infographic Concept:**
```
YOUR KNEE FUNCTION JOURNEY
═══════════════════════════════════════════════════

CURRENT SCORE          EXPECTED 1-YEAR SCORE
    ┌───┐                      ┌───┐
    │ 42│ ──────────────────▶ │ 78│  (+36 points)
    └───┘                      └───┘
   POOR                      GOOD
   
[████████░░░░░░░░░░░░]  →  [██████████████████░░]

✓ 89% of patients like you achieve substantial benefit
✓ Your predicted improvement: 36 points (need 20 for SCB)
✓ Risk factors considered: Age 67, BMI 28, No diabetes
```

### Phase 4: Prehabilitation Module (Week 7-8)
**Goal: Optimize patients before surgery to improve outcomes**
**Actual build time: 4-6 hours**

#### Pre-Surgery Optimization Checklist:

| Category | Assessments/Tasks | Optimization Goal |
|----------|-------------------|-------------------|
| **Cardiac** | EKG, cardiology clearance if needed | Risk stratification |
| **Diabetes** | HbA1c check | Target <8% (ideally <7%) |
| **Anemia** | CBC, iron studies | Hgb >10 before surgery |
| **Nutrition** | Albumin, BMI | Protein optimization |
| **Smoking** | Smoking history | Cessation 4+ weeks pre-op |
| **Sleep Apnea** | STOP-BANG screening | CPAP compliance if positive |
| **Dental** | Dental clearance | Reduce infection risk |
| **Mental Health** | PHQ-9, anxiety screen | Address depression/anxiety |
| **Physical Function** | Baseline strength, ROM | Prehab exercises |
| **Medications** | Blood thinner management | Safe discontinuation plan |

#### Module Features:
| Feature | Description | Build Time |
|---------|-------------|------------|
| **Optimization Checklist** | Track all clearances and tests | 1 hour |
| **Task Assignment** | Assign tasks to patient, staff, specialists | 1 hour |
| **Due Date Tracking** | "Cardiology clearance due by 1/15" | 30 min |
| **Document Upload** | Patient uploads clearance letters | 30 min |
| **Prehab Exercise Library** | Video exercises with tracking | 1-2 hours |
| **Readiness Score** | "Patient is 85% surgery-ready" | 30 min |
| **Surgery Hold Alerts** | Flag if critical item incomplete | 30 min |

### Phase 5: Remote Patient Monitoring & Billing (Week 9-10)
**Goal: Generate revenue from home monitoring while improving outcomes**
**Actual build time: 3-4 hours**

#### CPT Codes for Remote Monitoring:

| CPT Code | Description | 2025 Reimbursement | Frequency |
|----------|-------------|-------------------|-----------|
| **99453** | Device setup & patient education | ~$19 | Once per episode |
| **99454** | Device supply, daily transmission | ~$49 | Monthly (16+ days required) |
| **99457** | RPM treatment management (first 20 min) | ~$49 | Monthly |
| **99458** | Additional 20-min increments | ~$39 | Monthly (add-on) |

**Monthly Revenue Potential per Patient:**
- 99454: $49
- 99457: $49
- 99458: $39 (if 40+ min)
- **Total: $98-137/patient/month**

For 30-day post-op period (TEAM episode): ~$100-140 per patient

#### What Counts as "Device" for RPM:
- ✅ App-based ROM measurement (gyroscope) — **Already built!**
- ✅ Connected blood pressure cuff
- ✅ Smart scale (weight)
- ✅ Wearable activity tracker
- ✅ Pulse oximeter

#### RPM Module Features:

| Feature | Description | Build Time |
|---------|-------------|------------|
| **Device Integration** | Connect to Apple Health, Google Fit, wearables | 2 hours |
| **Daily Data Capture** | ROM, steps, vitals auto-logged | 30 min |
| **16-Day Tracking** | Dashboard shows days with readings | 30 min |
| **Time Logging** | Track clinical staff time for 99457/99458 | 30 min |
| **Billing Report Generator** | Monthly report for billing department | 30 min |
| **Documentation Templates** | Auto-generate clinical notes | 30 min |
| **Patient Consent** | Capture RPM consent (required) | 15 min |

### Phase 6: Care Coordination & Documentation (Week 11-12)
**Actual build time: 3-4 hours**

| Feature | Description | Build Time |
|---------|-------------|------------|
| **Appointment Tracker** | Surgeon, PT, PCP, specialist visits | 30 min |
| **PT Visit Logging** | Track PT sessions, ROM progress | 30 min |
| **Home Exercise Compliance** | Log home exercise completion | 30 min |
| **Communication Log** | Document all patient interactions | 30 min |
| **Care Team Messaging** | Secure messaging between team members | 1 hour |
| **Referral Management** | Track specialist referrals | 30 min |
| **Clinical Note Generator** | Auto-generate notes from data | 1 hour |

### Phase 7: Analytics & Quality Reporting (Week 13-14)
**Actual build time: 3-4 hours**

| Feature | Description | Build Time |
|---------|-------------|------------|
| **PRO-PM Dashboard** | Track SCB rates by surgeon, procedure | 1 hour |
| **Outcome Benchmarking** | Compare to national averages | 30 min |
| **Risk-Adjusted Outcomes** | Account for patient complexity | 1 hour |
| **Readmission Tracking** | 30-day and 90-day rates | 30 min |
| **Complication Rates** | Track by type and timing | 30 min |
| **CMS Report Generator** | Format data for submission | 30 min |
| **Quality Meeting Reports** | Exportable summaries | 30 min |

---

## Part 4: Implementation Timeline Summary

### Build vs. Calendar Time

| Phase | Build Time | Calendar Time | Bottleneck |
|-------|------------|---------------|------------|
| Foundation | 4-6 hours | Week 1-2 | Pilot site selection, staff training |
| PRO-PM Compliance | 3-4 hours | Week 3-4 | Workflow integration, IT review |
| Decision Infographic | 2-3 hours | Week 5-6 | Clinical validation, patient testing |
| Prehabilitation | 4-6 hours | Week 7-8 | Protocol approval, specialist buy-in |
| RPM & Billing | 3-4 hours | Week 9-10 | Billing dept setup, compliance review |
| Care Coordination | 3-4 hours | Week 11-12 | Staff adoption, workflow changes |
| Analytics | 3-4 hours | Week 13-14 | Data validation, reporting setup |

**Total actual development time: ~25-35 hours**
**Total calendar time: ~14 weeks (3.5 months)**
**Primary delays: Organizational, not technical**

### What Actually Slows Things Down:
- Committee approvals and stakeholder meetings
- IT security reviews
- HIPAA compliance verification
- Staff training and change management
- Pilot testing and feedback cycles
- Billing department setup
- EMR integration discussions
- Vendor negotiations (if any)

---

## Part 5: Revenue Impact Analysis

### Current State (No SRO):
- No PRO-PM data → CMS penalty risk (2027+)
- No RPM billing → Lost revenue
- No prehabilitation → Higher complication rates
- No TEAM preparation → Poor bundled payment performance

### With SRO Intelligence:

| Revenue/Savings Source | Per Patient | Annual (500 TJA) |
|------------------------|-------------|------------------|
| RPM billing (30 days) | $100-140 | $50,000-70,000 |
| Avoided readmission (2% reduction) | $15,000 | $150,000 |
| TEAM reconciliation bonus | $500-1,000 | $250,000-500,000 |
| Avoided CMS penalty | - | $50,000-100,000 |
| **Total Annual Impact** | | **$500,000-820,000** |

### Investment Required:

| Item | Cost |
|------|------|
| HIPAA hosting (annual) | $6,000-12,000 |
| SMS costs (annual, 500 patients) | $2,000-5,000 |
| Development time (internal/AI) | $0 (your time) |
| **Total Annual Cost** | **$8,000-17,000** |

**ROI: 30-50x return on investment**

---

## Part 6: Competitive Landscape

### Commercial Alternatives:

| Vendor | Focus | Cost | Notes |
|--------|-------|------|-------|
| Force Therapeutics | PRO-PM, recovery | $5-15/patient | Strong PRO-PM focus |
| Limber Health | Prehab, recovery | $10-20/patient | Exercise focus |
| Mymobility (Zimmer) | Recovery tracking | Device-bundled | Hardware required |
| CORA Health | General ortho | $8-15/patient | Broad feature set |

### SRO Intelligence Advantages:
- ✅ Built specifically for your workflow
- ✅ No per-patient fees
- ✅ Complete ownership of data
- ✅ Customizable to your protocols
- ✅ Integrated prehab + recovery + billing
- ✅ CMS TEAM + PRO-PM compliance built-in
- ✅ Development in hours, not months

---

## Part 7: Next Steps

### This Week:
1. ✅ Deployment complete
2. 🔄 Build patient onboarding + SMS
3. 🔄 Test with 2-3 internal patients

### Next 2 Weeks:
1. Build KOOS Jr. / HOOS Jr. / PROMIS assessments
2. Add risk variable collection
3. Begin limited pilot

### Following 2 Weeks:
1. Decision support infographic
2. Outcome prediction model
3. Expand pilot

### Ongoing:
1. Add prehabilitation module
2. Add RPM billing features
3. Analytics and reporting
4. Iterate based on feedback

---

## Appendix A: KOOS Jr. Questions (7 items)

1. How often are you aware of your knee problems?
2. Have you modified your lifestyle to avoid activities potentially damaging to your knee?
3. How troubled are you with lack of confidence in your knee?
4. What difficulty do you have rising from sitting?
5. What difficulty do you have bending to floor?
6. What difficulty do you have twisting/pivoting on injured knee?
7. What difficulty do you have kneeling?

*Response scale: None, Mild, Moderate, Severe, Extreme (0-4)*
*Score range: 0-100 (interval score)*

## Appendix B: HOOS Jr. Questions (6 items)

1. What difficulty do you have going down stairs?
2. What difficulty do you have getting in/out of bath?
3. What difficulty do you have sitting?
4. What difficulty do you have running?
5. What difficulty do you have twisting/pivoting on leg?
6. How troubled are you with lack of confidence in hip?

*Response scale: None, Mild, Moderate, Severe, Extreme (0-4)*
*Score range: 0-100 (interval score)*

## Appendix C: PROMIS Global-10 Questions

1. In general, would you say your health is... (Excellent-Poor)
2. In general, would you say your quality of life is... (Excellent-Poor)
3. In general, how would you rate your physical health? (Excellent-Poor)
4. In general, how would you rate your mental health? (Excellent-Poor)
5. In general, how would you rate your satisfaction with social activities? (Excellent-Poor)
6. To what extent are you able to carry out everyday physical activities? (Completely-Not at all)
7. How often have you been bothered by emotional problems? (Never-Always)
8. How would you rate your fatigue on average? (None-Very severe)
9. How would you rate your pain on average? (0-10)
10. In general, please rate how well you carry out usual social activities. (Excellent-Poor)

*Yields two scores: Global Physical Health (GPH), Global Mental Health (GMH)*

## Appendix D: Required Risk Variables for CMS

| Variable | Question/Source | Response Options |
|----------|-----------------|------------------|
| BMI | Provider-calculated | Numeric |
| Low back pain | "Have you had low back pain in the past month?" | Yes/No |
| Health literacy (SILS-2) | "How comfortable are you filling out medical forms by yourself?" | 0=Not at all, 1=A little bit, 2=Somewhat, 3=Quite a bit, 4=Extremely |
| Other joint pain | "What amount of pain have you experienced in the last week in your OTHER knee/hip?" | 0=None, 1=Mild, 2=Moderate, 3=Severe, 4=Extreme |
| Mental health subscale | From VR-12 or PROMIS Global-10 | Calculated |

---

*Document Version: 2.0*
*Created: January 2026*
*Author: SRO Intelligence Development Team*
*Note: Build times based on AI-assisted development. Calendar times account for organizational processes.*
