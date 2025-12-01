-- Phase 4: Interplay Reports Multi-Agent System
-- This migration creates the interplay_reports table and extends recommendations

-- Create enums for interplay reports
CREATE TYPE report_trigger AS ENUM ('client_creation', 'manual', 'scheduled');
CREATE TYPE report_status AS ENUM ('pending', 'researching', 'analyzing', 'completed', 'failed');
CREATE TYPE recommendation_source AS ENUM ('legacy', 'interplay_report');
CREATE TYPE recommendation_category AS ENUM ('sem', 'seo', 'hybrid');
CREATE TYPE impact_level AS ENUM ('high', 'medium', 'low');
CREATE TYPE effort_level AS ENUM ('high', 'medium', 'low');

-- Create interplay_reports table
CREATE TABLE interplay_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id UUID NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  trigger_type report_trigger NOT NULL,
  status report_status NOT NULL DEFAULT 'pending',

  -- Date range analyzed
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  date_range_days INTEGER NOT NULL DEFAULT 30,

  -- Phase outputs (stored as encrypted JSON)
  scout_findings_encrypted TEXT,
  researcher_data_encrypted TEXT,
  sem_agent_output_encrypted TEXT,
  seo_agent_output_encrypted TEXT,
  director_output_encrypted TEXT,

  -- Final output
  executive_summary_encrypted TEXT,
  unified_recommendations_encrypted TEXT,

  -- Metadata
  tokens_used INTEGER,
  processing_time_ms INTEGER,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_interplay_reports_client ON interplay_reports(client_account_id);
CREATE INDEX idx_interplay_reports_status ON interplay_reports(status);
CREATE INDEX idx_interplay_reports_created ON interplay_reports(created_at);

-- Extend recommendations table for interplay reports
ALTER TABLE recommendations
  ADD COLUMN source recommendation_source DEFAULT 'legacy',
  ADD COLUMN interplay_report_id UUID REFERENCES interplay_reports(id) ON DELETE SET NULL,
  ADD COLUMN recommendation_category recommendation_category,
  ADD COLUMN title VARCHAR(255),
  ADD COLUMN impact_level impact_level,
  ADD COLUMN effort_level effort_level,
  ADD COLUMN action_items TEXT[];

-- Make query_overlap_id nullable for interplay recommendations
ALTER TABLE recommendations
  ALTER COLUMN query_overlap_id DROP NOT NULL;

CREATE INDEX idx_recommendations_interplay_report ON recommendations(interplay_report_id);
CREATE INDEX idx_recommendations_source ON recommendations(source);
