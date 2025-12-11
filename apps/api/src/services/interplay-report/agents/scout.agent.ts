/**
 * Scout Agent - Data Triage (NO AI calls)
 *
 * The Scout performs pure data analysis to identify:
 * - SEM Track: Battleground Keywords (high spend, low ROAS, cannibalization, growth potential)
 * - SEO Track: Critical Pages (high paid spend + low organic, high bounce, low CTR)
 *
 * Supports skill-based configuration for business-type-aware thresholds and priority rules.
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
import type { ScoutSkillDefinition, PriorityRule, PriorityLevel } from '../skills/types.js';

const scoutLogger = logger.child({ module: 'scout-agent' });

// ============================================================================
// DEFAULT THRESHOLDS (fallback when no skill provided)
// ============================================================================

const DEFAULT_THRESHOLDS = {
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

// Default limits
const DEFAULT_LIMITS = {
  maxBattlegroundKeywords: 20,
  maxCriticalPages: 10,
};

// ============================================================================
// INPUT/OUTPUT TYPES
// ============================================================================

export interface ScoutInput {
  data: InterplayData;
  skill?: ScoutSkillDefinition;
}

export interface ScoutOutput extends ScoutFindings {
  metrics: {
    totalKeywordsAnalyzed: number;
    totalPagesAnalyzed: number;
    thresholdsApplied: {
      highSpendThreshold: number;
      lowRoasThreshold: number;
      cannibalizationPosition: number;
      highBounceRateThreshold: number;
      lowCtrThreshold: number;
      minImpressionsForAnalysis: number;
    };
  };
  skillVersion?: string;
}

// ============================================================================
// SCOUT AGENT
// ============================================================================

/**
 * Run Scout agent with skill configuration.
 * Uses business-type-aware thresholds and priority rules.
 */
export function runScout(input: ScoutInput): ScoutOutput {
  const { data, skill } = input;

  scoutLogger.info(
    {
      queryCount: data.queries.length,
      hasSkill: !!skill,
      skillVersion: skill?.version,
    },
    'Scout: Starting skill-based data triage'
  );

  // Determine thresholds to use
  const thresholds = skill?.thresholds ?? {
    highSpendThreshold: DEFAULT_THRESHOLDS.highSpend,
    lowRoasThreshold: DEFAULT_THRESHOLDS.lowRoas,
    cannibalizationPosition: DEFAULT_THRESHOLDS.cannibalizationPosition,
    highBounceRateThreshold: DEFAULT_THRESHOLDS.highBounceRate,
    lowCtrThreshold: DEFAULT_THRESHOLDS.lowCtr,
    minImpressionsForAnalysis: 0,
  };

  // Determine limits
  const limits = skill?.limits ?? DEFAULT_LIMITS;

  // Get priority rules from skill (or use default behavior)
  const keywordRules = skill?.priorityRules?.battlegroundKeywords ?? [];
  const pageRules = skill?.priorityRules?.criticalPages ?? [];

  // Get metrics configuration
  const metricsConfig = skill?.metrics;

  const battlegroundKeywords = identifyBattlegroundKeywords(
    data.queries,
    thresholds,
    keywordRules,
    metricsConfig
  );

  const criticalPages = identifyCriticalPages(
    data.queries,
    thresholds,
    pageRules
  );

  // Apply limits from skill
  const limitedKeywords = deduplicateAndLimit(battlegroundKeywords, limits.maxBattlegroundKeywords);
  const limitedPages = deduplicatePages(criticalPages, limits.maxCriticalPages);

  const output: ScoutOutput = {
    battlegroundKeywords: limitedKeywords,
    criticalPages: limitedPages,
    summary: {
      totalKeywordsAnalyzed: data.queries.filter((q) => q.googleAds).length,
      totalPagesAnalyzed: new Set(data.queries.map((q) => q.searchConsole?.url).filter(Boolean)).size,
      highPriorityCount:
        limitedKeywords.filter((k) => k.priority === 'high').length +
        limitedPages.filter((p) => p.priority === 'high').length,
    },
    metrics: {
      totalKeywordsAnalyzed: data.queries.filter((q) => q.googleAds).length,
      totalPagesAnalyzed: new Set(data.queries.map((q) => q.searchConsole?.url).filter(Boolean)).size,
      thresholdsApplied: thresholds,
    },
    skillVersion: skill?.version,
  };

  scoutLogger.info(
    {
      battlegroundCount: output.battlegroundKeywords.length,
      criticalPagesCount: output.criticalPages.length,
      highPriorityCount: output.summary.highPriorityCount,
      skillVersion: skill?.version,
    },
    'Scout: Skill-based data triage complete'
  );

  return output;
}


