/**
 * Data Constructor - Fetches and merges data from multiple sources
 */

import { db } from '@/db/index.js';
import {
  googleAdsQueries,
  searchConsoleQueries,
  searchQueries,
  ga4LandingPageMetrics,
} from '@/db/schema.js';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { logger } from '@/utils/logger.js';
import type { InterplayData, InterplayQueryData } from '../types.js';

const dataLogger = logger.child({ module: 'data-constructor' });

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;
}

/**
 * Constructs InterplayData by fetching from database
 */
export async function constructInterplayDataFromDb(
  clientAccountId: string,
  dateRange: DateRange
): Promise<InterplayData> {
  dataLogger.info({ clientAccountId, dateRange }, 'Constructing interplay data');

  // Fetch data in parallel
  const [googleAdsData, searchConsoleData, ga4Data] = await Promise.all([
    fetchGoogleAdsData(clientAccountId, dateRange),
    fetchSearchConsoleData(clientAccountId, dateRange),
    fetchGA4Data(clientAccountId, dateRange),
  ]);

  dataLogger.info(
    {
      googleAdsCount: googleAdsData.length,
      searchConsoleCount: searchConsoleData.length,
      ga4Count: ga4Data.length,
    },
    'Fetched raw data'
  );

  // Merge into InterplayData
  return mergeData(googleAdsData, searchConsoleData, ga4Data);
}

// ============================================================================
// DATA FETCHING
// ============================================================================

interface GoogleAdsRow {
  queryText: string;
  impressions: number | null;
  clicks: number | null;
  costMicros: number | null;
  conversions: string | null;
}

async function fetchGoogleAdsData(
  clientAccountId: string,
  dateRange: DateRange
): Promise<GoogleAdsRow[]> {
  const results = await db
    .select({
      queryText: searchQueries.queryText,
      impressions: googleAdsQueries.impressions,
      clicks: googleAdsQueries.clicks,
      costMicros: googleAdsQueries.costMicros,
      conversions: googleAdsQueries.conversions,
    })
    .from(googleAdsQueries)
    .innerJoin(searchQueries, eq(googleAdsQueries.searchQueryId, searchQueries.id))
    .where(
      and(
        eq(googleAdsQueries.clientAccountId, clientAccountId),
        gte(googleAdsQueries.date, dateRange.start),
        lte(googleAdsQueries.date, dateRange.end)
      )
    );

  return results;
}

interface SearchConsoleRow {
  queryText: string;
  page: string | null;
  clicks: number | null;
  impressions: number | null;
  ctr: string | null;
  position: string | null;
}

async function fetchSearchConsoleData(
  clientAccountId: string,
  dateRange: DateRange
): Promise<SearchConsoleRow[]> {
  const results = await db
    .select({
      queryText: searchQueries.queryText,
      page: searchConsoleQueries.page,
      clicks: searchConsoleQueries.clicks,
      impressions: searchConsoleQueries.impressions,
      ctr: searchConsoleQueries.ctr,
      position: searchConsoleQueries.position,
    })
    .from(searchConsoleQueries)
    .innerJoin(searchQueries, eq(searchConsoleQueries.searchQueryId, searchQueries.id))
    .where(
      and(
        eq(searchConsoleQueries.clientAccountId, clientAccountId),
        gte(searchConsoleQueries.date, dateRange.start),
        lte(searchConsoleQueries.date, dateRange.end)
      )
    );

  return results;
}

interface GA4Row {
  landingPage: string;
  sessions: number | null;
  totalRevenue: string | null;
  conversions: string | null;
  engagementRate: string | null;
  bounceRate: string | null;
  averageSessionDuration: string | null;
}

async function fetchGA4Data(
  clientAccountId: string,
  dateRange: DateRange
): Promise<GA4Row[]> {
  const results = await db
    .select({
      landingPage: ga4LandingPageMetrics.landingPage,
      sessions: ga4LandingPageMetrics.sessions,
      totalRevenue: ga4LandingPageMetrics.totalRevenue,
      conversions: ga4LandingPageMetrics.conversions,
      engagementRate: ga4LandingPageMetrics.engagementRate,
      bounceRate: ga4LandingPageMetrics.bounceRate,
      averageSessionDuration: ga4LandingPageMetrics.averageSessionDuration,
    })
    .from(ga4LandingPageMetrics)
    .where(
      and(
        eq(ga4LandingPageMetrics.clientAccountId, clientAccountId),
        gte(ga4LandingPageMetrics.date, dateRange.start),
        lte(ga4LandingPageMetrics.date, dateRange.end)
      )
    );

  return results;
}

// ============================================================================
// DATA MERGING
// ============================================================================

