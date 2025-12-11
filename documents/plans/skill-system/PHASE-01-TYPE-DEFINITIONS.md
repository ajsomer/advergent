# Phase 1: Type Definitions & Interfaces

## Goal

Define all TypeScript types and interfaces so the skill system compiles and provides type safety across the entire codebase.

## File to Create

**`apps/api/src/services/interplay-report/skills/types.ts`**

## Types to Define

### Core Types

```typescript
// Business type enum - the primary discriminator for skill loading
export type BusinessType = 'ecommerce' | 'lead-gen' | 'saas' | 'local';

// The complete skill bundle loaded for a business type
export interface AgentSkillBundle {
  businessType: BusinessType;
  version: string;

  scout: ScoutSkillDefinition;
  researcher: ResearcherSkillDefinition;
  sem: SEMSkillDefinition;
  seo: SEOSkillDefinition;
  director: DirectorSkillDefinition;
}
```

### Scout Skill Definition

The Scout agent performs data triage (no AI). Its skill defines thresholds and rules for identifying priority items.

```typescript
export interface ScoutSkillDefinition {
  version: string;

  // Threshold overrides for keyword identification
  thresholds: {
    highSpendThreshold: number;        // $ amount to consider "high spend"
    lowRoasThreshold: number;          // ROAS below this is "low"
    cannibalizationPosition: number;   // Organic position threshold
    highBounceRateThreshold: number;   // % bounce rate to flag
    lowCtrThreshold: number;           // % CTR to flag
    minImpressionsForAnalysis: number; // Minimum data for inclusion
  };

  // Priority classification rules
  priorityRules: {
    battlegroundKeywords: PriorityRule[];
    criticalPages: PriorityRule[];
  };

  // Metrics to include/exclude from analysis
  metrics: {
    include: string[];    // Metrics relevant to this business type
    exclude: string[];    // Metrics to ignore (e.g., ROAS for lead-gen)
    primary: string[];    // Most important metrics for sorting
  };

  // Output limits
  limits: {
    maxBattlegroundKeywords: number;
    maxCriticalPages: number;
  };
}

export interface PriorityRule {
  id: string;
  name: string;
  description: string;
  condition: string;      // Human-readable condition description
  priority: 'critical' | 'high' | 'medium' | 'low';
  enabled: boolean;
}
```

### Researcher Skill Definition

The Researcher agent enriches data with competitive metrics and page content.

```typescript
export interface ResearcherSkillDefinition {
  version: string;

  // Keyword enrichment configuration
  keywordEnrichment: {
    competitiveMetrics: {
      required: string[];
      optional: string[];
      irrelevant: string[];
    };
    priorityBoosts: PriorityBoost[];
  };

  // Page content enrichment - business-type aware
  pageEnrichment: {
    // Standard extractions (always run)
    standardExtractions: {
      title: boolean;
      h1: boolean;
      metaDescription: boolean;
      canonicalUrl: boolean;
      wordCount: boolean;
    };

    // Schema extraction (business-type aware)
    schemaExtraction: {
      lookFor: string[];           // Schema types to specifically extract
      flagIfPresent: string[];     // Schema types that shouldn't exist
      flagIfMissing: string[];     // Schema types that should exist
    };

    // Business-specific content signals
    contentSignals: ContentSignal[];

    // Page classification hints
    pageClassification: {
      patterns: PagePattern[];
      defaultType: string;
      confidenceThreshold: number;
    };
  };

  // Data quality thresholds
  dataQuality: {
    minKeywordsWithCompetitiveData: number;
    minPagesWithContent: number;
    maxFetchTimeout: number;
    maxConcurrentFetches: number;
  };
}

export interface PriorityBoost {
  metric: string;
  condition: string;
  boost: number;
  reason: string;
}

export interface ContentSignal {
  id: string;
  name: string;
  selector: string;              // CSS selector or detection rule
  importance: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  businessContext: string;
}

export interface PagePattern {
  pattern: string;               // Regex or URL pattern
  pageType: string;
  description: string;
  confidence: number;
}
```

### SEM Skill Definition

The SEM agent provides AI-powered keyword strategy analysis.