// ============================================================================
// SEM TRACK: BATTLEGROUND KEYWORDS
// ============================================================================

/**
 * Identify battleground keywords using skill thresholds and priority rules.
 */
function identifyBattlegroundKeywords(
  queries: InterplayQueryData[],
  thresholds: ScoutSkillDefinition['thresholds'],
  rules: PriorityRule[],
  metricsConfig?: ScoutSkillDefinition['metrics']
): BattlegroundKeyword[] {
  const battlegrounds: BattlegroundKeyword[] = [];

  for (const q of queries) {
    if (!q.googleAds) continue;

    const { spend, roas, conversions, impressions } = q.googleAds;
    const organicPosition = q.searchConsole?.position ?? null;
    const impressionShare = null; // Will be enriched by Researcher

    // Skip if below minimum impressions threshold
    if (thresholds.minImpressionsForAnalysis > 0 && impressions < thresholds.minImpressionsForAnalysis) {
      continue;
    }

    // If rules are provided, use rule-based evaluation
    if (rules.length > 0) {
      const ruleResult = evaluateKeywordRules(
        q,
        rules,
        thresholds,
        metricsConfig
      );

      if (ruleResult) {
        battlegrounds.push({
          query: q.query,
          priority: mapPriorityLevel(ruleResult.priority),
          reason: mapRuleIdToReason(ruleResult.ruleId),
          spend,
          roas,
          organicPosition,
          impressionShare,
          conversions,
        });
      }
    } else {
      // Fallback to default rules using skill thresholds
      const result = applyDefaultRulesWithThresholds(q, thresholds);
      if (result) {
        battlegrounds.push({
          query: q.query,
          priority: result.priority,
          reason: result.reason,
          spend,
          roas,
          organicPosition,
          impressionShare,
          conversions,
        });
      }
    }
  }

  return battlegrounds;
}

/**
 * Evaluate a keyword against priority rules from skill.
 */
function evaluateKeywordRules(
  q: InterplayQueryData,
  rules: PriorityRule[],
  thresholds: ScoutSkillDefinition['thresholds'],
  _metricsConfig?: ScoutSkillDefinition['metrics']
): { priority: PriorityLevel; ruleId: string } | null {
  const { spend, roas } = q.googleAds!;
  const organicPosition = q.searchConsole?.position ?? null;

  for (const rule of rules) {
    if (!rule.enabled) continue;

    // Evaluate rule based on ID pattern
    const matches = evaluateRuleCondition(rule.id, {
      spend,
      roas,
      organicPosition,
      thresholds,
    });

    if (matches) {
      return { priority: rule.priority, ruleId: rule.id };
    }
  }

  return null;
}

/**
 * Evaluate a rule condition based on rule ID and data.
 */
function evaluateRuleCondition(
  ruleId: string,
  data: {
    spend: number;
    roas: number;
    organicPosition: number | null;
    thresholds: ScoutSkillDefinition['thresholds'];
  }
): boolean {
  const { spend, roas, organicPosition, thresholds } = data;

  // Map common rule IDs to conditions
  switch (ruleId) {
    case 'brand-cannibalization':
    case 'cannibalization-risk':
      return (
        organicPosition !== null &&
        organicPosition <= thresholds.cannibalizationPosition &&
        spend > thresholds.highSpendThreshold * 0.5
      );

    case 'high-spend-low-roas':
    case 'wasted-spend':
      return spend > thresholds.highSpendThreshold && roas < thresholds.lowRoasThreshold;

    case 'zero-roas-high-spend':
      return spend > thresholds.highSpendThreshold && roas === 0;

    case 'low-roas-medium-spend':
      return (
        spend > thresholds.highSpendThreshold * 0.5 &&
        spend <= thresholds.highSpendThreshold &&
        roas < thresholds.lowRoasThreshold
      );

    case 'growth-potential':
    case 'expansion-opportunity':
      // Growth potential: good ROAS but could spend more
      return roas >= thresholds.lowRoasThreshold * 1.5 && spend > 0;

    case 'competitive-pressure':
      // High spend that warrants competitive analysis
      return spend > thresholds.highSpendThreshold * 0.75;

    default:
      // Unknown rule ID - don't match
      scoutLogger.debug({ ruleId }, 'Unknown rule ID in skill definition');
      return false;
  }
}

