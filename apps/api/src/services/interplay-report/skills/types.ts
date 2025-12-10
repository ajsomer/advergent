/**
 * Phase 1: Skill System Type Definitions
 *
 * Defines all TypeScript types and interfaces for the business-type-aware
 * skill system. Skills customize agent behavior based on business type
 * (ecommerce, lead-gen, saas, local).
 */

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Business type enum - the primary discriminator for skill loading.
 * Each business type has different KPIs, benchmarks, and analysis priorities.
 */
export type BusinessType = 'ecommerce' | 'lead-gen' | 'saas' | 'local';

/**
 * The complete skill bundle loaded for a business type.
 * Contains skill definitions for all five agents.
 */
export interface AgentSkillBundle {
  businessType: BusinessType;
  version: string;

  scout: ScoutSkillDefinition;
  researcher: ResearcherSkillDefinition;
  sem: SEMSkillDefinition;
  seo: SEOSkillDefinition;
  director: DirectorSkillDefinition;
}

// ============================================================================
// SHARED SKILL TYPES
// ============================================================================

/**
 * Priority level for rules and recommendations.
 */
export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low';

/**
 * Importance level for KPIs and factors.
 */
export type ImportanceLevel = 'critical' | 'high' | 'medium' | 'low';

/**
 * KPI definition used by both SEM and SEO agents.
 */
export interface KPIDefinition {
  metric: string;
  importance: ImportanceLevel;
  description: string;
  targetDirection: 'higher' | 'lower' | 'target';
  benchmark?: number;
  businessContext: string;
}

/**
 * Threshold set for benchmarking metrics.
 */
export interface ThresholdSet {
  excellent: number;
  good: number;
  average: number;
  poor: number;
}

// ============================================================================
// SCOUT SKILL DEFINITION
// ============================================================================

/**
 * Priority rule for identifying battleground keywords and critical pages.
 */
export interface PriorityRule {
  id: string;
  name: string;
  description: string;
  condition: string; // Human-readable condition description
  priority: PriorityLevel;
  enabled: boolean;
}

/**
 * Scout agent skill definition.
 * The Scout performs data triage (no AI) using configurable thresholds and rules.
 */
export interface ScoutSkillDefinition {
  version: string;

  /**
   * Threshold overrides for keyword identification.
   * Business types have different definitions of "high spend" or "low ROAS".
   */
  thresholds: {
    highSpendThreshold: number; // $ amount to consider "high spend"
    lowRoasThreshold: number; // ROAS below this is "low"
    cannibalizationPosition: number; // Organic position threshold
    highBounceRateThreshold: number; // % bounce rate to flag
    lowCtrThreshold: number; // % CTR to flag
    minImpressionsForAnalysis: number; // Minimum data for inclusion
  };

  /**
   * Priority classification rules for identifying important items.
   */
  priorityRules: {
    battlegroundKeywords: PriorityRule[];
    criticalPages: PriorityRule[];
  };

  /**
   * Metrics configuration for this business type.
   */
  metrics: {
    include: string[]; // Metrics relevant to this business type
    exclude: string[]; // Metrics to ignore (e.g., ROAS for lead-gen)
    primary: string[]; // Most important metrics for sorting
  };

  /**
   * Output limits to control analysis scope.
   */
  limits: {
    maxBattlegroundKeywords: number;
    maxCriticalPages: number;
  };
}

// ============================================================================
// RESEARCHER SKILL DEFINITION
// ============================================================================

/**
 * Priority boost rule for adjusting keyword importance.
 */
export interface PriorityBoost {
  metric: string;
  condition: string;
  boost: number;
  reason: string;
}

/**
 * Content signal to detect on pages (business-type specific).
 */
export interface ContentSignal {
  id: string;
  name: string;
  selector: string; // CSS selector or detection rule
  importance: ImportanceLevel;
  description: string;
  businessContext: string;
}

/**
 * URL pattern for page classification.
 */
export interface PagePattern {
  pattern: string; // Regex or URL pattern
  pageType: string;
  description: string;
  confidence: number;
}

/**
 * Researcher agent skill definition.
 * Enriches data with competitive metrics and page content.
 */
export interface ResearcherSkillDefinition {
  version: string;

  /**
   * Keyword enrichment configuration.
   */
  keywordEnrichment: {
    competitiveMetrics: {
      required: string[];
      optional: string[];
      irrelevant: string[];
    };
    priorityBoosts: PriorityBoost[];
  };

