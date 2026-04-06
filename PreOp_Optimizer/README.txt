═══════════════════════════════════════════════════════════════════
              PREOP OPTIMIZER - Perioperative Risk Assessment
═══════════════════════════════════════════════════════════════════

A comprehensive preoperative optimization tool for orthopaedic surgery.

FEATURES:
─────────
• Comorbidity checklist with CMS HCC scoring
• Automated workup generation with HARD BLOCK until complete
• Shared decision-making tool with KOOS/HOOS predictions
• Post-op IL-6 inflammatory lab tracking
• Risk stratification and outcome prediction
• Local SQLite database (no internet required during visits)

PAYERS SUPPORTED:
─────────────────
• Medicare (Novitas - Arkansas)
• Arkansas BCBS (Commercial)
• Arkansas Medicaid
• Medicare Advantage (Strictest criteria)

COMORBIDITIES TRACKED:
──────────────────────
• Diabetes (controlled/uncontrolled)
• CHF, CAD, Atrial Fibrillation
• COPD, Sleep Apnea
• CKD (Stages 3-5)
• Obesity (Class II/III)
• Depression/Anxiety, Serious Mental Illness
• Frailty/Senescence
• Malnutrition
• Chronic Opioid Use
• Anticoagulation
• Anemia, Liver Disease, PVD
• Smoking

WORKFLOW:
─────────
1. Patient Tab - Create or search for patient
2. Comorbidities - Check conditions, select Document or Workup
3. Workup Tab - Track required tests/consults (HARD BLOCK)
4. Decision Tool - Show expected outcomes with risk factors
5. Labs Tab - Track post-op IL-6 at POD 0, 10, 21
6. Summary - Generate complete preop summary

BUILD INSTRUCTIONS:
───────────────────
1. Run build_exe.bat
2. Find PreOpOptimizer.exe in dist folder
3. Copy to any Windows PC

DATA STORAGE:
─────────────
• Local SQLite database at: C:\Users\<you>\OrthoData\ortho_local.db
• Shared between Orthoplan and PreOp Optimizer
• No PHI sent over internet during visits

INTEGRATION:
────────────
• Opens from SRO Dashboard
• Sends summary to Orthoplan
• Syncs to Supabase for analytics (future)

═══════════════════════════════════════════════════════════════════
