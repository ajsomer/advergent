/**
 * Scout Agent - Data Triage (NO AI calls)
 *
 * The Scout performs pure data analysis to identify:
 * - SEM Track: Battleground Keywords (high spend, low ROAS, cannibalization, growth potential)
 * - SEO Track: Critical Pages (high paid spend + low organic, high bounce, low CTR)
 */

import { logger } from '@/utils/logger.js';
import type {
  InterplayData,
  InterplayQueryData,
  ScoutFindings,
  BattlegroundKeyword,
  CriticalPage,
  BattlegroundPriority,
  BattlegroundReason,
  CriticalPageReason,
} from '../types.js';

const scoutLogger = logger.child({ module: 'scout-agent' });

// ============================================================================
// THRESHOLDS (configurable)
// ============================================================================

const THRESHOLDS = {
  // SEM Track
  highSpend: 100, // $100+ monthly spend
  lowRoas: 2, // ROAS < 2 is concerning
  highConversions: 5, // 5+ conversions = valuable
  lowImpressionShare: 0.5, // < 50% impression share = growth potential
  cannibalizationPosition: 3, // Top 3 organic = cannibalization risk
  cannibalizationSpend: 50, // $50+ spend on top organic queries

  // SEO Track
  highPaidSpendForSeo: 100, // $100+ paid spend
  lowOrganicPosition: 10, // Position > 10 = poor organic
  highBounceRate: 0.7, // 70%+ bounce rate
  highImpressions: 1000, // 1000+ impressions
  lowCtr: 0.02, // < 2% CTR
};

// ============================================================================
// SCOUT AGENT
// ============================================================================

export function runScout(data: InterplayData): ScoutFindings {
  scoutLogger.info({ queryCount: data.queries.length }, 'Scout: Starting data triage');

  const battlegroundKeywords = identifyBattlegroundKeywords(data.queries);
  const criticalPages = identifyCriticalPages(data.queries);

  const findings: ScoutFindings = {
    battlegroundKeywords: deduplicateAndLimit(battlegroundKeywords, 20),
    criticalPages: deduplicatePages(criticalPages, 10),
    summary: {
      totalKeywordsAnalyzed: data.queries.filter((q) => q.googleAds).length,
      totalPagesAnalyzed: new Set(data.queries.map((q) => q.searchConsole?.url).filter(Boolean)).size,
      highPriorityCount:
        battlegroundKeywords.filter((k) => k.priority === 'high').length +
        criticalPages.filter((p) => p.priority === 'high').length,
    },
  };

  scoutLogger.info(
    {
      battlegroundCount: findings.battlegroundKeywords.length,
      criticalPagesCount: findings.criticalPages.length,
      highPriorityCount: findings.summary.highPriorityCount,
    },
    'Scout: Data triage complete'
  );

  return findings;
}

// ============================================================================
// SEM TRACK: BATTLEGROUND KEYWORDS
// ============================================================================

function identifyBattlegroundKeywords(queries: InterplayQueryData[]): BattlegroundKeyword[] {
  const battlegrounds: BattlegroundKeyword[] = [];

  for (const q of queries) {
    if (!q.googleAds) continue;

    const { spend, roas, conversions } = q.googleAds;
    const organicPosition = q.searchConsole?.position ?? null;
    const impressionShare = null; // Will be enriched by Researcher

    // Rule 1: High Spend + Low ROAS
    if (spend > THRESHOLDS.highSpend && roas < THRESHOLDS.lowRoas) {
      battlegrounds.push({
        query: q.query,
        priority: 'high',
        reason: 'high_spend_low_roas',
        spend,
        roas,
        organicPosition,
        impressionShare,
        conversions,
      });
      continue;
    }

    // Rule 2: Cannibalization Risk (High organic rank + high ad spend)
    if (
      organicPosition !== null &&
      organicPosition <= THRESHOLDS.cannibalizationPosition &&
      spend > THRESHOLDS.cannibalizationSpend
    ) {
      battlegrounds.push({
        query: q.query,
        priority: 'high',
        reason: 'cannibalization_risk',
        spend,
        roas,
        organicPosition,
        impressionShare,
        conversions,
      });
      continue;
    }

    // Rule 3: Growth Potential (High conversions + could expand)
    if (conversions > THRESHOLDS.highConversions && spend > 0) {
      // Marked for later check of impression share by Researcher
      battlegrounds.push({
        query: q.query,
        priority: 'medium',
        reason: 'growth_potential',
        spend,
        roas,
        organicPosition,
        impressionShare,
        conversions,
      });
      continue;
    }

    // Rule 4: Competitive Pressure (will be validated by Researcher with auction insights)
    // For now, flag high-spend queries that need competitive analysis
    if (spend > THRESHOLDS.highSpend * 0.75) {
      battlegrounds.push({
        query: q.query,
        priority: 'low',
        reason: 'competitive_pressure',
        spend,
        roas,
        organicPosition,
        impressionShare,
        conversions,
      });
    }
  }

  return battlegrounds;
}

