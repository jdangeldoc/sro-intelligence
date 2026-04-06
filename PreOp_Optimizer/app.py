#!/usr/bin/env python
"""
PreOp Optimizer - Perioperative Risk Assessment and Optimization Tool
Integrates with Orthoplan and SRO Dashboard for longitudinal patient tracking.
"""

import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
import json
import os
import sys
from datetime import datetime, date
from typing import Dict, List, Optional

def get_resource_path(relative_path):
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.dirname(__file__), relative_path)

try:
    from local_database import (
        create_patient, get_patient_by_mrn, search_patients,
        create_preop_assessment, update_preop_assessment, get_preop_assessment,
        create_workup_item, update_workup_item, get_assessment_workup_items,
        check_all_workup_cleared, save_proms_score, save_postop_lab
    )
    DB_AVAILABLE = True
except ImportError as e:
    DB_AVAILABLE = False
    print(f"Database not available: {e}")

def load_hcc_library():
    try:
        with open(get_resource_path("hcc_library.json"), 'r') as f:
            return json.load(f)
    except:
        return {}

HCC_LIBRARY = load_hcc_library()


class PreOpOptimizerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("PreOp Optimizer — Perioperative Risk Assessment")
        self.root.geometry("1100x850")
        
        self.current_patient_id = None
        self.current_assessment_id = None
        self.comorbidity_vars = {}
        self.sdoh_vars = {}
        self.workup_checkboxes = {}
        self.lab_vars = {}
        
        self.notebook = ttk.Notebook(root)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        self.create_patient_tab()
        self.create_comorbidity_tab()
        self.create_workup_tab()
        self.create_decision_tab()
        self.create_labs_tab()
        self.create_summary_tab()
        
        self.status_var = tk.StringVar(value="Ready")
        tk.Label(root, textvariable=self.status_var, bd=1, relief=tk.SUNKEN, anchor=tk.W).pack(side=tk.BOTTOM, fill=tk.X)

    def create_patient_tab(self):
        tab = ttk.Frame(self.notebook)
        self.notebook.add(tab, text="1. Patient")
        
        # Search
        sf = ttk.LabelFrame(tab, text="Find Patient", padding=10)
        sf.pack(fill=tk.X, padx=10, pady=5)
        
        ttk.Label(sf, text="Search:").pack(side=tk.LEFT)
        self.search_var = tk.StringVar()
        ttk.Entry(sf, textvariable=self.search_var, width=30).pack(side=tk.LEFT, padx=5)
        ttk.Button(sf, text="Search", command=self.search_patients).pack(side=tk.LEFT)
        
        self.search_listbox = tk.Listbox(tab, height=4)
        self.search_listbox.pack(fill=tk.X, padx=10, pady=5)
        self.search_listbox.bind('<<ListboxSelect>>', self.on_patient_select)
        
        # New patient
        nf = ttk.LabelFrame(tab, text="Patient Info", padding=10)
        nf.pack(fill=tk.X, padx=10, pady=5)
        
        r = ttk.Frame(nf)
        r.pack(fill=tk.X)
        
        self.mrn_var = tk.StringVar()
        self.first_name_var = tk.StringVar()
        self.last_name_var = tk.StringVar()
        self.dob_var = tk.StringVar()
        self.sex_var = tk.StringVar()
        self.insurance_var = tk.StringVar()
        
        ttk.Label(r, text="MRN:").grid(row=0, column=0, padx=2)
        ttk.Entry(r, textvariable=self.mrn_var, width=15).grid(row=0, column=1, padx=2)
        ttk.Label(r, text="First:").grid(row=0, column=2, padx=2)
        ttk.Entry(r, textvariable=self.first_name_var, width=15).grid(row=0, column=3, padx=2)
        ttk.Label(r, text="Last:").grid(row=0, column=4, padx=2)
        ttk.Entry(r, textvariable=self.last_name_var, width=15).grid(row=0, column=5, padx=2)
        
        ttk.Label(r, text="DOB:").grid(row=1, column=0, padx=2, pady=5)
        ttk.Entry(r, textvariable=self.dob_var, width=15).grid(row=1, column=1, padx=2)
        ttk.Label(r, text="Sex:").grid(row=1, column=2, padx=2)
        ttk.Combobox(r, textvariable=self.sex_var, values=["M","F"], width=5).grid(row=1, column=3, padx=2, sticky=tk.W)
        ttk.Label(r, text="Insurance:").grid(row=1, column=4, padx=2)
        ttk.Combobox(r, textvariable=self.insurance_var, 
                     values=["novitas_cms","arkansas_bcbs","arkansas_medicaid","medicare_advantage"],
                     width=18).grid(row=1, column=5, padx=2)
        
        ttk.Button(nf, text="Create Patient", command=self.create_new_patient).pack(pady=5)
        
        # Procedure
        pf = ttk.LabelFrame(tab, text="Planned Procedure", padding=10)
        pf.pack(fill=tk.X, padx=10, pady=5)
        
        self.procedure_var = tk.StringVar()
        self.surgery_date_var = tk.StringVar()
        
        ttk.Label(pf, text="Procedure:").pack(side=tk.LEFT)
        ttk.Combobox(pf, textvariable=self.procedure_var,
                     values=["TKA","THA","Shoulder Arthroplasty","ACL Reconstruction",
                             "Rotator Cuff Repair","Spinal Fusion","Laminectomy","Other"],
                     width=30).pack(side=tk.LEFT, padx=5)
        ttk.Label(pf, text="Surgery Date:").pack(side=tk.LEFT, padx=10)
        ttk.Entry(pf, textvariable=self.surgery_date_var, width=12).pack(side=tk.LEFT)
        ttk.Button(pf, text="Start Assessment", command=self.start_assessment).pack(side=tk.LEFT, padx=20)
        
        self.patient_display = ttk.Label(tab, text="No patient selected", font=("Arial", 11))
        self.patient_display.pack(pady=15)

    def search_patients(self):
        q = self.search_var.get().strip()
        if DB_AVAILABLE and q:
            results = search_patients(q)
            self.search_listbox.delete(0, tk.END)
            self.search_results = results
            for p in results:
                self.search_listbox.insert(tk.END, f"{p['mrn']} - {p['last_name']}, {p['first_name']}")

    def on_patient_select(self, event):
        sel = self.search_listbox.curselection()
        if sel and hasattr(self, 'search_results'):
            p = self.search_results[sel[0]]
            self.current_patient_id = p['id']
            self.mrn_var.set(p['mrn'])
            self.first_name_var.set(p['first_name'])
            self.last_name_var.set(p['last_name'])
            self.dob_var.set(p.get('dob',''))
            self.sex_var.set(p.get('sex',''))
            self.insurance_var.set(p.get('insurance_type',''))
            self.patient_display.config(text=f"Selected: {p['first_name']} {p['last_name']} (MRN: {p['mrn']})")

    def create_new_patient(self):
        if not DB_AVAILABLE:
            self.current_patient_id = "demo"
            self.patient_display.config(text=f"Demo: {self.first_name_var.get()} {self.last_name_var.get()}")
            return
        
        mrn, first, last = self.mrn_var.get().strip(), self.first_name_var.get().strip(), self.last_name_var.get().strip()
        if not all([mrn, first, last]):
            messagebox.showerror("Error", "MRN, First, and Last name required")
            return
        
        if get_patient_by_mrn(mrn):
            messagebox.showerror("Error", f"MRN {mrn} exists")
            return
        
        self.current_patient_id = create_patient(mrn=mrn, first_name=first, last_name=last,
                                                  dob=self.dob_var.get() or None, sex=self.sex_var.get() or None,
                                                  insurance_type=self.insurance_var.get() or None)
        self.patient_display.config(text=f"Created: {first} {last} (MRN: {mrn})")
        messagebox.showinfo("Success", "Patient created")

    def start_assessment(self):
        if not self.current_patient_id:
            messagebox.showerror("Error", "Select/create patient first")
            return
        proc = self.procedure_var.get()
        if not proc:
            messagebox.showerror("Error", "Select procedure")
            return
        
        if DB_AVAILABLE and self.current_patient_id != "demo":
            self.current_assessment_id = create_preop_assessment(self.current_patient_id, proc,
                                                                  self.surgery_date_var.get() or None)
        else:
            self.current_assessment_id = "demo"
        
        self.notebook.select(1)

    def create_comorbidity_tab(self):
        tab = ttk.Frame(self.notebook)
        self.notebook.add(tab, text="2. Comorbidities")
        
        ttk.Label(tab, text="Select comorbidities. Check 'Workup' to trigger required tests/consults.",
                  font=("Arial", 10)).pack(pady=5)
        
        # Score display
        sf = ttk.Frame(tab)
        sf.pack(fill=tk.X, padx=10)
        ttk.Label(sf, text="HCC Score:", font=("Arial", 11, "bold")).pack(side=tk.LEFT)
        self.hcc_score_var = tk.StringVar(value="0.000")
        ttk.Label(sf, textvariable=self.hcc_score_var, font=("Arial", 11, "bold"), foreground="blue").pack(side=tk.LEFT, padx=5)
        ttk.Label(sf, text="Risk Modifier:", font=("Arial", 11)).pack(side=tk.LEFT, padx=20)
        self.risk_modifier_var = tk.StringVar(value="1.00x")
        ttk.Label(sf, textvariable=self.risk_modifier_var, font=("Arial", 11), foreground="blue").pack(side=tk.LEFT)
        
        # Scrollable comorbidities
        canvas = tk.Canvas(tab, height=400)
        scrollbar = ttk.Scrollbar(tab, orient="vertical", command=canvas.yview)
        scroll_frame = ttk.Frame(canvas)
        scroll_frame.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=scroll_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        comorbidities = HCC_LIBRARY.get("comorbidities", {})
        categories = {}
        for cid, cdata in comorbidities.items():
            cat = cdata.get("category", "other")
            if cat not in categories:
                categories[cat] = []
            categories[cat].append((cid, cdata))
        
        row = 0
        for category, items in sorted(categories.items()):
            ttk.Label(scroll_frame, text=category.replace("_", " ").title(),
                      font=("Arial", 10, "bold")).grid(row=row, column=0, columnspan=4, sticky=tk.W, pady=(8,2), padx=5)
            row += 1
            
            for cid, cdata in items:
                ttk.Label(scroll_frame, text=cdata["display_name"], width=35, anchor=tk.W).grid(row=row, column=0, sticky=tk.W, padx=5)
                ttk.Label(scroll_frame, text=f"{cdata.get('hcc_weight',0):.3f}", width=8).grid(row=row, column=1)
                
                doc_var = tk.BooleanVar()
                workup_var = tk.BooleanVar()
                ttk.Checkbutton(scroll_frame, text="Doc", variable=doc_var,
                                command=self.update_scores).grid(row=row, column=2)
                ttk.Checkbutton(scroll_frame, text="Workup", variable=workup_var,
                                command=self.update_scores).grid(row=row, column=3)
                
                self.comorbidity_vars[cid] = {"document": doc_var, "workup": workup_var, "data": cdata}
                row += 1
        
        canvas.pack(side="left", fill="both", expand=True, padx=10)
        scrollbar.pack(side="right", fill="y")
        
        # SDOH
        sdoh_frame = ttk.LabelFrame(tab, text="Social Determinants", padding=5)
        sdoh_frame.pack(fill=tk.X, padx=10, pady=5)
        
        for sid, sdata in HCC_LIBRARY.get("social_determinants", {}).items():
            var = tk.BooleanVar()
            ttk.Checkbutton(sdoh_frame, text=sdata["display_name"], variable=var).pack(anchor=tk.W)
            self.sdoh_vars[sid] = var
        
        ttk.Button(tab, text="Generate Workup →", command=self.generate_workup).pack(pady=10)

    def update_scores(self):
        total_hcc, total_risk = 0.0, 1.0
        for cid, vars in self.comorbidity_vars.items():
            if vars["document"].get() or vars["workup"].get():
                total_hcc += vars["data"].get("hcc_weight", 0)
                total_risk *= vars["data"].get("surgical_risk_modifier", 1.0)
        self.hcc_score_var.set(f"{total_hcc:.3f}")
        self.risk_modifier_var.set(f"{total_risk:.2f}x")

    def generate_workup(self):
        if not self.current_assessment_id:
            messagebox.showerror("Error", "Start assessment first")
            return
        
        selected, workup_needed = [], []
        for cid, vars in self.comorbidity_vars.items():
            if vars["document"].get() or vars["workup"].get():
                selected.append(cid)
                if vars["workup"].get():
                    workup_needed.append(cid)
        
        sdoh = [s for s, v in self.sdoh_vars.items() if v.get()]
        
        if DB_AVAILABLE and self.current_assessment_id != "demo":
            update_preop_assessment(self.current_assessment_id, comorbidities=selected,
                                    hcc_total_score=float(self.hcc_score_var.get()), sdoh_flags=sdoh,
                                    status="workup_pending" if workup_needed else "in_progress")
            
            for cid in workup_needed:
                workup = self.comorbidity_vars[cid]["data"].get("workup_required", {})
                for test in workup.get("tests", []):
                    create_workup_item(self.current_assessment_id, self.current_patient_id, "test", test, cid)
                for consult in workup.get("consults", []):
                    create_workup_item(self.current_assessment_id, self.current_patient_id, "consult", consult, cid)
        
        self.refresh_workup_tab()
        self.notebook.select(2)

    def create_workup_tab(self):
        tab = ttk.Frame(self.notebook)
        self.notebook.add(tab, text="3. Workup")
        
        self.clearance_status = ttk.Label(tab, text="⏳ WORKUP IN PROGRESS", font=("Arial", 14, "bold"), foreground="orange")
        self.clearance_status.pack(pady=10)
        
        self.workup_container = ttk.Frame(tab)
        self.workup_container.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
        
        bf = ttk.Frame(tab)
        bf.pack(fill=tk.X, pady=10)
        ttk.Button(bf, text="Refresh", command=self.refresh_workup_tab).pack(side=tk.LEFT, padx=5)
        ttk.Button(bf, text="Check Clearance", command=self.check_clearance).pack(side=tk.LEFT, padx=5)
        ttk.Button(bf, text="Continue →", command=lambda: self.notebook.select(3)).pack(side=tk.RIGHT, padx=5)

    def refresh_workup_tab(self):
        for w in self.workup_container.winfo_children():
            w.destroy()
        
        self.workup_checkboxes = {}
        
        if DB_AVAILABLE and self.current_assessment_id and self.current_assessment_id != "demo":
            items = get_assessment_workup_items(self.current_assessment_id)
        else:
            items = [{"id": f"demo_{i}", "item_type": t, "item_name": n, "comorbidity_id": c, "cleared": 0}
                     for i, (c, t, n) in enumerate([
                         ("diabetes_controlled", "test", "HbA1c"),
                         ("sleep_apnea", "test", "Sleep Study"),
                         ("obesity_class_2", "consult", "Nutrition")])]
        
        if not items:
            ttk.Label(self.workup_container, text="No workup required", font=("Arial", 11)).pack(pady=20)
            self.clearance_status.config(text="✓ CLEARED", foreground="green")
            return
        
        for item in items:
            f = ttk.Frame(self.workup_container)
            f.pack(fill=tk.X, pady=2)
            
            var = tk.BooleanVar(value=bool(item.get('cleared')))
            cb = ttk.Checkbutton(f, variable=var, command=lambda i=item['id'], v=var: self.toggle_workup(i, v))
            cb.pack(side=tk.LEFT)
            
            cname = self.comorbidity_vars.get(item.get('comorbidity_id'), {}).get("data", {}).get("display_name", "")
            ttk.Label(f, text=f"[{item['item_type'].upper()}] {item['item_name']} ({cname})", width=50, anchor=tk.W).pack(side=tk.LEFT)
            
            status = "✓ Done" if item.get('cleared') else "Pending"
            color = "green" if item.get('cleared') else "orange"
            ttk.Label(f, text=status, foreground=color).pack(side=tk.LEFT, padx=10)
            
            self.workup_checkboxes[item['id']] = var
        
        self.check_clearance()

    def toggle_workup(self, item_id, var):
        if DB_AVAILABLE and not item_id.startswith("demo"):
            update_workup_item(item_id, cleared=1 if var.get() else 0,
                               completed_date=date.today().isoformat() if var.get() else None)
        self.check_clearance()

    def check_clearance(self):
        all_done = all(v.get() for v in self.workup_checkboxes.values()) if self.workup_checkboxes else True
        
        if all_done:
            self.clearance_status.config(text="✓ ALL WORKUP COMPLETE - CLEARED FOR SURGERY", foreground="green")
            if DB_AVAILABLE and self.current_assessment_id and self.current_assessment_id != "demo":
                update_preop_assessment(self.current_assessment_id, status="cleared", cleared_date=date.today().isoformat())
            return True
        else:
            self.clearance_status.config(text="⛔ WORKUP INCOMPLETE - NOT CLEARED", foreground="red")
            return False

    def create_decision_tab(self):
        tab = ttk.Frame(self.notebook)
        self.notebook.add(tab, text="4. Decision Tool")
        
        ttk.Label(tab, text="Shared Decision-Making Tool", font=("Arial", 14, "bold")).pack(pady=10)
        
        pf = ttk.Frame(tab)
        pf.pack(fill=tk.X, padx=20, pady=5)
        ttk.Label(pf, text="Procedure:").pack(side=tk.LEFT)
        self.decision_proc_var = tk.StringVar(value="TKA")
        ttk.Combobox(pf, textvariable=self.decision_proc_var, values=["TKA","THA"], width=10,
                     state="readonly").pack(side=tk.LEFT, padx=5)
        
        ttk.Label(pf, text="Pre-Op Score (0-100):").pack(side=tk.LEFT, padx=20)
        self.preop_score_var = tk.StringVar(value="45")
        ttk.Entry(pf, textvariable=self.preop_score_var, width=8).pack(side=tk.LEFT)
        ttk.Button(pf, text="Calculate", command=self.update_prediction).pack(side=tk.LEFT, padx=10)
        
        self.outcome_text = tk.Text(tab, height=25, width=80, font=("Courier", 10))
        self.outcome_text.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)
        
        self.update_prediction()

    def update_prediction(self):
        proc = self.decision_proc_var.get()
        try:
            preop = float(self.preop_score_var.get())
        except:
            preop = 45
        
        cms = HCC_LIBRARY.get("cms_proms_deltas", {}).get(proc, {})
        measure = cms.get("measure", "KOOS-JR" if proc == "TKA" else "HOOS-JR")
        exp_mean = cms.get("expected_improvement_mean", 20)
        exp_range = cms.get("expected_improvement_range", [15, 25])
        mcid = cms.get("mcid", 8)
        scb = cms.get("substantial_clinical_benefit", 16)
        
        reduction = 0
        reductions = []
        for cid, vars in self.comorbidity_vars.items():
            if vars["document"].get() or vars["workup"].get():
                d = vars["data"]
                key = "koos_reduction" if proc == "TKA" else "hoos_reduction"
                r = d.get("outcome_impact", {}).get(key, 0)
                if r:
                    reduction += r
                    reductions.append(f"  • {d['display_name']}: -{r} pts")
        
        predicted = exp_mean - reduction
        postop = preop + predicted
        best = preop + exp_range[1] - reduction * 0.5
        worst = preop + exp_range[0] - reduction * 1.5
        
        base_read = 0.045
        read_inc = sum(self.comorbidity_vars[c]["data"].get("outcome_impact",{}).get("readmission_increase",0)
                       for c, v in self.comorbidity_vars.items() if v["document"].get() or v["workup"].get())
        readmit = (base_read + read_inc) * 100
        
        out = f"""
╔═══════════════════════════════════════════════════════════════════╗
║          {proc} OUTCOME PREDICTION - {measure}                        ║
╠═══════════════════════════════════════════════════════════════════╣
║  Current Score: {preop:>5.0f} / 100                                      ║
║                                                                   ║
║  EXPECTED AFTER SURGERY:                                          ║
║    Best Case:    {best:>5.0f} (+{best-preop:>4.0f})                                   ║
║    Average:      {postop:>5.0f} (+{predicted:>4.0f})                                   ║
║    Worst Case:   {worst:>5.0f} (+{worst-preop:>4.0f})                                   ║
║                                                                   ║
║  MCID: {mcid} pts | Substantial Benefit: {scb} pts                       ║
╠═══════════════════════════════════════════════════════════════════╣
║  RISK FACTORS:                                                    ║
"""
        for r in reductions:
            out += f"║  {r:<60}║\n"
        if not reductions:
            out += "║    None identified                                            ║\n"
        
        out += f"""╠═══════════════════════════════════════════════════════════════════╣
║  90-Day Readmission Risk: {readmit:>5.1f}% (Avg: 4.5%)                      ║
╠═══════════════════════════════════════════════════════════════════╣
║  RECOMMENDATION: {"LIKELY BENEFIT" if predicted >= mcid else "MAY NOT BENEFIT":<45}║
╚═══════════════════════════════════════════════════════════════════╝
"""
        self.outcome_text.delete("1.0", tk.END)
        self.outcome_text.insert("1.0", out)

    def create_labs_tab(self):
        tab = ttk.Frame(self.notebook)
        self.notebook.add(tab, text="5. Post-Op Labs")
        
        ttk.Label(tab, text="IL-6 Tracking (POD 0, 10, 21)", font=("Arial", 14, "bold")).pack(pady=10)
        
        df = ttk.Frame(tab)
        df.pack(fill=tk.X, padx=20, pady=5)
        ttk.Label(df, text="Surgery Date:").pack(side=tk.LEFT)
        self.lab_surgery_date_var = tk.StringVar()
        ttk.Entry(df, textvariable=self.lab_surgery_date_var, width=12).pack(side=tk.LEFT, padx=5)
        
        lf = ttk.LabelFrame(tab, text="Enter IL-6 Values", padding=10)
        lf.pack(fill=tk.X, padx=20, pady=10)
        
        il6 = HCC_LIBRARY.get("postop_lab_schedule",{}).get("interleukin_6",{})
        expected = il6.get("expected_postop",{})
        
        for pod in ["POD 0", "POD 10", "POD 21"]:
            f = ttk.Frame(lf)
            f.pack(fill=tk.X, pady=3)
            ttk.Label(f, text=f"{pod}:", width=8).pack(side=tk.LEFT)
            var = tk.StringVar()
            ttk.Entry(f, textvariable=var, width=10).pack(side=tk.LEFT, padx=5)
            ttk.Label(f, text="pg/mL").pack(side=tk.LEFT)
            exp = expected.get(pod.replace(" ","_"), "")
            ttk.Label(f, text=f"  Expected: {exp}", foreground="gray").pack(side=tk.LEFT, padx=10)
            self.lab_vars[pod] = var
        
        ttk.Button(lf, text="Save Labs", command=self.save_labs).pack(pady=10)
        
        self.lab_text = tk.Text(tab, height=12, font=("Courier", 10))
        self.lab_text.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)

    def save_labs(self):
        surg = self.lab_surgery_date_var.get().strip()
        if not surg or not self.current_patient_id:
            messagebox.showerror("Error", "Enter surgery date and select patient")
            return
        
        thresholds = HCC_LIBRARY.get("postop_lab_schedule",{}).get("interleukin_6",{}).get("flag_threshold",{})
        
        for pod, var in self.lab_vars.items():
            val = var.get().strip()
            if val:
                try:
                    v = float(val)
                    thresh = thresholds.get(pod.replace(" ","_"), 100)
                    flag = "elevated" if v > thresh else "normal"
                    if DB_AVAILABLE and self.current_patient_id != "demo":
                        save_postop_lab(self.current_patient_id, surg, "IL6", pod, v, "pg/mL", flag)
                except:
                    pass
        messagebox.showinfo("Success", "Labs saved")

    def create_summary_tab(self):
        tab = ttk.Frame(self.notebook)
        self.notebook.add(tab, text="6. Summary")
        
        ttk.Label(tab, text="PreOp Assessment Summary", font=("Arial", 14, "bold")).pack(pady=10)
        
        self.summary_text = tk.Text(tab, height=28, width=90, font=("Courier", 10))
        self.summary_text.pack(fill=tk.BOTH, expand=True, padx=20, pady=5)
        
        bf = ttk.Frame(tab)
        bf.pack(fill=tk.X, padx=20, pady=10)
        ttk.Button(bf, text="Generate Summary", command=self.generate_summary).pack(side=tk.LEFT, padx=5)
        ttk.Button(bf, text="Copy to Clipboard", command=self.copy_summary).pack(side=tk.LEFT, padx=5)

    def generate_summary(self):
        cleared = self.check_clearance()
        
        conditions = [v["data"]["display_name"] for c, v in self.comorbidity_vars.items() 
                      if v["document"].get() or v["workup"].get()]
        
        summary = f"""
═══════════════════════════════════════════════════════════════════════
                    PREOPERATIVE OPTIMIZATION SUMMARY
═══════════════════════════════════════════════════════════════════════
Date: {date.today().isoformat()}

PATIENT: {self.first_name_var.get()} {self.last_name_var.get()}
MRN: {self.mrn_var.get()}  DOB: {self.dob_var.get()}  Sex: {self.sex_var.get()}
Insurance: {self.insurance_var.get()}

PROCEDURE: {self.procedure_var.get()}
Target Surgery Date: {self.surgery_date_var.get()}

COMORBIDITIES:
  HCC Score: {self.hcc_score_var.get()}  Risk Modifier: {self.risk_modifier_var.get()}
"""
        for c in conditions:
            summary += f"  • {c}\n"
        
        summary += f"""
CLEARANCE STATUS: {"✓ CLEARED FOR SURGERY" if cleared else "⛔ NOT CLEARED - Workup Incomplete"}

═══════════════════════════════════════════════════════════════════════
ATTESTATION: This preoperative assessment has been completed. The provider
has reviewed all comorbidities, ordered appropriate workups, and assessed
surgical risk with shared decision-making.
═══════════════════════════════════════════════════════════════════════
"""
        self.summary_text.delete("1.0", tk.END)
        self.summary_text.insert("1.0", summary)

    def copy_summary(self):
        try:
            import pyperclip
            pyperclip.copy(self.summary_text.get("1.0", tk.END))
        except:
            self.root.clipboard_clear()
            self.root.clipboard_append(self.summary_text.get("1.0", tk.END))
        self.status_var.set("Copied to clipboard")


if __name__ == "__main__":
    root = tk.Tk()
    app = PreOpOptimizerApp(root)
    root.mainloop()
