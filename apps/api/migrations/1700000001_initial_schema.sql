-- Initial schema for Advergent platform
-- Creates core tables for agencies, users, clients, and data sync

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Agencies table
CREATE TABLE agencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  billing_tier VARCHAR(20) NOT NULL CHECK (billing_tier IN ('starter', 'growth', 'agency')),
  client_limit INTEGER NOT NULL,
  stripe_customer_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_agencies_billing_tier ON agencies(billing_tier);
CREATE INDEX idx_agencies_stripe_customer_id ON agencies(stripe_customer_id);

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  password_algorithm VARCHAR(20) NOT NULL DEFAULT 'bcrypt',
  password_cost INTEGER NOT NULL DEFAULT 12,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_agency_id ON users(agency_id);
CREATE INDEX idx_users_email ON users(email);

-- User sessions table (for JWT revocation)
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  access_token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  refresh_token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_access_token ON user_sessions(access_token);
CREATE INDEX idx_user_sessions_refresh_token ON user_sessions(refresh_token);
CREATE INDEX idx_user_sessions_expires ON user_sessions(access_token_expires_at, refresh_token_expires_at);

-- Client accounts table
CREATE TABLE client_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  google_ads_customer_id VARCHAR(20),
  google_ads_refresh_token_encrypted TEXT,
  google_ads_refresh_token_key_version INTEGER DEFAULT 1,
  search_console_site_url VARCHAR(500),
  search_console_refresh_token_encrypted TEXT,
  search_console_refresh_token_key_version INTEGER DEFAULT 1,
  sync_frequency VARCHAR(20) DEFAULT 'daily',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_client_accounts_agency_id ON client_accounts(agency_id);
CREATE INDEX idx_client_accounts_is_active ON client_accounts(is_active);
CREATE INDEX idx_client_accounts_google_ads_customer_id ON client_accounts(google_ads_customer_id);

-- ============================================================================
-- DATA SYNC TABLES
-- ============================================================================

-- Search queries table (normalized queries with hash for deduplication)
CREATE TABLE search_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_account_id UUID NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  query_normalized TEXT NOT NULL,
  query_hash VARCHAR(32) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_search_queries_client_account_id ON search_queries(client_account_id);
CREATE INDEX idx_search_queries_hash ON search_queries(query_hash);
CREATE UNIQUE INDEX idx_search_queries_unique ON search_queries(client_account_id, query_hash);

