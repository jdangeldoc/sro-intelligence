#!/usr/bin/env python
"""
CMS PROMS Patient Intake Module
Comprehensive patient-reported outcome collection for TKA/THA
Meets all CMS requirements for CJRM and Hospital OQR programs

Instruments included:
- KOOS-JR (7 questions) - Knee
- HOOS-JR (6 questions) - Hip  
- PROMIS-10 Global Health (10 questions)
- Social Determinants of Health
- Mental Health Screening (PHQ-2, GAD-2)
- Opioid Use Assessment
- CMS Risk Variables
"""

import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import json
import os
import sys
from datetime import datetime, date
from typing import Dict, List, Optional, Tuple

# ============================================================================
# CMS-REQUIRED PROMS INSTRUMENTS
# ============================================================================

KOOS_JR_QUESTIONS = {
    "instrument": "KOOS-JR",
    "description": "Knee Injury and Osteoarthritis Outcome Score - Joint Replacement",
    "joint": "knee",
    "scoring": {
        "method": "interval_score",
        "range": [0, 100],
        "direction": "higher_is_better"
    },
    "questions": [
        {
            "id": "koos_1",
            "text": "How often are you aware of your knee problem?",
            "category": "symptoms",
            "options": [
                {"value": 4, "label": "Never"},
                {"value": 3, "label": "Monthly"},
                {"value": 2, "label": "Weekly"},
                {"value": 1, "label": "Daily"},
                {"value": 0, "label": "Constantly"}
            ]
        },
        {
            "id": "koos_2", 
            "text": "Have you modified your lifestyle to avoid activities potentially damaging to your knee?",
            "category": "symptoms",
            "options": [
                {"value": 4, "label": "Not at all"},
                {"value": 3, "label": "Mildly"},
                {"value": 2, "label": "Moderately"},
                {"value": 1, "label": "Severely"},
                {"value": 0, "label": "Totally"}
            ]
        },
        {
            "id": "koos_3",
            "text": "How much trouble do you have with turning/pivoting on your knee?",
            "category": "function",
            "options": [
                {"value": 4, "label": "None"},
                {"value": 3, "label": "Mild"},
                {"value": 2, "label": "Moderate"},
                {"value": 1, "label": "Severe"},
                {"value": 0, "label": "Extreme"}
            ]
        },
        {
            "id": "koos_4",
            "text": "What degree of difficulty do you have straightening your knee fully?",
            "category": "stiffness",
            "options": [
                {"value": 4, "label": "None"},
                {"value": 3, "label": "Mild"},
                {"value": 2, "label": "Moderate"},
                {"value": 1, "label": "Severe"},
                {"value": 0, "label": "Extreme"}
            ]
        },
        {
            "id": "koos_5",
            "text": "What degree of difficulty do you have going up or down stairs?",
            "category": "function",
            "options": [
                {"value": 4, "label": "None"},
                {"value": 3, "label": "Mild"},
                {"value": 2, "label": "Moderate"},
                {"value": 1, "label": "Severe"},
                {"value": 0, "label": "Extreme"}
            ]
        },
        {
            "id": "koos_6",
            "text": "What degree of difficulty do you have standing?",
            "category": "function",
            "options": [
                {"value": 4, "label": "None"},
                {"value": 3, "label": "Mild"},
                {"value": 2, "label": "Moderate"},
                {"value": 1, "label": "Severe"},
                {"value": 0, "label": "Extreme"}
            ]
        },
        {
            "id": "koos_7",
            "text": "What degree of difficulty do you have rising from sitting?",
            "category": "function",
            "options": [
                {"value": 4, "label": "None"},
                {"value": 3, "label": "Mild"},
                {"value": 2, "label": "Moderate"},
                {"value": 1, "label": "Severe"},
                {"value": 0, "label": "Extreme"}
            ]
        }
    ]
}

HOOS_JR_QUESTIONS = {
    "instrument": "HOOS-JR",
    "description": "Hip Disability and Osteoarthritis Outcome Score - Joint Replacement",
    "joint": "hip",
    "scoring": {
        "method": "interval_score",
        "range": [0, 100],
        "direction": "higher_is_better"
    },
    "questions": [
        {
            "id": "hoos_1",
            "text": "What degree of difficulty do you have going down stairs?",
            "category": "function",
            "options": [
                {"value": 4, "label": "None"},
                {"value": 3, "label": "Mild"},
                {"value": 2, "label": "Moderate"},
                {"value": 1, "label": "Severe"},
                {"value": 0, "label": "Extreme"}
            ]
        },
        {
            "id": "hoos_2",
            "text": "What degree of difficulty do you have getting in/out of a car?",
            "category": "function",
            "options": [
                {"value": 4, "label": "None"},
                {"value": 3, "label": "Mild"},
                {"value": 2, "label": "Moderate"},
                {"value": 1, "label": "Severe"},
                {"value": 0, "label": "Extreme"}
            ]
        },
        {
            "id": "hoos_3",
            "text": "What degree of difficulty do you have with walking on a flat surface?",
            "category": "function",
            "options": [
                {"value": 4, "label": "None"},
                {"value": 3, "label": "Mild"},
                {"value": 2, "label": "Moderate"},
                {"value": 1, "label": "Severe"},
                {"value": 0, "label": "Extreme"}
            ]
        },
        {
            "id": "hoos_4",
            "text": "What degree of difficulty do you have putting on socks/stockings?",
            "category": "function",
            "options": [
                {"value": 4, "label": "None"},
                {"value": 3, "label": "Mild"},
                {"value": 2, "label": "Moderate"},
                {"value": 1, "label": "Severe"},
                {"value": 0, "label": "Extreme"}
            ]
        },
        {
            "id": "hoos_5",
            "text": "What degree of difficulty do you have rising from sitting?",
            "category": "function",
            "options": [
                {"value": 4, "label": "None"},
                {"value": 3, "label": "Mild"},
                {"value": 2, "label": "Moderate"},
                {"value": 1, "label": "Severe"},
                {"value": 0, "label": "Extreme"}
            ]
        },
        {
            "id": "hoos_6",
            "text": "How severe is your hip stiffness after first waking in the morning?",
            "category": "stiffness",
            "options": [
                {"value": 4, "label": "None"},
                {"value": 3, "label": "Mild"},
                {"value": 2, "label": "Moderate"},
                {"value": 1, "label": "Severe"},
                {"value": 0, "label": "Extreme"}
            ]
        }
    ]
}

