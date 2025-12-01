export interface ColumnMapping {
  [csvColumn: string]: string;
}

// ============================================================================
// TIER 1: ESSENTIAL
// ============================================================================

export const GOOGLE_ADS_SEARCHES_COLUMNS: ColumnMapping = {
  'Search': 'queryText',
  'Search term': 'queryText',
  'Search Term': 'queryText',
  'Cost': 'cost',
  'Clicks': 'clicks',
  'Impressions': 'impressions',
  'Impr.': 'impressions',
  'Conversions': 'conversions',
  'Conv.': 'conversions',
  'Day': 'date',
  'Date': 'date',
};

export const GOOGLE_ADS_KEYWORDS_COLUMNS: ColumnMapping = {
  'Search Keyword': 'queryText',
  'Keyword': 'queryText',
  'Match type': 'matchType',
  'Match Type': 'matchType',
  'Criterion Status': 'criterionStatus',
  'Status': 'criterionStatus',
  'Campaign Status': 'campaignStatus',
  'Ad Group Status': 'adGroupStatus',
  'Cost': 'cost',
  'Clicks': 'clicks',
  'CTR': 'ctr',
  'Impressions': 'impressions',
  'Impr.': 'impressions',
};

export const AUCTION_INSIGHTS_COLUMNS: ColumnMapping = {
  // Competitor identification
  'Advertiser Name': 'competitorDomain',
  'Advertiser': 'competitorDomain',
  'Display URL domain': 'competitorDomain',
  // Segment columns (keyword-level granularity)
  'Campaign Name': 'campaignName',
  'Campaign': 'campaignName',
  'Ad Group Name': 'adGroupName',
  'Ad Group': 'adGroupName',
  'Keyword': 'keyword',
  'Match type': 'keywordMatchType',
  'Match Type': 'keywordMatchType',
  // Core metrics
  'Impression share': 'impressionShare',
  'Search impr. share': 'impressionShare',
  'Search lost IS (rank)': 'lostImpressionShareRank',
  'Search lost IS (budget)': 'lostImpressionShareBudget',
  // Additional competitive metrics
  'Outranking share': 'outrankingShare',
  'Overlap rate': 'overlapRate',
  'Top of page rate': 'topOfPageRate',
  'Position above rate': 'positionAboveRate',
  'Abs. top of page rate': 'absTopOfPageRate',
  // Comparison columns (optional, for trend analysis)
  'Impression share (Comparison)': 'impressionShareComparison',
  'Outranking share (Comparison)': 'outrankingShareComparison',
  'Overlap rate (Comparison)': 'overlapRateComparison',
  'Top of page rate (Comparison)': 'topOfPageRateComparison',
  'Position above rate (Comparison)': 'positionAboveRateComparison',
};

// ============================================================================
// TIER 2: CONTEXTUAL
// ============================================================================

export const CAMPAIGNS_COLUMNS: ColumnMapping = {
  'Campaign Name': 'campaignName',
  'Campaign': 'campaignName',
  'Campaign Group Name': 'campaignGroupName',
  'Campaign Status': 'campaignStatus',
  'Status': 'campaignStatus',
  'Cost': 'cost',
  'Clicks': 'clicks',
  'Impressions': 'impressions',
  'CTR': 'ctr',
};

export const DEVICES_COLUMNS: ColumnMapping = {
  'Device': 'device',
  'Cost': 'cost',
  'Clicks': 'clicks',
  'Impressions': 'impressions',
};

export const TIME_SERIES_COLUMNS: ColumnMapping = {
  'Date': 'date',
  'Day': 'date',
  'Clicks': 'clicks',
  'Impressions': 'impressions',
  'Cost': 'cost',
  'Avg. CPC': 'avgCpc',
  'Average CPC': 'avgCpc',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Normalize a CSV header to our internal field name
 */
export function normalizeColumnName(header: string, mapping: ColumnMapping): string {
  const trimmed = header.trim();
  return mapping[trimmed] || trimmed.toLowerCase().replace(/\s+/g, '_');
}

/**
 * Parse currency string to number (removes $ and commas)
 * "$1,234.56" → 1234.56
 */
export function parseCurrency(value: string | undefined): number {
  if (!value) return 0;
  return parseFloat(value.replace(/[$,]/g, '')) || 0;
}

/**
 * Parse currency to micros (Google Ads uses micros for currency)
 * "$1,234.56" → 1234560000
 */
export function parseCurrencyToMicros(value: string | undefined): number {
  return Math.round(parseCurrency(value) * 1_000_000);
}

/**
 * Parse percentage string to number
 * "8.57%" → 8.57 (or 0.0857 if asDecimal=true)
 */
export function parsePercentage(value: string | undefined, asDecimal: boolean = false): number | null {
  if (!value || value === 'No data') return null;

  // Handle "< 10%" type values
  if (value.includes('<')) return null;

  const num = parseFloat(value.replace('%', ''));
  if (isNaN(num)) return null;

  return asDecimal ? num / 100 : num;
}

/**
 * Check if a percentage value is "< X%" (below threshold)
 */
export function isBelowThreshold(value: string | undefined): boolean {
  return !!value && value.includes('<');
}

/**
 * Parse date from various formats
 * "Sat, 1 Nov 2025" → "2025-11-01"
 * "2025.11.01" → "2025-11-01"
 */
export function parseDate(value: string | undefined): string | null {
  if (!value) return null;

  // Try parsing "Sat, 1 Nov 2025" format
  const longMatch = value.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (longMatch) {
    const [, day, monthName, year] = longMatch;
    const months: Record<string, string> = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
      'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
      'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12',
    };
    const month = months[monthName];
    if (month) {
      return `${year}-${month}-${day.padStart(2, '0')}`;
    }
  }

  // Try parsing "2025.11.01" format
  const dotMatch = value.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  if (dotMatch) {
    const [, year, month, day] = dotMatch;
    return `${year}-${month}-${day}`;
  }

  // Try parsing ISO format "2025-11-01"
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return null;
}

/**
 * Parse integer with comma separators
 * "11,423" → 11423
 */
export function parseInteger(value: string | undefined): number {
  if (!value) return 0;
  return parseInt(value.replace(/,/g, ''), 10) || 0;
}