function mergeData(
  googleAdsData: GoogleAdsRow[],
  searchConsoleData: SearchConsoleRow[],
  ga4Data: GA4Row[]
): InterplayData {
  const queryMap = new Map<string, InterplayQueryData>();

  const getOrCreate = (query: string): InterplayQueryData => {
    const normalized = query.toLowerCase().trim();
    if (!queryMap.has(normalized)) {
      queryMap.set(normalized, { query });
    }
    return queryMap.get(normalized)!;
  };

  // Process Google Ads
  for (const row of googleAdsData) {
    const q = getOrCreate(row.queryText);
    const spend = (row.costMicros || 0) / 1_000_000;
    const conversions = parseFloat(row.conversions || '0');
    // No conversionValue in schema - estimate from conversions
    const conversionValue = conversions * 50; // Default $50 per conversion estimate
    const impressions = row.impressions || 0;
    const clicks = row.clicks || 0;

    // Aggregate if already exists
    if (q.googleAds) {
      q.googleAds.spend += spend;
      q.googleAds.clicks += clicks;
      q.googleAds.impressions += impressions;
      q.googleAds.conversions += conversions;
      q.googleAds.conversionValue += conversionValue;
    } else {
      q.googleAds = {
        spend,
        clicks,
        impressions,
        cpc: clicks > 0 ? spend / clicks : 0,
        conversions,
        conversionValue,
        roas: spend > 0 ? conversionValue / spend : 0,
      };
    }
  }

  // Recalculate derived metrics after aggregation
  for (const q of queryMap.values()) {
    if (q.googleAds) {
      q.googleAds.cpc = q.googleAds.clicks > 0 ? q.googleAds.spend / q.googleAds.clicks : 0;
      q.googleAds.roas = q.googleAds.spend > 0 ? q.googleAds.conversionValue / q.googleAds.spend : 0;
    }
  }

  // Process Search Console
  for (const row of searchConsoleData) {
    const q = getOrCreate(row.queryText);
    const clicks = row.clicks || 0;
    const impressions = row.impressions || 0;
    const ctr = parseFloat(row.ctr || '0');
    const position = parseFloat(row.position || '0');

    // Aggregate or set
    if (q.searchConsole) {
      q.searchConsole.clicks += clicks;
      q.searchConsole.impressions += impressions;
      // Weighted average for position and CTR
      const totalImpressions = q.searchConsole.impressions;
      if (totalImpressions > 0) {
        q.searchConsole.ctr = (q.searchConsole.clicks / totalImpressions) * 100;
      }
    } else {
      q.searchConsole = {
        position,
        clicks,
        impressions,
        ctr,
        url: row.page || undefined,
      };
    }
  }

  // Process GA4 - aggregate by landing page path
  const ga4ByPage = new Map<string, {
    sessions: number;
    revenue: number;
    conversions: number;
    weightedEngagement: number;
    weightedBounce: number;
    weightedDuration: number;
  }>();

  for (const row of ga4Data) {
    const path = extractPath(row.landingPage);
    const existing = ga4ByPage.get(path) || {
      sessions: 0,
      revenue: 0,
      conversions: 0,
      weightedEngagement: 0,
      weightedBounce: 0,
      weightedDuration: 0,
    };

    const sessions = row.sessions || 0;
    existing.sessions += sessions;
    existing.revenue += parseFloat(row.totalRevenue || '0');
    existing.conversions += parseFloat(row.conversions || '0');
    existing.weightedEngagement += parseFloat(row.engagementRate || '0') * sessions;
    existing.weightedBounce += parseFloat(row.bounceRate || '0') * sessions;
    existing.weightedDuration += parseFloat(row.averageSessionDuration || '0') * sessions;

    ga4ByPage.set(path, existing);
  }

  // Attach GA4 metrics to queries based on URL
  for (const q of queryMap.values()) {
    if (q.searchConsole?.url) {
      const path = extractPath(q.searchConsole.url);
      const ga4 = ga4ByPage.get(path);
      if (ga4 && ga4.sessions > 0) {
        q.ga4Metrics = {
          sessions: ga4.sessions,
          revenue: ga4.revenue,
          conversions: ga4.conversions,
          engagementRate: ga4.weightedEngagement / ga4.sessions,
          bounceRate: ga4.weightedBounce / ga4.sessions,
          averageSessionDuration: ga4.weightedDuration / ga4.sessions,
        };
      }
    }
  }

  // Calculate summary
  const summary = {
    totalSpend: 0,
    totalRevenue: 0,
    totalOrganicClicks: 0,
  };

  for (const q of queryMap.values()) {
    if (q.googleAds) {
      summary.totalSpend += q.googleAds.spend;
      summary.totalRevenue += q.googleAds.conversionValue;
    }
    if (q.searchConsole) {
      summary.totalOrganicClicks += q.searchConsole.clicks;
    }
  }

  dataLogger.info(
    { queryCount: queryMap.size, summary },
    'Data merge complete'
  );

  return {
    queries: Array.from(queryMap.values()),
    summary,
  };
}

function extractPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split('?')[0];
  }
}