/**
 * Apply default rules using skill-based thresholds.
 */
function applyDefaultRulesWithThresholds(
  q: InterplayQueryData,
  thresholds: ScoutSkillDefinition['thresholds']
): { priority: BattlegroundPriority; reason: BattlegroundReason } | null {
  const { spend, roas, conversions } = q.googleAds!;
  const organicPosition = q.searchConsole?.position ?? null;

  // Rule 1: High Spend + Low ROAS
  if (spend > thresholds.highSpendThreshold && roas < thresholds.lowRoasThreshold) {
    return { priority: 'high', reason: 'high_spend_low_roas' };
  }

  // Rule 2: Cannibalization Risk
  if (
    organicPosition !== null &&
    organicPosition <= thresholds.cannibalizationPosition &&
    spend > thresholds.highSpendThreshold * 0.5
  ) {
    return { priority: 'high', reason: 'cannibalization_risk' };
  }

  // Rule 3: Growth Potential
  if (conversions > 5 && spend > 0 && roas >= thresholds.lowRoasThreshold) {
    return { priority: 'medium', reason: 'growth_potential' };
  }

  // Rule 4: Competitive Pressure
  if (spend > thresholds.highSpendThreshold * 0.75) {
    return { priority: 'low', reason: 'competitive_pressure' };
  }

  return null;
}

/**
 * Map PriorityLevel from skill to BattlegroundPriority.
 */
function mapPriorityLevel(level: PriorityLevel): BattlegroundPriority {
  switch (level) {
    case 'critical':
      return 'high';
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
      return 'low';
    default:
      return 'low';
  }
}

/**
 * Map rule ID to BattlegroundReason.
 */
function mapRuleIdToReason(ruleId: string): BattlegroundReason {
  const mappings: Record<string, BattlegroundReason> = {
    'brand-cannibalization': 'cannibalization_risk',
    'cannibalization-risk': 'cannibalization_risk',
    'high-spend-low-roas': 'high_spend_low_roas',
    'wasted-spend': 'high_spend_low_roas',
    'zero-roas-high-spend': 'high_spend_low_roas',
    'low-roas-medium-spend': 'high_spend_low_roas',
    'growth-potential': 'growth_potential',
    'expansion-opportunity': 'growth_potential',
    'competitive-pressure': 'competitive_pressure',
  };

  return mappings[ruleId] ?? 'competitive_pressure';
}

// ============================================================================
// SEO TRACK: CRITICAL PAGES
// ============================================================================

/**
 * Identify critical pages using skill thresholds and priority rules.
 */
function identifyCriticalPages(
  queries: InterplayQueryData[],
  thresholds: ScoutSkillDefinition['thresholds'],
  rules: PriorityRule[]
): CriticalPage[] {
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

    // If rules are provided, use rule-based evaluation
    if (rules.length > 0) {
      const ruleResult = evaluatePageRules(
        { paidSpend, organicPosition, bounceRate, impressions, ctr },
        rules,
        thresholds
      );

      if (ruleResult) {
        pageMap.set(url, {
          url,
          priority: mapPriorityLevel(ruleResult.priority),
          reason: mapPageRuleIdToReason(ruleResult.ruleId),
          paidSpend,
          organicPosition,
          bounceRate,
          impressions,
          ctr,
        });
      }
    } else {
      // Fallback to default rules using skill thresholds
      const result = applyDefaultPageRulesWithThresholds(
        { paidSpend, organicPosition, bounceRate, impressions, ctr },
        thresholds
      );

      if (result) {
        pageMap.set(url, {
          url,
          priority: result.priority,
          reason: result.reason,
          paidSpend,
          organicPosition,
          bounceRate,
          impressions,
          ctr,
        });
      }
    }
  }

  return Array.from(pageMap.values());
}

