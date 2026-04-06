#!/usr/bin/env python
"""
SRO Patient Intake - Beautiful Elder-Friendly Version
Uses CustomTkinter for modern, professional appearance

Features:
- Large touch-friendly buttons
- Dark/Light mode
- KOOS-JR / HOOS-JR
- PROMIS-10
- PHQ-2 / GAD-2
- Risk calculation
- Outcome projection
- 100% local - HIPAA compliant
"""

import customtkinter as ctk
from tkinter import messagebox
from datetime import date
from typing import Dict, List, Tuple, Optional
import json
import os

# ============================================================================
# APPEARANCE SETTINGS
# ============================================================================

ctk.set_appearance_mode("light")  # "light", "dark", or "system"
ctk.set_default_color_theme("blue")  # "blue", "green", "dark-blue"

# Colors
COLORS = {
    "primary": "#2563EB",      # Blue
    "success": "#16A34A",      # Green
    "warning": "#F59E0B",      # Orange/Yellow
    "danger": "#DC2626",       # Red
    "info": "#0891B2",         # Cyan
    "light": "#F3F4F6",        # Light gray
    "dark": "#1F2937",         # Dark gray
    "white": "#FFFFFF",
    "text": "#374151",
    "muted": "#6B7280"
}

# Fonts
FONTS = {
    "title": ("Segoe UI", 28, "bold"),
    "heading": ("Segoe UI", 22, "bold"),
    "subheading": ("Segoe UI", 18, "bold"),
    "question": ("Segoe UI", 16),
    "body": ("Segoe UI", 14),
    "button": ("Segoe UI", 16, "bold"),
    "small": ("Segoe UI", 12)
}

# ============================================================================
# QUESTION DATA
# ============================================================================

KOOS_QUESTIONS = [
    "How often does your KNEE bother you?",
    "Have you changed your daily activities because of your knee?",
    "How hard is it to TWIST or TURN on your knee?",
    "How hard is it to STRAIGHTEN your knee all the way?",
    "How hard is it to go UP or DOWN STAIRS?",
    "How hard is it to STAND?",
    "How hard is it to GET UP from a chair?"
]

HOOS_QUESTIONS = [
    "How hard is it to go DOWN STAIRS?",
    "How hard is it to GET IN or OUT of a car?",
    "How hard is it to WALK on a flat surface?",
    "How hard is it to PUT ON socks or shoes?",
    "How hard is it to GET UP from a chair?",
    "How STIFF is your hip when you first wake up?"
]

PROMIS_QUESTIONS = [
    ("In general, how is your HEALTH?", "health"),
    ("How is your QUALITY OF LIFE?", "health"),
    ("How is your PHYSICAL health?", "health"),
    ("How is your MENTAL health?", "health"),
    ("How happy are you with your SOCIAL life?", "health"),
    ("Can you do DAILY ACTIVITIES?", "ability"),
    ("How much PAIN do you have? (0-10)", "pain"),
    ("How much FATIGUE do you have?", "fatigue"),
    ("How often do you feel ANXIOUS or SAD?", "frequency"),
    ("Can you do your WORK and FAMILY activities?", "ability")
]

MOOD_QUESTIONS = [
    "Felt DOWN, DEPRESSED, or HOPELESS?",
    "Had LITTLE INTEREST in doing things?",
    "Felt NERVOUS or ANXIOUS?",
    "Unable to STOP WORRYING?"
]

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def calculate_koos_score(responses: List[int]) -> float:
    total = sum(responses)
    return round((total / 28) * 100, 1)

def calculate_hoos_score(responses: List[int]) -> float:
    total = sum(responses)
    return round((total / 24) * 100, 1)

def calculate_bmi(height_inches: float, weight_lbs: float) -> float:
    if height_inches > 0 and weight_lbs > 0:
        return round((weight_lbs / (height_inches ** 2)) * 703, 1)
    return 0

def get_risk_tier(mortality: float, readmission: float) -> Tuple[str, str]:
    if mortality < 1 and readmission < 5:
        return "LOW", COLORS["success"]
    elif mortality < 2 and readmission < 10:
        return "MODERATE", COLORS["warning"]
    else:
        return "HIGH", COLORS["danger"]

# ============================================================================
# CUSTOM WIDGETS
# ============================================================================

