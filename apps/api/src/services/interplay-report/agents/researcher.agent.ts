/**
 * Researcher Agent - Data Enrichment
 *
 * Enriches Scout findings with:
 * - SEM Track: Keyword-level competitive metrics from auction_insights
 * - SEO Track: Page content (title, H1, meta description, word count)
 *
 * Supports skill-based configuration for business-type-aware content extraction
 * and page classification.
 */

import { JSDOM } from 'jsdom';
import { db } from '@/db/index.js';
import { auctionInsights } from '@/db/schema.js';
import { eq, and, isNull, gte, lte } from 'drizzle-orm';
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
import type {
  ResearcherSkillDefinition,
  ContentSignal,
  PagePattern,
  PriorityBoost,
} from '../skills/types.js';

const researcherLogger = logger.child({ module: 'researcher-agent' });

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_DATA_QUALITY = {
  minKeywordsWithCompetitiveData: 0,
  minPagesWithContent: 0,
  maxFetchTimeout: 10000,
  maxConcurrentFetches: 3,
};

// ============================================================================
// INPUT/OUTPUT TYPES
// ============================================================================

export interface ResearcherInput {
  clientAccountId: string;
  scoutFindings: ScoutFindings;
  dateRange: { start: string; end: string };
  skill?: ResearcherSkillDefinition;
}

export interface ExtendedPageContent extends PageContent {
  detectedSchema?: string[];
  schemaErrors?: string[];
  contentSignals?: Record<string, boolean>;
  pageType?: string;
  canonicalUrl?: string | null;
}

export interface ExtendedEnrichedPage extends EnrichedPage {
  content?: ExtendedPageContent;
}

export interface ResearcherOutput extends ResearcherData {
  enrichedPages: ExtendedEnrichedPage[];
  dataQualityMetrics: {
    keywordsWithCompetitiveData: number;
    pagesWithContent: number;
    pagesWithSchema: number;
    pagesFetchFailed: number;
  };
  skillVersion?: string;
}

// ============================================================================
// RESEARCHER AGENT
// ============================================================================

/**
 * Run Researcher agent with skill configuration.
 * Uses business-type-aware content extraction.
 */
export async function runResearcher(input: ResearcherInput): Promise<ResearcherOutput> {
  const { clientAccountId, scoutFindings, dateRange, skill } = input;

  researcherLogger.info(
    {
      keywordCount: scoutFindings.battlegroundKeywords.length,
      pageCount: scoutFindings.criticalPages.length,
      hasSkill: !!skill,
      skillVersion: skill?.version,
    },
    'Researcher: Starting skill-based data enrichment'
  );

  const dataQualityConfig = skill?.dataQuality ?? DEFAULT_DATA_QUALITY;

  // Enrich keywords with competitive metrics and priority boosts
  const enrichedKeywords = await enrichKeywordsWithCompetitiveData(
    clientAccountId,
    scoutFindings.battlegroundKeywords,
    dateRange,
    skill?.keywordEnrichment?.priorityBoosts
  );

  // Enrich pages with content using skill-based extraction
  const { enrichedPages, fetchStats } = await enrichPagesWithSkill(
    scoutFindings.criticalPages,
    skill?.pageEnrichment,
    dataQualityConfig
  );

  const output: ResearcherOutput = {
    enrichedKeywords,
    enrichedPages,
    dataQuality: {
      keywordsWithCompetitiveData: enrichedKeywords.filter((k) => k.competitiveMetrics).length,
      pagesWithContent: enrichedPages.filter((p) => p.content).length,
    },
    dataQualityMetrics: {
      keywordsWithCompetitiveData: enrichedKeywords.filter((k) => k.competitiveMetrics).length,
      pagesWithContent: enrichedPages.filter((p) => p.content).length,
      pagesWithSchema: enrichedPages.filter((p) => p.content?.detectedSchema?.length).length,
      pagesFetchFailed: fetchStats.failed,
    },
    skillVersion: skill?.version,
  };

  researcherLogger.info(
    {
      keywordsWithData: output.dataQualityMetrics.keywordsWithCompetitiveData,
      pagesWithContent: output.dataQualityMetrics.pagesWithContent,
      pagesWithSchema: output.dataQualityMetrics.pagesWithSchema,
      skillVersion: skill?.version,
    },
    'Researcher: Skill-based data enrichment complete'
  );

  return output;
}


// ============================================================================
// KEYWORD ENRICHMENT
// ============================================================================

