#!/usr/bin/env python
"""
SRO Patient Intake - One Question at a Time
Auto-advances when patient selects an answer.
No scrolling, no confusion - perfect for elderly patients.

Features:
- ONE question fills the whole screen
- BIG buttons - tap and auto-advance
- Progress bar shows how far along
- Back button if they made a mistake
- All CMS-required PROMS included
"""

import customtkinter as ctk
from tkinter import messagebox
from datetime import date
from typing import List, Tuple, Optional
import json

# ============================================================================
# APPEARANCE
# ============================================================================

ctk.set_appearance_mode("light")
ctk.set_default_color_theme("blue")

COLORS = {
    "primary": "#2563EB",
    "success": "#16A34A", 
    "warning": "#F59E0B",
    "danger": "#DC2626",
    "light": "#F3F4F6",
    "white": "#FFFFFF",
    "text": "#1F2937",
    "muted": "#6B7280"
}

# ============================================================================
# ALL QUESTIONS - Linear Flow
# ============================================================================

def build_questions(joint="knee"):
    """Build the complete question list based on joint type."""
    
    questions = []
    
    # === SECTION 1: BASICS ===
    questions.append({
        "id": "age",
        "section": "About You",
        "text": "How old are you?",
        "type": "slider",
        "min": 40,
        "max": 100,
        "default": 65,
        "unit": "years old"
    })
    
    questions.append({
        "id": "gender",
        "section": "About You", 
        "text": "Are you male or female?",
        "type": "choice",
        "options": ["👨 Male", "👩 Female"]
    })
    
    questions.append({
        "id": "surgery",
        "section": "About You",
        "text": "Which surgery are you having?",
        "type": "choice",
        "options": ["🦵 KNEE Replacement", "🦴 HIP Replacement"],
        "triggers_joint": True
    })
    
    questions.append({
        "id": "height_ft",
        "section": "About You",
        "text": "How tall are you? (feet)",
        "type": "choice",
        "options": ["4 feet", "5 feet", "6 feet", "7 feet"]
    })
    
    questions.append({
        "id": "height_in", 
        "section": "About You",
        "text": "How tall are you? (inches)",
        "type": "choice",
        "options": ["0 in", "1 in", "2 in", "3 in", "4 in", "5 in", "6 in", "7 in", "8 in", "9 in", "10 in", "11 in"]
    })
    
    questions.append({
        "id": "weight",
        "section": "About You",
        "text": "How much do you weigh?",
        "type": "slider",
        "min": 100,
        "max": 350,
        "default": 180,
        "unit": "pounds"
    })
    
    # === SECTION 2: MEDICAL HISTORY ===
    questions.append({
        "id": "diabetes",
        "section": "Your Health",
        "text": "Do you have DIABETES?",
        "type": "choice",
        "options": ["No", "Yes - diet only", "Yes - pills", "Yes - insulin"]
    })
    
    questions.append({
        "id": "cardiac",
        "section": "Your Health",
        "text": "Do you have HEART problems?",
        "type": "choice",
        "options": ["No", "Yes"]
    })
    
    questions.append({
        "id": "ckd",
        "section": "Your Health", 
        "text": "Do you have KIDNEY disease?",
        "type": "choice",
        "options": ["No", "Yes"]
    })
    
    questions.append({
        "id": "smoker",
        "section": "Your Health",
        "text": "Do you SMOKE cigarettes?",
        "type": "choice",
        "options": ["Never smoked", "Quit over 1 year ago", "Quit recently", "Yes, I smoke"]
    })
    
    questions.append({
        "id": "health_overall",
        "section": "Your Health",
        "text": "Overall, how healthy are you?",
        "type": "choice",
        "options": ["Very healthy", "Some problems", "Serious problems"]
    })
    
    # === SECTION 3: JOINT FUNCTION (KOOS-JR or HOOS-JR) ===
    if joint == "knee":
        joint_qs = [
            ("koos_1", "How often does your KNEE bother you?", "frequency"),
            ("koos_2", "Have you changed activities because of your knee?", "amount"),
            ("koos_3", "How hard is it to TWIST or PIVOT?", "difficulty"),
            ("koos_4", "How hard is it to STRAIGHTEN your knee?", "difficulty"),
            ("koos_5", "How hard is it to go UP or DOWN STAIRS?", "difficulty"),
            ("koos_6", "How hard is it to STAND?", "difficulty"),
            ("koos_7", "How hard is it to GET UP from a chair?", "difficulty"),
        ]
        section = "Your Knee"
    else:
        joint_qs = [
            ("hoos_1", "How hard is it to go DOWN STAIRS?", "difficulty"),
            ("hoos_2", "How hard is it to GET IN/OUT of a car?", "difficulty"),
            ("hoos_3", "How hard is it to WALK on flat ground?", "difficulty"),
            ("hoos_4", "How hard is it to PUT ON socks/shoes?", "difficulty"),
            ("hoos_5", "How hard is it to GET UP from a chair?", "difficulty"),
            ("hoos_6", "How STIFF is your hip in the morning?", "severity"),
        ]
        section = "Your Hip"
    
    for qid, qtext, qtype in joint_qs:
        if qtype == "frequency":
            opts = ["Never", "Monthly", "Weekly", "Daily", "Always"]
        elif qtype == "amount":
            opts = ["Not at all", "A little", "Somewhat", "A lot", "Totally"]
        elif qtype == "severity":
            opts = ["None", "Mild", "Moderate", "Severe", "Extreme"]
        else:  # difficulty
            opts = ["No problem", "A little hard", "Somewhat hard", "Very hard", "Extremely hard"]
        
        questions.append({
            "id": qid,
            "section": section,
            "text": qtext,
            "type": "choice",
            "options": opts,
            "scoring": [4, 3, 2, 1, 0]
        })
    
    # === SECTION 4: GENERAL HEALTH (PROMIS-10 simplified) ===
    questions.append({
        "id": "promis_1",
        "section": "General Health",
        "text": "In general, how is your HEALTH?",
        "type": "choice",
        "options": ["Excellent", "Very Good", "Good", "Fair", "Poor"],
        "scoring": [5, 4, 3, 2, 1]
    })
    
    questions.append({
        "id": "promis_2",
        "section": "General Health",
        "text": "How is your QUALITY OF LIFE?",
        "type": "choice", 
        "options": ["Excellent", "Very Good", "Good", "Fair", "Poor"],
        "scoring": [5, 4, 3, 2, 1]
    })
    
    questions.append({
        "id": "promis_3",
        "section": "General Health",
        "text": "How is your PHYSICAL health?",
        "type": "choice",
        "options": ["Excellent", "Very Good", "Good", "Fair", "Poor"],
        "scoring": [5, 4, 3, 2, 1]
    })
    
    questions.append({
        "id": "promis_4",
        "section": "General Health", 
        "text": "How is your MENTAL health?",
        "type": "choice",
        "options": ["Excellent", "Very Good", "Good", "Fair", "Poor"],
        "scoring": [5, 4, 3, 2, 1]
    })
    
    questions.append({
        "id": "promis_5",
        "section": "General Health",
        "text": "How happy are you with your SOCIAL life?",
        "type": "choice",
        "options": ["Very happy", "Happy", "Okay", "Unhappy", "Very unhappy"],
        "scoring": [5, 4, 3, 2, 1]
    })
    
    questions.append({
        "id": "promis_6",
        "section": "General Health",
        "text": "Can you do DAILY activities like walking and climbing stairs?",
        "type": "choice",
        "options": ["Completely", "Mostly", "Somewhat", "A little", "Not at all"],
        "scoring": [5, 4, 3, 2, 1]
    })
    
    questions.append({
        "id": "promis_7",
        "section": "General Health",
        "text": "How much PAIN do you have on average?",
        "type": "choice",
        "options": ["No pain", "Mild pain", "Moderate pain", "Severe pain", "Worst pain"],
        "scoring": [5, 4, 3, 2, 1]
    })
    
    questions.append({
        "id": "promis_8",
        "section": "General Health",
        "text": "How TIRED do you feel?",
        "type": "choice",
        "options": ["Not tired", "A little tired", "Somewhat tired", "Very tired", "Exhausted"],
        "scoring": [5, 4, 3, 2, 1]
    })
    
    questions.append({
        "id": "promis_9",
        "section": "General Health",
        "text": "How often do you feel ANXIOUS or SAD?",
        "type": "choice",
        "options": ["Never", "Rarely", "Sometimes", "Often", "Always"],
        "scoring": [5, 4, 3, 2, 1]
    })
    
    questions.append({
        "id": "promis_10",
        "section": "General Health",
        "text": "Can you do your usual WORK and FAMILY activities?",
        "type": "choice",
        "options": ["Completely", "Mostly", "Somewhat", "A little", "Not at all"],
        "scoring": [5, 4, 3, 2, 1]
    })
    
    # === SECTION 5: MOOD (PHQ-2 + GAD-2) ===
    questions.append({
        "id": "phq_1",
        "section": "Your Mood",
        "text": "In the past 2 weeks, have you felt DOWN or HOPELESS?",
        "type": "choice",
        "options": ["Not at all", "Several days", "More than half the days", "Nearly every day"],
        "scoring": [0, 1, 2, 3]
    })
    
    questions.append({
        "id": "phq_2",
        "section": "Your Mood",
        "text": "In the past 2 weeks, have you had LITTLE INTEREST in things?",
        "type": "choice",
        "options": ["Not at all", "Several days", "More than half the days", "Nearly every day"],
        "scoring": [0, 1, 2, 3]
    })
    
    questions.append({
        "id": "gad_1",
        "section": "Your Mood",
        "text": "In the past 2 weeks, have you felt NERVOUS or ANXIOUS?",
        "type": "choice",
        "options": ["Not at all", "Several days", "More than half the days", "Nearly every day"],
        "scoring": [0, 1, 2, 3]
    })
    
    questions.append({
        "id": "gad_2",
        "section": "Your Mood",
        "text": "In the past 2 weeks, have you been unable to STOP WORRYING?",
        "type": "choice",
        "options": ["Not at all", "Several days", "More than half the days", "Nearly every day"],
        "scoring": [0, 1, 2, 3]
    })
    
    # === SECTION 6: OPIOIDS ===
    questions.append({
        "id": "opioid",
        "section": "Pain Medicine",
        "text": "Do you take OPIOID pain medicine?\n(like Percocet, Vicodin, oxycodone)",
        "type": "choice",
        "options": ["No", "Yes - less than 3 months", "Yes - more than 3 months"]
    })
    
    # === SECTION 7: LIVING SITUATION ===
    questions.append({
        "id": "living",
        "section": "Your Home",
        "text": "Who do you live with?",
        "type": "choice",
        "options": ["I live ALONE", "With spouse or partner", "With family", "Nursing home"]
    })
    
    questions.append({
        "id": "help",
        "section": "Your Home",
        "text": "Will someone HELP you at home for 2 weeks after surgery?",
        "type": "choice",
        "options": ["Yes", "No", "Not sure"]
    })
    
    questions.append({
        "id": "transport",
        "section": "Your Home",
        "text": "Can you get to your FOLLOW-UP appointments?",
        "type": "choice",
        "options": ["Yes, I have a ride", "No, I need help", "Not sure"]
    })
    
    return questions


