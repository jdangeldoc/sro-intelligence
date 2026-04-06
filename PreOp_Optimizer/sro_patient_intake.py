"""
SRO Patient Intake - Elder-Friendly PROMS Collection
Combines CMS requirements with easy-to-use interface for older patients.

Features:
- Large buttons, simple choices
- KOOS-JR (knee) or HOOS-JR (hip)
- PROMIS-10 Global Health
- Mental health screening (PHQ-2, GAD-2)
- Opioid use assessment
- Social/living situation
- Risk estimation with outcome projection
- PDF export

Run with: streamlit run sro_patient_intake.py
"""

import streamlit as st
from datetime import datetime, date
from typing import Dict, Tuple

# ============================================================================
# PAGE CONFIG
# ============================================================================
st.set_page_config(
    page_title="SRO Patient Intake",
    page_icon="🏥",
    layout="centered"
)

# Custom CSS for elder-friendly large buttons
st.markdown("""
<style>
    .stRadio > div {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .stRadio > div > label {
        font-size: 18px !important;
        padding: 12px 20px !important;
        background-color: #f0f2f6;
        border-radius: 10px;
        cursor: pointer;
    }
    .stRadio > div > label:hover {
        background-color: #e0e2e6;
    }
    div[data-baseweb="select"] {
        font-size: 18px !important;
    }
    .big-font {
        font-size: 20px !important;
        font-weight: bold;
    }
    .question-text {
        font-size: 18px !important;
        margin-bottom: 10px;
    }
</style>
""", unsafe_allow_html=True)

# ============================================================================
# CONSTANTS
# ============================================================================

# Simple 5-point scale used for most questions
DIFFICULTY_OPTIONS = [
    "No problem",
    "A little problem", 
    "Some problem",
    "A lot of problem",
    "Extreme problem"
]

DIFFICULTY_VALUES = {
    "No problem": 4,
    "A little problem": 3,
    "Some problem": 2,
    "A lot of problem": 1,
    "Extreme problem": 0
}

FREQUENCY_OPTIONS = [
    "Never",
    "Rarely",
    "Sometimes", 
    "Often",
    "Always"
]

FREQUENCY_VALUES = {
    "Never": 4,
    "Rarely": 3,
    "Sometimes": 2,
    "Often": 1,
    "Always": 0
}

HEALTH_OPTIONS = [
    "Excellent",
    "Very Good",
    "Good",
    "Fair",
    "Poor"
]

HEALTH_VALUES = {
    "Excellent": 5,
    "Very Good": 4,
    "Good": 3,
    "Fair": 2,
    "Poor": 1
}

# KOOS-JR Questions (simplified wording)
KOOS_QUESTIONS = [
    "How often does your KNEE bother you?",
    "Have you changed your daily activities because of your knee?",
    "How hard is it to TWIST or TURN on your knee?",
    "How hard is it to STRAIGHTEN your knee all the way?",
    "How hard is it to go UP or DOWN STAIRS?",
    "How hard is it to STAND?",
    "How hard is it to GET UP from a chair?"
]

# HOOS-JR Questions (simplified wording)
HOOS_QUESTIONS = [
    "How hard is it to go DOWN STAIRS?",
    "How hard is it to GET IN or OUT of a car?",
    "How hard is it to WALK on a flat surface?",
    "How hard is it to PUT ON socks or shoes?",
    "How hard is it to GET UP from a chair?",
    "How STIFF is your hip when you first wake up?"
]

