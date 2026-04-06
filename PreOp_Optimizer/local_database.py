#!/usr/bin/env python
"""
Orthoplan Local Database Module
SQLite database for sharing patient data between Orthoplan, PreOp Optimizer, and other modules.
Designed for local-first operation with optional cloud sync to Supabase.
"""

import sqlite3
import os
import json
from datetime import datetime, date
from typing import Dict, List, Optional, Any
import uuid

# Default database location
DEFAULT_DB_PATH = os.path.join(os.path.expanduser("~"), "OrthoData", "ortho_local.db")


def get_db_path() -> str:
    """Get the database path, creating directory if needed."""
    db_path = os.environ.get("ORTHO_DB_PATH", DEFAULT_DB_PATH)
    db_dir = os.path.dirname(db_path)
    if not os.path.exists(db_dir):
        os.makedirs(db_dir)
    return db_path


def get_connection() -> sqlite3.Connection:
    """Get a database connection with row factory."""
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    return conn


def init_database():
    """Initialize the database schema."""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Patients table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS patients (
            id TEXT PRIMARY KEY,
            mrn TEXT UNIQUE,
            first_name TEXT,
            last_name TEXT,
            dob TEXT,
            sex TEXT,
            insurance_type TEXT,
            insurance_id TEXT,
            phone TEXT,
            email TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            synced_at TEXT
        )
    """)
    
    # PreOp assessments table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS preop_assessments (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL,
            assessment_date TEXT,
            planned_procedure TEXT,
            planned_surgery_date TEXT,
            comorbidities TEXT,  -- JSON array of comorbidity IDs
            hcc_total_score REAL,
            risk_score REAL,
            workup_items TEXT,  -- JSON array of workup items
            sdoh_flags TEXT,  -- JSON array of social determinants
            status TEXT DEFAULT 'in_progress',  -- in_progress, workup_pending, cleared, cancelled
            cleared_date TEXT,
            cleared_by TEXT,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            synced_at TEXT,
            FOREIGN KEY (patient_id) REFERENCES patients(id)
        )
    """)
    
    # Workup items tracking
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS workup_items (
            id TEXT PRIMARY KEY,
            assessment_id TEXT NOT NULL,
            patient_id TEXT NOT NULL,
            comorbidity_id TEXT,
            item_type TEXT,  -- test, consult
            item_name TEXT,
            ordered_date TEXT,
            scheduled_date TEXT,
            completed_date TEXT,
            result TEXT,
            cleared INTEGER DEFAULT 0,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (assessment_id) REFERENCES preop_assessments(id),
            FOREIGN KEY (patient_id) REFERENCES patients(id)
        )
    """)
    
    # PROMS scores
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS proms_scores (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL,
            assessment_id TEXT,
            measure_type TEXT,  -- KOOS-JR, HOOS-JR, VAS, etc.
            score REAL,
            responses TEXT,  -- JSON of individual responses
            collection_date TEXT,
            collection_type TEXT,  -- preop, postop_6wk, postop_3mo, postop_1yr, postop_2yr
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            synced_at TEXT,
            FOREIGN KEY (patient_id) REFERENCES patients(id),
            FOREIGN KEY (assessment_id) REFERENCES preop_assessments(id)
        )
    """)
    
    # Post-op labs tracking
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS postop_labs (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL,
            surgery_date TEXT,
            lab_type TEXT,  -- IL6, CRP, ESR, etc.
            collection_day TEXT,  -- POD_0, POD_10, POD_21
            collection_date TEXT,
            value REAL,
            unit TEXT,
            flag TEXT,  -- normal, elevated, critical
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            synced_at TEXT,
            FOREIGN KEY (patient_id) REFERENCES patients(id)
        )
    """)
    
    # ROM tracking
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS rom_measurements (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL,
            measurement_date TEXT,
            joint TEXT,  -- knee, hip, shoulder, etc.
            side TEXT,  -- left, right
            flexion REAL,
            extension REAL,
            abduction REAL,
            adduction REAL,
            internal_rotation REAL,
            external_rotation REAL,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            synced_at TEXT,
            FOREIGN KEY (patient_id) REFERENCES patients(id)
        )
    """)
    
    # Visit notes (from Orthoplan)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS visit_notes (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL,
            visit_date TEXT,
            visit_type TEXT,  -- initial, followup, preop, postop
            provider TEXT,
            transcript TEXT,
            generated_note TEXT,
            diagnoses TEXT,  -- JSON array
            cpt_codes TEXT,  -- JSON array
            icd_codes TEXT,  -- JSON array
            payer_compliance TEXT,  -- JSON object
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            synced_at TEXT,
            FOREIGN KEY (patient_id) REFERENCES patients(id)
        )
    """)
    
    # Sync log
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sync_log (
            id TEXT PRIMARY KEY,
            sync_type TEXT,  -- full, incremental
            started_at TEXT,
            completed_at TEXT,
            records_synced INTEGER,
            status TEXT,  -- success, failed, partial
            error_message TEXT
        )
    """)
    
    conn.commit()
    conn.close()
    print(f"Database initialized at {get_db_path()}")