```typescript
export interface SEMSkillDefinition {
  version: string;

  // Business context for prompt
  context: {
    businessModel: string;
    conversionDefinition: string;
    typicalCustomerJourney: string;
  };

  // KPIs and benchmarks
  kpis: {
    primary: KPIDefinition[];
    secondary: KPIDefinition[];
    irrelevant: string[];
  };

  benchmarks: {
    ctr: ThresholdSet;
    conversionRate: ThresholdSet;
    cpc: ThresholdSet;
    roas?: ThresholdSet;
    costPerConversion?: ThresholdSet;
  };

  // Analysis guidance
  analysis: {
    keyPatterns: AnalysisPattern[];
    antiPatterns: AnalysisPattern[];
    opportunities: OpportunityType[];
  };

  // Prompt configuration
  prompt: {
    roleContext: string;
    analysisInstructions: string;
    outputGuidance: string;
    examples: SEMExample[];
    constraints: string[];
  };

  // Output filtering
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

export interface KPIDefinition {
  metric: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  targetDirection: 'higher' | 'lower' | 'target';
  benchmark?: number;
  businessContext: string;
}

export interface ThresholdSet {
  excellent: number;
  good: number;
  average: number;
  poor: number;
}

export interface AnalysisPattern {
  id: string;
  name: string;
  description: string;
  indicators: string[];
  recommendation: string;
}

export interface OpportunityType {
  type: string;
  description: string;
  signals: string[];
  typicalAction: string;
}

export interface SEMExample {
  scenario: string;
  data: string;
  recommendation: string;
  reasoning: string;
}
```

### SEO Skill Definition

The SEO agent provides AI-powered page optimization analysis.

```typescript
export interface SEOSkillDefinition {
  version: string;

  // Business context for prompt
  context: {
    siteType: string;
    primaryGoal: string;
    contentStrategy: string;
  };

  // Schema markup rules
  schema: {
    required: SchemaRule[];
    recommended: SchemaRule[];
    invalid: SchemaRule[];
    pageTypeRules: PageTypeSchemaRule[];
  };

  // KPIs and benchmarks
  kpis: {
    primary: KPIDefinition[];
    secondary: KPIDefinition[];
    irrelevant: string[];
  };

  benchmarks: {
    organicCtr: ThresholdSet;
    bounceRate: ThresholdSet;
    avgPosition: ThresholdSet;
    pageLoadTime?: ThresholdSet;
  };

  // Page analysis guidance
  analysis: {
    contentPatterns: ContentPattern[];
    technicalChecks: TechnicalCheck[];
    onPageFactors: OnPageFactor[];
  };

  // Prompt configuration
  prompt: {
    roleContext: string;
    analysisInstructions: string;
    outputGuidance: string;
    examples: SEOExample[];
    constraints: string[];
  };

  // Common issues specific to this business type
  commonIssues: {
    critical: IssueDefinition[];
    warnings: IssueDefinition[];
    falsePositives: string[];
  };

  // Output filtering
  output: {
    recommendationTypes: {
      prioritize: string[];
      deprioritize: string[];
      exclude: string[];
    };
    maxRecommendations: number;
  };
}

export interface SchemaRule {
  type: string;
  description: string;
  importance: 'required' | 'recommended' | 'optional';
  validationNotes: string;
}

export interface PageTypeSchemaRule {
  pageType: string;
  requiredSchema: string[];
  recommendedSchema: string[];
  invalidSchema: string[];
}

export interface ContentPattern {
  id: string;
  name: string;
  goodPattern: string;
  badPattern: string;
  recommendation: string;
}

export interface TechnicalCheck {
  id: string;
  name: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}

export interface OnPageFactor {
  factor: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
  guidance: string;
}

export interface SEOExample {
  scenario: string;
  pageData: string;
  recommendation: string;
  reasoning: string;
}

export interface IssueDefinition {
  id: string;
  pattern: string;
  description: string;
  recommendation: string;
}
```

### Director Skill Definition

The Director agent synthesizes SEM and SEO recommendations.

```typescript
export interface DirectorSkillDefinition {
  version: string;

  // Business context for synthesis
  context: {
    businessPriorities: string[];
    successMetrics: string[];
    executiveFraming: string;
  };

  // Synthesis rules
  synthesis: {
    conflictResolution: ConflictRule[];
    synergyIdentification: SynergyRule[];
    prioritization: PrioritizationRule[];
  };

  // Filtering and limits
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

  // Executive summary configuration
  executiveSummary: {
    focusAreas: string[];
    metricsToQuantify: string[];
    framingGuidance: string;
    maxHighlights: number;
  };

  // Prompt configuration
  prompt: {
    roleContext: string;
    synthesisInstructions: string;
    prioritizationGuidance: string;
    outputFormat: string;
    constraints: string[];
  };

  // Output structure
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

export interface ConflictRule {
  id: string;
  semSignal: string;
  seoSignal: string;
  resolution: string;
  resultingType: 'sem' | 'seo' | 'hybrid' | 'drop';
}

export interface SynergyRule {
  id: string;
  semCondition: string;
  seoCondition: string;
  combinedRecommendation: string;
}

export interface PrioritizationRule {
  condition: string;
  adjustment: 'boost' | 'reduce' | 'require' | 'exclude';
  factor: number;
  reason: string;
}
```

## Dependencies

- None (this is the foundation)

## Validation Criteria

- [ ] All interfaces export correctly
- [ ] No TypeScript compilation errors
- [ ] Types are importable from other files in the project
- [ ] Zod schemas can be generated from types (if needed for runtime validation)

## Estimated Effort

Small - primarily type definitions with no business logic.