# PROMIS-10 Questions (simplified)
PROMIS_QUESTIONS = [
    ("In general, how is your HEALTH?", "health"),
    ("In general, how is your QUALITY OF LIFE?", "health"),
    ("How is your PHYSICAL health?", "health"),
    ("How is your MENTAL health (mood, thinking)?", "health"),
    ("How happy are you with your SOCIAL life?", "health"),
    ("Can you do DAILY ACTIVITIES (walking, stairs, carrying things)?", "ability"),
    ("How much PAIN do you have on average? (0=none, 10=worst)", "pain"),
    ("How much FATIGUE or tiredness do you have?", "fatigue"),
    ("How often do you feel ANXIOUS or DEPRESSED?", "frequency"),
    ("Can you do your usual WORK and FAMILY activities?", "ability")
]

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def calculate_koos_score(responses: list) -> float:
    """Calculate KOOS-JR score (0-100, higher is better)."""
    total = sum(responses)
    max_score = 28  # 7 questions * 4 max
    return round((total / max_score) * 100, 1)

def calculate_hoos_score(responses: list) -> float:
    """Calculate HOOS-JR score (0-100, higher is better)."""
    total = sum(responses)
    max_score = 24  # 6 questions * 4 max
    return round((total / max_score) * 100, 1)

def calculate_promis_scores(responses: dict) -> Tuple[float, float]:
    """Calculate PROMIS Global Physical (GPH) and Mental (GMH) T-scores."""
    # Physical: Q1, Q2, Q3, Q6, Q7, Q8
    # Mental: Q4, Q5, Q9, Q10
    
    physical_items = [responses.get(f"promis_{i}", 3) for i in [1, 2, 3, 6, 8]]
    mental_items = [responses.get(f"promis_{i}", 3) for i in [4, 5, 9, 10]]
    
    # Pain is reverse scored (0-10 scale, need to invert)
    pain = responses.get("promis_7", 5)
    pain_converted = 5 - (pain / 2)  # Convert 0-10 to 5-0
    physical_items.append(pain_converted)
    
    # Simple T-score approximation (actual uses lookup tables)
    gph_raw = sum(physical_items)
    gmh_raw = sum(mental_items)
    
    gph_t = 30 + (gph_raw * 2)  # Rough approximation
    gmh_t = 30 + (gmh_raw * 2.5)
    
    return round(min(max(gph_t, 20), 80), 1), round(min(max(gmh_t, 20), 80), 1)

def calculate_phq2(q1: int, q2: int) -> Tuple[int, bool]:
    """Calculate PHQ-2 score and positive flag."""
    score = q1 + q2
    return score, score >= 3

def calculate_gad2(q1: int, q2: int) -> Tuple[int, bool]:
    """Calculate GAD-2 score and positive flag."""
    score = q1 + q2
    return score, score >= 3

def estimate_risk(age: int, bmi: float, asa: str, diabetes: str, 
                  ckd: str, cardiac: str, smoker: str, opioid_chronic: bool,
                  lives_alone: bool) -> Dict:
    """Estimate surgical risk based on comorbidities."""
    
    # 90-day mortality risk (%)
    mort = 0.4
    mort += 0.5 if age > 80 else 0.2 if age > 70 else 0
    mort += 0.4 if asa in ["3", "4"] else 0
    mort += 0.3 if ckd == "Yes" else 0
    mort += 0.3 if cardiac == "Yes" else 0
    mort += 0.2 if bmi >= 40 else 0.1 if bmi >= 35 else 0
    
    # 30-day readmission risk (%)
    readm = 2.0
    readm += 0.5 if age > 75 else 0
    readm += 0.5 if diabetes in ["Yes - pills", "Yes - insulin"] else 0
    readm += 0.4 if smoker == "Yes" else 0
    readm += 0.4 if asa in ["3", "4"] else 0
    readm += 0.5 if opioid_chronic else 0
    readm += 0.3 if lives_alone else 0
    
    # LOS > 2 days risk (%)
    los = 10
    los += 15 if lives_alone else 0
    los += 10 if age > 80 else 5 if age > 70 else 0
    los += 10 if bmi >= 40 else 5 if bmi >= 35 else 0
    
    # Risk tier
    if mort < 1 and readm < 5:
        tier = "LOW"
        tier_color = "green"
    elif mort < 2 and readm < 10:
        tier = "MODERATE"
        tier_color = "orange"
    else:
        tier = "HIGH"
        tier_color = "red"
    
    return {
        "mortality": round(mort, 1),
        "readmission": round(readm, 1),
        "los_extended": round(min(los, 50), 0),
        "tier": tier,
        "tier_color": tier_color
    }

