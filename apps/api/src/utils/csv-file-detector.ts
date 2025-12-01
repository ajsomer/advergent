export type GoogleAdsReportType =
  | 'google_ads_searches'
  | 'google_ads_keywords'
  | 'auction_insights'
  | 'campaigns'
  | 'devices'
  | 'time_series'
  | 'skip';

export interface FileDetectionResult {
  type: GoogleAdsReportType;
  tier: 1 | 2 | 3;
  shouldStore: boolean;
  description: string;
}

const GOOGLE_ADS_PATTERNS: Array<{ pattern: RegExp; result: FileDetectionResult }> = [
  // Tier 1: Essential
  {
    pattern: /^Searches?\(Search_/i,
    result: { type: 'google_ads_searches', tier: 1, shouldStore: true, description: 'Search Terms' },
  },
  {
    pattern: /^Search_keywords\(/i,
    result: { type: 'google_ads_keywords', tier: 1, shouldStore: true, description: 'Keywords' },
  },
  {
    pattern: /^Auction_insights\(Compare/i,
    result: { type: 'auction_insights', tier: 1, shouldStore: true, description: 'Auction Insights' },
  },

  // Tier 2: Contextual
  {
    pattern: /^Campaigns\(/i,
    result: { type: 'campaigns', tier: 2, shouldStore: true, description: 'Campaigns' },
  },
  {
    pattern: /^Devices\(/i,
    result: { type: 'devices', tier: 2, shouldStore: true, description: 'Devices' },
  },
  {
    pattern: /^Time_series\(/i,
    result: { type: 'time_series', tier: 2, shouldStore: true, description: 'Daily Trends' },
  },

  // Tier 3: Skip
  {
    pattern: /^Searches?\(Word_/i,
    result: { type: 'skip', tier: 3, shouldStore: false, description: 'Word Analysis' },
  },
  {
    pattern: /^Demographics\(/i,
    result: { type: 'skip', tier: 3, shouldStore: false, description: 'Demographics' },
  },
  {
    pattern: /^Day_&_hour\(/i,
    result: { type: 'skip', tier: 3, shouldStore: false, description: 'Day & Hour' },
  },
  {
    pattern: /^Networks\(/i,
    result: { type: 'skip', tier: 3, shouldStore: false, description: 'Networks' },
  },
  {
    pattern: /^Biggest_changes\(/i,
    result: { type: 'skip', tier: 3, shouldStore: false, description: 'Biggest Changes' },
  },
  {
    pattern: /^Optimisation_score\(/i,
    result: { type: 'skip', tier: 3, shouldStore: false, description: 'Optimisation Score' },
  },
  {
    pattern: /^Auction_insights\(Metric/i,
    result: { type: 'skip', tier: 3, shouldStore: false, description: 'Auction Trends' },
  },
];

/**
 * Detect the type of Google Ads report from filename
 */
export function detectGoogleAdsReportType(filename: string): FileDetectionResult | null {
  for (const { pattern, result } of GOOGLE_ADS_PATTERNS) {
    if (pattern.test(filename)) {
      return result;
    }
  }
  return null;
}

/**
 * Parse date range from filename
 * Format: Searches(Search_2025.11.01-2025.11.30).csv
 */
export function parseDateRangeFromFilename(filename: string): { start: string; end: string } | null {
  const match = filename.match(/(\d{4}\.\d{2}\.\d{2})-(\d{4}\.\d{2}\.\d{2})/);
  if (!match) return null;

  // Convert 2025.11.01 to 2025-11-01
  const start = match[1].replace(/\./g, '-');
  const end = match[2].replace(/\./g, '-');

  return { start, end };
}
