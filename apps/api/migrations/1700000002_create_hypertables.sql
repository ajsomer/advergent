-- Create Timescale hypertables for time-series data
-- This optimizes storage and queries for time-series metrics

-- Convert competitor_metrics to hypertable
SELECT create_hypertable(
  'competitor_metrics',
  'date',
  if_not_exists => TRUE,
  migrate_data => TRUE
);

-- Convert google_ads_queries to hypertable
SELECT create_hypertable(
  'google_ads_queries',
  'date',
  if_not_exists => TRUE,
  migrate_data => TRUE
);

-- Convert search_console_queries to hypertable
SELECT create_hypertable(
  'search_console_queries',
  'date',
  if_not_exists => TRUE,
  migrate_data => TRUE
);

-- Add retention policies (optional - keeps last 13 months of data)
SELECT add_retention_policy('competitor_metrics', INTERVAL '13 months', if_not_exists => TRUE);
SELECT add_retention_policy('google_ads_queries', INTERVAL '13 months', if_not_exists => TRUE);
SELECT add_retention_policy('search_console_queries', INTERVAL '13 months', if_not_exists => TRUE);

-- Create continuous aggregates for daily rollups (improves query performance)
CREATE MATERIALIZED VIEW IF NOT EXISTS google_ads_daily_summary
WITH (timescaledb.continuous) AS
SELECT
  client_account_id,
  search_query_id,
  time_bucket('1 day', date) AS bucket,
  SUM(impressions) AS total_impressions,
  SUM(clicks) AS total_clicks,
  SUM(cost_micros) AS total_cost_micros,
  SUM(conversions) AS total_conversions,
  AVG(ctr) AS avg_ctr,
  AVG(avg_cpc_micros) AS avg_cpc_micros
FROM google_ads_queries
GROUP BY client_account_id, search_query_id, bucket
WITH NO DATA;

CREATE MATERIALIZED VIEW IF NOT EXISTS search_console_daily_summary
WITH (timescaledb.continuous) AS
SELECT
  client_account_id,
  search_query_id,
  time_bucket('1 day', date) AS bucket,
  SUM(impressions) AS total_impressions,
  SUM(clicks) AS total_clicks,
  AVG(ctr) AS avg_ctr,
  AVG(position) AS avg_position
FROM search_console_queries
GROUP BY client_account_id, search_query_id, bucket
WITH NO DATA;

-- Add refresh policies for continuous aggregates
SELECT add_continuous_aggregate_policy('google_ads_daily_summary',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

SELECT add_continuous_aggregate_policy('search_console_daily_summary',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);