async function enrichKeywordsWithCompetitiveData(
  clientAccountId: string,
  keywords: ScoutFindings['battlegroundKeywords'],
  dateRange: { start: string; end: string },
  priorityBoosts?: PriorityBoost[]
): Promise<EnrichedKeyword[]> {
  const enriched: EnrichedKeyword[] = [];

  for (const kw of keywords) {
    const competitiveMetrics = await getCompetitiveMetrics(
      clientAccountId,
      kw.query,
      dateRange
    );

    // Apply priority boosts if configured
    let boostedPriority = kw.priority;
    if (priorityBoosts && competitiveMetrics) {
      const boost = calculatePriorityBoost(kw, competitiveMetrics, priorityBoosts);
      if (boost > 0 && kw.priority !== 'high') {
        boostedPriority = 'high';
      } else if (boost < 0 && kw.priority === 'high') {
        boostedPriority = 'medium';
      }
    }

    enriched.push({
      ...kw,
      priority: boostedPriority,
      competitiveMetrics,
      // Update impression share from auction insights if available
      impressionShare: competitiveMetrics?.impressionShare ?? kw.impressionShare,
    });
  }

  return enriched;
}

/**
 * Calculate priority boost based on skill configuration.
 */
function calculatePriorityBoost(
  keyword: ScoutFindings['battlegroundKeywords'][0],
  metrics: CompetitiveMetrics,
  boosts: PriorityBoost[]
): number {
  let totalBoost = 0;

  for (const boost of boosts) {
    const metricValue = getMetricValue(keyword, metrics, boost.metric);
    if (metricValue === null) continue;

    // Evaluate condition (simple expression parsing)
    if (evaluateBoostCondition(metricValue, boost.condition)) {
      totalBoost += boost.boost;
      researcherLogger.debug(
        {
          keyword: keyword.query,
          metric: boost.metric,
          value: metricValue,
          boost: boost.boost,
          reason: boost.reason,
        },
        'Applied priority boost'
      );
    }
  }

  return totalBoost;
}

/**
 * Get a metric value from keyword or competitive metrics.
 */
function getMetricValue(
  keyword: ScoutFindings['battlegroundKeywords'][0],
  metrics: CompetitiveMetrics,
  metricName: string
): number | null {
  switch (metricName) {
    case 'impressionShare':
      return metrics.impressionShare;
    case 'lostImpressionShareRank':
      return metrics.lostImpressionShareRank;
    case 'lostImpressionShareBudget':
      return metrics.lostImpressionShareBudget;
    case 'topOfPageRate':
      return metrics.topOfPageRate;
    case 'spend':
      return keyword.spend;
    case 'roas':
      return keyword.roas;
    case 'conversions':
      return keyword.conversions;
    default:
      return null;
  }
}

/**
 * Evaluate a simple boost condition.
 * Supports: "> X", "< X", ">= X", "<= X", "== X"
 */
function evaluateBoostCondition(value: number, condition: string): boolean {
  const match = condition.match(/^([<>=!]+)\s*(\d+(?:\.\d+)?)$/);
  if (!match) return false;

  const [, operator, threshold] = match;
  const thresholdNum = parseFloat(threshold);

  switch (operator) {
    case '>':
      return value > thresholdNum;
    case '<':
      return value < thresholdNum;
    case '>=':
      return value >= thresholdNum;
    case '<=':
      return value <= thresholdNum;
    case '==':
      return value === thresholdNum;
    case '!=':
      return value !== thresholdNum;
    default:
      return false;
  }
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

/**
 * Enrich pages with content using skill configuration.
 */
async function enrichPagesWithSkill(
  pages: ScoutFindings['criticalPages'],
  pageEnrichment: ResearcherSkillDefinition['pageEnrichment'] | undefined,
  dataQualityConfig: ResearcherSkillDefinition['dataQuality']
): Promise<{ enrichedPages: ExtendedEnrichedPage[]; fetchStats: { success: number; failed: number } }> {
  const enriched: ExtendedEnrichedPage[] = [];
  let successCount = 0;
  let failedCount = 0;

  const timeout = dataQualityConfig?.maxFetchTimeout ?? 10000;
  const concurrency = dataQualityConfig?.maxConcurrentFetches ?? 3;

  // Fetch pages in parallel with concurrency limit from skill
  for (let i = 0; i < pages.length; i += concurrency) {
    const batch = pages.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (page) => {
        const content = await fetchAndAnalyzePageWithSkill(page.url, pageEnrichment, timeout);
        if (content) {
          successCount++;
        } else {
          failedCount++;
        }
        return { ...page, content } as ExtendedEnrichedPage;
      })
    );
    enriched.push(...results);
  }

  return {
    enrichedPages: enriched,
    fetchStats: { success: successCount, failed: failedCount },
  };
}

/**
 * Fetch and analyze a page with skill-based extraction.
 */
async function fetchAndAnalyzePageWithSkill(
  url: string,
  pageEnrichment: ResearcherSkillDefinition['pageEnrichment'] | undefined,
  timeout: number
): Promise<ExtendedPageContent | undefined> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

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
    return parsePageContentWithSkill(html, url, pageEnrichment);
  } catch (error) {
    researcherLogger.warn(
      { url, error: error instanceof Error ? error.message : 'Unknown error' },
      'Error fetching page content'
    );
    return undefined;
  }
}

/**
 * Parse page content with skill-based extraction.
 */
