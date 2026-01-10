-- =====================================================
-- SRO INTELLIGENCE - COMPLETE ANALYTICS SCHEMA
-- Run this entire script in Supabase SQL Editor
-- =====================================================

-- 1. ADD MISSING COLUMNS TO CHECKINS
-- =====================================================
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS rom_knee INTEGER;
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS rom_hip INTEGER;
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS swelling_level INTEGER;
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS sleep_quality INTEGER;
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS walking_distance VARCHAR(50);
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS assistive_device VARCHAR(50);
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS completed_exercises BOOLEAN;
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS exercise_duration INTEGER;
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS temperature DECIMAL(4,1);
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS wound_issues BOOLEAN;
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS wound_notes TEXT;
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- 2. OPTION A: MATERIALIZED VIEW (Auto-aggregates, refresh manually or on schedule)
-- =====================================================
DROP MATERIALIZED VIEW IF EXISTS episode_analytics;

CREATE MATERIALIZED VIEW episode_analytics AS
SELECT 
  e.id as episode_id,
  e.clinic_id,
  e.patient_id,
  p.first_name,
  p.last_name,
  e.procedure_type,
  e.procedure_side,
  e.procedure_date,
  e.status,
  
  -- Days since surgery
  EXTRACT(DAY FROM NOW() - e.procedure_date)::INTEGER as days_post_op,
  
  -- Check-in counts
  COUNT(c.id) as total_checkins,
  COUNT(CASE WHEN c.created_at > NOW() - INTERVAL '7 days' THEN 1 END) as checkins_last_7_days,
  COUNT(CASE WHEN c.created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as checkins_last_24h,
  
  -- Pain metrics
  AVG(c.pain_level)::DECIMAL(3,1) as avg_pain_all_time,
  AVG(CASE WHEN c.created_at > NOW() - INTERVAL '7 days' THEN c.pain_level END)::DECIMAL(3,1) as avg_pain_7_days,
  MAX(c.pain_level) as max_pain,
  MIN(c.pain_level) as min_pain,
  
  -- Latest pain
  (SELECT pain_level FROM checkins WHERE episode_id = e.id ORDER BY created_at DESC LIMIT 1) as latest_pain,
  
  -- Medication metrics
  SUM(c.pill_count) as total_pills,
  AVG(c.pill_count)::DECIMAL(3,1) as avg_pills_per_day,
  SUM(CASE WHEN c.created_at > NOW() - INTERVAL '7 days' THEN c.pill_count ELSE 0 END) as pills_last_7_days,
  
  -- PT Compliance (numerator / denominator)
  SUM(CASE WHEN c.did_pt = true THEN 1 ELSE 0 END) as pt_completed_count,
  COUNT(c.id) as pt_total_opportunities,
  CASE 
    WHEN COUNT(c.id) > 0 
    THEN (SUM(CASE WHEN c.did_pt = true THEN 1 ELSE 0 END)::DECIMAL / COUNT(c.id) * 100)::DECIMAL(5,2)
    ELSE 0 
  END as pt_compliance_pct,
  
  -- ROM metrics
  AVG(c.rom_knee)::DECIMAL(4,1) as avg_rom_knee,
  MAX(c.rom_knee) as max_rom_knee,
  AVG(c.rom_hip)::DECIMAL(4,1) as avg_rom_hip,
  MAX(c.rom_hip) as max_rom_hip,
  
  -- Latest ROM
  (SELECT rom_knee FROM checkins WHERE episode_id = e.id AND rom_knee IS NOT NULL ORDER BY created_at DESC LIMIT 1) as latest_rom_knee,
  (SELECT rom_hip FROM checkins WHERE episode_id = e.id AND rom_hip IS NOT NULL ORDER BY created_at DESC LIMIT 1) as latest_rom_hip,
  
  -- Concerns
  COUNT(CASE WHEN c.concerns IS NOT NULL AND c.concerns != '' THEN 1 END) as total_concerns,
  (SELECT concerns FROM checkins WHERE episode_id = e.id AND concerns IS NOT NULL ORDER BY created_at DESC LIMIT 1) as latest_concern,
  
  -- Timestamps
  MIN(c.created_at) as first_checkin,
  MAX(c.created_at) as last_checkin,
  
  -- Flag calculation
  CASE
    WHEN (SELECT pain_level FROM checkins WHERE episode_id = e.id ORDER BY created_at DESC LIMIT 1) >= 7 THEN 'red'
    WHEN (SELECT concerns FROM checkins WHERE episode_id = e.id ORDER BY created_at DESC LIMIT 1) IS NOT NULL THEN 'red'
    WHEN AVG(c.pill_count) >= 5 THEN 'yellow'
    WHEN (SUM(CASE WHEN c.did_pt = true THEN 1 ELSE 0 END)::DECIMAL / NULLIF(COUNT(c.id), 0) * 100) < 70 THEN 'yellow'
    ELSE 'green'
  END as flag_status

FROM episodes e
JOIN patients p ON e.patient_id = p.id
LEFT JOIN checkins c ON e.id = c.episode_id
WHERE e.status = 'active'
GROUP BY e.id, e.clinic_id, e.patient_id, p.first_name, p.last_name, 
         e.procedure_type, e.procedure_side, e.procedure_date, e.status;

-- Create index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_episode_analytics_episode ON episode_analytics(episode_id);

-- 3. OPTION B: ANALYTICS TABLE (Updated on each checkin via trigger)
-- =====================================================
CREATE TABLE IF NOT EXISTS episode_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID REFERENCES episodes(id) UNIQUE,
  clinic_id UUID REFERENCES clinics(id),
  patient_id UUID REFERENCES patients(id),
  
  -- Counts (raw denominators)
  total_checkins INTEGER DEFAULT 0,
  checkins_last_7_days INTEGER DEFAULT 0,
  
  -- Pain (raw data for calculations)
  pain_sum INTEGER DEFAULT 0,
  avg_pain DECIMAL(3,1),
  latest_pain INTEGER,
  max_pain INTEGER,
  
  -- Medication (raw numerators)
  total_pills INTEGER DEFAULT 0,
  pills_last_7_days INTEGER DEFAULT 0,
  avg_pills_per_day DECIMAL(3,1),
  
  -- PT Compliance (numerator & denominator)
  pt_completed_count INTEGER DEFAULT 0,
  pt_total_opportunities INTEGER DEFAULT 0,
  pt_compliance_pct DECIMAL(5,2),
  
  -- ROM
  latest_rom_knee INTEGER,
  max_rom_knee INTEGER,
  latest_rom_hip INTEGER,
  max_rom_hip INTEGER,
  
  -- Concerns
  total_concerns INTEGER DEFAULT 0,
  latest_concern TEXT,
  has_active_concern BOOLEAN DEFAULT false,
  
  -- Status
  flag_status VARCHAR(10) DEFAULT 'green',
  days_post_op INTEGER,
  
  -- Timestamps
  first_checkin TIMESTAMP,
  last_checkin TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- RLS for episode_stats
ALTER TABLE episode_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read episode_stats" ON episode_stats FOR SELECT USING (true);
CREATE POLICY "Allow public insert episode_stats" ON episode_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update episode_stats" ON episode_stats FOR UPDATE USING (true);

-- 4. FUNCTION TO UPDATE STATS AFTER CHECKIN
-- =====================================================
CREATE OR REPLACE FUNCTION update_episode_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_total_checkins INTEGER;
  v_pain_sum INTEGER;
  v_total_pills INTEGER;
  v_pt_completed INTEGER;
  v_total_concerns INTEGER;
  v_procedure_date DATE;
BEGIN
  -- Get procedure date
  SELECT procedure_date INTO v_procedure_date FROM episodes WHERE id = NEW.episode_id;
  
  -- Calculate aggregates
  SELECT 
    COUNT(*),
    COALESCE(SUM(pain_level), 0),
    COALESCE(SUM(pill_count), 0),
    SUM(CASE WHEN did_pt = true THEN 1 ELSE 0 END),
    COUNT(CASE WHEN concerns IS NOT NULL AND concerns != '' THEN 1 END)
  INTO v_total_checkins, v_pain_sum, v_total_pills, v_pt_completed, v_total_concerns
  FROM checkins
  WHERE episode_id = NEW.episode_id;
  
  -- Upsert stats
  INSERT INTO episode_stats (
    episode_id, clinic_id, patient_id,
    total_checkins, pain_sum, avg_pain, latest_pain, max_pain,
    total_pills, avg_pills_per_day,
    pt_completed_count, pt_total_opportunities, pt_compliance_pct,
    latest_rom_knee, latest_rom_hip,
    total_concerns, latest_concern, has_active_concern,
    flag_status, days_post_op, first_checkin, last_checkin, updated_at
  )
  VALUES (
    NEW.episode_id, NEW.clinic_id, NEW.patient_id,
    v_total_checkins,
    v_pain_sum,
    CASE WHEN v_total_checkins > 0 THEN v_pain_sum::DECIMAL / v_total_checkins ELSE 0 END,
    NEW.pain_level,
    (SELECT MAX(pain_level) FROM checkins WHERE episode_id = NEW.episode_id),
    v_total_pills,
    CASE WHEN v_total_checkins > 0 THEN v_total_pills::DECIMAL / v_total_checkins ELSE 0 END,
    v_pt_completed,
    v_total_checkins,
    CASE WHEN v_total_checkins > 0 THEN (v_pt_completed::DECIMAL / v_total_checkins * 100) ELSE 0 END,
    NEW.rom_knee,
    NEW.rom_hip,
    v_total_concerns,
    NEW.concerns,
    NEW.concerns IS NOT NULL AND NEW.concerns != '',
    CASE 
      WHEN NEW.pain_level >= 7 OR (NEW.concerns IS NOT NULL AND NEW.concerns != '') THEN 'red'
      WHEN NEW.pill_count >= 5 THEN 'yellow'
      WHEN v_pt_completed::DECIMAL / NULLIF(v_total_checkins, 0) < 0.7 THEN 'yellow'
      ELSE 'green'
    END,
    EXTRACT(DAY FROM NOW() - v_procedure_date)::INTEGER,
    (SELECT MIN(created_at) FROM checkins WHERE episode_id = NEW.episode_id),
    NOW(),
    NOW()
  )
  ON CONFLICT (episode_id) DO UPDATE SET
    total_checkins = EXCLUDED.total_checkins,
    pain_sum = EXCLUDED.pain_sum,
    avg_pain = EXCLUDED.avg_pain,
    latest_pain = EXCLUDED.latest_pain,
    max_pain = EXCLUDED.max_pain,
    total_pills = EXCLUDED.total_pills,
    avg_pills_per_day = EXCLUDED.avg_pills_per_day,
    pt_completed_count = EXCLUDED.pt_completed_count,
    pt_total_opportunities = EXCLUDED.pt_total_opportunities,
    pt_compliance_pct = EXCLUDED.pt_compliance_pct,
    latest_rom_knee = COALESCE(EXCLUDED.latest_rom_knee, episode_stats.latest_rom_knee),
    latest_rom_hip = COALESCE(EXCLUDED.latest_rom_hip, episode_stats.latest_rom_hip),
    total_concerns = EXCLUDED.total_concerns,
    latest_concern = EXCLUDED.latest_concern,
    has_active_concern = EXCLUDED.has_active_concern,
    flag_status = EXCLUDED.flag_status,
    days_post_op = EXCLUDED.days_post_op,
    last_checkin = EXCLUDED.last_checkin,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. TRIGGER TO AUTO-UPDATE STATS
-- =====================================================
DROP TRIGGER IF EXISTS trigger_update_episode_stats ON checkins;
CREATE TRIGGER trigger_update_episode_stats
  AFTER INSERT ON checkins
  FOR EACH ROW
  EXECUTE FUNCTION update_episode_stats();

-- 6. CLINIC-LEVEL ANALYTICS VIEW (for payer reports)
-- =====================================================
DROP VIEW IF EXISTS clinic_analytics;

CREATE VIEW clinic_analytics AS
SELECT 
  c.id as clinic_id,
  c.name as clinic_name,
  
  -- Patient counts
  COUNT(DISTINCT e.id) as total_active_episodes,
  COUNT(DISTINCT CASE WHEN e.procedure_type = 'TKA' THEN e.id END) as tka_count,
  COUNT(DISTINCT CASE WHEN e.procedure_type = 'THA' THEN e.id END) as tha_count,
  
  -- Check-in compliance
  COUNT(ch.id) as total_checkins,
  COUNT(DISTINCT ch.patient_id) as patients_with_checkins,
  
  -- Pain metrics (for CMS reporting)
  AVG(ch.pain_level)::DECIMAL(3,1) as clinic_avg_pain,
  
  -- PT Compliance (numerator/denominator for payers)
  SUM(CASE WHEN ch.did_pt = true THEN 1 ELSE 0 END) as pt_sessions_completed,
  COUNT(ch.id) as pt_sessions_expected,
  CASE 
    WHEN COUNT(ch.id) > 0 
    THEN (SUM(CASE WHEN ch.did_pt = true THEN 1 ELSE 0 END)::DECIMAL / COUNT(ch.id) * 100)::DECIMAL(5,2)
    ELSE 0 
  END as clinic_pt_compliance_pct,
  
  -- Medication totals
  SUM(ch.pill_count) as total_pills_prescribed,
  AVG(ch.pill_count)::DECIMAL(3,1) as avg_pills_per_checkin,
  
  -- Flag distribution
  COUNT(CASE WHEN es.flag_status = 'green' THEN 1 END) as green_count,
  COUNT(CASE WHEN es.flag_status = 'yellow' THEN 1 END) as yellow_count,
  COUNT(CASE WHEN es.flag_status = 'red' THEN 1 END) as red_count,
  
  -- Concern rate
  COUNT(CASE WHEN ch.concerns IS NOT NULL THEN 1 END) as total_concerns_reported

FROM clinics c
LEFT JOIN episodes e ON c.id = e.clinic_id AND e.status = 'active'
LEFT JOIN checkins ch ON e.id = ch.episode_id
LEFT JOIN episode_stats es ON e.id = es.episode_id
GROUP BY c.id, c.name;

-- 7. REFRESH FUNCTION FOR MATERIALIZED VIEW
-- =====================================================
CREATE OR REPLACE FUNCTION refresh_episode_analytics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW episode_analytics;
END;
$$ LANGUAGE plpgsql;

-- 8. INITIAL DATA POPULATION
-- =====================================================
-- Refresh the materialized view
REFRESH MATERIALIZED VIEW episode_analytics;

-- Populate episode_stats for existing data
INSERT INTO episode_stats (episode_id, clinic_id, patient_id, days_post_op, updated_at)
SELECT e.id, e.clinic_id, e.patient_id, 
       EXTRACT(DAY FROM NOW() - e.procedure_date)::INTEGER,
       NOW()
FROM episodes e
WHERE e.status = 'active'
ON CONFLICT (episode_id) DO NOTHING;

-- Done!
SELECT 'Analytics schema created successfully!' as status;
