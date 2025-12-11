/**
 * Phase 6: Constraint Validation System
 *
 * Validates upstream agent outputs against skill constraints, filters violations,
 * and logs for debugging.
 *
 * Design Principle: "Strict Upstream"
 * Agents should never generate invalid recommendations in the first place.
 * The Director is a safety net, not a primary filter.
 */

import { logger } from '@/utils/logger.js';
import crypto from 'crypto';
import type { DirectorSkillDefinition } from '../skills/types.js';
import type { SEMAgentOutput, SEOAgentOutput, SEMAction, SEOAction } from '../types.js';

const constraintLogger = logger.child({ module: 'constraint-validation' });

// ============================================================================
// NORMALIZED ACTION TYPES
// ============================================================================

/**
 * Action type categorization for filtering and analysis.
 */
export type ActionType =
  | 'bid-adjustment'
  | 'budget-change'
  | 'campaign-structure'
  | 'keyword-targeting'
  | 'schema-implementation'
  | 'schema-removal'
  | 'content-change'
  | 'technical-fix'
  | 'other';

/**
 * Normalized action representation that unifies SEM and SEO actions
 * for consistent constraint validation.
 */
export interface NormalizedAction {
  /** Unique identifier for the action */
  id: string;
  /** Source agent (sem or seo) */
  source: 'sem' | 'seo';
  /** Categorized action type */
  type: ActionType;
  /** Full recommendation text (lowercased for matching) */
  text: string;
  /** Extracted keywords/entities from the recommendation */
  keywords: string[];
  /** Metrics mentioned (roas, cpl, revenue, etc.) */
  metrics: string[];
  /** Schema types mentioned (Product, Service, etc.) */
  schemas: string[];
  /** Original action object for reference */
  originalAction: SEMAction | SEOAction;
}

// ============================================================================
// ACTION TYPE INFERENCE
// ============================================================================

/**
 * Patterns for inferring action types from recommendation text.
 */
const ACTION_TYPE_PATTERNS: Record<ActionType, RegExp[]> = {
  'bid-adjustment': [
    /\b(reduce|increase|adjust|lower|raise)\s+(bids?|bidding)/i,
    /\bbid\s+(strategy|adjustment|modifier)/i,
    /\btarget\s+(roas|cpa)/i,
    /\bsmart\s+bidding/i,
  ],
  'budget-change': [
    /\b(increase|decrease|reallocate|shift)\s+budget/i,
    /\bbudget\s+(allocation|reallocation)/i,
    /\bspend\s+(more|less)/i,
  ],
  'campaign-structure': [
    /\b(create|restructure|consolidate|split)\s+(campaign|ad\s*group)/i,
    /\bcampaign\s+structure/i,
    /\bshopping\s+campaign/i,
    /\bperformance\s+max/i,
    /\bpmax/i,
  ],
  'keyword-targeting': [
    /\b(add|remove|pause)\s+(keyword|negative)/i,
    /\bmatch\s+type/i,
    /\bkeyword\s+(targeting|expansion)/i,
    /\bnegative\s+keyword/i,
  ],
  'schema-implementation': [
    /\b(add|implement|create)\s+\w*\s*schema/i,
    /\bschema\s+(markup|implementation)/i,
    /\bstructured\s+data/i,
    /\bjson-?ld/i,
  ],
  'schema-removal': [
    /\b(remove|delete|fix)\s+\w*\s*schema/i,
    /\bincorrect\s+schema/i,
    /\binvalid\s+schema/i,
  ],
  'content-change': [
    /\b(update|rewrite|improve|optimize)\s+(title|meta|h1|content|copy)/i,
    /\bcontent\s+(optimization|improvement)/i,
    /\btitle\s+tag/i,
    /\bmeta\s+description/i,
  ],
  'technical-fix': [
    /\b(fix|resolve|address)\s+(page\s*speed|mobile|ssl|redirect|404)/i,
    /\btechnical\s+(seo|issue|fix)/i,
    /\bcore\s+web\s+vitals/i,
    /\bpage\s+speed/i,
  ],
  'other': [],
};

/**
 * Infers the action type from recommendation text.
 */
function inferActionType(text: string, source: 'sem' | 'seo'): ActionType {
  for (const [actionType, patterns] of Object.entries(ACTION_TYPE_PATTERNS)) {
    if (actionType === 'other') continue;
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return actionType as ActionType;
      }
    }
  }
  // Default based on source
  return source === 'sem' ? 'keyword-targeting' : 'content-change';
}

// ============================================================================
// EXTRACTION FUNCTIONS
// ============================================================================

/**
 * Extracts keywords and entities from recommendation text.
 * Looks for quoted strings and bracketed terms.
 */