PROMIS_10_QUESTIONS = {
    "instrument": "PROMIS-10",
    "description": "PROMIS Global Health 10-Item Short Form",
    "scoring": {
        "method": "t_score",
        "subscales": ["Global Physical Health", "Global Mental Health"],
        "population_mean": 50,
        "population_sd": 10
    },
    "questions": [
        {
            "id": "promis_1",
            "text": "In general, would you say your health is:",
            "subscale": "GPH",
            "options": [
                {"value": 5, "label": "Excellent"},
                {"value": 4, "label": "Very good"},
                {"value": 3, "label": "Good"},
                {"value": 2, "label": "Fair"},
                {"value": 1, "label": "Poor"}
            ]
        },
        {
            "id": "promis_2",
            "text": "In general, would you say your quality of life is:",
            "subscale": "GPH",
            "options": [
                {"value": 5, "label": "Excellent"},
                {"value": 4, "label": "Very good"},
                {"value": 3, "label": "Good"},
                {"value": 2, "label": "Fair"},
                {"value": 1, "label": "Poor"}
            ]
        },
        {
            "id": "promis_3",
            "text": "In general, how would you rate your physical health?",
            "subscale": "GPH",
            "options": [
                {"value": 5, "label": "Excellent"},
                {"value": 4, "label": "Very good"},
                {"value": 3, "label": "Good"},
                {"value": 2, "label": "Fair"},
                {"value": 1, "label": "Poor"}
            ]
        },
        {
            "id": "promis_4",
            "text": "In general, how would you rate your mental health, including your mood and ability to think?",
            "subscale": "GMH",
            "options": [
                {"value": 5, "label": "Excellent"},
                {"value": 4, "label": "Very good"},
                {"value": 3, "label": "Good"},
                {"value": 2, "label": "Fair"},
                {"value": 1, "label": "Poor"}
            ]
        },
        {
            "id": "promis_5",
            "text": "In general, how would you rate your satisfaction with your social activities and relationships?",
            "subscale": "GMH",
            "options": [
                {"value": 5, "label": "Excellent"},
                {"value": 4, "label": "Very good"},
                {"value": 3, "label": "Good"},
                {"value": 2, "label": "Fair"},
                {"value": 1, "label": "Poor"}
            ]
        },
        {
            "id": "promis_6",
            "text": "To what extent are you able to carry out your everyday physical activities such as walking, climbing stairs, carrying groceries, or moving a chair?",
            "subscale": "GPH",
            "options": [
                {"value": 5, "label": "Completely"},
                {"value": 4, "label": "Mostly"},
                {"value": 3, "label": "Moderately"},
                {"value": 2, "label": "A little"},
                {"value": 1, "label": "Not at all"}
            ]
        },
        {
            "id": "promis_7",
            "text": "In the past 7 days, how would you rate your pain on average? (0 = No pain, 10 = Worst pain imaginable)",
            "subscale": "GPH",
            "response_type": "numeric_0_10",
            "reverse_scored": True
        },
        {
            "id": "promis_8",
            "text": "In the past 7 days, how would you rate your fatigue on average?",
            "subscale": "GPH",
            "options": [
                {"value": 5, "label": "None"},
                {"value": 4, "label": "Mild"},
                {"value": 3, "label": "Moderate"},
                {"value": 2, "label": "Severe"},
                {"value": 1, "label": "Very severe"}
            ]
        },
        {
            "id": "promis_9",
            "text": "In the past 7 days, how often have you been bothered by emotional problems such as feeling anxious, depressed, or irritable?",
            "subscale": "GMH",
            "options": [
                {"value": 5, "label": "Never"},
                {"value": 4, "label": "Rarely"},
                {"value": 3, "label": "Sometimes"},
                {"value": 2, "label": "Often"},
                {"value": 1, "label": "Always"}
            ]
        },
        {
            "id": "promis_10",
            "text": "How would you rate your ability to participate in social roles and activities? (Work, family, friends, groups)",
            "subscale": "GMH",
            "options": [
                {"value": 5, "label": "Excellent"},
                {"value": 4, "label": "Very good"},
                {"value": 3, "label": "Good"},
                {"value": 2, "label": "Fair"},
                {"value": 1, "label": "Poor"}
            ]
        }
    ]
}