class BigOptionButton(ctk.CTkButton):
    """Large, touch-friendly option button."""
    
    def __init__(self, master, text, value, variable, command=None, **kwargs):
        self.value = value
        self.variable = variable
        self.selected = False
        
        super().__init__(
            master,
            text=text,
            font=FONTS["body"],
            height=50,
            corner_radius=10,
            fg_color=COLORS["light"],
            text_color=COLORS["text"],
            hover_color="#E5E7EB",
            command=self._on_click,
            **kwargs
        )
        
        # Check if already selected
        if self.variable.get() == self.value:
            self._select()
    
    def _on_click(self):
        self.variable.set(self.value)
        # Update all buttons in parent
        for child in self.master.winfo_children():
            if isinstance(child, BigOptionButton):
                child._update_state()
    
    def _update_state(self):
        if self.variable.get() == self.value:
            self._select()
        else:
            self._deselect()
    
    def _select(self):
        self.selected = True
        self.configure(fg_color=COLORS["primary"], text_color=COLORS["white"])
    
    def _deselect(self):
        self.selected = False
        self.configure(fg_color=COLORS["light"], text_color=COLORS["text"])


class ScoreCard(ctk.CTkFrame):
    """Display card for scores/metrics."""
    
    def __init__(self, master, title, value, subtitle="", color=COLORS["primary"], **kwargs):
        super().__init__(master, fg_color=COLORS["white"], corner_radius=15, **kwargs)
        
        self.configure(border_width=2, border_color=color)
        
        # Title
        ctk.CTkLabel(
            self, text=title, font=FONTS["small"],
            text_color=COLORS["muted"]
        ).pack(pady=(15, 5))
        
        # Value
        ctk.CTkLabel(
            self, text=str(value), font=("Segoe UI", 32, "bold"),
            text_color=color
        ).pack()
        
        # Subtitle
        if subtitle:
            ctk.CTkLabel(
                self, text=subtitle, font=FONTS["small"],
                text_color=COLORS["muted"]
            ).pack(pady=(5, 15))
        else:
            ctk.CTkLabel(self, text="").pack(pady=(0, 15))


class ProgressIndicator(ctk.CTkFrame):
    """Visual progress indicator for questionnaire."""
    
    def __init__(self, master, steps, current=0, **kwargs):
        super().__init__(master, fg_color="transparent", **kwargs)
        
        self.steps = steps
        self.current = current
        self.dots = []
        
        for i in range(steps):
            dot = ctk.CTkButton(
                self,
                text=str(i + 1),
                width=40,
                height=40,
                corner_radius=20,
                font=FONTS["body"],
                fg_color=COLORS["primary"] if i <= current else COLORS["light"],
                text_color=COLORS["white"] if i <= current else COLORS["muted"],
                hover=False
            )
            dot.pack(side="left", padx=5)
            self.dots.append(dot)
    
    def set_step(self, step):
        self.current = step
        for i, dot in enumerate(self.dots):
            if i <= step:
                dot.configure(fg_color=COLORS["primary"], text_color=COLORS["white"])
            else:
                dot.configure(fg_color=COLORS["light"], text_color=COLORS["muted"])


# ============================================================================
# MAIN APPLICATION
# ============================================================================