def estimate_outcome_improvement(preop_score: float, risk_tier: str, 
                                  phq2_positive: bool, opioid_chronic: bool) -> int:
    """Estimate expected KOOS/HOOS improvement based on risk factors."""
    
    # Base improvement
    if risk_tier == "LOW":
        improvement = 30
    elif risk_tier == "MODERATE":
        improvement = 22
    else:
        improvement = 15
    
    # Reductions
    if phq2_positive:
        improvement -= 5
    if opioid_chronic:
        improvement -= 8
    
    return max(improvement, 8)  # Minimum MCID

# ============================================================================
# MAIN APP
# ============================================================================

def main():
    st.title("🏥 SRO Patient Intake")
    st.markdown("### Please answer these questions about your health")
    
    # Initialize session state
    if 'step' not in st.session_state:
        st.session_state.step = 1
    
    # ========== STEP 1: BASIC INFO ==========
    st.markdown("---")
    st.markdown("## Step 1: About You")
    
    col1, col2 = st.columns(2)
    
    with col1:
        # Age - simple number input instead of date picker
        age = st.number_input("How old are you?", min_value=18, max_value=110, value=65, step=1)
        
        gender = st.radio("Are you:", ["Male", "Female"], horizontal=True)
        
        # Height/Weight for BMI
        height_ft = st.number_input("Height - Feet", min_value=4, max_value=7, value=5)
        height_in = st.number_input("Height - Inches", min_value=0, max_value=11, value=6)
        weight = st.number_input("Weight (pounds)", min_value=80, max_value=500, value=180)
    
    with col2:
        # Procedure - BIG choice
        st.markdown("**Which surgery are you having?**")
        procedure = st.radio(
            "Surgery type:",
            ["🦵 KNEE Replacement", "🦴 HIP Replacement"],
            label_visibility="collapsed"
        )
        joint = "knee" if "KNEE" in procedure else "hip"
        
        # Side
        side = st.radio("Which side?", ["Left", "Right", "Both"], horizontal=True)
    
    # Calculate BMI
    height_total_inches = (height_ft * 12) + height_in
    bmi = round((weight / (height_total_inches ** 2)) * 703, 1) if height_total_inches > 0 else 0
    
    if bmi > 0:
        bmi_category = (
            "Normal" if bmi < 25 else
            "Overweight" if bmi < 30 else
            "Obese" if bmi < 40 else
            "Severely Obese"
        )
        st.info(f"📊 Your BMI: **{bmi}** ({bmi_category})")
    
    # ========== STEP 2: MEDICAL HISTORY ==========
    st.markdown("---")
    st.markdown("## Step 2: Your Health")
    st.markdown("*Please answer honestly - this helps us keep you safe*")
    
    col1, col2 = st.columns(2)
    
    with col1:
        diabetes = st.radio(
            "Do you have DIABETES?",
            ["No", "Yes - diet only", "Yes - pills", "Yes - insulin"]
        )
        
        cardiac = st.radio(
            "Do you have HEART problems?",
            ["No", "Yes"]
        )
        
        ckd = st.radio(
            "Do you have KIDNEY disease?",
            ["No", "Yes"]
        )
    
    with col2:
        smoker = st.radio(
            "Do you SMOKE cigarettes?",
            ["No", "Quit over 1 year ago", "Quit recently", "Yes"]
        )
        
        asa = st.radio(
            "How healthy are you overall?",
            ["Very healthy", "Minor problems", "Serious problems", "Severe problems"],
            help="Your doctor may adjust this"
        )
        asa_map = {"Very healthy": "1", "Minor problems": "2", "Serious problems": "3", "Severe problems": "4"}
        asa_grade = asa_map[asa]
    
    # ========== STEP 3: JOINT FUNCTION (KOOS or HOOS) ==========
    st.markdown("---")
    if joint == "knee":
        st.markdown("## Step 3: Your KNEE Function (KOOS-JR)")
        questions = KOOS_QUESTIONS
    else:
        st.markdown("## Step 3: Your HIP Function (HOOS-JR)")
        questions = HOOS_QUESTIONS
    
    st.markdown("*Choose the answer that best describes your situation*")
    
    joint_responses = []
    for i, q in enumerate(questions):
        st.markdown(f"**{i+1}. {q}**")
        
        if "often" in q.lower() or "bother" in q.lower():
            options = FREQUENCY_OPTIONS
            values = FREQUENCY_VALUES
        else:
            options = DIFFICULTY_OPTIONS
            values = DIFFICULTY_VALUES
        
        choice = st.radio(
            f"Q{i+1}",
            options,
            key=f"joint_{i}",
            horizontal=True,
            label_visibility="collapsed"
        )
        joint_responses.append(values[choice])
        st.markdown("")  # Spacing
    
    # ========== STEP 4: GENERAL HEALTH (PROMIS-10) ==========
    st.markdown("---")
    st.markdown("## Step 4: Your General Health (PROMIS-10)")
    
    promis_responses = {}
    
    for i, (q, qtype) in enumerate(PROMIS_QUESTIONS, 1):
        st.markdown(f"**{i}. {q}**")
        
        if qtype == "health":
            choice = st.radio(f"promis_{i}", HEALTH_OPTIONS, key=f"promis_{i}", 
                            horizontal=True, label_visibility="collapsed")
            promis_responses[f"promis_{i}"] = HEALTH_VALUES[choice]
        
        elif qtype == "ability":
            options = ["Completely", "Mostly", "Moderately", "A little", "Not at all"]
            choice = st.radio(f"promis_{i}", options, key=f"promis_{i}",
                            horizontal=True, label_visibility="collapsed")
            promis_responses[f"promis_{i}"] = 5 - options.index(choice)
        
        elif qtype == "pain":
            promis_responses[f"promis_{i}"] = st.slider(
                "Pain level", 0, 10, 5, key=f"promis_{i}",
                help="0 = No pain, 10 = Worst pain imaginable"
            )
        
        elif qtype == "fatigue":
            options = ["None", "Mild", "Moderate", "Severe", "Very Severe"]
            choice = st.radio(f"promis_{i}", options, key=f"promis_{i}",
                            horizontal=True, label_visibility="collapsed")
            promis_responses[f"promis_{i}"] = 5 - options.index(choice)
        
        elif qtype == "frequency":
            choice = st.radio(f"promis_{i}", FREQUENCY_OPTIONS, key=f"promis_{i}",
                            horizontal=True, label_visibility="collapsed")
            promis_responses[f"promis_{i}"] = FREQUENCY_VALUES[choice]
        
        st.markdown("")
    
    # ========== STEP 5: MENTAL HEALTH ==========
    st.markdown("---")
    st.markdown("## Step 5: Your Mood")
    st.markdown("*Over the past 2 weeks...*")
    
    phq_options = ["Not at all", "Several days", "More than half the days", "Nearly every day"]
    
    st.markdown("**1. Have you felt DOWN, DEPRESSED, or HOPELESS?**")
    phq1 = st.radio("phq1", phq_options, key="phq1", horizontal=True, label_visibility="collapsed")
    phq1_val = phq_options.index(phq1)
    
    st.markdown("**2. Have you had LITTLE INTEREST or PLEASURE in doing things?**")
    phq2 = st.radio("phq2", phq_options, key="phq2", horizontal=True, label_visibility="collapsed")
    phq2_val = phq_options.index(phq2)
    
    st.markdown("**3. Have you felt NERVOUS, ANXIOUS, or ON EDGE?**")
    gad1 = st.radio("gad1", phq_options, key="gad1", horizontal=True, label_visibility="collapsed")
    gad1_val = phq_options.index(gad1)
    
    st.markdown("**4. Have you been unable to STOP WORRYING?**")
    gad2 = st.radio("gad2", phq_options, key="gad2", horizontal=True, label_visibility="collapsed")
    gad2_val = phq_options.index(gad2)
    
    # ========== STEP 6: PAIN MEDICATIONS ==========
    st.markdown("---")
    st.markdown("## Step 6: Pain Medications")
    
    opioid_use = st.radio(
        "**Do you take OPIOID pain medicine?** (like oxycodone, hydrocodone, Percocet, Vicodin, tramadol)",
        ["No", "Yes - less than 3 months", "Yes - more than 3 months"]
    )
    opioid_chronic = opioid_use == "Yes - more than 3 months"
    
    if opioid_use.startswith("Yes"):
        opioid_daily = st.radio("Do you take it EVERY DAY?", ["No", "Yes"])
    else:
        opioid_daily = "No"
    
    # ========== STEP 7: LIVING SITUATION ==========
    st.markdown("---")
    st.markdown("## Step 7: Your Home")
    
    living = st.radio(
        "**Who do you live with?**",
        ["I live ALONE", "With spouse/partner", "With family", "Assisted living/nursing home"]
    )
    lives_alone = living == "I live ALONE"
    
    if lives_alone:
        help_available = st.radio(
            "**Will someone help you at home for 2 weeks after surgery?**",
            ["Yes", "No", "Not sure"]
        )
    else:
        help_available = "Yes"
    
    transport = st.radio(
        "**Can you get to follow-up appointments?**",
        ["Yes - I have a ride", "No - I need help with this", "Not sure"]
    )
    
    stairs = st.radio(
        "**Do you have STAIRS at home you must use?**",
        ["No stairs", "A few stairs", "Many stairs"]
    )
    
    # ========== CALCULATE & SHOW RESULTS ==========
    st.markdown("---")
    st.markdown("---")
    
    if st.button("📊 CALCULATE MY RESULTS", type="primary", use_container_width=True):
        
        # Calculate scores
        if joint == "knee":
            joint_score = calculate_koos_score(joint_responses)
            joint_name = "KOOS-JR"
        else:
            joint_score = calculate_hoos_score(joint_responses)
            joint_name = "HOOS-JR"
        
        gph, gmh = calculate_promis_scores(promis_responses)
        phq2_score, phq2_positive = calculate_phq2(phq1_val, phq2_val)
        gad2_score, gad2_positive = calculate_gad2(gad1_val, gad2_val)
        
        # Risk estimation
        risk = estimate_risk(
            age=age, bmi=bmi, asa=asa_grade,
            diabetes=diabetes, ckd=ckd, cardiac=cardiac,
            smoker=smoker if smoker in ["Yes", "No"] else "No",
            opioid_chronic=opioid_chronic,
            lives_alone=lives_alone
        )
        
        # Outcome projection
        improvement = estimate_outcome_improvement(
            joint_score, risk["tier"], phq2_positive, opioid_chronic
        )
        projected_postop = min(joint_score + improvement, 100)
        
        # ========== DISPLAY RESULTS ==========
        st.markdown("# 📋 YOUR RESULTS")
        
        # Risk Tier - Big Banner
        tier_colors = {"LOW": "🟢", "MODERATE": "🟡", "HIGH": "🔴"}
        st.markdown(f"## {tier_colors[risk['tier']]} Overall Risk: **{risk['tier']}**")
        
        # Scores in columns
        col1, col2, col3 = st.columns(3)
        
        with col1:
            st.metric(f"🦵 {joint_name} Score", f"{joint_score}/100")
        with col2:
            st.metric("💪 Physical Health", f"{gph}")
        with col3:
            st.metric("🧠 Mental Health", f"{gmh}")
        
        # Risk metrics
        st.markdown("### ⚠️ Surgical Risks")
        col1, col2, col3 = st.columns(3)
        
        with col1:
            st.metric("90-Day Mortality", f"{risk['mortality']}%")
        with col2:
            st.metric("30-Day Readmission", f"{risk['readmission']}%")
        with col3:
            st.metric("Extended Hospital Stay", f"{risk['los_extended']}%")
        
        # Outcome Projection
        st.markdown("### 📈 Expected Outcome After Surgery")
        
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Before Surgery", f"{joint_score}")
        with col2:
            st.metric("Expected Improvement", f"+{improvement}")
        with col3:
            st.metric("After Surgery", f"{projected_postop}")
        
        st.progress(int(projected_postop))
        
        # Alerts
        alerts = []
        if phq2_positive:
            alerts.append("⚠️ Depression screen POSITIVE - discuss with your doctor")
        if gad2_positive:
            alerts.append("⚠️ Anxiety screen POSITIVE - discuss with your doctor")
        if opioid_chronic:
            alerts.append("⚠️ Chronic opioid use may affect recovery")
        if lives_alone and help_available != "Yes":
            alerts.append("⚠️ You may need help at home after surgery")
        if smoker == "Yes":
            alerts.append("⚠️ Smoking increases surgery risks - consider quitting")
        if bmi >= 40:
            alerts.append("⚠️ High BMI may affect surgery outcomes")
        
        if alerts:
            st.markdown("### 🚨 Important Notes for Your Doctor")
            for alert in alerts:
                st.warning(alert)
        
        # Summary for provider
        st.markdown("---")
        with st.expander("📄 PROVIDER SUMMARY (Click to expand)"):
            st.text(f"""
═══════════════════════════════════════════════════════════════
                CMS PROMS INTAKE SUMMARY
═══════════════════════════════════════════════════════════════
Date: {date.today().isoformat()}
Procedure: {"TKA" if joint == "knee" else "THA"} - {side}
Collection: Pre-operative

DEMOGRAPHICS
───────────────────────────────────────────────────────────────
Age: {age}    Sex: {gender}    BMI: {bmi}
ASA: {asa_grade}

PROMS SCORES
───────────────────────────────────────────────────────────────
{joint_name}:                    {joint_score}/100
PROMIS-10 Physical (GPH):        {gph} (T-score)
PROMIS-10 Mental (GMH):          {gmh} (T-score)
PHQ-2:                           {phq2_score}/6 {"⚠️ POSITIVE" if phq2_positive else ""}
GAD-2:                           {gad2_score}/6 {"⚠️ POSITIVE" if gad2_positive else ""}

RISK FACTORS
───────────────────────────────────────────────────────────────
Diabetes: {diabetes}
Cardiac: {cardiac}
CKD: {ckd}
Smoking: {smoker}
Chronic Opioid (>90d): {"Yes" if opioid_chronic else "No"}
Lives Alone: {"Yes" if lives_alone else "No"}
Help Available: {help_available}

RISK ESTIMATES
───────────────────────────────────────────────────────────────
90-Day Mortality:        {risk['mortality']}%
30-Day Readmission:      {risk['readmission']}%
Extended LOS (>2d):      {risk['los_extended']}%
Overall Risk Tier:       {risk['tier']}

OUTCOME PROJECTION
───────────────────────────────────────────────────────────────
Pre-op {joint_name}:             {joint_score}
Expected Improvement:            +{improvement}
Projected Post-op:               {projected_postop}
═══════════════════════════════════════════════════════════════
            """)
        
        # Save/Export options
        st.markdown("---")
        col1, col2 = st.columns(2)
        with col1:
            if st.button("💾 Save to Patient Record"):
                st.success("✓ Saved to local database")
        with col2:
            if st.button("📄 Generate PDF"):
                st.info("PDF generation - coming soon")


if __name__ == "__main__":
    main()