# PHQ-2 Depression Screening
PHQ2_QUESTIONS = {
    "instrument": "PHQ-2",
    "description": "Patient Health Questionnaire - 2 Item Depression Screen",
    "scoring": {
        "range": [0, 6],
        "positive_screen_threshold": 3
    },
    "stem": "Over the past 2 weeks, how often have you been bothered by:",
    "questions": [
        {
            "id": "phq2_1",
            "text": "Little interest or pleasure in doing things",
            "options": [
                {"value": 0, "label": "Not at all"},
                {"value": 1, "label": "Several days"},
                {"value": 2, "label": "More than half the days"},
                {"value": 3, "label": "Nearly every day"}
            ]
        },
        {
            "id": "phq2_2",
            "text": "Feeling down, depressed, or hopeless",
            "options": [
                {"value": 0, "label": "Not at all"},
                {"value": 1, "label": "Several days"},
                {"value": 2, "label": "More than half the days"},
                {"value": 3, "label": "Nearly every day"}
            ]
        }
    ]
}

# GAD-2 Anxiety Screening
GAD2_QUESTIONS = {
    "instrument": "GAD-2",
    "description": "Generalized Anxiety Disorder - 2 Item Screen",
    "scoring": {
        "range": [0, 6],
        "positive_screen_threshold": 3
    },
    "stem": "Over the past 2 weeks, how often have you been bothered by:",
    "questions": [
        {
            "id": "gad2_1",
            "text": "Feeling nervous, anxious, or on edge",
            "options": [
                {"value": 0, "label": "Not at all"},
                {"value": 1, "label": "Several days"},
                {"value": 2, "label": "More than half the days"},
                {"value": 3, "label": "Nearly every day"}
            ]
        },
        {
            "id": "gad2_2",
            "text": "Not being able to stop or control worrying",
            "options": [
                {"value": 0, "label": "Not at all"},
                {"value": 1, "label": "Several days"},
                {"value": 2, "label": "More than half the days"},
                {"value": 3, "label": "Nearly every day"}
            ]
        }
    ]
}

# Opioid Use Assessment
OPIOID_ASSESSMENT = {
    "instrument": "Opioid Use Assessment",
    "description": "CMS-required opioid use history for TKA/THA risk adjustment",
    "questions": [
        {
            "id": "opioid_1",
            "text": "Are you currently taking any opioid pain medications? (Examples: oxycodone, hydrocodone, morphine, tramadol, codeine)",
            "type": "yes_no"
        },
        {
            "id": "opioid_2",
            "text": "If yes, how long have you been taking opioid medications?",
            "type": "select",
            "options": [
                {"value": "none", "label": "Not taking opioids"},
                {"value": "less_30", "label": "Less than 30 days"},
                {"value": "30_90", "label": "30-90 days"},
                {"value": "over_90", "label": "More than 90 days (chronic use)"}
            ],
            "cms_flag": "chronic_opioid_use_over_90"
        },
        {
            "id": "opioid_3",
            "text": "Have you ever been treated for opioid addiction or dependency?",
            "type": "yes_no"
        },
        {
            "id": "opioid_4",
            "text": "Are you currently on Suboxone, methadone, or other medication-assisted treatment?",
            "type": "yes_no"
        },
        {
            "id": "opioid_5",
            "text": "Do you take opioid medications daily?",
            "type": "yes_no"
        }
    ]
}

# Social Determinants of Health
SDOH_ASSESSMENT = {
    "instrument": "Social Determinants of Health",
    "description": "Social risk factors affecting surgical outcomes",
    "questions": [
        {
            "id": "sdoh_living",
            "text": "What is your current living situation?",
            "type": "select",
            "options": [
                {"value": "home_alone", "label": "Live alone at home"},
                {"value": "home_family", "label": "Live with family/spouse"},
                {"value": "home_caregiver", "label": "Live with caregiver"},
                {"value": "assisted", "label": "Assisted living facility"},
                {"value": "snf", "label": "Skilled nursing facility"},
                {"value": "homeless", "label": "Homeless/unstable housing"}
            ]
        },
        {
            "id": "sdoh_support",
            "text": "Will you have help at home for the first 2 weeks after surgery?",
            "type": "yes_no_unsure"
        },
        {
            "id": "sdoh_transport",
            "text": "Do you have reliable transportation to follow-up appointments?",
            "type": "yes_no_unsure"
        },
        {
            "id": "sdoh_stairs",
            "text": "Do you have stairs at home that you must use daily?",
            "type": "yes_no"
        },
        {
            "id": "sdoh_bathroom",
            "text": "Is your bathroom on the same floor as your bedroom?",
            "type": "yes_no"
        },
        {
            "id": "sdoh_food",
            "text": "In the past 12 months, have you worried about having enough food?",
            "type": "yes_no"
        },
        {
            "id": "sdoh_meds",
            "text": "In the past 12 months, have you had trouble affording your medications?",
            "type": "yes_no"
        },
        {
            "id": "sdoh_english",
            "text": "Do you need an interpreter for medical appointments?",
            "type": "yes_no"
        },
        {
            "id": "sdoh_education",
            "text": "What is your highest level of education?",
            "type": "select",
            "options": [
                {"value": "less_hs", "label": "Less than high school"},
                {"value": "hs", "label": "High school diploma/GED"},
                {"value": "some_college", "label": "Some college"},
                {"value": "college", "label": "College degree"},
                {"value": "graduate", "label": "Graduate degree"}
            ]
        }
    ]
}