  /**
   * Page content enrichment - business-type aware.
   */
  pageEnrichment: {
    /**
     * Standard extractions that always run.
     */
    standardExtractions: {
      title: boolean;
      h1: boolean;
      metaDescription: boolean;
      canonicalUrl: boolean;
      wordCount: boolean;
    };

    /**
     * Schema extraction rules (business-type aware).
     */
    schemaExtraction: {
      lookFor: string[]; // Schema types to specifically extract
      flagIfPresent: string[]; // Schema types that shouldn't exist
      flagIfMissing: string[]; // Schema types that should exist
    };

    /**
     * Business-specific content signals to detect.
     */
    contentSignals: ContentSignal[];

    /**
     * Page classification configuration.
     */
    pageClassification: {
      patterns: PagePattern[];
      defaultType: string;
      confidenceThreshold: number;
    };
  };

  /**
   * Data quality thresholds for enrichment.
   */
  dataQuality: {
    minKeywordsWithCompetitiveData: number;
    minPagesWithContent: number;
    maxFetchTimeout: number;
    maxConcurrentFetches: number;
  };
}

// ============================================================================
// SEM SKILL DEFINITION
// ============================================================================

/**
 * Analysis pattern for identifying opportunities or issues.
 */
export interface AnalysisPattern {
  id: string;
  name: string;
  description: string;
  indicators: string[];
  recommendation: string;
}

/**
 * Opportunity type that can be identified during analysis.
 */
export interface OpportunityType {
  type: string;
  description: string;
  signals: string[];
  typicalAction: string;
}

/**
 * Example for few-shot prompting in SEM analysis.
 */
export interface SEMExample {
  scenario: string;
  data: string;
  recommendation: string;
  reasoning: string;
}

/**
 * SEM agent skill definition.
 * Provides AI-powered keyword strategy analysis.
 */
export interface SEMSkillDefinition {
  version: string;

  /**
   * Business context for prompt construction.
   */
  context: {
    businessModel: string;
    conversionDefinition: string;
    typicalCustomerJourney: string;
  };

  /**
   * KPIs and their importance for this business type.
   */
  kpis: {
    primary: KPIDefinition[];
    secondary: KPIDefinition[];
    irrelevant: string[];
  };

  /**
   * Metric benchmarks for evaluation.
   */
  benchmarks: {
    ctr: ThresholdSet;
    conversionRate: ThresholdSet;
    cpc: ThresholdSet;
    roas?: ThresholdSet;
    costPerConversion?: ThresholdSet;
  };

  /**
   * Analysis guidance for the AI agent.
   */
  analysis: {
    keyPatterns: AnalysisPattern[];
    antiPatterns: AnalysisPattern[];
    opportunities: OpportunityType[];
  };

  /**
   * Prompt configuration for Claude.
   */
  prompt: {
    roleContext: string;
    analysisInstructions: string;
    outputGuidance: string;
    examples: SEMExample[];
    constraints: string[];
  };

  /**
   * Output filtering rules.
   */
  output: {
    recommendationTypes: {
      prioritize: string[];
      deprioritize: string[];
      exclude: string[];
    };
    maxRecommendations: number;
    requireQuantifiedImpact: boolean;
  };
}

// ============================================================================
// SEO SKILL DEFINITION
// ============================================================================

/**
 * Schema markup rule for validation.
 */
export interface SchemaRule {
  type: string;
  description: string;
  importance: 'required' | 'recommended' | 'optional';
  validationNotes: string;
}

/**
 * Page-type specific schema rules.
 */
export interface PageTypeSchemaRule {
  pageType: string;
  requiredSchema: string[];
  recommendedSchema: string[];
  invalidSchema: string[];
}

/**
 * Content pattern for SEO analysis.
 */
export interface ContentPattern {
  id: string;
  name: string;
  goodPattern: string;
  badPattern: string;
  recommendation: string;
}

/**
 * Technical SEO check to perform.
 */
export interface TechnicalCheck {
  id: string;
  name: string;
  importance: ImportanceLevel;
  description: string;
}

/**
 * On-page SEO factor to evaluate.
 */
export interface OnPageFactor {
  factor: string;
  importance: ImportanceLevel;
  guidance: string;
}

/**
 * Example for few-shot prompting in SEO analysis.
 */
export interface SEOExample {
  scenario: string;
  pageData: string;
  recommendation: string;
  reasoning: string;
}