/**
 * Evaluate a page against priority rules from skill.
 */
function evaluatePageRules(
  data: {
    paidSpend: number;
    organicPosition: number | null;
    bounceRate: number | null;
    impressions: number;
    ctr: number | null;
  },
  rules: PriorityRule[],
  thresholds: ScoutSkillDefinition['thresholds']
): { priority: PriorityLevel; ruleId: string } | null {
  for (const rule of rules) {
    if (!rule.enabled) continue;

    const matches = evaluatePageRuleCondition(rule.id, data, thresholds);

    if (matches) {
      return { priority: rule.priority, ruleId: rule.id };
    }
  }

  return null;
}

/**
 * Evaluate a page rule condition based on rule ID and data.
 */
function evaluatePageRuleCondition(
  ruleId: string,
  data: {
    paidSpend: number;
    organicPosition: number | null;
    bounceRate: number | null;
    impressions: number;
    ctr: number | null;
  },
  thresholds: ScoutSkillDefinition['thresholds']
): boolean {
  const { paidSpend, organicPosition, bounceRate, impressions, ctr } = data;

  switch (ruleId) {
    case 'high-spend-low-organic':
    case 'paid-dependency':
      return (
        paidSpend > thresholds.highSpendThreshold &&
        (organicPosition === null || organicPosition > 10)
      );

    case 'high-traffic-high-bounce':
    case 'ux-issue':
      return (
        impressions > 1000 &&
        bounceRate !== null &&
        bounceRate > thresholds.highBounceRateThreshold
      );

    case 'high-impressions-low-ctr':
    case 'meta-issue':
      return (
        impressions > 1000 &&
        ctr !== null &&
        ctr < thresholds.lowCtrThreshold
      );

    case 'conversion-blocker':
      return (
        paidSpend > thresholds.highSpendThreshold * 0.5 &&
        bounceRate !== null &&
        bounceRate > thresholds.highBounceRateThreshold
      );

    default:
      return false;
  }
}

/**
 * Apply default page rules using skill-based thresholds.
 */
function applyDefaultPageRulesWithThresholds(
  data: {
    paidSpend: number;
    organicPosition: number | null;
    bounceRate: number | null;
    impressions: number;
    ctr: number | null;
  },
  thresholds: ScoutSkillDefinition['thresholds']
): { priority: BattlegroundPriority; reason: CriticalPageReason } | null {
  const { paidSpend, organicPosition, bounceRate, impressions, ctr } = data;

  // Rule 1: High Paid Spend + Low Organic Rank
  if (paidSpend > thresholds.highSpendThreshold && (organicPosition === null || organicPosition > 10)) {
    return { priority: 'high', reason: 'high_spend_low_organic' };
  }

  // Rule 2: High Traffic + High Bounce Rate
  if (impressions > 1000 && bounceRate !== null && bounceRate > thresholds.highBounceRateThreshold) {
    const priority = determinePriority(bounceRate > 0.8, paidSpend > 50);
    return { priority, reason: 'high_traffic_high_bounce' };
  }

  // Rule 3: High Impressions + Low CTR
  if (impressions > 1000 && ctr !== null && ctr < thresholds.lowCtrThreshold) {
    const priority = determinePriority(ctr < 0.01, impressions > 5000);
    return { priority, reason: 'high_impressions_low_ctr' };
  }

  return null;
}

/**
 * Map page rule ID to CriticalPageReason.
 */
function mapPageRuleIdToReason(ruleId: string): CriticalPageReason {
  const mappings: Record<string, CriticalPageReason> = {
    'high-spend-low-organic': 'high_spend_low_organic',
    'paid-dependency': 'high_spend_low_organic',
    'high-traffic-high-bounce': 'high_traffic_high_bounce',
    'ux-issue': 'high_traffic_high_bounce',
    'conversion-blocker': 'high_traffic_high_bounce',
    'high-impressions-low-ctr': 'high_impressions_low_ctr',
    'meta-issue': 'high_impressions_low_ctr',
  };

  return mappings[ruleId] ?? 'high_spend_low_organic';
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
