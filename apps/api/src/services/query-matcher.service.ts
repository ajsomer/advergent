import crypto from 'crypto';
import { db, searchQueries } from '@/db/index.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/utils/logger.js';

const matcherLogger = logger.child({ module: 'query-matcher' });

/**
 * Common stop words to optionally remove from queries
 */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'will', 'with'
]);

export interface GoogleAdsQuery {
  query: string;
  cpc: number;
  spend: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
}

export interface SearchConsoleQuery {
  query: string;
  position: number;
  ctr: number;
  impressions: number;
  clicks: number;
}

export interface QueryOverlap {
  queryText: string;
  queryHash: string;
  googleAds: {
    cpc: number;
    spend: number;
    clicks: number;
    conversions: number;
    conversionValue: number;
  } | null;
  searchConsole: {
    position: number;
    ctr: number;
    impressions: number;
    clicks: number;
  };
}

/**
 * Normalize query text for consistent matching
 * - Convert to lowercase
 * - Remove special characters (keep letters, numbers, spaces)
 * - Normalize whitespace (trim, collapse multiple spaces)
 * - Optionally remove common stop words
 */
export function normalizeQuery(value: string, removeStopWords: boolean = false): string {
  if (!value || typeof value !== 'string') {
    return '';
  }

  // Convert to lowercase
  let normalized = value.toLowerCase();

  // Remove special characters, keep only alphanumeric and spaces
  normalized = normalized.replace(/[^a-z0-9\s]/g, ' ');

  // Normalize whitespace: collapse multiple spaces and trim
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Optionally remove stop words
  if (removeStopWords) {
    const words = normalized.split(' ');
    const filteredWords = words.filter(word => !STOP_WORDS.has(word));
    normalized = filteredWords.join(' ');
  }

  return normalized;
}

/**
 * Generate MD5 hash for fast query lookups
 */
export function hashQuery(value: string): string {
  if (!value || typeof value !== 'string') {
    return '';
  }

  const normalized = normalizeQuery(value);
  const hash = crypto.createHash('md5').update(normalized).digest('hex');

  return hash;
}

/**
 * Find overlapping queries between Google Ads and Search Console
 * Returns queries that appear in both data sources with combined metrics
 */
export function findOverlappingQueries(
  adsQueries: GoogleAdsQuery[],
  scQueries: SearchConsoleQuery[]
): QueryOverlap[] {
  matcherLogger.info(
    {
      adsQueryCount: adsQueries.length,
      scQueryCount: scQueries.length,
    },
    'Finding overlapping queries'
  );

  // Create hash map of Search Console queries for O(1) lookup
  const scQueryMap = new Map<string, SearchConsoleQuery>();

  for (const scQuery of scQueries) {
    const hash = hashQuery(scQuery.query);
    if (hash) {
      // If multiple SC queries hash to same value, keep the one with better position
      const existing = scQueryMap.get(hash);
      if (!existing || scQuery.position < existing.position) {
        scQueryMap.set(hash, scQuery);
      }
    }
  }

  matcherLogger.debug(
    { uniqueScHashes: scQueryMap.size },
    'Created Search Console query map'
  );

  // Find overlaps by matching Google Ads queries against SC map
  const overlaps: QueryOverlap[] = [];

  for (const adsQuery of adsQueries) {
    const hash = hashQuery(adsQuery.query);
    if (!hash) continue;

    const scQuery = scQueryMap.get(hash);

    if (scQuery) {
      // Found an overlap - query exists in both Google Ads and Search Console
      const overlap: QueryOverlap = {
        queryText: adsQuery.query, // Use original (not normalized) for display
        queryHash: hash,
        googleAds: {
          cpc: adsQuery.cpc,
          spend: adsQuery.spend,
          clicks: adsQuery.clicks,
          conversions: adsQuery.conversions,
          conversionValue: adsQuery.conversionValue,
        },
        searchConsole: {
          position: scQuery.position,
          ctr: scQuery.ctr,
          impressions: scQuery.impressions,
          clicks: scQuery.clicks,
        },
      };

      overlaps.push(overlap);

      matcherLogger.debug(
        {
          query: overlap.queryText,
          hash,
          adsSpend: adsQuery.spend,
          scPosition: scQuery.position,
        },
        'Found query overlap'
      );
    }
  }

  matcherLogger.info(
    {
      overlapCount: overlaps.length,
      overlapRate: adsQueries.length > 0
        ? ((overlaps.length / adsQueries.length) * 100).toFixed(2) + '%'
        : '0%',
    },
    'Query matching complete'
  );

  return overlaps;
}

/**
 * Calculate total spend for a set of overlapping queries
 */
export function calculateTotalSpend(overlaps: QueryOverlap[]): number {
  return overlaps.reduce((total, overlap) => total + (overlap.googleAds?.spend || 0), 0);
}

/**
 * Filter overlaps by minimum spend threshold
 * Skips filtering if there's no Ads data
 */
export function filterBySpendThreshold(
  overlaps: QueryOverlap[],
  minSpend: number
): QueryOverlap[] {
  return overlaps.filter(overlap => !overlap.googleAds || overlap.googleAds.spend >= minSpend);
}

/**
 * Sort overlaps by spend (descending)
 * Queries without Ads data are sorted to the end
 */
export function sortBySpend(overlaps: QueryOverlap[]): QueryOverlap[] {
  return [...overlaps].sort((a, b) => {
    const aSpend = a.googleAds?.spend || 0;
    const bSpend = b.googleAds?.spend || 0;
    return bSpend - aSpend;
  });
}

/**
 * Get or create a search query record in the database
 */
export async function getOrCreateQuery(clientId: string, queryText: string) {
  const normalized = normalizeQuery(queryText);
  const hash = hashQuery(normalized);

  // Check if query already exists using Drizzle
  const existing = await db
    .select()
    .from(searchQueries)
    .where(
      and(
        eq(searchQueries.clientAccountId, clientId),
        eq(searchQueries.queryHash, hash)
      )
    )
    .limit(1);

  if (existing.length) {
    return existing[0];
  }

  // Insert new query using Drizzle
  const [inserted] = await db
    .insert(searchQueries)
    .values({
      clientAccountId: clientId,
      queryText,
      queryNormalized: normalized,
      queryHash: hash,
    })
    .returning();

  return inserted;
}

/**
 * @deprecated Use findOverlappingQueries instead
 */
export async function matchQueries(_clientId: string) {
  return [];
}
