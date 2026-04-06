
from fpdf import FPDF
from datetime import datetime

def generate_pdf(patient_data):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    pdf.set_title("Angel TKA Risk & KOOS JR Report")
    pdf.cell(200, 10, txt="Angel TKA Risk Estimator Report", ln=True, align='C')
    pdf.ln(10)
    for label, value in patient_data.items():
        pdf.cell(200, 10, txt=f"{label}: {value}", ln=True)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    pdf.ln(5)
    pdf.cell(200, 10, txt=f"Generated on: {now}", ln=True)
    output_path = "tka_risk_summary.pdf"
    pdf.output(output_path)
    return output_path
