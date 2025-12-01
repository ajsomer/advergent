/**
 * Researcher Agent - Data Enrichment
 *
 * Enriches Scout findings with:
 * - SEM Track: Keyword-level competitive metrics from auction_insights
 * - SEO Track: Page content (title, H1, meta description, word count)
 */

import { JSDOM } from 'jsdom';
import { db } from '@/db/index.js';
import { auctionInsights } from '@/db/schema.js';
import { eq, and, or, isNull, gte, lte } from 'drizzle-orm';
import { logger } from '@/utils/logger.js';
import type {
  ScoutFindings,
  ResearcherData,
  EnrichedKeyword,
  EnrichedPage,
  CompetitiveMetrics,
  CompetitiveDataLevel,
  PageContent,
} from '../types.js';

const researcherLogger = logger.child({ module: 'researcher-agent' });

// ============================================================================
// RESEARCHER AGENT
// ============================================================================

export async function runResearcher(
  clientAccountId: string,
  scoutFindings: ScoutFindings,
  dateRange: { start: string; end: string }
): Promise<ResearcherData> {
  researcherLogger.info(
    {
      keywordCount: scoutFindings.battlegroundKeywords.length,
      pageCount: scoutFindings.criticalPages.length,
    },
    'Researcher: Starting data enrichment'
  );

  // Enrich keywords with competitive metrics
  const enrichedKeywords = await enrichKeywordsWithCompetitiveData(
    clientAccountId,
    scoutFindings.battlegroundKeywords,
    dateRange
  );

  // Enrich pages with content
  const enrichedPages = await enrichPagesWithContent(scoutFindings.criticalPages);

  const data: ResearcherData = {
    enrichedKeywords,
    enrichedPages,
    dataQuality: {
      keywordsWithCompetitiveData: enrichedKeywords.filter((k) => k.competitiveMetrics).length,
      pagesWithContent: enrichedPages.filter((p) => p.content).length,
    },
  };

  researcherLogger.info(
    {
      keywordsWithData: data.dataQuality.keywordsWithCompetitiveData,
      pagesWithContent: data.dataQuality.pagesWithContent,
    },
    'Researcher: Data enrichment complete'
  );

  return data;
}

// ============================================================================
// KEYWORD ENRICHMENT
// ============================================================================

async function enrichKeywordsWithCompetitiveData(
  clientAccountId: string,
  keywords: ScoutFindings['battlegroundKeywords'],
  dateRange: { start: string; end: string }
): Promise<EnrichedKeyword[]> {
  const enriched: EnrichedKeyword[] = [];

  for (const kw of keywords) {
    const competitiveMetrics = await getCompetitiveMetrics(
      clientAccountId,
      kw.query,
      dateRange
    );

    enriched.push({
      ...kw,
      competitiveMetrics,
      // Update impression share from auction insights if available
      impressionShare: competitiveMetrics?.impressionShare ?? kw.impressionShare,
    });
  }

  return enriched;
}

async function getCompetitiveMetrics(
  clientAccountId: string,
  keyword: string,
  dateRange: { start: string; end: string }
): Promise<CompetitiveMetrics | undefined> {
  // Priority 1: Try keyword-level data within date range
  const keywordData = await db
    .select()
    .from(auctionInsights)
    .where(
      and(
        eq(auctionInsights.clientAccountId, clientAccountId),
        eq(auctionInsights.keyword, keyword),
        eq(auctionInsights.isOwnAccount, true),
        // Filter by date range - auction insights must overlap with report date range
        gte(auctionInsights.dateRangeStart, dateRange.start),
        lte(auctionInsights.dateRangeEnd, dateRange.end)
      )
    )
    .limit(1);

  if (keywordData.length > 0) {
    researcherLogger.debug(
      { keyword, dateRange, dataLevel: 'keyword' },
      'Found keyword-level competitive data within date range'
    );
    return formatCompetitiveMetrics(keywordData[0], 'keyword');
  }

  // Priority 2: Try account-level data (aggregate) within date range
  const accountData = await db
    .select()
    .from(auctionInsights)
    .where(
      and(
        eq(auctionInsights.clientAccountId, clientAccountId),
        eq(auctionInsights.isOwnAccount, true),
        isNull(auctionInsights.keyword), // Account-level has no keyword
        // Filter by date range
        gte(auctionInsights.dateRangeStart, dateRange.start),
        lte(auctionInsights.dateRangeEnd, dateRange.end)
      )
    )
    .limit(1);

  if (accountData.length > 0) {
    researcherLogger.debug(
      { keyword, dateRange, dataLevel: 'account' },
      'Found account-level competitive data within date range'
    );
    return formatCompetitiveMetrics(accountData[0], 'account');
  }

  // No data available within date range
  researcherLogger.debug(
    { keyword, dateRange },
    'No competitive data found within date range'
  );
  return undefined;
}