function parsePageContentWithSkill(
  html: string,
  url: string,
  pageEnrichment: ResearcherSkillDefinition['pageEnrichment'] | undefined
): ExtendedPageContent {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Remove scripts, styles, etc.
  doc.querySelectorAll('script, style, noscript, iframe, svg').forEach((el) => el.remove());

  // Standard extractions
  const standardExtractions = pageEnrichment?.standardExtractions;
  const title = standardExtractions?.title !== false
    ? doc.querySelector('title')?.textContent?.trim() || null
    : null;
  const h1 = standardExtractions?.h1 !== false
    ? doc.querySelector('h1')?.textContent?.trim() || null
    : null;
  const metaDescription = standardExtractions?.metaDescription !== false
    ? doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || null
    : null;
  const canonicalUrl = standardExtractions?.canonicalUrl !== false
    ? doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || null
    : null;

  // Get text content
  const bodyText = doc.body?.textContent || '';
  const cleanText = bodyText.replace(/\s+/g, ' ').trim();
  const wordCount = standardExtractions?.wordCount !== false
    ? cleanText.split(/\s+/).length
    : 0;

  // Schema extraction
  const schemaConfig = pageEnrichment?.schemaExtraction;
  const { detectedSchema, schemaErrors } = extractSchema(doc, schemaConfig);

  // Content signals (business-type specific)
  const contentSignals = detectContentSignals(doc, pageEnrichment?.contentSignals ?? []);

  // Page classification
  const pageType = classifyPage(url, doc, pageEnrichment?.pageClassification);

  return {
    wordCount,
    title,
    h1,
    metaDescription,
    contentPreview: cleanText.slice(0, 500),
    canonicalUrl,
    detectedSchema,
    schemaErrors,
    contentSignals,
    pageType,
  };
}

/**
 * Extract schema markup from page.
 */
function extractSchema(
  doc: Document,
  schemaConfig: ResearcherSkillDefinition['pageEnrichment']['schemaExtraction'] | undefined
): { detectedSchema: string[]; schemaErrors: string[] } {
  const detectedSchema: string[] = [];
  const schemaErrors: string[] = [];

  // Find all JSON-LD scripts
  const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
  jsonLdScripts.forEach((script) => {
    try {
      const data = JSON.parse(script.textContent || '');
      const types = extractSchemaTypes(data);
      detectedSchema.push(...types);
    } catch {
      // Invalid JSON-LD
      schemaErrors.push('Invalid JSON-LD syntax');
    }
  });

  // Check for required schemas that are missing
  if (schemaConfig?.flagIfMissing) {
    for (const requiredType of schemaConfig.flagIfMissing) {
      if (!detectedSchema.includes(requiredType)) {
        schemaErrors.push(`Missing recommended schema: ${requiredType}`);
      }
    }
  }

  // Check for schemas that shouldn't exist
  if (schemaConfig?.flagIfPresent) {
    for (const invalidType of schemaConfig.flagIfPresent) {
      if (detectedSchema.includes(invalidType)) {
        schemaErrors.push(`Inappropriate schema present: ${invalidType}`);
      }
    }
  }

  return { detectedSchema, schemaErrors };
}

/**
 * Extract @type values from JSON-LD data.
 */
function extractSchemaTypes(data: unknown): string[] {
  const types: string[] = [];

  if (Array.isArray(data)) {
    for (const item of data) {
      types.push(...extractSchemaTypes(item));
    }
  } else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (typeof obj['@type'] === 'string') {
      types.push(obj['@type']);
    } else if (Array.isArray(obj['@type'])) {
      types.push(...(obj['@type'] as string[]));
    }
    // Recursively check nested objects
    if (obj['@graph'] && Array.isArray(obj['@graph'])) {
      types.push(...extractSchemaTypes(obj['@graph']));
    }
  }

  return types;
}

/**
 * Detect content signals based on skill configuration.
 */
function detectContentSignals(
  doc: Document,
  signals: ContentSignal[]
): Record<string, boolean> {
  const result: Record<string, boolean> = {};

  for (const signal of signals) {
    try {
      // Try to match using CSS selector
      const matches = doc.querySelector(signal.selector);
      result[signal.id] = matches !== null;
    } catch {
      // Invalid selector
      result[signal.id] = false;
    }
  }

  return result;
}

/**
 * Classify page type based on URL patterns and content.
 */
function classifyPage(
  url: string,
  doc: Document,
  classificationConfig: ResearcherSkillDefinition['pageEnrichment']['pageClassification'] | undefined
): string {
  if (!classificationConfig) {
    return 'unknown';
  }

  let bestMatch: { type: string; confidence: number } | null = null;

  for (const pattern of classificationConfig.patterns) {
    try {
      const regex = new RegExp(pattern.pattern, 'i');
      if (regex.test(url)) {
        if (!bestMatch || pattern.confidence > bestMatch.confidence) {
          bestMatch = { type: pattern.pageType, confidence: pattern.confidence };
        }
      }
    } catch {
      // Invalid regex pattern
    }
  }

  if (bestMatch && bestMatch.confidence >= classificationConfig.confidenceThreshold) {
    return bestMatch.type;
  }

  return classificationConfig.defaultType;
}