-- Google Ads queries table
CREATE TABLE google_ads_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_account_id UUID NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  search_query_id UUID NOT NULL REFERENCES search_queries(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  cost_micros BIGINT DEFAULT 0,
  conversions DECIMAL(10,2) DEFAULT 0,
  ctr DECIMAL(5,4),
  avg_cpc_micros BIGINT,
  campaign_id VARCHAR(50),
  campaign_name VARCHAR(255),
  ad_group_id VARCHAR(50),
  ad_group_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_google_ads_queries_client ON google_ads_queries(client_account_id);
CREATE INDEX idx_google_ads_queries_search_query ON google_ads_queries(search_query_id);
CREATE INDEX idx_google_ads_queries_date ON google_ads_queries(date DESC);
CREATE UNIQUE INDEX idx_google_ads_queries_unique ON google_ads_queries(client_account_id, search_query_id, date);

-- Search Console queries table
CREATE TABLE search_console_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_account_id UUID NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  search_query_id UUID NOT NULL REFERENCES search_queries(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr DECIMAL(5,4),
  position DECIMAL(5,2),
  device VARCHAR(20),
  country VARCHAR(2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_search_console_queries_client ON search_console_queries(client_account_id);
CREATE INDEX idx_search_console_queries_search_query ON search_console_queries(search_query_id);
CREATE INDEX idx_search_console_queries_date ON search_console_queries(date DESC);
CREATE UNIQUE INDEX idx_search_console_queries_unique ON search_console_queries(client_account_id, search_query_id, date, device, country);

-- Query overlaps table (detected paid/organic overlaps)
CREATE TABLE query_overlaps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_account_id UUID NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  search_query_id UUID NOT NULL REFERENCES search_queries(id) ON DELETE CASCADE,
  overlap_detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_analyzed_at TIMESTAMP WITH TIME ZONE,
  analysis_status VARCHAR(20) DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'analyzing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_query_overlaps_client ON query_overlaps(client_account_id);
CREATE INDEX idx_query_overlaps_search_query ON query_overlaps(search_query_id);
CREATE INDEX idx_query_overlaps_status ON query_overlaps(analysis_status);
CREATE UNIQUE INDEX idx_query_overlaps_unique ON query_overlaps(client_account_id, search_query_id);

-- ============================================================================
-- RECOMMENDATIONS & COMPETITORS
-- ============================================================================

-- Recommendations table
CREATE TABLE recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_account_id UUID NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  query_overlap_id UUID NOT NULL REFERENCES query_overlaps(id) ON DELETE CASCADE,
  recommendation_type VARCHAR(20) NOT NULL CHECK (recommendation_type IN ('reduce', 'pause', 'increase', 'maintain')),
  confidence_level VARCHAR(10) NOT NULL CHECK (confidence_level IN ('high', 'medium', 'low')),
  current_monthly_spend DECIMAL(12,2),
  recommended_monthly_spend DECIMAL(12,2),
  estimated_monthly_savings DECIMAL(12,2),
  reasoning TEXT NOT NULL,
  key_factors TEXT[],
  encrypted_snapshot TEXT,
  encrypted_snapshot_key_version INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'applied')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  applied_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_recommendations_client ON recommendations(client_account_id);
CREATE INDEX idx_recommendations_overlap ON recommendations(query_overlap_id);
CREATE INDEX idx_recommendations_status ON recommendations(status);
CREATE INDEX idx_recommendations_type ON recommendations(recommendation_type);
CREATE INDEX idx_recommendations_confidence ON recommendations(confidence_level);

-- Competitors table
CREATE TABLE competitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_account_id UUID NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  competitor_domain VARCHAR(255) NOT NULL,
  detected_via VARCHAR(50) DEFAULT 'auction_insights',
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_competitors_client ON competitors(client_account_id);
CREATE INDEX idx_competitors_domain ON competitors(competitor_domain);
CREATE INDEX idx_competitors_is_active ON competitors(is_active);
CREATE UNIQUE INDEX idx_competitors_unique ON competitors(client_account_id, competitor_domain);

-- Competitor metrics table (time-series data)
CREATE TABLE competitor_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impression_share DECIMAL(5,2),
  overlap_rate DECIMAL(5,2),
  position_above_rate DECIMAL(5,2),
  top_of_page_rate DECIMAL(5,2),
  outranking_share DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_competitor_metrics_competitor ON competitor_metrics(competitor_id);
CREATE INDEX idx_competitor_metrics_date ON competitor_metrics(date DESC);
CREATE UNIQUE INDEX idx_competitor_metrics_unique ON competitor_metrics(competitor_id, date);

-- ============================================================================
-- JOB TRACKING
-- ============================================================================

-- Sync jobs table
CREATE TABLE sync_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_account_id UUID NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('google_ads_sync', 'search_console_sync', 'full_sync')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  records_processed INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sync_jobs_client ON sync_jobs(client_account_id);
CREATE INDEX idx_sync_jobs_status ON sync_jobs(status);
CREATE INDEX idx_sync_jobs_created_at ON sync_jobs(created_at DESC);

-- Analysis jobs table
CREATE TABLE analysis_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query_overlap_id UUID NOT NULL REFERENCES query_overlaps(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  ai_tokens_used INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_analysis_jobs_overlap ON analysis_jobs(query_overlap_id);
CREATE INDEX idx_analysis_jobs_status ON analysis_jobs(status);
CREATE INDEX idx_analysis_jobs_created_at ON analysis_jobs(created_at DESC);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_agencies_updated_at BEFORE UPDATE ON agencies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_accounts_updated_at BEFORE UPDATE ON client_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