function formatCompetitiveMetrics(
  row: typeof auctionInsights.$inferSelect,
  dataLevel: CompetitiveDataLevel
): CompetitiveMetrics {
  return {
    impressionShare: row.impressionShare ? parseFloat(row.impressionShare) : null,
    lostImpressionShareRank: row.lostImpressionShareRank
      ? parseFloat(row.lostImpressionShareRank)
      : null,
    lostImpressionShareBudget: row.lostImpressionShareBudget
      ? parseFloat(row.lostImpressionShareBudget)
      : null,
    outrankingShare: row.outrankingShare ? parseFloat(row.outrankingShare) : null,
    overlapRate: row.overlapRate ? parseFloat(row.overlapRate) : null,
    topOfPageRate: row.topOfPageRate ? parseFloat(row.topOfPageRate) : null,
    positionAboveRate: row.positionAboveRate ? parseFloat(row.positionAboveRate) : null,
    absTopOfPageRate: row.absTopOfPageRate ? parseFloat(row.absTopOfPageRate) : null,
    dataLevel,
  };
}

// ============================================================================
// PAGE CONTENT ENRICHMENT
// ============================================================================

const PAGE_FETCH_TIMEOUT = 10000; // 10 seconds

async function enrichPagesWithContent(
  pages: ScoutFindings['criticalPages']
): Promise<EnrichedPage[]> {
  const enriched: EnrichedPage[] = [];

  // Fetch pages in parallel with concurrency limit
  const CONCURRENCY = 3;
  for (let i = 0; i < pages.length; i += CONCURRENCY) {
    const batch = pages.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (page) => {
        const content = await fetchPageContent(page.url);
        return { ...page, content } as EnrichedPage;
      })
    );
    enriched.push(...results);
  }

  return enriched;
}

async function fetchPageContent(url: string): Promise<PageContent | undefined> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PAGE_FETCH_TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Advergent-Analysis-Bot/1.0',
        Accept: 'text/html',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      researcherLogger.warn({ url, status: response.status }, 'Failed to fetch page');
      return undefined;
    }

    const html = await response.text();
    return parsePageContent(html);
  } catch (error) {
    researcherLogger.warn(
      { url, error: error instanceof Error ? error.message : 'Unknown error' },
      'Error fetching page content'
    );
    return undefined;
  }
}

function parsePageContent(html: string): PageContent {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Remove scripts, styles, etc.
  doc.querySelectorAll('script, style, noscript, iframe, svg').forEach((el) => el.remove());

  // Extract metadata
  const title = doc.querySelector('title')?.textContent?.trim() || null;
  const h1 = doc.querySelector('h1')?.textContent?.trim() || null;
  const metaDescription =
    doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || null;

  // Get text content
  const bodyText = doc.body.textContent || '';
  const cleanText = bodyText.replace(/\s+/g, ' ').trim();

  return {
    wordCount: cleanText.split(/\s+/).length,
    title,
    h1,
    metaDescription,
    contentPreview: cleanText.slice(0, 500),
  };
}