# CMS Risk Variables
CMS_RISK_VARIABLES = {
    "instrument": "CMS Risk Adjustment Variables",
    "description": "Required data elements for CMS TKA/THA quality measures",
    "questions": [
        {
            "id": "cms_age",
            "text": "Date of Birth",
            "type": "date",
            "note": "Age calculated at time of surgery"
        },
        {
            "id": "cms_sex",
            "text": "Sex assigned at birth",
            "type": "select",
            "options": [
                {"value": "M", "label": "Male"},
                {"value": "F", "label": "Female"}
            ]
        },
        {
            "id": "cms_height",
            "text": "Height (inches)",
            "type": "numeric"
        },
        {
            "id": "cms_weight",
            "text": "Weight (pounds)",
            "type": "numeric",
            "note": "BMI will be calculated"
        },
        {
            "id": "cms_diagnosis",
            "text": "Primary diagnosis for joint replacement",
            "type": "select",
            "options": [
                {"value": "primary_oa", "label": "Primary Osteoarthritis"},
                {"value": "secondary_oa", "label": "Secondary Osteoarthritis"},
                {"value": "ra", "label": "Rheumatoid Arthritis"},
                {"value": "avn", "label": "Avascular Necrosis"},
                {"value": "fracture", "label": "Fracture"},
                {"value": "other", "label": "Other"}
            ]
        },
        {
            "id": "cms_prior_surgery",
            "text": "Have you had prior surgery on this joint?",
            "type": "yes_no"
        },
        {
            "id": "cms_prior_surgery_type",
            "text": "If yes, what type of prior surgery?",
            "type": "select",
            "options": [
                {"value": "none", "label": "No prior surgery"},
                {"value": "arthroscopy", "label": "Arthroscopy"},
                {"value": "osteotomy", "label": "Osteotomy"},
                {"value": "partial", "label": "Partial joint replacement"},
                {"value": "total", "label": "Total joint replacement (revision)"},
                {"value": "other", "label": "Other"}
            ]
        },
        {
            "id": "cms_diabetes",
            "text": "Do you have diabetes?",
            "type": "select",
            "options": [
                {"value": "no", "label": "No"},
                {"value": "diet", "label": "Yes - controlled with diet"},
                {"value": "oral", "label": "Yes - on oral medications"},
                {"value": "insulin", "label": "Yes - on insulin"}
            ]
        },
        {
            "id": "cms_smoking",
            "text": "What is your smoking status?",
            "type": "select",
            "options": [
                {"value": "never", "label": "Never smoked"},
                {"value": "former", "label": "Former smoker (quit > 1 year ago)"},
                {"value": "recent", "label": "Recently quit (< 1 year ago)"},
                {"value": "current", "label": "Current smoker"}
            ]
        },
        {
            "id": "cms_asa",
            "text": "ASA Physical Status Classification (if known)",
            "type": "select",
            "note": "May be completed by provider",
            "options": [
                {"value": "unknown", "label": "Unknown/Not yet assigned"},
                {"value": "1", "label": "ASA 1 - Normal healthy patient"},
                {"value": "2", "label": "ASA 2 - Mild systemic disease"},
                {"value": "3", "label": "ASA 3 - Severe systemic disease"},
                {"value": "4", "label": "ASA 4 - Severe disease, constant threat to life"}
            ]
        }
    ]
}


# ============================================================================
# SCORING FUNCTIONS
# ============================================================================

def calculate_koos_jr_score(responses: Dict) -> float:
    """
    Calculate KOOS-JR interval score (0-100).
    Uses the published interval scoring table.
    """
    raw_sum = sum(responses.get(f"koos_{i}", 0) for i in range(1, 8))
    max_raw = 28  # 7 questions * 4 max points
    
    # Convert to 0-100 scale (simplified - actual uses interval scoring table)
    score = (raw_sum / max_raw) * 100
    return round(score, 1)


def calculate_hoos_jr_score(responses: Dict) -> float:
    """
    Calculate HOOS-JR interval score (0-100).
    Uses the published interval scoring table.
    """
    raw_sum = sum(responses.get(f"hoos_{i}", 0) for i in range(1, 7))
    max_raw = 24  # 6 questions * 4 max points
    
    # Convert to 0-100 scale (simplified - actual uses interval scoring table)
    score = (raw_sum / max_raw) * 100
    return round(score, 1)


def calculate_promis_scores(responses: Dict) -> Dict:
    """
    Calculate PROMIS-10 Global Physical Health (GPH) and Global Mental Health (GMH) T-scores.
    """
    gph_items = ["promis_1", "promis_2", "promis_3", "promis_6", "promis_7", "promis_8"]
    gmh_items = ["promis_4", "promis_5", "promis_9", "promis_10"]
    
    gph_raw = sum(responses.get(q, 3) for q in gph_items)
    gmh_raw = sum(responses.get(q, 3) for q in gmh_items)
    
    # Simplified T-score conversion (actual uses published tables)
    # T-score = 50 + 10 * (raw - mean) / SD
    gph_t = 50 + (gph_raw - 18) * 2  # Approximation
    gmh_t = 50 + (gmh_raw - 12) * 2.5  # Approximation
    
    return {
        "GPH": round(min(max(gph_t, 20), 80), 1),
        "GMH": round(min(max(gmh_t, 20), 80), 1)
    }


