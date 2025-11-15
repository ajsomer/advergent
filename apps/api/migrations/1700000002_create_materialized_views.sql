-- Create materialized views for daily aggregations
-- These provide query performance benefits similar to Timescale hypertables
-- without requiring the Timescale extension

-- Google Ads daily summary
CREATE MATERIALIZED VIEW IF NOT EXISTS google_ads_daily_summary AS
SELECT
  client_account_id,
  search_query_id,
  date,
  SUM(impressions) AS total_impressions,
  SUM(clicks) AS total_clicks,
  SUM(cost_micros) AS total_cost_micros,
  SUM(conversions) AS total_conversions,
  AVG(ctr) AS avg_ctr,
  AVG(avg_cpc_micros) AS avg_cpc_micros
FROM google_ads_queries
GROUP BY client_account_id, search_query_id, date;

-- Search Console daily summary
CREATE MATERIALIZED VIEW IF NOT EXISTS search_console_daily_summary AS
SELECT
  client_account_id,
  search_query_id,
  date,
  SUM(impressions) AS total_impressions,
  SUM(clicks) AS total_clicks,
  AVG(ctr) AS avg_ctr,
  AVG(position) AS avg_position
FROM search_console_queries
GROUP BY client_account_id, search_query_id, date;

-- Create indexes on materialized views for faster queries
CREATE INDEX IF NOT EXISTS idx_google_ads_summary_client ON google_ads_daily_summary(client_account_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_summary_query ON google_ads_daily_summary(search_query_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_summary_date ON google_ads_daily_summary(date DESC);

CREATE INDEX IF NOT EXISTS idx_search_console_summary_client ON search_console_daily_summary(client_account_id);
CREATE INDEX IF NOT EXISTS idx_search_console_summary_query ON search_console_daily_summary(search_query_id);
CREATE INDEX IF NOT EXISTS idx_search_console_summary_date ON search_console_daily_summary(date DESC);

-- Add comments for documentation
COMMENT ON MATERIALIZED VIEW google_ads_daily_summary IS 'Daily aggregated Google Ads metrics per query. Refresh periodically for up-to-date data.';
COMMENT ON MATERIALIZED VIEW search_console_daily_summary IS 'Daily aggregated Search Console metrics per query. Refresh periodically for up-to-date data.';