/**
 * Issue definition for common problems.
 */
export interface IssueDefinition {
  id: string;
  pattern: string;
  description: string;
  recommendation: string;
}

/**
 * SEO agent skill definition.
 * Provides AI-powered page optimization analysis.
 */
export interface SEOSkillDefinition {
  version: string;

  /**
   * Business context for prompt construction.
   */
  context: {
    siteType: string;
    primaryGoal: string;
    contentStrategy: string;
  };

  /**
   * Schema markup rules for this business type.
   */
  schema: {
    required: SchemaRule[];
    recommended: SchemaRule[];
    invalid: SchemaRule[];
    pageTypeRules: PageTypeSchemaRule[];
  };

  /**
   * KPIs and their importance for this business type.
   */
  kpis: {
    primary: KPIDefinition[];
    secondary: KPIDefinition[];
    irrelevant: string[];
  };

  /**
   * Metric benchmarks for evaluation.
   */
  benchmarks: {
    organicCtr: ThresholdSet;
    bounceRate: ThresholdSet;
    avgPosition: ThresholdSet;
    pageLoadTime?: ThresholdSet;
  };

  /**
   * Page analysis guidance for the AI agent.
   */
  analysis: {
    contentPatterns: ContentPattern[];
    technicalChecks: TechnicalCheck[];
    onPageFactors: OnPageFactor[];
  };

  /**
   * Prompt configuration for Claude.
   */
  prompt: {
    roleContext: string;
    analysisInstructions: string;
    outputGuidance: string;
    examples: SEOExample[];
    constraints: string[];
  };

  /**
   * Common issues specific to this business type.
   */
  commonIssues: {
    critical: IssueDefinition[];
    warnings: IssueDefinition[];
    falsePositives: string[];
  };

  /**
   * Output filtering rules.
   */
  output: {
    recommendationTypes: {
      prioritize: string[];
      deprioritize: string[];
      exclude: string[];
    };
    maxRecommendations: number;
  };
}

// ============================================================================
// DIRECTOR SKILL DEFINITION
// ============================================================================

/**
 * Conflict resolution rule for when SEM and SEO recommendations conflict.
 */
export interface ConflictRule {
  id: string;
  semSignal: string;
  seoSignal: string;
  resolution: string;
  resultingType: 'sem' | 'seo' | 'hybrid' | 'drop';
}

/**
 * Synergy rule for combining SEM and SEO recommendations.
 */
export interface SynergyRule {
  id: string;
  semCondition: string;
  seoCondition: string;
  combinedRecommendation: string;
}

/**
 * Prioritization rule for adjusting recommendation importance.
 */
export interface PrioritizationRule {
  condition: string;
  adjustment: 'boost' | 'reduce' | 'require' | 'exclude';
  factor: number;
  reason: string;
}

/**
 * Director agent skill definition.
 * Synthesizes SEM and SEO recommendations into unified output.
 */
export interface DirectorSkillDefinition {
  version: string;

  /**
   * Business context for synthesis.
   */
  context: {
    businessPriorities: string[];
    successMetrics: string[];
    executiveFraming: string;
  };

  /**
   * Synthesis rules for combining recommendations.
   */
  synthesis: {
    conflictResolution: ConflictRule[];
    synergyIdentification: SynergyRule[];
    prioritization: PrioritizationRule[];
  };

  /**
   * Filtering and limits for output.
   */
  filtering: {
    maxRecommendations: number;
    minImpactThreshold: 'high' | 'medium' | 'low';
    impactWeights: {
      revenue: number;
      cost: number;
      effort: number;
      risk: number;
    };
    mustInclude: string[];
    mustExclude: string[];
  };

  /**
   * Executive summary configuration.
   */
  executiveSummary: {
    focusAreas: string[];
    metricsToQuantify: string[];
    framingGuidance: string;
    maxHighlights: number;
  };

  /**
   * Prompt configuration for Claude.
   */
  prompt: {
    roleContext: string;
    synthesisInstructions: string;
    prioritizationGuidance: string;
    outputFormat: string;
    constraints: string[];
  };

  /**
   * Output structure configuration.
   */
  output: {
    recommendationFormat: {
      requireTitle: boolean;
      requireDescription: boolean;
      requireImpact: boolean;
      requireEffort: boolean;
      requireActionItems: boolean;
      maxActionItems: number;
    };
    categoryLabels: {
      sem: string;
      seo: string;
      hybrid: string;
    };
  };
}