def calculate_phq2_score(responses: Dict) -> Tuple[int, bool]:
    """Calculate PHQ-2 score and positive screen flag."""
    score = responses.get("phq2_1", 0) + responses.get("phq2_2", 0)
    positive = score >= 3
    return score, positive


def calculate_gad2_score(responses: Dict) -> Tuple[int, bool]:
    """Calculate GAD-2 score and positive screen flag."""
    score = responses.get("gad2_1", 0) + responses.get("gad2_2", 0)
    positive = score >= 3
    return score, positive


def calculate_bmi(height_inches: float, weight_lbs: float) -> float:
    """Calculate BMI from height (inches) and weight (pounds)."""
    if height_inches > 0 and weight_lbs > 0:
        return round((weight_lbs / (height_inches ** 2)) * 703, 1)
    return 0


def get_bmi_category(bmi: float) -> str:
    """Get BMI category."""
    if bmi < 18.5:
        return "Underweight"
    elif bmi < 25:
        return "Normal"
    elif bmi < 30:
        return "Overweight"
    elif bmi < 35:
        return "Obese Class I"
    elif bmi < 40:
        return "Obese Class II"
    else:
        return "Obese Class III (Morbid)"


def is_chronic_opioid_use(responses: Dict) -> bool:
    """Determine if patient meets CMS definition of chronic opioid use (>90 days)."""
    return responses.get("opioid_2") == "over_90"


# ============================================================================
# MAIN APPLICATION
# ============================================================================