function extractKeywords(text: string): string[] {
  const keywords: string[] = [];

  // Extract double-quoted strings
  const doubleQuotedMatches = text.match(/"([^"]+)"/g);
  if (doubleQuotedMatches) {
    keywords.push(...doubleQuotedMatches.map((q) => q.replace(/"/g, '')));
  }

  // Extract single-quoted strings
  const singleQuotedMatches = text.match(/'([^']+)'/g);
  if (singleQuotedMatches) {
    keywords.push(...singleQuotedMatches.map((q) => q.replace(/'/g, '')));
  }

  // Extract bracketed terms
  const bracketedMatches = text.match(/\[([^\]]+)\]/g);
  if (bracketedMatches) {
    keywords.push(...bracketedMatches.map((b) => b.replace(/[\[\]]/g, '')));
  }

  return [...new Set(keywords)];
}

/**
 * Patterns for detecting metrics mentioned in text.
 */
const METRIC_PATTERNS: Record<string, RegExp> = {
  roas: /\broas\b|return on ad spend/i,
  revenue: /\brevenue\b|\bearnings\b|\bsales\b/i,
  aov: /\baov\b|average order value/i,
  cpl: /\bcpl\b|cost per lead/i,
  cpc: /\bcpc\b|cost per click/i,
  ctr: /\bctr\b|click.through rate/i,
  cpa: /\bcpa\b|cost per acquisition/i,
  ltv: /\bltv\b|lifetime value/i,
  mrr: /\bmrr\b|monthly recurring revenue/i,
  arr: /\barr\b|annual recurring revenue/i,
  churn: /\bchurn\b|churn rate/i,
};

/**
 * Extracts metrics mentioned in the recommendation text.
 */
function extractMetrics(text: string): string[] {
  return Object.entries(METRIC_PATTERNS)
    .filter(([_, pattern]) => pattern.test(text))
    .map(([metric]) => metric);
}

/**
 * Schema types to detect in recommendations.
 */
const SCHEMA_TYPES = [
  'Product',
  'Offer',
  'AggregateOffer',
  'Service',
  'ProfessionalService',
  'LocalBusiness',
  'Organization',
  'FAQPage',
  'Article',
  'BreadcrumbList',
  'HowTo',
  'Review',
  'AggregateRating',
  'Event',
  'SoftwareApplication',
  'WebApplication',
  'VideoObject',
  'ImageObject',
];

/**
 * Extracts schema types mentioned in the recommendation text.
 */
function extractSchemaTypes(text: string): string[] {
  return SCHEMA_TYPES.filter((schema) => new RegExp(`\\b${schema}\\b`, 'i').test(text));
}

// ============================================================================
// ACTION NORMALIZATION
// ============================================================================

/**
 * Normalizes a SEM action for constraint validation.
 */
export function normalizeSEMAction(action: SEMAction): NormalizedAction {
  const text = `${action.action} ${action.reasoning}`.toLowerCase();

  return {
    id: crypto.randomUUID(),
    source: 'sem',
    type: inferActionType(text, 'sem'),
    text,
    keywords: extractKeywords(text),
    metrics: extractMetrics(text),
    schemas: [], // SEM actions typically don't mention schemas
    originalAction: action,
  };
}

/**
 * Normalizes an SEO action for constraint validation.
 */
export function normalizeSEOAction(action: SEOAction): NormalizedAction {
  const text = `${action.recommendation} ${action.specificActions.join(' ')}`.toLowerCase();

  return {
    id: crypto.randomUUID(),
    source: 'seo',
    type: inferActionType(text, 'seo'),
    text,
    keywords: extractKeywords(text),
    metrics: extractMetrics(text),
    schemas: extractSchemaTypes(text),
    originalAction: action,
  };
}

// ============================================================================
// EXCLUSION RULES
// ============================================================================

/**
 * An exclusion rule that determines whether an action should be filtered.
 */
export interface ExclusionRule {
  /** Rule identifier (matches the mustExclude pattern) */
  id: string;
  /** Human-readable description of what this rule excludes */
  description: string;
  /** Function that returns true if the action should be excluded */
  match: (action: NormalizedAction) => boolean;
}

/**
 * Builds exclusion rules from skill configuration patterns.
 *
 * Supported patterns:
 * - "metric:roas" - Exclude if mentions ROAS metric
 * - "schema:Product" - Exclude if recommends Product schema
 * - "type:shopping-campaign" - Exclude if contains keyword phrase
 * - Plain text - Simple text match
 */
export function buildExclusionRules(mustExclude: string[]): ExclusionRule[] {
  return mustExclude.map((exclusion) => {
    // Pattern: "metric:roas" - exclude if mentions specific metric
    if (exclusion.startsWith('metric:')) {
      const metric = exclusion.replace('metric:', '');
      return {
        id: exclusion,
        description: `Excludes actions mentioning ${metric}`,
        match: (action) => action.metrics.includes(metric),
      };
    }

    // Pattern: "schema:Product" - exclude if recommends specific schema
    if (exclusion.startsWith('schema:')) {
      const schema = exclusion.replace('schema:', '');
      return {
        id: exclusion,
        description: `Excludes actions recommending ${schema} schema`,
        match: (action) =>
          action.schemas.some((s) => s.toLowerCase() === schema.toLowerCase()) &&
          action.type === 'schema-implementation',
      };
    }

    // Pattern: "type:shopping-campaign" - exclude by action type keyword
    if (exclusion.startsWith('type:')) {
      const keyword = exclusion.replace('type:', '').replace(/-/g, ' ').toLowerCase();
      return {
        id: exclusion,
        description: `Excludes actions containing "${keyword}"`,
        match: (action) => action.text.includes(keyword),
      };
    }

    // Default: simple text match
    return {
      id: exclusion,
      description: `Excludes actions containing "${exclusion}"`,
      match: (action) => action.text.includes(exclusion.toLowerCase()),
    };
  });
}

// ============================================================================
// CONSTRAINT VALIDATION
// ============================================================================

/**
 * A detected constraint violation.
 */
export interface ConstraintViolation {
  /** Source agent that generated the violation */
  source: 'sem' | 'seo';
  /** ID of the normalized action */
  actionId: string;
  /** ID of the exclusion rule that was violated */
  ruleId: string;
  /** Description of what the rule excludes */
  ruleDescription: string;
  /** Preview of the content that matched (truncated) */
  matchedContent: string;
}

/**
 * Result of constraint validation.
 */
export interface ConstraintValidationResult {
  /** Detected constraint violations */
  violations: ConstraintViolation[];
  /** Actions that passed validation (filtered list) */
  filtered: NormalizedAction[];
  /** Original count before filtering */
  originalCount: number;
  /** Count after filtering */
  filteredCount: number;
}

/**
 * Validates upstream agent outputs against skill constraints.
 *
 * This function:
 * 1. Normalizes all SEM and SEO actions
 * 2. Builds exclusion rules from skill configuration
 * 3. Checks each action against each rule
 * 4. Filters out violating actions
 * 5. Logs violations for debugging
 *
 * @param semOutput - Output from the SEM agent
 * @param seoOutput - Output from the SEO agent
 * @param skill - Director skill definition with filtering rules
 * @returns Validation result with violations and filtered actions
 */
export function validateUpstreamConstraints(
  semOutput: SEMAgentOutput,
  seoOutput: SEOAgentOutput,
  skill: DirectorSkillDefinition
): ConstraintValidationResult {
  const violations: ConstraintViolation[] = [];
  const filtered: NormalizedAction[] = [];

  // Build exclusion rules from skill config
  const rules = buildExclusionRules(skill.filtering.mustExclude);

  // Normalize all actions
  const semActions = semOutput.semActions.map(normalizeSEMAction);
  const seoActions = seoOutput.seoActions.map(normalizeSEOAction);
  const allActions = [...semActions, ...seoActions];

  // Check each action against each rule
  for (const action of allActions) {
    let excluded = false;

    for (const rule of rules) {
      if (rule.match(action)) {
        violations.push({
          source: action.source,
          actionId: action.id,
          ruleId: rule.id,
          ruleDescription: rule.description,
          matchedContent: action.text.slice(0, 200),
        });
        excluded = true;
        break; // One violation is enough to exclude
      }
    }

    if (!excluded) {
      filtered.push(action);
    }
  }

  // Log violations (indicates prompt weakness in upstream agents)
  if (violations.length > 0) {
    constraintLogger.warn(
      {
        violationCount: violations.length,
        violations: violations.map((v) => ({
          source: v.source,
          ruleId: v.ruleId,
          contentPreview: v.matchedContent.slice(0, 100),
        })),
        skillVersion: skill.version,
      },
      'Upstream constraint violations detected - filtering from output'
    );
  }

  return {
    violations,
    filtered,
    originalCount: allActions.length,
    filteredCount: filtered.length,
  };
}

// ============================================================================
// UTILITIES FOR EXTRACTING ORIGINAL ACTIONS
// ============================================================================

/**
 * Extracts the original SEM actions from validated normalized actions.
 */
export function extractFilteredSEMActions(validated: NormalizedAction[]): SEMAction[] {
  return validated
    .filter((action) => action.source === 'sem')
    .map((action) => action.originalAction as SEMAction);
}

/**
 * Extracts the original SEO actions from validated normalized actions.
 */
export function extractFilteredSEOActions(validated: NormalizedAction[]): SEOAction[] {
  return validated
    .filter((action) => action.source === 'seo')
    .map((action) => action.originalAction as SEOAction);
}