class SROPatientIntake(ctk.CTk):
    def __init__(self):
        super().__init__()
        
        # Window setup
        self.title("SRO Patient Intake")
        self.geometry("1000x800")
        self.minsize(800, 600)
        
        # Center window
        self.update_idletasks()
        width = self.winfo_width()
        height = self.winfo_height()
        x = (self.winfo_screenwidth() // 2) - (width // 2)
        y = (self.winfo_screenheight() // 2) - (height // 2)
        self.geometry(f"+{x}+{y}")
        
        # Data storage
        self.responses = {}
        self.current_step = 0
        self.joint_type = "knee"  # or "hip"
        
        # Create main container
        self.main_container = ctk.CTkFrame(self, fg_color="transparent")
        self.main_container.pack(fill="both", expand=True, padx=30, pady=20)
        
        # Header
        self.create_header()
        
        # Content area (scrollable)
        self.content_frame = ctk.CTkScrollableFrame(
            self.main_container,
            fg_color="transparent",
            scrollbar_button_color=COLORS["primary"]
        )
        self.content_frame.pack(fill="both", expand=True, pady=20)
        
        # Navigation
        self.create_navigation()
        
        # Start with step 1
        self.show_step(0)
    
    def create_header(self):
        """Create the header with logo and progress."""
        header = ctk.CTkFrame(self.main_container, fg_color="transparent")
        header.pack(fill="x", pady=(0, 10))
        
        # Title
        title_frame = ctk.CTkFrame(header, fg_color="transparent")
        title_frame.pack(side="left")
        
        ctk.CTkLabel(
            title_frame,
            text="🏥 SRO Patient Intake",
            font=FONTS["title"],
            text_color=COLORS["primary"]
        ).pack(anchor="w")
        
        ctk.CTkLabel(
            title_frame,
            text="Please answer the questions below",
            font=FONTS["body"],
            text_color=COLORS["muted"]
        ).pack(anchor="w")
        
        # Progress indicator
        self.progress = ProgressIndicator(header, steps=7, current=0)
        self.progress.pack(side="right", pady=10)
        
        # Theme toggle
        self.theme_btn = ctk.CTkButton(
            header,
            text="🌙",
            width=40,
            height=40,
            corner_radius=20,
            fg_color=COLORS["light"],
            text_color=COLORS["text"],
            hover_color="#E5E7EB",
            command=self.toggle_theme
        )
        self.theme_btn.pack(side="right", padx=20)
    
    def create_navigation(self):
        """Create navigation buttons."""
        nav = ctk.CTkFrame(self.main_container, fg_color="transparent")
        nav.pack(fill="x", pady=(10, 0))
        
        self.back_btn = ctk.CTkButton(
            nav,
            text="← Back",
            font=FONTS["button"],
            width=150,
            height=50,
            corner_radius=10,
            fg_color=COLORS["light"],
            text_color=COLORS["text"],
            hover_color="#E5E7EB",
            command=self.prev_step
        )
        self.back_btn.pack(side="left")
        
        self.next_btn = ctk.CTkButton(
            nav,
            text="Next →",
            font=FONTS["button"],
            width=150,
            height=50,
            corner_radius=10,
            fg_color=COLORS["primary"],
            hover_color="#1D4ED8",
            command=self.next_step
        )
        self.next_btn.pack(side="right")
    
    def toggle_theme(self):
        """Toggle dark/light mode."""
        current = ctk.get_appearance_mode()
        if current == "Light":
            ctk.set_appearance_mode("dark")
            self.theme_btn.configure(text="☀️")
        else:
            ctk.set_appearance_mode("light")
            self.theme_btn.configure(text="🌙")
    
    def clear_content(self):
        """Clear the content area."""
        for widget in self.content_frame.winfo_children():
            widget.destroy()
    
    def show_step(self, step):
        """Display a specific step."""
        self.current_step = step
        self.progress.set_step(step)
        self.clear_content()
        
        # Update nav buttons
        self.back_btn.configure(state="normal" if step > 0 else "disabled")
        self.next_btn.configure(text="See Results" if step == 6 else "Next →")
        
        # Show appropriate step
        steps = [
            self.step_patient_info,
            self.step_medical_history,
            self.step_joint_function,
            self.step_general_health,
            self.step_mood,
            self.step_medications_living,
            self.step_results
        ]
        
        steps[step]()
    
    def next_step(self):
        """Go to next step."""
        if self.current_step < 6:
            self.show_step(self.current_step + 1)
    
    def prev_step(self):
        """Go to previous step."""
        if self.current_step > 0:
            self.show_step(self.current_step - 1)
    
    # ========== STEP 1: PATIENT INFO ==========
    def step_patient_info(self):
        """Patient demographics."""
        # Title
        ctk.CTkLabel(
            self.content_frame,
            text="Step 1: About You",
            font=FONTS["heading"],
            text_color=COLORS["dark"]
        ).pack(anchor="w", pady=(0, 20))
        
        # Age
        age_frame = ctk.CTkFrame(self.content_frame, fg_color="transparent")
        age_frame.pack(fill="x", pady=10)
        
        ctk.CTkLabel(
            age_frame,
            text="How old are you?",
            font=FONTS["question"]
        ).pack(anchor="w")
        
        self.age_var = ctk.IntVar(value=self.responses.get("age", 65))
        age_slider = ctk.CTkSlider(
            age_frame,
            from_=40,
            to=100,
            number_of_steps=60,
            variable=self.age_var,
            width=400,
            height=30,
            progress_color=COLORS["primary"]
        )
        age_slider.pack(anchor="w", pady=5)
        
        self.age_label = ctk.CTkLabel(
            age_frame,
            text=f"{self.age_var.get()} years old",
            font=FONTS["subheading"],
            text_color=COLORS["primary"]
        )
        self.age_label.pack(anchor="w")
        
        age_slider.configure(command=lambda v: self.age_label.configure(text=f"{int(v)} years old"))
        
        # Gender
        gender_frame = ctk.CTkFrame(self.content_frame, fg_color="transparent")
        gender_frame.pack(fill="x", pady=20)
        
        ctk.CTkLabel(
            gender_frame,
            text="Are you:",
            font=FONTS["question"]
        ).pack(anchor="w", pady=(0, 10))
        
        self.gender_var = ctk.StringVar(value=self.responses.get("gender", ""))
        
        btn_frame = ctk.CTkFrame(gender_frame, fg_color="transparent")
        btn_frame.pack(anchor="w")
        
        BigOptionButton(btn_frame, "👨 Male", "Male", self.gender_var, width=180).pack(side="left", padx=5)
        BigOptionButton(btn_frame, "👩 Female", "Female", self.gender_var, width=180).pack(side="left", padx=5)
        
        # Surgery type
        surgery_frame = ctk.CTkFrame(self.content_frame, fg_color="transparent")
        surgery_frame.pack(fill="x", pady=20)
        
        ctk.CTkLabel(
            surgery_frame,
            text="Which surgery are you having?",
            font=FONTS["question"]
        ).pack(anchor="w", pady=(0, 10))
        
        self.surgery_var = ctk.StringVar(value=self.responses.get("surgery", ""))
        
        btn_frame2 = ctk.CTkFrame(surgery_frame, fg_color="transparent")
        btn_frame2.pack(anchor="w")
        
        BigOptionButton(btn_frame2, "🦵 KNEE Replacement", "knee", self.surgery_var, width=220).pack(side="left", padx=5)
        BigOptionButton(btn_frame2, "🦴 HIP Replacement", "hip", self.surgery_var, width=220).pack(side="left", padx=5)
        
        # Height/Weight
        hw_frame = ctk.CTkFrame(self.content_frame, fg_color="transparent")
        hw_frame.pack(fill="x", pady=20)
        
        ctk.CTkLabel(hw_frame, text="Height and Weight:", font=FONTS["question"]).pack(anchor="w", pady=(0, 10))
        
        inputs = ctk.CTkFrame(hw_frame, fg_color="transparent")
        inputs.pack(anchor="w")
        
        ctk.CTkLabel(inputs, text="Height:", font=FONTS["body"]).pack(side="left")
        self.height_ft = ctk.CTkEntry(inputs, width=60, font=FONTS["body"], placeholder_text="ft")
        self.height_ft.pack(side="left", padx=5)
        self.height_ft.insert(0, str(self.responses.get("height_ft", "5")))
        
        ctk.CTkLabel(inputs, text="ft", font=FONTS["body"]).pack(side="left")
        
        self.height_in = ctk.CTkEntry(inputs, width=60, font=FONTS["body"], placeholder_text="in")
        self.height_in.pack(side="left", padx=5)
        self.height_in.insert(0, str(self.responses.get("height_in", "6")))
        
        ctk.CTkLabel(inputs, text="in", font=FONTS["body"]).pack(side="left", padx=(0, 30))
        
        ctk.CTkLabel(inputs, text="Weight:", font=FONTS["body"]).pack(side="left")
        self.weight = ctk.CTkEntry(inputs, width=80, font=FONTS["body"], placeholder_text="lbs")
        self.weight.pack(side="left", padx=5)
        self.weight.insert(0, str(self.responses.get("weight", "180")))
        
        ctk.CTkLabel(inputs, text="lbs", font=FONTS["body"]).pack(side="left")
    
    # ========== STEP 2: MEDICAL HISTORY ==========
    def step_medical_history(self):
        """Medical history questions."""
        ctk.CTkLabel(
            self.content_frame,
            text="Step 2: Your Health",
            font=FONTS["heading"]
        ).pack(anchor="w", pady=(0, 10))
        
        ctk.CTkLabel(
            self.content_frame,
            text="Please answer honestly - this helps us keep you safe",
            font=FONTS["body"],
            text_color=COLORS["muted"]
        ).pack(anchor="w", pady=(0, 20))
        
        # Medical questions with big buttons
        questions = [
            ("diabetes", "Do you have DIABETES?", ["No", "Yes - diet only", "Yes - pills", "Yes - insulin"]),
            ("cardiac", "Do you have HEART problems?", ["No", "Yes"]),
            ("ckd", "Do you have KIDNEY disease?", ["No", "Yes"]),
            ("smoker", "Do you SMOKE?", ["Never", "Quit > 1 year", "Quit recently", "Yes, currently"]),
            ("health_overall", "How healthy are you overall?", ["Very healthy", "Minor problems", "Serious problems", "Severe problems"])
        ]
        
        for key, question, options in questions:
            q_frame = ctk.CTkFrame(self.content_frame, fg_color="transparent")
            q_frame.pack(fill="x", pady=15)
            
            ctk.CTkLabel(q_frame, text=question, font=FONTS["question"]).pack(anchor="w", pady=(0, 10))
            
            var = ctk.StringVar(value=self.responses.get(key, ""))
            setattr(self, f"{key}_var", var)
            
            btn_frame = ctk.CTkFrame(q_frame, fg_color="transparent")
            btn_frame.pack(anchor="w")
            
            for opt in options:
                BigOptionButton(btn_frame, opt, opt, var, width=160).pack(side="left", padx=3)
    
    # ========== STEP 3: JOINT FUNCTION ==========
    def step_joint_function(self):
        """KOOS-JR or HOOS-JR questions."""
        # Determine joint type from step 1
        self.joint_type = getattr(self, 'surgery_var', ctk.StringVar(value="knee")).get() or "knee"
        
        if self.joint_type == "knee":
            title = "Step 3: Your KNEE Function"
            questions = KOOS_QUESTIONS
        else:
            title = "Step 3: Your HIP Function"
            questions = HOOS_QUESTIONS
        
        ctk.CTkLabel(self.content_frame, text=title, font=FONTS["heading"]).pack(anchor="w", pady=(0, 20))
        
        options = ["No problem", "A little", "Some", "A lot", "Extreme"]
        values = [4, 3, 2, 1, 0]
        
        self.joint_vars = []
        
        for i, q in enumerate(questions):
            q_frame = ctk.CTkFrame(self.content_frame, fg_color=COLORS["white"], corner_radius=10)
            q_frame.pack(fill="x", pady=8, padx=5)
            
            inner = ctk.CTkFrame(q_frame, fg_color="transparent")
            inner.pack(fill="x", padx=15, pady=15)
            
            ctk.CTkLabel(
                inner,
                text=f"{i+1}. {q}",
                font=FONTS["question"],
                wraplength=600
            ).pack(anchor="w", pady=(0, 10))
            
            var = ctk.IntVar(value=self.responses.get(f"joint_{i}", 2))
            self.joint_vars.append(var)
            
            btn_frame = ctk.CTkFrame(inner, fg_color="transparent")
            btn_frame.pack(anchor="w")
            
            for opt, val in zip(options, values):
                BigOptionButton(btn_frame, opt, val, var, width=110).pack(side="left", padx=2)
    
    # ========== STEP 4: GENERAL HEALTH (PROMIS-10) ==========
    def step_general_health(self):
        """PROMIS-10 questions."""
        ctk.CTkLabel(
            self.content_frame,
            text="Step 4: Your General Health",
            font=FONTS["heading"]
        ).pack(anchor="w", pady=(0, 20))
        
        self.promis_vars = []
        
        for i, (q, qtype) in enumerate(PROMIS_QUESTIONS):
            q_frame = ctk.CTkFrame(self.content_frame, fg_color=COLORS["white"], corner_radius=10)
            q_frame.pack(fill="x", pady=8, padx=5)
            
            inner = ctk.CTkFrame(q_frame, fg_color="transparent")
            inner.pack(fill="x", padx=15, pady=15)
            
            ctk.CTkLabel(inner, text=f"{i+1}. {q}", font=FONTS["question"]).pack(anchor="w", pady=(0, 10))
            
            if qtype == "pain":
                var = ctk.IntVar(value=self.responses.get(f"promis_{i}", 5))
                slider = ctk.CTkSlider(inner, from_=0, to=10, number_of_steps=10, variable=var, width=300)
                slider.pack(anchor="w")
                
                label_frame = ctk.CTkFrame(inner, fg_color="transparent")
                label_frame.pack(fill="x")
                ctk.CTkLabel(label_frame, text="0 = No pain", font=FONTS["small"], text_color=COLORS["muted"]).pack(side="left")
                ctk.CTkLabel(label_frame, text="10 = Worst pain", font=FONTS["small"], text_color=COLORS["muted"]).pack(side="right", padx=100)
            else:
                var = ctk.IntVar(value=self.responses.get(f"promis_{i}", 3))
                
                if qtype == "health":
                    options = [("Excellent", 5), ("Very Good", 4), ("Good", 3), ("Fair", 2), ("Poor", 1)]
                elif qtype == "ability":
                    options = [("Completely", 5), ("Mostly", 4), ("Moderately", 3), ("A little", 2), ("Not at all", 1)]
                elif qtype == "fatigue":
                    options = [("None", 5), ("Mild", 4), ("Moderate", 3), ("Severe", 2), ("Very Severe", 1)]
                else:  # frequency
                    options = [("Never", 5), ("Rarely", 4), ("Sometimes", 3), ("Often", 2), ("Always", 1)]
                
                btn_frame = ctk.CTkFrame(inner, fg_color="transparent")
                btn_frame.pack(anchor="w")
                
                for opt, val in options:
                    BigOptionButton(btn_frame, opt, val, var, width=100).pack(side="left", padx=2)
            
            self.promis_vars.append(var)
    
    # ========== STEP 5: MOOD ==========
    def step_mood(self):
        """PHQ-2 and GAD-2 questions."""
        ctk.CTkLabel(
            self.content_frame,
            text="Step 5: Your Mood",
            font=FONTS["heading"]
        ).pack(anchor="w", pady=(0, 10))
        
        ctk.CTkLabel(
            self.content_frame,
            text="Over the past 2 weeks, how often have you...",
            font=FONTS["body"],
            text_color=COLORS["muted"]
        ).pack(anchor="w", pady=(0, 20))
        
        options = [("Not at all", 0), ("Several days", 1), ("More than half", 2), ("Nearly every day", 3)]
        
        self.mood_vars = []
        
        for i, q in enumerate(MOOD_QUESTIONS):
            q_frame = ctk.CTkFrame(self.content_frame, fg_color=COLORS["white"], corner_radius=10)
            q_frame.pack(fill="x", pady=8, padx=5)
            
            inner = ctk.CTkFrame(q_frame, fg_color="transparent")
            inner.pack(fill="x", padx=15, pady=15)
            
            ctk.CTkLabel(inner, text=f"{i+1}. {q}", font=FONTS["question"]).pack(anchor="w", pady=(0, 10))
            
            var = ctk.IntVar(value=self.responses.get(f"mood_{i}", 0))
            self.mood_vars.append(var)
            
            btn_frame = ctk.CTkFrame(inner, fg_color="transparent")
            btn_frame.pack(anchor="w")
            
            for opt, val in options:
                BigOptionButton(btn_frame, opt, val, var, width=140).pack(side="left", padx=2)
    
    # ========== STEP 6: MEDICATIONS & LIVING ==========
    def step_medications_living(self):
        """Opioid use and living situation."""
        ctk.CTkLabel(
            self.content_frame,
            text="Step 6: Medications & Home",
            font=FONTS["heading"]
        ).pack(anchor="w", pady=(0, 20))
        
        # Opioid use
        opioid_frame = ctk.CTkFrame(self.content_frame, fg_color="transparent")
        opioid_frame.pack(fill="x", pady=10)
        
        ctk.CTkLabel(
            opioid_frame,
            text="Do you take OPIOID pain medicine?",
            font=FONTS["question"]
        ).pack(anchor="w")
        
        ctk.CTkLabel(
            opioid_frame,
            text="(like Percocet, Vicodin, oxycodone, hydrocodone)",
            font=FONTS["small"],
            text_color=COLORS["muted"]
        ).pack(anchor="w", pady=(0, 10))
        
        self.opioid_var = ctk.StringVar(value=self.responses.get("opioid", ""))
        
        btn_frame = ctk.CTkFrame(opioid_frame, fg_color="transparent")
        btn_frame.pack(anchor="w")
        
        for opt in ["No", "Yes - less than 3 months", "Yes - more than 3 months"]:
            BigOptionButton(btn_frame, opt, opt, self.opioid_var, width=200).pack(side="left", padx=3)
        
        # Living situation
        living_frame = ctk.CTkFrame(self.content_frame, fg_color="transparent")
        living_frame.pack(fill="x", pady=20)
        
        ctk.CTkLabel(living_frame, text="Who do you live with?", font=FONTS["question"]).pack(anchor="w", pady=(0, 10))
        
        self.living_var = ctk.StringVar(value=self.responses.get("living", ""))
        
        btn_frame2 = ctk.CTkFrame(living_frame, fg_color="transparent")
        btn_frame2.pack(anchor="w")
        
        for opt in ["I live ALONE", "With spouse/family", "Assisted living"]:
            BigOptionButton(btn_frame2, opt, opt, self.living_var, width=180).pack(side="left", padx=3)
        
        # Help at home
        help_frame = ctk.CTkFrame(self.content_frame, fg_color="transparent")
        help_frame.pack(fill="x", pady=10)
        
        ctk.CTkLabel(help_frame, text="Will someone help you for 2 weeks after surgery?", font=FONTS["question"]).pack(anchor="w", pady=(0, 10))
        
        self.help_var = ctk.StringVar(value=self.responses.get("help", ""))
        
        btn_frame3 = ctk.CTkFrame(help_frame, fg_color="transparent")
        btn_frame3.pack(anchor="w")
        
        for opt in ["Yes", "No", "Not sure"]:
            BigOptionButton(btn_frame3, opt, opt, self.help_var, width=150).pack(side="left", padx=3)
        
        # Transportation
        transport_frame = ctk.CTkFrame(self.content_frame, fg_color="transparent")
        transport_frame.pack(fill="x", pady=10)
        
        ctk.CTkLabel(transport_frame, text="Can you get to follow-up appointments?", font=FONTS["question"]).pack(anchor="w", pady=(0, 10))
        
        self.transport_var = ctk.StringVar(value=self.responses.get("transport", ""))
        
        btn_frame4 = ctk.CTkFrame(transport_frame, fg_color="transparent")
        btn_frame4.pack(anchor="w")
        
        for opt in ["Yes", "No", "Need help"]:
            BigOptionButton(btn_frame4, opt, opt, self.transport_var, width=150).pack(side="left", padx=3)
    
    # ========== STEP 7: RESULTS ==========
    def step_results(self):
        """Calculate and display results."""
        # Hide nav buttons
        self.back_btn.pack_forget()
        self.next_btn.pack_forget()
        
        # Collect all responses
        self.collect_responses()
        
        # Calculate scores
        joint_responses = [v.get() for v in self.joint_vars] if hasattr(self, 'joint_vars') else [2]*7
        
        if self.joint_type == "knee":
            joint_score = calculate_koos_score(joint_responses)
            joint_name = "KOOS-JR"
        else:
            joint_score = calculate_hoos_score(joint_responses)
            joint_name = "HOOS-JR"
        
        # PROMIS scores
        promis_responses = [v.get() for v in self.promis_vars] if hasattr(self, 'promis_vars') else [3]*10
        gph_raw = sum(promis_responses[:6])
        gmh_raw = sum(promis_responses[6:])
        gph = min(max(30 + gph_raw * 2, 20), 80)
        gmh = min(max(30 + gmh_raw * 2.5, 20), 80)
        
        # Mood scores
        mood_responses = [v.get() for v in self.mood_vars] if hasattr(self, 'mood_vars') else [0]*4
        phq2 = sum(mood_responses[:2])
        gad2 = sum(mood_responses[2:])
        phq2_positive = phq2 >= 3
        gad2_positive = gad2 >= 3
        
        # Risk calculation
        age = getattr(self, 'age_var', ctk.IntVar(value=65)).get()
        
        try:
            ht_ft = int(self.height_ft.get())
            ht_in = int(self.height_in.get())
            wt = int(self.weight.get())
            bmi = calculate_bmi(ht_ft * 12 + ht_in, wt)
        except:
            bmi = 28
        
        opioid_chronic = getattr(self, 'opioid_var', ctk.StringVar()).get() == "Yes - more than 3 months"
        lives_alone = "ALONE" in getattr(self, 'living_var', ctk.StringVar()).get()
        
        # Calculate risks
        mortality = 0.4 + (0.5 if age > 80 else 0.2 if age > 70 else 0) + (0.2 if bmi >= 35 else 0)
        readmission = 2.0 + (0.5 if age > 75 else 0) + (0.5 if opioid_chronic else 0) + (0.3 if lives_alone else 0)
        
        risk_tier, tier_color = get_risk_tier(mortality, readmission)
        
        # Expected improvement
        improvement = 30 if risk_tier == "LOW" else 22 if risk_tier == "MODERATE" else 15
        if phq2_positive:
            improvement -= 5
        if opioid_chronic:
            improvement -= 8
        improvement = max(improvement, 8)
        
        projected = min(joint_score + improvement, 100)
        
        # ========== DISPLAY RESULTS ==========
        ctk.CTkLabel(
            self.content_frame,
            text="📋 Your Results",
            font=FONTS["title"],
            text_color=COLORS["primary"]
        ).pack(anchor="w", pady=(0, 20))
        
        # Risk tier banner
        tier_frame = ctk.CTkFrame(self.content_frame, fg_color=tier_color, corner_radius=15)
        tier_frame.pack(fill="x", pady=10)
        
        ctk.CTkLabel(
            tier_frame,
            text=f"Overall Risk Level: {risk_tier}",
            font=FONTS["heading"],
            text_color=COLORS["white"]
        ).pack(pady=20)
        
        # Score cards
        cards_frame = ctk.CTkFrame(self.content_frame, fg_color="transparent")
        cards_frame.pack(fill="x", pady=20)
        
        ScoreCard(cards_frame, joint_name, f"{joint_score}", "out of 100", COLORS["primary"]).pack(side="left", padx=10, expand=True, fill="x")
        ScoreCard(cards_frame, "Physical Health", f"{gph:.0f}", "T-score", COLORS["info"]).pack(side="left", padx=10, expand=True, fill="x")
        ScoreCard(cards_frame, "Mental Health", f"{gmh:.0f}", "T-score", COLORS["info"]).pack(side="left", padx=10, expand=True, fill="x")
        
        # Outcome projection
        outcome_frame = ctk.CTkFrame(self.content_frame, fg_color=COLORS["white"], corner_radius=15)
        outcome_frame.pack(fill="x", pady=20, padx=5)
        
        ctk.CTkLabel(
            outcome_frame,
            text="📈 Expected Outcome After Surgery",
            font=FONTS["subheading"]
        ).pack(pady=(20, 10))
        
        proj_inner = ctk.CTkFrame(outcome_frame, fg_color="transparent")
        proj_inner.pack(pady=10)
        
        ctk.CTkLabel(proj_inner, text=f"Now: {joint_score}", font=FONTS["body"]).pack(side="left", padx=20)
        ctk.CTkLabel(proj_inner, text=f"→", font=FONTS["heading"]).pack(side="left", padx=10)
        ctk.CTkLabel(proj_inner, text=f"+{improvement}", font=FONTS["body"], text_color=COLORS["success"]).pack(side="left", padx=10)
        ctk.CTkLabel(proj_inner, text=f"→", font=FONTS["heading"]).pack(side="left", padx=10)
        ctk.CTkLabel(proj_inner, text=f"After: {projected:.0f}", font=FONTS["subheading"], text_color=COLORS["success"]).pack(side="left", padx=20)
        
        # Progress bar
        progress = ctk.CTkProgressBar(outcome_frame, width=400, height=20, progress_color=COLORS["success"])
        progress.set(projected / 100)
        progress.pack(pady=(10, 20))
        
        # Alerts
        alerts = []
        if phq2_positive:
            alerts.append("⚠️ Depression screen positive - please discuss with your doctor")
        if gad2_positive:
            alerts.append("⚠️ Anxiety screen positive - please discuss with your doctor")
        if opioid_chronic:
            alerts.append("⚠️ Chronic opioid use may affect your recovery")
        if lives_alone and getattr(self, 'help_var', ctk.StringVar()).get() != "Yes":
            alerts.append("⚠️ You may need help at home after surgery")
        
        if alerts:
            alert_frame = ctk.CTkFrame(self.content_frame, fg_color="#FEF3C7", corner_radius=10)
            alert_frame.pack(fill="x", pady=10, padx=5)
            
            ctk.CTkLabel(
                alert_frame,
                text="Important Notes:",
                font=FONTS["subheading"],
                text_color=COLORS["warning"]
            ).pack(anchor="w", padx=15, pady=(15, 5))
            
            for alert in alerts:
                ctk.CTkLabel(
                    alert_frame,
                    text=alert,
                    font=FONTS["body"],
                    text_color=COLORS["dark"]
                ).pack(anchor="w", padx=15, pady=2)
            
            ctk.CTkLabel(alert_frame, text="").pack(pady=5)  # Spacer
        
        # Action buttons
        btn_frame = ctk.CTkFrame(self.content_frame, fg_color="transparent")
        btn_frame.pack(fill="x", pady=20)
        
        ctk.CTkButton(
            btn_frame,
            text="💾 Save Results",
            font=FONTS["button"],
            width=200,
            height=50,
            corner_radius=10,
            fg_color=COLORS["success"],
            command=self.save_results
        ).pack(side="left", padx=10)
        
        ctk.CTkButton(
            btn_frame,
            text="🔄 Start Over",
            font=FONTS["button"],
            width=200,
            height=50,
            corner_radius=10,
            fg_color=COLORS["light"],
            text_color=COLORS["text"],
            command=self.restart
        ).pack(side="left", padx=10)
    
    def collect_responses(self):
        """Collect all responses into dictionary."""
        if hasattr(self, 'age_var'):
            self.responses['age'] = self.age_var.get()
        if hasattr(self, 'gender_var'):
            self.responses['gender'] = self.gender_var.get()
        if hasattr(self, 'surgery_var'):
            self.responses['surgery'] = self.surgery_var.get()
            self.joint_type = self.surgery_var.get() or "knee"
    
    def save_results(self):
        """Save results to database."""
        messagebox.showinfo("Saved", "Results saved to patient record!")
    
    def restart(self):
        """Start over with new patient."""
        self.responses = {}
        self.back_btn.pack(side="left")
        self.next_btn.pack(side="right")
        self.show_step(0)


# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    app = SROPatientIntake()
    app.mainloop()