# ==================== Patient Functions ====================

def create_patient(mrn: str, first_name: str, last_name: str, 
                   dob: str = None, sex: str = None,
                   insurance_type: str = None, insurance_id: str = None,
                   phone: str = None, email: str = None) -> str:
    """Create a new patient record. Returns patient ID."""
    conn = get_connection()
    cursor = conn.cursor()
    
    patient_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    
    cursor.execute("""
        INSERT INTO patients (id, mrn, first_name, last_name, dob, sex, 
                              insurance_type, insurance_id, phone, email, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (patient_id, mrn, first_name, last_name, dob, sex, 
          insurance_type, insurance_id, phone, email, now, now))
    
    conn.commit()
    conn.close()
    return patient_id


def get_patient_by_mrn(mrn: str) -> Optional[Dict]:
    """Get patient by MRN."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM patients WHERE mrn = ?", (mrn,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_patient_by_id(patient_id: str) -> Optional[Dict]:
    """Get patient by ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM patients WHERE id = ?", (patient_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def search_patients(query: str) -> List[Dict]:
    """Search patients by name or MRN."""
    conn = get_connection()
    cursor = conn.cursor()
    search = f"%{query}%"
    cursor.execute("""
        SELECT * FROM patients 
        WHERE mrn LIKE ? OR first_name LIKE ? OR last_name LIKE ?
        ORDER BY last_name, first_name
        LIMIT 50
    """, (search, search, search))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


# ==================== PreOp Assessment Functions ====================

def create_preop_assessment(patient_id: str, planned_procedure: str,
                            planned_surgery_date: str = None) -> str:
    """Create a new preop assessment. Returns assessment ID."""
    conn = get_connection()
    cursor = conn.cursor()
    
    assessment_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    today = date.today().isoformat()
    
    cursor.execute("""
        INSERT INTO preop_assessments (id, patient_id, assessment_date, planned_procedure,
                                        planned_surgery_date, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'in_progress', ?, ?)
    """, (assessment_id, patient_id, today, planned_procedure, planned_surgery_date, now, now))
    
    conn.commit()
    conn.close()
    return assessment_id


def update_preop_assessment(assessment_id: str, **kwargs) -> bool:
    """Update preop assessment fields."""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Build update query from kwargs
    allowed_fields = ['comorbidities', 'hcc_total_score', 'risk_score', 'workup_items',
                      'sdoh_flags', 'status', 'cleared_date', 'cleared_by', 'notes',
                      'planned_surgery_date']
    
    updates = []
    values = []
    for key, value in kwargs.items():
        if key in allowed_fields:
            updates.append(f"{key} = ?")
            # Convert lists/dicts to JSON
            if isinstance(value, (list, dict)):
                value = json.dumps(value)
            values.append(value)
    
    if not updates:
        return False
    
    updates.append("updated_at = ?")
    values.append(datetime.now().isoformat())
    values.append(assessment_id)
    
    cursor.execute(f"""
        UPDATE preop_assessments SET {', '.join(updates)} WHERE id = ?
    """, values)
    
    conn.commit()
    conn.close()
    return cursor.rowcount > 0


def get_preop_assessment(assessment_id: str) -> Optional[Dict]:
    """Get preop assessment by ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM preop_assessments WHERE id = ?", (assessment_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        result = dict(row)
        # Parse JSON fields
        for field in ['comorbidities', 'workup_items', 'sdoh_flags']:
            if result.get(field):
                try:
                    result[field] = json.loads(result[field])
                except:
                    pass
        return result
    return None


def get_patient_assessments(patient_id: str) -> List[Dict]:
    """Get all preop assessments for a patient."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM preop_assessments 
        WHERE patient_id = ? 
        ORDER BY created_at DESC
    """, (patient_id,))
    rows = cursor.fetchall()
    conn.close()
    
    results = []
    for row in rows:
        result = dict(row)
        for field in ['comorbidities', 'workup_items', 'sdoh_flags']:
            if result.get(field):
                try:
                    result[field] = json.loads(result[field])
                except:
                    pass
        results.append(result)
    return results


# ==================== Workup Item Functions ====================

def create_workup_item(assessment_id: str, patient_id: str, 
                       item_type: str, item_name: str,
                       comorbidity_id: str = None) -> str:
    """Create a workup item. Returns item ID."""
    conn = get_connection()
    cursor = conn.cursor()
    
    item_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    
    cursor.execute("""
        INSERT INTO workup_items (id, assessment_id, patient_id, comorbidity_id,
                                   item_type, item_name, ordered_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (item_id, assessment_id, patient_id, comorbidity_id, 
          item_type, item_name, date.today().isoformat(), now, now))
    
    conn.commit()
    conn.close()
    return item_id


def update_workup_item(item_id: str, **kwargs) -> bool:
    """Update workup item fields."""
    conn = get_connection()
    cursor = conn.cursor()
    
    allowed_fields = ['scheduled_date', 'completed_date', 'result', 'cleared', 'notes']
    
    updates = []
    values = []
    for key, value in kwargs.items():
        if key in allowed_fields:
            updates.append(f"{key} = ?")
            values.append(value)
    
    if not updates:
        return False
    
    updates.append("updated_at = ?")
    values.append(datetime.now().isoformat())
    values.append(item_id)
    
    cursor.execute(f"""
        UPDATE workup_items SET {', '.join(updates)} WHERE id = ?
    """, values)
    
    conn.commit()
    conn.close()
    return cursor.rowcount > 0


def get_assessment_workup_items(assessment_id: str) -> List[Dict]:
    """Get all workup items for an assessment."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM workup_items 
        WHERE assessment_id = ? 
        ORDER BY item_type, item_name
    """, (assessment_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def check_all_workup_cleared(assessment_id: str) -> bool:
    """Check if all workup items are cleared."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT COUNT(*) as total, SUM(cleared) as cleared_count
        FROM workup_items WHERE assessment_id = ?
    """, (assessment_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row and row['total'] > 0:
        return row['cleared_count'] == row['total']
    return True  # No workup items = cleared


# ==================== PROMS Functions ====================

def save_proms_score(patient_id: str, measure_type: str, score: float,
                     responses: Dict, collection_type: str,
                     assessment_id: str = None) -> str:
    """Save a PROMS score. Returns score ID."""
    conn = get_connection()
    cursor = conn.cursor()
    
    score_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    today = date.today().isoformat()
    
    cursor.execute("""
        INSERT INTO proms_scores (id, patient_id, assessment_id, measure_type, score,
                                   responses, collection_date, collection_type, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (score_id, patient_id, assessment_id, measure_type, score,
          json.dumps(responses), today, collection_type, now))
    
    conn.commit()
    conn.close()
    return score_id


def get_patient_proms(patient_id: str, measure_type: str = None) -> List[Dict]:
    """Get PROMS scores for a patient."""
    conn = get_connection()
    cursor = conn.cursor()
    
    if measure_type:
        cursor.execute("""
            SELECT * FROM proms_scores 
            WHERE patient_id = ? AND measure_type = ?
            ORDER BY collection_date DESC
        """, (patient_id, measure_type))
    else:
        cursor.execute("""
            SELECT * FROM proms_scores 
            WHERE patient_id = ?
            ORDER BY collection_date DESC
        """, (patient_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    results = []
    for row in rows:
        result = dict(row)
        if result.get('responses'):
            try:
                result['responses'] = json.loads(result['responses'])
            except:
                pass
        results.append(result)
    return results


# ==================== Post-Op Lab Functions ====================

def save_postop_lab(patient_id: str, surgery_date: str, lab_type: str,
                    collection_day: str, value: float, unit: str,
                    flag: str = None, notes: str = None) -> str:
    """Save a post-op lab result. Returns lab ID."""
    conn = get_connection()
    cursor = conn.cursor()
    
    lab_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    today = date.today().isoformat()
    
    cursor.execute("""
        INSERT INTO postop_labs (id, patient_id, surgery_date, lab_type, collection_day,
                                  collection_date, value, unit, flag, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (lab_id, patient_id, surgery_date, lab_type, collection_day,
          today, value, unit, flag, notes, now))
    
    conn.commit()
    conn.close()
    return lab_id


def get_patient_postop_labs(patient_id: str, surgery_date: str = None) -> List[Dict]:
    """Get post-op labs for a patient."""
    conn = get_connection()
    cursor = conn.cursor()
    
    if surgery_date:
        cursor.execute("""
            SELECT * FROM postop_labs 
            WHERE patient_id = ? AND surgery_date = ?
            ORDER BY collection_date
        """, (patient_id, surgery_date))
    else:
        cursor.execute("""
            SELECT * FROM postop_labs 
            WHERE patient_id = ?
            ORDER BY surgery_date DESC, collection_date
        """, (patient_id,))
    
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


# ==================== ROM Functions ====================

def save_rom_measurement(patient_id: str, joint: str, side: str,
                         flexion: float = None, extension: float = None,
                         abduction: float = None, adduction: float = None,
                         internal_rotation: float = None, external_rotation: float = None,
                         notes: str = None) -> str:
    """Save a ROM measurement. Returns measurement ID."""
    conn = get_connection()
    cursor = conn.cursor()
    
    rom_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    today = date.today().isoformat()
    
    cursor.execute("""
        INSERT INTO rom_measurements (id, patient_id, measurement_date, joint, side,
                                       flexion, extension, abduction, adduction,
                                       internal_rotation, external_rotation, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (rom_id, patient_id, today, joint, side, flexion, extension,
          abduction, adduction, internal_rotation, external_rotation, notes, now))
    
    conn.commit()
    conn.close()
    return rom_id


def get_patient_rom_history(patient_id: str, joint: str = None) -> List[Dict]:
    """Get ROM history for a patient."""
    conn = get_connection()
    cursor = conn.cursor()
    
    if joint:
        cursor.execute("""
            SELECT * FROM rom_measurements 
            WHERE patient_id = ? AND joint = ?
            ORDER BY measurement_date DESC
        """, (patient_id, joint))
    else:
        cursor.execute("""
            SELECT * FROM rom_measurements 
            WHERE patient_id = ?
            ORDER BY measurement_date DESC
        """, (patient_id,))
    
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


# ==================== Visit Note Functions ====================

def save_visit_note(patient_id: str, visit_type: str, provider: str,
                    transcript: str = None, generated_note: str = None,
                    diagnoses: List = None, cpt_codes: List = None,
                    icd_codes: List = None, payer_compliance: Dict = None) -> str:
    """Save a visit note. Returns note ID."""
    conn = get_connection()
    cursor = conn.cursor()
    
    note_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    today = date.today().isoformat()
    
    cursor.execute("""
        INSERT INTO visit_notes (id, patient_id, visit_date, visit_type, provider,
                                  transcript, generated_note, diagnoses, cpt_codes,
                                  icd_codes, payer_compliance, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (note_id, patient_id, today, visit_type, provider, transcript, generated_note,
          json.dumps(diagnoses) if diagnoses else None,
          json.dumps(cpt_codes) if cpt_codes else None,
          json.dumps(icd_codes) if icd_codes else None,
          json.dumps(payer_compliance) if payer_compliance else None, now))
    
    conn.commit()
    conn.close()
    return note_id


# ==================== Initialize on import ====================

# Auto-initialize database when module is imported
init_database()


if __name__ == "__main__":
    # Test the database
    print("Testing local database...")
    
    # Create a test patient
    patient_id = create_patient(
        mrn="TEST001",
        first_name="John",
        last_name="Doe",
        dob="1960-05-15",
        sex="M",
        insurance_type="medicare_advantage"
    )
    print(f"Created patient: {patient_id}")
    
    # Create a preop assessment
    assessment_id = create_preop_assessment(
        patient_id=patient_id,
        planned_procedure="TKA",
        planned_surgery_date="2025-03-15"
    )
    print(f"Created assessment: {assessment_id}")
    
    # Add comorbidities and workup
    update_preop_assessment(
        assessment_id,
        comorbidities=["diabetes_controlled", "obesity_class_2", "sleep_apnea"],
        hcc_total_score=0.535
    )
    
    # Create workup items
    create_workup_item(assessment_id, patient_id, "test", "HbA1c", "diabetes_controlled")
    create_workup_item(assessment_id, patient_id, "test", "Sleep Study", "sleep_apnea")
    create_workup_item(assessment_id, patient_id, "consult", "Nutrition", "obesity_class_2")
    
    # Get the assessment
    assessment = get_preop_assessment(assessment_id)
    print(f"Assessment: {json.dumps(assessment, indent=2, default=str)}")
    
    # Get workup items
    workup = get_assessment_workup_items(assessment_id)
    print(f"Workup items: {len(workup)}")
    
    print("\nDatabase test complete!")