// ============================================================================
// SEO TRACK: CRITICAL PAGES
// ============================================================================

function identifyCriticalPages(queries: InterplayQueryData[]): CriticalPage[] {
  const pageMap = new Map<string, CriticalPage>();

  for (const q of queries) {
    const url = q.searchConsole?.url;
    if (!url) continue;

    const paidSpend = q.googleAds?.spend ?? 0;
    const organicPosition = q.searchConsole?.position ?? null;
    const bounceRate = q.ga4Metrics?.bounceRate ?? null;
    const impressions = q.searchConsole?.impressions ?? 0;
    const ctr = q.searchConsole?.ctr ?? null;

    // Skip if already processed this URL with higher priority
    if (pageMap.has(url)) {
      const existing = pageMap.get(url)!;
      if (existing.priority === 'high') continue;
    }

    // Rule 1: High Paid Spend + Low Organic Rank
    if (paidSpend > THRESHOLDS.highPaidSpendForSeo && (organicPosition === null || organicPosition > THRESHOLDS.lowOrganicPosition)) {
      pageMap.set(url, {
        url,
        priority: 'high',
        reason: 'high_spend_low_organic',
        paidSpend,
        organicPosition,
        bounceRate,
        impressions,
        ctr,
      });
      continue;
    }

    // Rule 2: High Traffic + High Bounce Rate (UX issue)
    if (impressions > THRESHOLDS.highImpressions && bounceRate !== null && bounceRate > THRESHOLDS.highBounceRate) {
      const priority = determinePriority(bounceRate > 0.8, paidSpend > 50);
      pageMap.set(url, {
        url,
        priority,
        reason: 'high_traffic_high_bounce',
        paidSpend,
        organicPosition,
        bounceRate,
        impressions,
        ctr,
      });
      continue;
    }

    // Rule 3: High Impressions + Low CTR (meta/title issue)
    if (impressions > THRESHOLDS.highImpressions && ctr !== null && ctr < THRESHOLDS.lowCtr) {
      const priority = determinePriority(ctr < 0.01, impressions > 5000);
      pageMap.set(url, {
        url,
        priority,
        reason: 'high_impressions_low_ctr',
        paidSpend,
        organicPosition,
        bounceRate,
        impressions,
        ctr,
      });
    }
  }

  return Array.from(pageMap.values());
}

// ============================================================================
// HELPERS
// ============================================================================

function determinePriority(isVeryBad: boolean, hasHighImpact: boolean): BattlegroundPriority {
  if (isVeryBad && hasHighImpact) return 'high';
  if (isVeryBad || hasHighImpact) return 'medium';
  return 'low';
}

function deduplicateAndLimit(keywords: BattlegroundKeyword[], limit: number): BattlegroundKeyword[] {
  // Deduplicate by query (keep highest priority)
  const queryMap = new Map<string, BattlegroundKeyword>();

  for (const kw of keywords) {
    const existing = queryMap.get(kw.query);
    if (!existing || priorityValue(kw.priority) > priorityValue(existing.priority)) {
      queryMap.set(kw.query, kw);
    }
  }

  // Sort by priority (high > medium > low), then by spend
  return Array.from(queryMap.values())
    .sort((a, b) => {
      const priorityDiff = priorityValue(b.priority) - priorityValue(a.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return b.spend - a.spend;
    })
    .slice(0, limit);
}

function deduplicatePages(pages: CriticalPage[], limit: number): CriticalPage[] {
  // Already deduplicated by URL in identifyCriticalPages
  return pages
    .sort((a, b) => {
      const priorityDiff = priorityValue(b.priority) - priorityValue(a.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return b.paidSpend - a.paidSpend;
    })
    .slice(0, limit);
}

function priorityValue(priority: BattlegroundPriority): number {
  switch (priority) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}