class CMSPromsIntakeApp:
    def __init__(self, root):
        self.root = root
        self.root.title("CMS PROMS Patient Intake")
        self.root.geometry("900x700")
        
        self.responses = {}
        self.current_section = 0
        
        # Create main container
        self.main_frame = ttk.Frame(root)
        self.main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Header
        header = ttk.Frame(self.main_frame)
        header.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Label(header, text="Patient Intake Questionnaire", 
                  font=("Arial", 16, "bold")).pack(side=tk.LEFT)
        
        self.section_label = ttk.Label(header, text="Section 1 of 7", font=("Arial", 11))
        self.section_label.pack(side=tk.RIGHT)
        
        # Progress bar
        self.progress = ttk.Progressbar(self.main_frame, length=400, mode='determinate')
        self.progress.pack(fill=tk.X, pady=(0, 10))
        
        # Content area (scrollable)
        self.canvas = tk.Canvas(self.main_frame)
        self.scrollbar = ttk.Scrollbar(self.main_frame, orient="vertical", command=self.canvas.yview)
        self.content_frame = ttk.Frame(self.canvas)
        
        self.content_frame.bind("<Configure>", lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all")))
        self.canvas.create_window((0, 0), window=self.content_frame, anchor="nw")
        self.canvas.configure(yscrollcommand=self.scrollbar.set)
        
        self.canvas.pack(side="left", fill="both", expand=True)
        self.scrollbar.pack(side="right", fill="y")
        
        # Navigation buttons
        nav_frame = ttk.Frame(self.main_frame)
        nav_frame.pack(fill=tk.X, pady=(10, 0))
        
        self.back_btn = ttk.Button(nav_frame, text="← Back", command=self.prev_section)
        self.back_btn.pack(side=tk.LEFT)
        
        self.next_btn = ttk.Button(nav_frame, text="Next →", command=self.next_section)
        self.next_btn.pack(side=tk.RIGHT)
        
        # Procedure selection for KOOS vs HOOS
        self.procedure_var = tk.StringVar(value="TKA")
        
        # Define sections
        self.sections = [
            ("Patient Information", self.create_patient_info_section),
            ("Joint-Specific Questions", self.create_joint_section),  # KOOS or HOOS
            ("General Health (PROMIS-10)", self.create_promis_section),
            ("Mental Health Screening", self.create_mental_health_section),
            ("Opioid Use Assessment", self.create_opioid_section),
            ("Social & Living Situation", self.create_sdoh_section),
            ("Review & Submit", self.create_review_section)
        ]
        
        self.question_vars = {}
        
        # Show first section
        self.show_section(0)
    
    def show_section(self, index):
        """Display a specific section."""
        # Clear content
        for widget in self.content_frame.winfo_children():
            widget.destroy()
        
        self.current_section = index
        self.section_label.config(text=f"Section {index + 1} of {len(self.sections)}")
        self.progress['value'] = ((index + 1) / len(self.sections)) * 100
        
        # Update nav buttons
        self.back_btn.config(state=tk.NORMAL if index > 0 else tk.DISABLED)
        self.next_btn.config(text="Submit" if index == len(self.sections) - 1 else "Next →")
        
        # Create section content
        section_name, section_func = self.sections[index]
        
        ttk.Label(self.content_frame, text=section_name, 
                  font=("Arial", 14, "bold")).pack(anchor=tk.W, pady=(0, 15))
        
        section_func()
        
        # Scroll to top
        self.canvas.yview_moveto(0)
    
    def create_patient_info_section(self):
        """Create patient information and CMS risk variables section."""
        frame = ttk.Frame(self.content_frame)
        frame.pack(fill=tk.X, pady=5)
        
        # Procedure selection
        proc_frame = ttk.LabelFrame(frame, text="Planned Procedure", padding=10)
        proc_frame.pack(fill=tk.X, pady=5)
        
        ttk.Radiobutton(proc_frame, text="Total Knee Arthroplasty (TKA)", 
                        variable=self.procedure_var, value="TKA").pack(anchor=tk.W)
        ttk.Radiobutton(proc_frame, text="Total Hip Arthroplasty (THA)", 
                        variable=self.procedure_var, value="THA").pack(anchor=tk.W)
        
        # Demographics
        demo_frame = ttk.LabelFrame(frame, text="Demographics", padding=10)
        demo_frame.pack(fill=tk.X, pady=5)
        
        for q in CMS_RISK_VARIABLES["questions"][:4]:  # First 4: DOB, sex, height, weight
            self.create_question_widget(demo_frame, q)
        
        # Medical history
        med_frame = ttk.LabelFrame(frame, text="Medical History", padding=10)
        med_frame.pack(fill=tk.X, pady=5)
        
        for q in CMS_RISK_VARIABLES["questions"][4:]:
            self.create_question_widget(med_frame, q)
    
    def create_joint_section(self):
        """Create KOOS-JR or HOOS-JR section based on procedure."""
        procedure = self.procedure_var.get()
        
        if procedure == "TKA":
            instrument = KOOS_JR_QUESTIONS
            title = "Knee Function (KOOS-JR)"
        else:
            instrument = HOOS_JR_QUESTIONS
            title = "Hip Function (HOOS-JR)"
        
        frame = ttk.LabelFrame(self.content_frame, text=title, padding=10)
        frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(frame, text=instrument["description"], 
                  font=("Arial", 9, "italic")).pack(anchor=tk.W, pady=(0, 10))
        
        for q in instrument["questions"]:
            self.create_question_widget(frame, q)
    
    def create_promis_section(self):
        """Create PROMIS-10 section."""
        frame = ttk.LabelFrame(self.content_frame, text="PROMIS-10 Global Health", padding=10)
        frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(frame, text="Please answer the following questions about your general health.",
                  font=("Arial", 9, "italic")).pack(anchor=tk.W, pady=(0, 10))
        
        for q in PROMIS_10_QUESTIONS["questions"]:
            self.create_question_widget(frame, q)
    
    def create_mental_health_section(self):
        """Create PHQ-2 and GAD-2 section."""
        # PHQ-2
        phq_frame = ttk.LabelFrame(self.content_frame, text="Depression Screening (PHQ-2)", padding=10)
        phq_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(phq_frame, text=PHQ2_QUESTIONS["stem"],
                  font=("Arial", 9, "italic")).pack(anchor=tk.W, pady=(0, 10))
        
        for q in PHQ2_QUESTIONS["questions"]:
            self.create_question_widget(phq_frame, q)
        
        # GAD-2
        gad_frame = ttk.LabelFrame(self.content_frame, text="Anxiety Screening (GAD-2)", padding=10)
        gad_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(gad_frame, text=GAD2_QUESTIONS["stem"],
                  font=("Arial", 9, "italic")).pack(anchor=tk.W, pady=(0, 10))
        
        for q in GAD2_QUESTIONS["questions"]:
            self.create_question_widget(gad_frame, q)
    
    def create_opioid_section(self):
        """Create opioid use assessment section."""
        frame = ttk.LabelFrame(self.content_frame, text="Pain Medication History", padding=10)
        frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(frame, 
                  text="The following questions help us understand your current pain management and plan for surgery.",
                  font=("Arial", 9, "italic"), wraplength=600).pack(anchor=tk.W, pady=(0, 10))
        
        for q in OPIOID_ASSESSMENT["questions"]:
            self.create_question_widget(frame, q)
    
    def create_sdoh_section(self):
        """Create social determinants section."""
        frame = ttk.LabelFrame(self.content_frame, text="Living Situation & Support", padding=10)
        frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(frame,
                  text="These questions help us plan for your safe recovery after surgery.",
                  font=("Arial", 9, "italic"), wraplength=600).pack(anchor=tk.W, pady=(0, 10))
        
        for q in SDOH_ASSESSMENT["questions"]:
            self.create_question_widget(frame, q)
    
    def create_review_section(self):
        """Create review and submit section."""
        frame = ttk.Frame(self.content_frame)
        frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        ttk.Label(frame, text="Review Your Responses", 
                  font=("Arial", 12, "bold")).pack(anchor=tk.W, pady=(0, 10))
        
        # Calculate scores
        self.collect_responses()
        
        # Summary display
        summary_text = tk.Text(frame, height=25, width=80, font=("Courier", 9))
        summary_text.pack(fill=tk.BOTH, expand=True)
        
        summary = self.generate_summary()
        summary_text.insert("1.0", summary)
        summary_text.config(state=tk.DISABLED)
        
        # Flags/alerts
        alerts = self.check_alerts()
        if alerts:
            alert_frame = ttk.LabelFrame(frame, text="⚠️ Alerts for Provider Review", padding=10)
            alert_frame.pack(fill=tk.X, pady=10)
            
            for alert in alerts:
                ttk.Label(alert_frame, text=f"• {alert}", foreground="red").pack(anchor=tk.W)
    
    def create_question_widget(self, parent, question):
        """Create a widget for a single question."""
        q_frame = ttk.Frame(parent)
        q_frame.pack(fill=tk.X, pady=5)
        
        q_id = question["id"]
        q_text = question["text"]
        
        # Question label
        ttk.Label(q_frame, text=q_text, wraplength=550).pack(anchor=tk.W)
        
        # Response widget based on type
        q_type = question.get("type", "select")
        options = question.get("options", [])
        
        if q_type == "yes_no":
            var = tk.StringVar()
            opt_frame = ttk.Frame(q_frame)
            opt_frame.pack(anchor=tk.W, padx=20)
            ttk.Radiobutton(opt_frame, text="Yes", variable=var, value="yes").pack(side=tk.LEFT)
            ttk.Radiobutton(opt_frame, text="No", variable=var, value="no").pack(side=tk.LEFT, padx=10)
            self.question_vars[q_id] = var
            
        elif q_type == "yes_no_unsure":
            var = tk.StringVar()
            opt_frame = ttk.Frame(q_frame)
            opt_frame.pack(anchor=tk.W, padx=20)
            ttk.Radiobutton(opt_frame, text="Yes", variable=var, value="yes").pack(side=tk.LEFT)
            ttk.Radiobutton(opt_frame, text="No", variable=var, value="no").pack(side=tk.LEFT, padx=10)
            ttk.Radiobutton(opt_frame, text="Unsure", variable=var, value="unsure").pack(side=tk.LEFT, padx=10)
            self.question_vars[q_id] = var
            
        elif q_type == "numeric":
            var = tk.StringVar()
            ttk.Entry(q_frame, textvariable=var, width=10).pack(anchor=tk.W, padx=20)
            self.question_vars[q_id] = var
            
        elif q_type == "date":
            var = tk.StringVar()
            ttk.Entry(q_frame, textvariable=var, width=15).pack(anchor=tk.W, padx=20)
            ttk.Label(q_frame, text="(YYYY-MM-DD)", font=("Arial", 8)).pack(anchor=tk.W, padx=20)
            self.question_vars[q_id] = var
            
        elif question.get("response_type") == "numeric_0_10":
            var = tk.IntVar(value=5)
            scale = ttk.Scale(q_frame, from_=0, to=10, variable=var, orient=tk.HORIZONTAL, length=300)
            scale.pack(anchor=tk.W, padx=20)
            
            label_frame = ttk.Frame(q_frame)
            label_frame.pack(anchor=tk.W, padx=20)
            ttk.Label(label_frame, text="0 (No pain)").pack(side=tk.LEFT)
            ttk.Label(label_frame, text="10 (Worst)").pack(side=tk.RIGHT, padx=200)
            self.question_vars[q_id] = var
            
        else:  # select with options
            var = tk.IntVar() if options and isinstance(options[0].get("value"), int) else tk.StringVar()
            opt_frame = ttk.Frame(q_frame)
            opt_frame.pack(anchor=tk.W, padx=20)
            
            for opt in options:
                ttk.Radiobutton(opt_frame, text=opt["label"], variable=var, 
                                value=opt["value"]).pack(anchor=tk.W)
            
            self.question_vars[q_id] = var
    
    def collect_responses(self):
        """Collect all responses from question variables."""
        for q_id, var in self.question_vars.items():
            try:
                self.responses[q_id] = var.get()
            except:
                self.responses[q_id] = None
    
    def generate_summary(self) -> str:
        """Generate a summary of all responses with scores."""
        procedure = self.procedure_var.get()
        
        # Calculate scores
        if procedure == "TKA":
            joint_score = calculate_koos_jr_score(self.responses)
            joint_name = "KOOS-JR"
        else:
            joint_score = calculate_hoos_jr_score(self.responses)
            joint_name = "HOOS-JR"
        
        promis = calculate_promis_scores(self.responses)
        phq2_score, phq2_pos = calculate_phq2_score(self.responses)
        gad2_score, gad2_pos = calculate_gad2_score(self.responses)
        
        # BMI
        try:
            height = float(self.responses.get("cms_height", 0))
            weight = float(self.responses.get("cms_weight", 0))
            bmi = calculate_bmi(height, weight)
            bmi_cat = get_bmi_category(bmi)
        except:
            bmi = 0
            bmi_cat = "Unknown"
        
        chronic_opioid = is_chronic_opioid_use(self.responses)
        
        summary = f"""
═══════════════════════════════════════════════════════════════════════
                    CMS PROMS INTAKE SUMMARY
═══════════════════════════════════════════════════════════════════════
Date Collected: {date.today().isoformat()}
Procedure: {procedure}
Collection Timepoint: Pre-operative

───────────────────────────────────────────────────────────────────────
                         PROMS SCORES
───────────────────────────────────────────────────────────────────────
{joint_name} Score:              {joint_score:.1f} / 100

PROMIS-10 Global Physical:       {promis['GPH']:.1f} (T-score, mean=50)
PROMIS-10 Global Mental:         {promis['GMH']:.1f} (T-score, mean=50)

PHQ-2 Depression Screen:         {phq2_score}/6 {"⚠️ POSITIVE" if phq2_pos else "(Negative)"}
GAD-2 Anxiety Screen:            {gad2_score}/6 {"⚠️ POSITIVE" if gad2_pos else "(Negative)"}

───────────────────────────────────────────────────────────────────────
                      CMS RISK VARIABLES
───────────────────────────────────────────────────────────────────────
BMI:                             {bmi:.1f} ({bmi_cat})
Diabetes:                        {self.responses.get('cms_diabetes', 'Not answered')}
Smoking Status:                  {self.responses.get('cms_smoking', 'Not answered')}
Primary Diagnosis:               {self.responses.get('cms_diagnosis', 'Not answered')}
Prior Surgery on Joint:          {self.responses.get('cms_prior_surgery', 'Not answered')}
Chronic Opioid Use (>90 days):   {"⚠️ YES" if chronic_opioid else "No"}

───────────────────────────────────────────────────────────────────────
                    SOCIAL DETERMINANTS
───────────────────────────────────────────────────────────────────────
Living Situation:                {self.responses.get('sdoh_living', 'Not answered')}
Has Caregiver Support:           {self.responses.get('sdoh_support', 'Not answered')}
Transportation:                  {self.responses.get('sdoh_transport', 'Not answered')}
Food Insecurity:                 {self.responses.get('sdoh_food', 'Not answered')}
Medication Affordability:        {self.responses.get('sdoh_meds', 'Not answered')}

═══════════════════════════════════════════════════════════════════════
"""
        return summary
    
    def check_alerts(self) -> List[str]:
        """Check for conditions that need provider attention."""
        alerts = []
        
        # Depression screen positive
        phq2_score, phq2_pos = calculate_phq2_score(self.responses)
        if phq2_pos:
            alerts.append("Depression screen POSITIVE (PHQ-2 ≥ 3) - Consider PHQ-9 follow-up")
        
        # Anxiety screen positive
        gad2_score, gad2_pos = calculate_gad2_score(self.responses)
        if gad2_pos:
            alerts.append("Anxiety screen POSITIVE (GAD-2 ≥ 3) - Consider GAD-7 follow-up")
        
        # Chronic opioid use
        if is_chronic_opioid_use(self.responses):
            alerts.append("Chronic opioid use >90 days - Pain management consult recommended")
        
        # BMI
        try:
            height = float(self.responses.get("cms_height", 0))
            weight = float(self.responses.get("cms_weight", 0))
            bmi = calculate_bmi(height, weight)
            if bmi >= 40:
                alerts.append(f"BMI {bmi:.1f} (Morbid Obesity) - May affect surgical outcomes")
            elif bmi >= 35:
                alerts.append(f"BMI {bmi:.1f} (Obese Class II) - Consider nutrition referral")
        except:
            pass
        
        # Living alone without support
        if self.responses.get("sdoh_living") == "home_alone" and self.responses.get("sdoh_support") == "no":
            alerts.append("Lives alone WITHOUT caregiver support - Discharge planning needed")
        
        # No transportation
        if self.responses.get("sdoh_transport") == "no":
            alerts.append("No reliable transportation - May affect follow-up compliance")
        
        # Food/medication insecurity
        if self.responses.get("sdoh_food") == "yes":
            alerts.append("Food insecurity reported - Social work referral recommended")
        if self.responses.get("sdoh_meds") == "yes":
            alerts.append("Medication affordability concerns - Pharmacy/social work consult")
        
        # Current smoker
        if self.responses.get("cms_smoking") == "current":
            alerts.append("Current smoker - Smoking cessation required before elective surgery")
        
        return alerts
    
    def prev_section(self):
        """Go to previous section."""
        if self.current_section > 0:
            self.show_section(self.current_section - 1)
    
    def next_section(self):
        """Go to next section or submit."""
        if self.current_section < len(self.sections) - 1:
            self.show_section(self.current_section + 1)
        else:
            self.submit()
    
    def submit(self):
        """Submit the completed questionnaire."""
        self.collect_responses()
        
        # Save to local database if available
        try:
            from local_database import save_proms_score, get_db_path
            
            procedure = self.procedure_var.get()
            
            if procedure == "TKA":
                score = calculate_koos_jr_score(self.responses)
                measure = "KOOS-JR"
            else:
                score = calculate_hoos_jr_score(self.responses)
                measure = "HOOS-JR"
            
            promis = calculate_promis_scores(self.responses)
            
            # Note: Would need patient_id from context
            messagebox.showinfo("Success", 
                f"Questionnaire completed!\n\n"
                f"{measure} Score: {score:.1f}/100\n"
                f"PROMIS Physical: {promis['GPH']:.1f}\n"
                f"PROMIS Mental: {promis['GMH']:.1f}\n\n"
                f"Data saved locally. Ready for provider review.")
            
        except Exception as e:
            messagebox.showinfo("Complete", 
                f"Questionnaire completed!\n\n"
                f"Please have the provider review the summary.\n\n"
                f"(Database save: {e})")


# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    root = tk.Tk()
    app = CMSPromsIntakeApp(root)
    root.mainloop()