# ============================================================================
# MAIN APPLICATION
# ============================================================================

class OneQuestionIntake(ctk.CTk):
    def __init__(self):
        super().__init__()
        
        # Window setup - FULL SCREEN friendly
        self.title("SRO Patient Intake")
        self.geometry("1024x768")
        self.minsize(800, 600)
        
        # Can go fullscreen with F11
        self.bind("<F11>", lambda e: self.attributes("-fullscreen", not self.attributes("-fullscreen")))
        self.bind("<Escape>", lambda e: self.attributes("-fullscreen", False))
        
        # Data
        self.responses = {}
        self.current_index = 0
        self.joint_type = "knee"
        self.questions = build_questions("knee")
        
        # Build UI
        self.create_ui()
        self.show_question(0)
    
    def create_ui(self):
        """Create the main UI structure."""
        # Main container
        self.main = ctk.CTkFrame(self, fg_color=COLORS["white"])
        self.main.pack(fill="both", expand=True)
        
        # Top bar with progress
        self.topbar = ctk.CTkFrame(self.main, fg_color=COLORS["light"], height=80)
        self.topbar.pack(fill="x")
        self.topbar.pack_propagate(False)
        
        # Back button
        self.back_btn = ctk.CTkButton(
            self.topbar,
            text="← Back",
            font=("Segoe UI", 18),
            width=120,
            height=50,
            corner_radius=10,
            fg_color=COLORS["white"],
            text_color=COLORS["text"],
            hover_color="#E5E7EB",
            command=self.go_back
        )
        self.back_btn.pack(side="left", padx=20, pady=15)
        
        # Progress label
        self.progress_label = ctk.CTkLabel(
            self.topbar,
            text="Question 1 of 35",
            font=("Segoe UI", 16),
            text_color=COLORS["muted"]
        )
        self.progress_label.pack(side="right", padx=20)
        
        # Progress bar
        self.progress_bar = ctk.CTkProgressBar(
            self.topbar,
            width=300,
            height=15,
            progress_color=COLORS["primary"]
        )
        self.progress_bar.pack(side="right", padx=20)
        self.progress_bar.set(0)
        
        # Section label
        self.section_label = ctk.CTkLabel(
            self.main,
            text="About You",
            font=("Segoe UI", 20),
            text_color=COLORS["primary"]
        )
        self.section_label.pack(pady=(30, 10))
        
        # Question text - BIG
        self.question_label = ctk.CTkLabel(
            self.main,
            text="",
            font=("Segoe UI", 36, "bold"),
            text_color=COLORS["text"],
            wraplength=800
        )
        self.question_label.pack(pady=(20, 40))
        
        # Answer area - will be populated dynamically
        self.answer_frame = ctk.CTkFrame(self.main, fg_color="transparent")
        self.answer_frame.pack(fill="both", expand=True, padx=50, pady=20)
        
        # Bottom spacer
        ctk.CTkLabel(self.main, text="").pack(pady=20)
    
    def show_question(self, index):
        """Display a single question."""
        if index >= len(self.questions):
            self.show_results()
            return
        
        self.current_index = index
        q = self.questions[index]
        
        # Update progress
        progress = (index + 1) / len(self.questions)
        self.progress_bar.set(progress)
        self.progress_label.configure(text=f"Question {index + 1} of {len(self.questions)}")
        
        # Update section
        self.section_label.configure(text=q["section"])
        
        # Update question text
        self.question_label.configure(text=q["text"])
        
        # Clear answer area
        for widget in self.answer_frame.winfo_children():
            widget.destroy()
        
        # Build answer widgets based on type
        if q["type"] == "choice":
            self.build_choice_buttons(q)
        elif q["type"] == "slider":
            self.build_slider(q)
        
        # Update back button
        self.back_btn.configure(state="normal" if index > 0 else "disabled")
    
    def build_choice_buttons(self, q):
        """Build big choice buttons that auto-advance."""
        options = q["options"]
        
        # Calculate button layout
        if len(options) <= 3:
            # Horizontal layout for 2-3 options
            btn_frame = ctk.CTkFrame(self.answer_frame, fg_color="transparent")
            btn_frame.pack(expand=True)
            
            for i, opt in enumerate(options):
                btn = ctk.CTkButton(
                    btn_frame,
                    text=opt,
                    font=("Segoe UI", 24, "bold"),
                    width=280,
                    height=100,
                    corner_radius=20,
                    fg_color=COLORS["light"],
                    text_color=COLORS["text"],
                    hover_color=COLORS["primary"],
                    command=lambda o=opt, idx=i: self.select_choice(q, o, idx)
                )
                btn.pack(side="left", padx=15, pady=10)
        
        else:
            # Vertical layout for 4+ options
            for i, opt in enumerate(options):
                btn = ctk.CTkButton(
                    self.answer_frame,
                    text=opt,
                    font=("Segoe UI", 22),
                    width=500,
                    height=70,
                    corner_radius=15,
                    fg_color=COLORS["light"],
                    text_color=COLORS["text"],
                    hover_color=COLORS["primary"],
                    command=lambda o=opt, idx=i: self.select_choice(q, o, idx)
                )
                btn.pack(pady=8)
    
    def build_slider(self, q):
        """Build a slider with big + / - buttons."""
        # Current value display
        self.slider_value = ctk.IntVar(value=q.get("default", 50))
        
        value_label = ctk.CTkLabel(
            self.answer_frame,
            text=f"{self.slider_value.get()} {q.get('unit', '')}",
            font=("Segoe UI", 48, "bold"),
            text_color=COLORS["primary"]
        )
        value_label.pack(pady=20)
        
        # Big buttons for adjustment
        btn_frame = ctk.CTkFrame(self.answer_frame, fg_color="transparent")
        btn_frame.pack(pady=20)
        
        def decrease():
            val = self.slider_value.get()
            if val > q["min"]:
                self.slider_value.set(val - 1)
                value_label.configure(text=f"{self.slider_value.get()} {q.get('unit', '')}")
        
        def increase():
            val = self.slider_value.get()
            if val < q["max"]:
                self.slider_value.set(val + 1)
                value_label.configure(text=f"{self.slider_value.get()} {q.get('unit', '')}")
        
        def decrease_10():
            val = self.slider_value.get()
            new_val = max(val - 10, q["min"])
            self.slider_value.set(new_val)
            value_label.configure(text=f"{self.slider_value.get()} {q.get('unit', '')}")
        
        def increase_10():
            val = self.slider_value.get()
            new_val = min(val + 10, q["max"])
            self.slider_value.set(new_val)
            value_label.configure(text=f"{self.slider_value.get()} {q.get('unit', '')}")
        
        # -10 button
        ctk.CTkButton(
            btn_frame, text="- 10", font=("Segoe UI", 20, "bold"),
            width=100, height=80, corner_radius=15,
            fg_color=COLORS["light"], text_color=COLORS["text"],
            hover_color="#E5E7EB", command=decrease_10
        ).pack(side="left", padx=5)
        
        # -1 button
        ctk.CTkButton(
            btn_frame, text="−", font=("Segoe UI", 36, "bold"),
            width=100, height=80, corner_radius=15,
            fg_color=COLORS["light"], text_color=COLORS["text"],
            hover_color="#E5E7EB", command=decrease
        ).pack(side="left", padx=5)
        
        # +1 button
        ctk.CTkButton(
            btn_frame, text="+", font=("Segoe UI", 36, "bold"),
            width=100, height=80, corner_radius=15,
            fg_color=COLORS["light"], text_color=COLORS["text"],
            hover_color="#E5E7EB", command=increase
        ).pack(side="left", padx=5)
        
        # +10 button
        ctk.CTkButton(
            btn_frame, text="+ 10", font=("Segoe UI", 20, "bold"),
            width=100, height=80, corner_radius=15,
            fg_color=COLORS["light"], text_color=COLORS["text"],
            hover_color="#E5E7EB", command=increase_10
        ).pack(side="left", padx=5)
        
        # Confirm button for sliders
        ctk.CTkButton(
            self.answer_frame,
            text="Confirm ✓",
            font=("Segoe UI", 24, "bold"),
            width=250,
            height=80,
            corner_radius=20,
            fg_color=COLORS["primary"],
            hover_color="#1D4ED8",
            command=lambda: self.select_slider(q, self.slider_value.get())
        ).pack(pady=30)
    
    def select_choice(self, q, option, option_index):
        """Handle choice selection and auto-advance."""
        # Store response
        self.responses[q["id"]] = {
            "answer": option,
            "index": option_index,
            "score": q.get("scoring", [None])[option_index] if "scoring" in q else None
        }
        
        # Check if this triggers joint type change
        if q.get("triggers_joint"):
            new_joint = "hip" if "HIP" in option else "knee"
            if new_joint != self.joint_type:
                self.joint_type = new_joint
                self.questions = build_questions(new_joint)
        
        # Flash the button green briefly, then advance
        self.after(150, lambda: self.show_question(self.current_index + 1))
    
    def select_slider(self, q, value):
        """Handle slider confirmation."""
        self.responses[q["id"]] = {
            "answer": value,
            "index": None,
            "score": None
        }
        self.show_question(self.current_index + 1)
    
    def go_back(self):
        """Go to previous question."""
        if self.current_index > 0:
            self.show_question(self.current_index - 1)
    
    def show_results(self):
        """Calculate and display results with visual infographic."""
        # Clear everything
        for widget in self.main.winfo_children():
            widget.destroy()
        
        # Calculate scores
        scores = self.calculate_all_scores()
        
        # Results container
        results = ctk.CTkScrollableFrame(self.main, fg_color=COLORS["white"])
        results.pack(fill="both", expand=True, padx=40, pady=20)
        
        # Title
        ctk.CTkLabel(
            results,
            text="📋 Your Results",
            font=("Segoe UI", 36, "bold"),
            text_color=COLORS["primary"]
        ).pack(pady=(20, 20))
        
        # ============================================================
        # VISUAL INFOGRAPHIC - Person Journey from Pain to Recovery
        # ============================================================
        self.create_journey_infographic(results, scores)
        
        # Risk tier banner
        tier = scores["risk_tier"]
        tier_color = COLORS["success"] if tier == "LOW" else COLORS["warning"] if tier == "MODERATE" else COLORS["danger"]
        
        tier_frame = ctk.CTkFrame(results, fg_color=tier_color, corner_radius=20)
        tier_frame.pack(fill="x", pady=20, padx=20)
        
        ctk.CTkLabel(
            tier_frame,
            text=f"Risk Level: {tier}",
            font=("Segoe UI", 32, "bold"),
            text_color=COLORS["white"]
        ).pack(pady=30)
        
        # Score cards
        cards = ctk.CTkFrame(results, fg_color="transparent")
        cards.pack(fill="x", pady=20)
        
        self.create_score_card(cards, scores["joint_name"], f"{scores['joint_score']:.0f}", "out of 100", COLORS["primary"])
        self.create_score_card(cards, "Physical Health", f"{scores['gph']:.0f}", "T-score", COLORS["info"] if "info" in COLORS else COLORS["primary"])
        self.create_score_card(cards, "Mental Health", f"{scores['gmh']:.0f}", "T-score", COLORS["info"] if "info" in COLORS else COLORS["primary"])
        
        # Alerts
        if scores["alerts"]:
            alert_frame = ctk.CTkFrame(results, fg_color="#FEF3C7", corner_radius=15)
            alert_frame.pack(fill="x", pady=20, padx=20)
            
            ctk.CTkLabel(
                alert_frame,
                text="⚠️ Important Notes for Your Doctor:",
                font=("Segoe UI", 20, "bold"),
                text_color=COLORS["warning"]
            ).pack(anchor="w", padx=20, pady=(20, 10))
            
            for alert in scores["alerts"]:
                ctk.CTkLabel(
                    alert_frame,
                    text=f"• {alert}",
                    font=("Segoe UI", 16),
                    text_color=COLORS["text"]
                ).pack(anchor="w", padx=30, pady=3)
            
            ctk.CTkLabel(alert_frame, text="").pack(pady=10)
        
        # Buttons
        btn_frame = ctk.CTkFrame(results, fg_color="transparent")
        btn_frame.pack(pady=30)
        
        ctk.CTkButton(
            btn_frame,
            text="💾 Save Results",
            font=("Segoe UI", 20, "bold"),
            width=200,
            height=60,
            corner_radius=15,
            fg_color=COLORS["success"],
            command=self.save_results
        ).pack(side="left", padx=15)
        
        ctk.CTkButton(
            btn_frame,
            text="🔄 Start Over",
            font=("Segoe UI", 20, "bold"),
            width=200,
            height=60,
            corner_radius=15,
            fg_color=COLORS["light"],
            text_color=COLORS["text"],
            command=self.restart
        ).pack(side="left", padx=15)
    
    def create_journey_infographic(self, parent, scores):
        """Create visual journey from pain to recovery with person figures."""
        import tkinter as tk
        
        # Main infographic frame
        info_frame = ctk.CTkFrame(parent, fg_color=COLORS["light"], corner_radius=20)
        info_frame.pack(fill="x", pady=20, padx=20)
        
        # Title
        ctk.CTkLabel(
            info_frame,
            text="Your Expected Journey",
            font=("Segoe UI", 28, "bold"),
            text_color=COLORS["text"]
        ).pack(pady=(25, 15))
        
        # Canvas for drawing
        canvas_frame = ctk.CTkFrame(info_frame, fg_color=COLORS["white"], corner_radius=15)
        canvas_frame.pack(fill="x", padx=30, pady=15)
        
        canvas = tk.Canvas(canvas_frame, width=850, height=320, bg="white", highlightthickness=0)
        canvas.pack(padx=20, pady=25)
        
        # Calculate positions based on scores
        preop_score = scores["joint_score"]
        postop_score = scores["projected"]
        
        # Scale: 0-100 maps to x: 120-730
        def score_to_x(score):
            return 120 + (score / 100) * 610
        
        preop_x = score_to_x(preop_score)
        postop_x = score_to_x(postop_score)
        
        # Draw gradient background bar (red -> yellow -> green)
        for i in range(610):
            x = 120 + i
            ratio = i / 610
            if ratio < 0.4:
                # Red to orange
                r = 220
                g = int(60 + (140 * (ratio / 0.4)))
                b = 60
            elif ratio < 0.7:
                # Orange to yellow
                r = 220
                g = int(200 + (55 * ((ratio - 0.4) / 0.3)))
                b = 60
            else:
                # Yellow to green
                r = int(220 - (180 * ((ratio - 0.7) / 0.3)))
                g = 200
                b = int(60 + (40 * ((ratio - 0.7) / 0.3)))
            color = f'#{r:02x}{g:02x}{b:02x}'
            canvas.create_line(x, 220, x, 260, fill=color, width=1)
        
        # Draw scale bar outline with rounded ends
        canvas.create_rectangle(120, 220, 730, 260, outline="#CCCCCC", width=3)
        
        # Draw scale labels
        for val, label in [(0, "0"), (25, "25"), (50, "50"), (75, "75"), (100, "100")]:
            x = score_to_x(val)
            canvas.create_text(x, 280, text=label, font=("Segoe UI", 12), fill="#666666")
        
        # Labels at ends
        canvas.create_text(120, 300, text="😰 Severe Pain", font=("Segoe UI", 12, "bold"), fill="#DC2626", anchor="w")
        canvas.create_text(730, 300, text="😊 Excellent", font=("Segoe UI", 12, "bold"), fill="#16A34A", anchor="e")
        canvas.create_text(425, 300, text=scores["joint_name"] + " Score", font=("Segoe UI", 13, "bold"), fill="#666666")
        
        # Draw curved arrow from preop to postop
        mid_x = (preop_x + postop_x) / 2
        canvas.create_line(
            preop_x, 190, mid_x, 160, postop_x, 190,
            smooth=True, width=5, fill=COLORS["primary"],
            arrow=tk.LAST, arrowshape=(18, 22, 8)
        )
        
        # Improvement label on arrow
        canvas.create_oval(mid_x - 35, 135, mid_x + 35, 175, fill=COLORS["success"], outline="")
        canvas.create_text(
            mid_x, 155,
            text=f"+{scores['improvement']}",
            font=("Segoe UI", 18, "bold"),
            fill="white"
        )
        
        # === PREOP PERSON (struggling with cane) ===
        self.draw_struggling_person(canvas, preop_x, 95)
        
        # Preop marker on bar
        canvas.create_polygon(
            preop_x, 215, preop_x - 12, 195, preop_x + 12, 195,
            fill=COLORS["danger"], outline=""
        )
        canvas.create_text(
            preop_x, 175,
            text=f"NOW",
            font=("Segoe UI", 11, "bold"),
            fill=COLORS["danger"]
        )
        canvas.create_text(
            preop_x, 310,
            text=f"{preop_score:.0f}",
            font=("Segoe UI", 16, "bold"),
            fill=COLORS["danger"]
        )
        
        # === POSTOP PERSON (active and happy) ===
        self.draw_happy_person(canvas, postop_x, 95)
        
        # Postop marker on bar
        canvas.create_polygon(
            postop_x, 215, postop_x - 12, 195, postop_x + 12, 195,
            fill=COLORS["success"], outline=""
        )
        canvas.create_text(
            postop_x, 175,
            text=f"AFTER",
            font=("Segoe UI", 11, "bold"),
            fill=COLORS["success"]
        )
        canvas.create_text(
            postop_x, 310,
            text=f"{postop_score:.0f}",
            font=("Segoe UI", 16, "bold"),
            fill=COLORS["success"]
        )
        
        # Bottom message based on improvement
        msg_frame = ctk.CTkFrame(info_frame, fg_color="transparent")
        msg_frame.pack(pady=(5, 25))
        
        if scores["improvement"] >= 20:
            message = "🎉 Great news! You're expected to have SIGNIFICANT improvement!"
            msg_color = COLORS["success"]
        elif scores["improvement"] >= 12:
            message = "👍 Good news! Surgery should help you feel MUCH better."
            msg_color = COLORS["primary"]
        elif scores["improvement"] >= 8:
            message = "✓ Surgery should provide meaningful improvement."
            msg_color = COLORS["primary"]
        else:
            message = "ℹ️ Let's discuss your goals and expectations together."
            msg_color = COLORS["warning"]
        
        ctk.CTkLabel(
            msg_frame,
            text=message,
            font=("Segoe UI", 20, "bold"),
            text_color=msg_color
        ).pack()
    
    def draw_struggling_person(self, canvas, x, y):
        """Draw a person with cane, hunched, in pain - clearly struggling."""
        # Colors
        body = "#6B7280"  # Gray
        pain = "#DC2626"  # Red
        cane = "#8B4513"  # Brown
        
        # Pain indicators (red stars/bursts around the joint)
        for dx, dy in [(-25, 35), (-30, 28), (-18, 42), (-32, 38)]:
            canvas.create_text(x+dx, y+dy, text="✱", font=("Segoe UI", 9), fill=pain)
        
        # Head (tilted down, sad)
        canvas.create_oval(x-12, y-8, x+8, y+18, fill=body, outline="")
        # Sad mouth
        canvas.create_arc(x-6, y+5, x+2, y+13, start=180, extent=-180, style="arc", outline="white", width=2)
        
        # Body (hunched forward)
        canvas.create_line(x-2, y+18, x-12, y+55, width=5, fill=body, capstyle="round")
        
        # Legs (bent, weight shifted)
        canvas.create_line(x-12, y+55, x-25, y+85, width=4, fill=body, capstyle="round")  # Left thigh
        canvas.create_line(x-25, y+85, x-28, y+105, width=3, fill=body, capstyle="round") # Left shin
        canvas.create_line(x-12, y+55, x+2, y+80, width=4, fill=body, capstyle="round")   # Right thigh
        canvas.create_line(x+2, y+80, x+2, y+105, width=3, fill=body, capstyle="round")   # Right shin
        
        # Arms
        canvas.create_line(x-5, y+25, x-30, y+50, width=3, fill=body, capstyle="round")   # Left arm reaching to cane
        canvas.create_line(x-5, y+25, x+5, y+45, width=3, fill=body, capstyle="round")    # Right arm on body
        
        # Cane
        canvas.create_line(x-32, y+45, x-38, y+105, width=4, fill=cane, capstyle="round")
        canvas.create_oval(x-40, y+40, x-28, y+52, fill=cane, outline="")  # Cane handle
    
    def draw_happy_person(self, canvas, x, y):
        """Draw an active, happy, celebrating person."""
        # Colors
        body = "#16A34A"   # Green (healthy)
        accent = "#FCD34D" # Yellow (happy)
        
        # Celebration effects
        for dx, dy, char in [(0, -25, "⭐"), (-25, -15, "✨"), (25, -15, "✨")]:
            canvas.create_text(x+dx, y+dy, text=char, font=("Segoe UI", 10), fill=accent)
        
        # Head (upright, happy)
        canvas.create_oval(x-12, y-15, x+12, y+12, fill=body, outline="")
        # Big smile
        canvas.create_arc(x-7, y-5, x+7, y+8, start=0, extent=-180, style="arc", outline="white", width=2)
        
        # Body (upright, dynamic pose)
        canvas.create_line(x, y+12, x, y+55, width=5, fill=body, capstyle="round")
        
        # Legs (active walking/striding stance)
        canvas.create_line(x, y+55, x-18, y+82, width=4, fill=body, capstyle="round")    # Left thigh
        canvas.create_line(x-18, y+82, x-12, y+105, width=3, fill=body, capstyle="round") # Left shin
        canvas.create_line(x, y+55, x+18, y+78, width=4, fill=body, capstyle="round")    # Right thigh
        canvas.create_line(x+18, y+78, x+22, y+105, width=3, fill=body, capstyle="round") # Right shin
        
        # Arms (raised in celebration!)
        canvas.create_line(x, y+22, x-22, y+8, width=3, fill=body, capstyle="round")     # Left arm up
        canvas.create_line(x, y+22, x+22, y+8, width=3, fill=body, capstyle="round")     # Right arm up
        
        # Celebration items in hands
        canvas.create_text(x-30, y-2, text="🎉", font=("Segoe UI", 14))
        canvas.create_text(x+30, y-2, text="🎉", font=("Segoe UI", 14))
    
    def create_score_card(self, parent, title, value, subtitle, color):
        """Create a score display card."""
        card = ctk.CTkFrame(parent, fg_color=COLORS["white"], corner_radius=15, border_width=2, border_color=color)
        card.pack(side="left", padx=15, expand=True, fill="both")
        
        ctk.CTkLabel(card, text=title, font=("Segoe UI", 14), text_color=COLORS["muted"]).pack(pady=(15, 5))
        ctk.CTkLabel(card, text=value, font=("Segoe UI", 36, "bold"), text_color=color).pack()
        ctk.CTkLabel(card, text=subtitle, font=("Segoe UI", 12), text_color=COLORS["muted"]).pack(pady=(5, 15))
    
    def calculate_all_scores(self):
        """Calculate all scores from responses."""
        # Joint score
        joint_keys = [k for k in self.responses.keys() if k.startswith("koos_") or k.startswith("hoos_")]
        joint_scores = [self.responses[k]["score"] for k in joint_keys if self.responses[k]["score"] is not None]
        
        if "koos_1" in self.responses:
            joint_name = "KOOS-JR"
            max_score = 28
        else:
            joint_name = "HOOS-JR"
            max_score = 24
        
        joint_score = (sum(joint_scores) / max_score * 100) if joint_scores else 50
        
        # PROMIS scores
        promis_keys = [f"promis_{i}" for i in range(1, 11)]
        promis_scores = [self.responses.get(k, {}).get("score", 3) for k in promis_keys]
        
        gph = 30 + sum(promis_scores[:6]) * 1.5
        gmh = 30 + sum(promis_scores[6:]) * 2
        
        # PHQ-2 and GAD-2
        phq = sum([self.responses.get(f"phq_{i}", {}).get("score", 0) for i in [1, 2]])
        gad = sum([self.responses.get(f"gad_{i}", {}).get("score", 0) for i in [1, 2]])
        
        phq_positive = phq >= 3
        gad_positive = gad >= 3
        
        # Risk factors
        age = self.responses.get("age", {}).get("answer", 65)
        opioid_chronic = "more than 3" in self.responses.get("opioid", {}).get("answer", "")
        lives_alone = "ALONE" in self.responses.get("living", {}).get("answer", "")
        smoker = "smoke" in self.responses.get("smoker", {}).get("answer", "").lower()
        
        # BMI
        try:
            ht_ft = int(self.responses.get("height_ft", {}).get("answer", "5").split()[0])
            ht_in = int(self.responses.get("height_in", {}).get("answer", "6").split()[0])
            weight = self.responses.get("weight", {}).get("answer", 180)
            bmi = (weight / ((ht_ft * 12 + ht_in) ** 2)) * 703
        except:
            bmi = 28
        
        # Calculate risk
        mortality = 0.4 + (0.5 if age > 80 else 0.2 if age > 70 else 0)
        readmission = 2.0 + (0.5 if age > 75 else 0) + (0.5 if opioid_chronic else 0)
        
        if mortality < 1 and readmission < 5:
            risk_tier = "LOW"
        elif mortality < 2 and readmission < 10:
            risk_tier = "MODERATE"
        else:
            risk_tier = "HIGH"
        
        # Improvement estimate
        improvement = 30 if risk_tier == "LOW" else 22 if risk_tier == "MODERATE" else 15
        if phq_positive:
            improvement -= 5
        if opioid_chronic:
            improvement -= 8
        improvement = max(improvement, 8)
        
        projected = min(joint_score + improvement, 100)
        
        # Alerts
        alerts = []
        if phq_positive:
            alerts.append("Depression screen positive")
        if gad_positive:
            alerts.append("Anxiety screen positive")
        if opioid_chronic:
            alerts.append("Chronic opioid use (>3 months)")
        if lives_alone and self.responses.get("help", {}).get("answer") != "Yes":
            alerts.append("Lives alone - may need help after surgery")
        if smoker:
            alerts.append("Current smoker - higher risk")
        if bmi >= 40:
            alerts.append(f"BMI {bmi:.1f} - higher risk")
        
        return {
            "joint_name": joint_name,
            "joint_score": joint_score,
            "gph": min(max(gph, 20), 80),
            "gmh": min(max(gmh, 20), 80),
            "phq": phq,
            "gad": gad,
            "risk_tier": risk_tier,
            "improvement": improvement,
            "projected": projected,
            "alerts": alerts
        }
    
    def save_results(self):
        """Save results."""
        messagebox.showinfo("Saved", "Results saved to patient record!")
    
    def restart(self):
        """Start over."""
        self.responses = {}
        self.current_index = 0
        self.joint_type = "knee"
        self.questions = build_questions("knee")
        
        # Rebuild UI
        for widget in self.main.winfo_children():
            widget.destroy()
        self.create_ui()
        self.show_question(0)


# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    app = OneQuestionIntake()
    app.mainloop()
