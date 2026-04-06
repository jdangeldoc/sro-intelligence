
import streamlit as st
from datetime import datetime
from pdf_util import generate_pdf

st.set_page_config(page_title="Angel TKA Risk Estimator", layout="centered")
st.title("🦵 Angel TKA Risk Estimator – Surgical Risk + KOOS JR Projection")

st.markdown("### ➤ Patient Risk Input")

with st.form("risk_form"):
    col1, col2 = st.columns(2)
    with col1:
        age = st.number_input("Age", 50, 95, 70)
        gender = st.selectbox("Sex Assigned at Birth", ["Male", "Female"])
        asa = st.selectbox("ASA Grade", ["1", "2", "3", "4"])
        bmi = st.number_input("BMI", 10.0, 60.0, 28.0)
        diabetes = st.selectbox("Diabetes", ["No", "Yes"])
    with col2:
        ckd = st.selectbox("Chronic Kidney Disease", ["No", "Yes"])
        heart_disease = st.selectbox("History of Cardiac Disease", ["No", "Yes"])
        smoker = st.selectbox("Current Smoker", ["No", "Yes"])
        length_of_stay_risk = st.selectbox("Risk Factors for Prolonged Stay (e.g. home alone, frailty)", ["No", "Yes"])

    st.markdown("### 📝 KOOS JR – Ask Patient to Choose One (4 = No difficulty, 0 = Extreme difficulty)")
    response_map = {
        "No difficulty": 4,
        "Mild difficulty": 3,
        "Moderate difficulty": 2,
        "Severe difficulty": 1,
        "Extreme difficulty": 0
    }

    koos_labels = [
        "How much difficulty do you have going up or down stairs?",
        "How much difficulty do you have walking on a flat surface?",
        "How much difficulty do you have getting in or out of a car?",
        "How much difficulty do you have going shopping?",
        "How much pain do you usually have in your knee?",
        "How much are you troubled by lack of confidence in your knee?",
        "How much difficulty do you have rising from sitting?"
    ]

    koos_qs = []
    for i, q in enumerate(koos_labels):
        choice = st.radio(q, list(response_map.keys()), index=2, key=f"koos_{i}")
        koos_qs.append(response_map[choice])

    submitted = st.form_submit_button("Estimate Risk + KOOS JR")

if submitted:
    mort_risk = 0.4 + (0.4 if age > 80 else 0) + (0.3 if gender == "Male" else 0) +                 (0.4 if asa in ["3", "4"] else 0) + (0.3 if ckd == "Yes" else 0) + (0.2 if heart_disease == "Yes" else 0)
    readm_risk = 2.0 + (0.5 if age > 75 else 0) + (0.5 if diabetes == "Yes" else 0) +                  (0.3 if smoker == "Yes" else 0) + (0.4 if asa in ["3", "4"] else 0)
    los_risk = 15 if length_of_stay_risk == "Yes" else 5

    raw_score = sum(koos_qs)
    preop_koos = (raw_score / 28) * 100
    improvement = 18 if mort_risk > 2 or readm_risk > 10 else 25 if mort_risk > 1 or readm_risk > 5 else 32
    postop_koos = min(preop_koos + improvement, 100)
    tier = "Low" if mort_risk < 1 and readm_risk < 5 else "Moderate" if mort_risk < 2 and readm_risk < 10 else "High"

    st.markdown("### 📊 Estimated Outcomes")
    st.metric("☠️ 90-Day Mortality", f"{mort_risk:.1f} %")
    st.metric("📦 30-Day Readmission", f"{readm_risk:.1f} %")
    st.metric("🛏️ LoS >5 Days", f"{los_risk} %")
    st.success("🧠 Overall Risk Tier: " + tier)
    st.markdown("### 📈 KOOS JR Outcome Projection")
    st.write(f"Pre-op KOOS JR: {preop_koos:.1f}")
    st.write(f"Expected Improvement: +{improvement}")
    st.write(f"Projected Post-op KOOS JR: {postop_koos:.1f}")
    st.progress(int(postop_koos))

    if st.button("📝 Generate PDF Summary"):
        patient_data = {
            "Age": age, "Gender": gender, "BMI": bmi, "ASA Grade": asa,
            "Diabetes": diabetes, "Chronic Kidney Disease": ckd,
            "Cardiac History": heart_disease, "Smoker": smoker,
            "LOS Risk Factors": length_of_stay_risk,
            "90-Day Mortality Risk (%)": f"{mort_risk:.1f}",
            "30-Day Readmission Risk (%)": f"{readm_risk:.1f}",
            "LOS >5d Risk (%)": f"{los_risk}%",
            "Overall Risk Tier": tier,
            "Pre-op KOOS JR": f"{preop_koos:.1f}",
            "Expected Improvement": f"+{improvement}",
            "Projected Post-op KOOS JR": f"{postop_koos:.1f}"
        }
        path = generate_pdf(patient_data)
        with open(path, "rb") as f:
            st.download_button("📥 Download PDF", f, file_name="tka_risk_summary.pdf")
