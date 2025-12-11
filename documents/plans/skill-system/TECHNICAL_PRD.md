# Technical PRD: Agent Skill System

## Problem Statement

The interplay report system generates inaccurate recommendations because agents lack business-type context. A product schema error flagged on an ecommerce category page is a legitimate issue, but for a lead-gen business, product schema shouldn't exist at all. Currently, all clients receive generic analysis regardless of their business model.

**Root Cause:** Agents operate with universal assumptions about what "good" looks like, when in reality:
- Valid schema types differ by business model
- Relevant KPIs vary significantly across industries
- Common errors and red flags are business-type specific
- Optimization strategies depend on conversion models

**Impact:** Reports contain false positives, miss critical issues, and provide generic recommendations that don't account for business context.

---

## Solution Overview

Implement a **Skill System** that loads domain-specific expertise files for **each agent** based on client business type. When a user adds a client, they select a business category (ecommerce, lead-gen, SaaS, local). This selection loads **agent-specific skill files** containing:

- **Scout Skill**: Threshold configurations, priority rules, data triage logic
- **Researcher Skill**: Enrichment priorities, data sources, quality criteria
- **SEM Skill**: Keyword analysis expertise, bid strategies, campaign tactics
- **SEO Skill**: Page optimization expertise, schema requirements, content guidelines
- **Director Skill**: Synthesis rules, prioritization logic, executive framing

Each agent receives its own specialized skill file, enabling deep domain expertise at every layer of the workflow without coupling agent concerns.

---

## Business Types (Initial Set)

| Type | Description | Examples |
|------|-------------|----------|
| `ecommerce` | Online retail, product sales | Shopify stores, marketplaces, D2C brands |
| `lead-gen` | Lead generation, form submissions | B2B services, agencies, consultants |
| `saas` | Software as a Service | SaaS products, subscription software |
| `local` | Local businesses with physical presence | Restaurants, dentists, plumbers, retail stores |

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client Onboarding                            │
│  User selects: "What type of business is this client?"          │
│  → ecommerce | lead-gen | saas | local                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Skill Loader                                 │
│  loadSkillBundle(businessType) → SkillLoadResult                │
│                                                                  │
│  Returns:                                                        │
│    ├── bundle: AgentSkillBundle                                 │
│    │     ├── scout: ScoutSkillDefinition                        │
│    │     ├── researcher: ResearcherSkillDefinition              │
│    │     ├── sem: SEMSkillDefinition                            │
│    │     ├── seo: SEOSkillDefinition                            │
│    │     └── director: DirectorSkillDefinition                  │
│    ├── usingFallback: boolean                                   │
│    └── warning?: string (if using fallback)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Agent Pipeline                               │
│                                                                  │
│  Scout(scoutSkill) → Researcher(researcherSkill)                │
│         ↓                                                        │
│  [SEM(semSkill) + SEO(seoSkill)] → Director(directorSkill)      │
│                                                                  │
│  Each agent receives ONLY its specific skill file               │
└─────────────────────────────────────────────────────────────────┘
```

### Why Agent-Specific Skills?

| Approach | Pros | Cons |
|----------|------|------|
| **Single monolithic skill file** | Simpler to manage, single source of truth | Coupling between agents, harder to tune individual agents, bloated files |
| **Agent-specific skill files** ✓ | Clean separation, agents only see relevant config, easier to iterate per agent, enables agent-specific versioning | More files to maintain, need coordination across files |

**Decision:** Agent-specific skill files provide better modularity and enable deeper expertise at each pipeline stage. The additional file management is worth the improved output quality.

---

## Skill Type Definitions

### Agent Skill Bundle

```typescript
// The complete skill bundle loaded for a business type
interface AgentSkillBundle {
  businessType: BusinessType;
  version: string;

  scout: ScoutSkillDefinition;
  researcher: ResearcherSkillDefinition;
  sem: SEMSkillDefinition;
  seo: SEOSkillDefinition;
  director: DirectorSkillDefinition;
}

type BusinessType = 'ecommerce' | 'lead-gen' | 'saas' | 'local';
```

### Scout Skill Definition

The Scout agent performs data triage (no AI). Its skill defines thresholds and rules for identifying priority items.

```typescript
interface ScoutSkillDefinition {
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

interface PriorityRule {
  id: string;
  name: string;
  description: string;
  condition: string;      // Human-readable condition description
  priority: 'critical' | 'high' | 'medium' | 'low';
  enabled: boolean;
}
```

### Researcher Skill Definition

The Researcher agent enriches data with competitive metrics and page content. Its skill defines what to fetch and how to prioritize.

```typescript
interface ResearcherSkillDefinition {
  version: string;

  // Keyword enrichment configuration
  keywordEnrichment: {
    competitiveMetrics: {
      required: string[];     // Must fetch these metrics
      optional: string[];     // Fetch if available
      irrelevant: string[];   // Don't bother fetching
    };
    priorityBoosts: {
      metric: string;
      condition: string;
      boost: number;
    }[];
  };

  // Page content enrichment configuration
  pageEnrichment: {
    contentAnalysis: {
      extractTitle: boolean;
      extractH1: boolean;
      extractMetaDescription: boolean;
      extractSchema: boolean;         // Parse JSON-LD schema
      extractWordCount: boolean;
      extractContentPreview: boolean;
      customExtractions: CustomExtraction[];
    };
    qualitySignals: {
      checkMobileUsability: boolean;
      checkPageSpeed: boolean;
      checkSSL: boolean;
    };
  };

  // Data quality thresholds
  dataQuality: {
    minKeywordsWithCompetitiveData: number;  // Warn if below
    minPagesWithContent: number;              // Warn if below
    maxFetchTimeout: number;                  // MS timeout for page fetches
    maxConcurrentFetches: number;
  };
}

interface CustomExtraction {
  name: string;
  selector: string;        // CSS selector or extraction rule
  description: string;
}
```

### SEM Skill Definition

The SEM agent provides AI-powered keyword strategy analysis. Its skill defines domain expertise for Google Ads optimization.

```typescript
interface SEMSkillDefinition {
  version: string;

  // Business context for prompt
  context: {
    businessModel: string;           // Description of how this business makes money
    conversionDefinition: string;    // What counts as a conversion
    typicalCustomerJourney: string;  // How customers find and convert
  };

  // KPIs and benchmarks
  kpis: {
    primary: KPIDefinition[];
    secondary: KPIDefinition[];
    irrelevant: string[];            // Explicitly ignore these metrics
  };

  benchmarks: {
    ctr: ThresholdSet;
    conversionRate: ThresholdSet;
    cpc: ThresholdSet;
    roas?: ThresholdSet;             // Optional - not all business types use ROAS
    costPerConversion?: ThresholdSet;
  };

  // Analysis guidance
  analysis: {
    keyPatterns: AnalysisPattern[];      // Patterns to look for
    antiPatterns: AnalysisPattern[];     // Patterns that indicate problems
    opportunities: OpportunityType[];    // Types of opportunities to identify
  };

  // Prompt configuration
  prompt: {
    roleContext: string;             // Added to role definition
    analysisInstructions: string;    // Detailed analysis guidance
    outputGuidance: string;          // How to format recommendations
    examples: SEMExample[];          // Business-specific examples
    constraints: string[];           // Things NOT to recommend
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

interface KPIDefinition {
  metric: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  targetDirection: 'higher' | 'lower' | 'target';
  benchmark?: number;
  businessContext: string;           // Why this matters for this business type
}

interface ThresholdSet {
  excellent: number;
  good: number;
  average: number;
  poor: number;
}

interface AnalysisPattern {
  id: string;
  name: string;
  description: string;
  indicators: string[];
  recommendation: string;
}

interface OpportunityType {
  type: string;
  description: string;
  signals: string[];
  typicalAction: string;
}

interface SEMExample {
  scenario: string;
  data: string;
  recommendation: string;
  reasoning: string;
}
```

### SEO Skill Definition

The SEO agent provides AI-powered page optimization analysis. Its skill defines domain expertise for organic search.

```typescript
interface SEOSkillDefinition {
  version: string;

  // Business context for prompt
  context: {
    siteType: string;                // Type of website
    primaryGoal: string;             // What pages should achieve
    contentStrategy: string;         // How content drives business goals
  };

  // Schema markup rules
  schema: {
    required: SchemaRule[];          // Must have these
    recommended: SchemaRule[];       // Should have these
    invalid: SchemaRule[];           // Should NOT have these (flag as error)
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
    falsePositives: string[];        // Don't flag these as issues
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

interface SchemaRule {
  type: string;                      // Schema.org type
  description: string;
  importance: 'required' | 'recommended' | 'optional';
  validationNotes: string;
}

interface PageTypeSchemaRule {
  pageType: string;                  // e.g., "product", "category", "landing"
  requiredSchema: string[];
  recommendedSchema: string[];
  invalidSchema: string[];
}

interface ContentPattern {
  id: string;
  name: string;
  goodPattern: string;
  badPattern: string;
  recommendation: string;
}

interface TechnicalCheck {
  id: string;
  name: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}

interface OnPageFactor {
  factor: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
  guidance: string;
}

interface SEOExample {
  scenario: string;
  pageData: string;
  recommendation: string;
  reasoning: string;
}

interface IssueDefinition {
  id: string;
  pattern: string;
  description: string;
  recommendation: string;
}
```

### Director Skill Definition

The Director agent synthesizes SEM and SEO recommendations. Its skill defines how to combine, prioritize, and present findings.

```typescript
interface DirectorSkillDefinition {
  version: string;

  // Business context for synthesis
  context: {
    businessPriorities: string[];       // What matters most to this business
    successMetrics: string[];           // How to measure success
    executiveFraming: string;           // How to frame for executives
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
    mustInclude: string[];             // Always include these types if present
    mustExclude: string[];             // Never include these types
  };

  // Executive summary configuration
  executiveSummary: {
    focusAreas: string[];              // What to highlight
    metricsToQuantify: string[];       // Which metrics to put numbers on
    framingGuidance: string;           // How to frame the narrative
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
      sem: string;                     // How to label SEM recommendations
      seo: string;                     // How to label SEO recommendations
      hybrid: string;                  // How to label combined recommendations
    };
  };
}

interface ConflictRule {
  id: string;
  semSignal: string;
  seoSignal: string;
  resolution: string;
  resultingType: 'sem' | 'seo' | 'hybrid' | 'drop';
}

interface SynergyRule {
  id: string;
  semCondition: string;
  seoCondition: string;
  combinedRecommendation: string;
}

interface PrioritizationRule {
  condition: string;
  adjustment: 'boost' | 'reduce' | 'require' | 'exclude';
  factor: number;
  reason: string;
}
```

---

## Directory Structure

```
apps/api/src/services/interplay-report/
├── skills/
│   ├── index.ts                           # Skill loader & bundle assembly
│   ├── types.ts                           # All skill type definitions
│   │
│   ├── ecommerce/
│   │   ├── index.ts                       # Bundle export
│   │   ├── scout.skill.ts                 # Scout expertise for ecommerce
│   │   ├── researcher.skill.ts            # Researcher expertise for ecommerce
│   │   ├── sem.skill.ts                   # SEM expertise for ecommerce
│   │   ├── seo.skill.ts                   # SEO expertise for ecommerce
│   │   └── director.skill.ts              # Director expertise for ecommerce
│   │
│   ├── lead-gen/
│   │   ├── index.ts
│   │   ├── scout.skill.ts
│   │   ├── researcher.skill.ts
│   │   ├── sem.skill.ts
│   │   ├── seo.skill.ts
│   │   └── director.skill.ts
│   │
│   ├── saas/
│   │   ├── index.ts
│   │   ├── scout.skill.ts
│   │   ├── researcher.skill.ts
│   │   ├── sem.skill.ts
│   │   ├── seo.skill.ts
│   │   └── director.skill.ts
│   │
│   └── local/
│       ├── index.ts
│       ├── scout.skill.ts
│       ├── researcher.skill.ts
│       ├── sem.skill.ts
│       ├── seo.skill.ts
│       └── director.skill.ts
```

---

## Example Skill Files

### Ecommerce Scout Skill

```typescript
// apps/api/src/services/interplay-report/skills/ecommerce/scout.skill.ts

import { ScoutSkillDefinition } from '../types';

export const ecommerceScoutSkill: ScoutSkillDefinition = {
  version: '1.0.0',

  thresholds: {
    highSpendThreshold: 150,           // Ecommerce has higher CPCs
    lowRoasThreshold: 2.5,             // Below 2.5x is concerning
    cannibalizationPosition: 5,        // Wider net for product queries
    highBounceRateThreshold: 65,       // Product pages can have higher bounce
    lowCtrThreshold: 1.5,              // Lower bar for product listings
    minImpressionsForAnalysis: 100,
  },

  priorityRules: {
    battlegroundKeywords: [
      {
        id: 'brand-cannibalization',
        name: 'Brand Term Cannibalization',
        description: 'Paying for clicks on brand terms where organic ranks #1-3',
        condition: 'Brand keyword + organic position <= 3 + ad spend > $50',
        priority: 'critical',
        enabled: true,
      },
      {
        id: 'product-high-spend-low-roas',
        name: 'Product Query Inefficiency',
        description: 'Product-specific queries with poor return',
        condition: 'Product keyword + ROAS < 2.5 + spend > $100',
        priority: 'high',
        enabled: true,
      },
      {
        id: 'category-opportunity',
        name: 'Category Growth Opportunity',
        description: 'Category terms converting well with room to scale',
        condition: 'Category keyword + ROAS > 4 + impression share < 50%',
        priority: 'medium',
        enabled: true,
      },
      {
        id: 'shopping-organic-overlap',
        name: 'Shopping vs Organic Overlap',
        description: 'Products appearing in both Shopping and organic results',
        condition: 'Shopping ad + organic position <= 10',
        priority: 'high',
        enabled: true,
      },
    ],
    criticalPages: [
      {
        id: 'product-page-high-spend',
        name: 'High-Spend Product Pages',
        description: 'Product pages receiving significant paid traffic',
        condition: 'Product page + paid spend > $200/month',
        priority: 'critical',
        enabled: true,
      },
      {
        id: 'category-high-bounce',
        name: 'Category Page Bounce Issues',
        description: 'Category pages with UX problems',
        condition: 'Category page + bounce rate > 70%',
        priority: 'high',
        enabled: true,
      },
      {
        id: 'product-low-ctr',
        name: 'Product Listing CTR Issues',
        description: 'Product pages with poor search appearance',
        condition: 'Product page + impressions > 1000 + CTR < 1%',
        priority: 'medium',
        enabled: true,
      },
    ],
  },

  metrics: {
    include: ['spend', 'roas', 'revenue', 'conversions', 'ctr', 'impressions', 'position', 'bounceRate'],
    exclude: ['leadQuality', 'mqls', 'sqls'],  // Not relevant for ecommerce
    primary: ['roas', 'revenue', 'spend'],      // Sort by these
  },

  limits: {
    maxBattlegroundKeywords: 25,
    maxCriticalPages: 15,
  },
};
```

### Lead-Gen SEM Skill

```typescript
// apps/api/src/services/interplay-report/skills/lead-gen/sem.skill.ts

import { SEMSkillDefinition } from '../types';

export const leadGenSEMSkill: SEMSkillDefinition = {
  version: '1.0.0',

  context: {
    businessModel: 'Lead generation through form submissions, phone calls, or demo requests. Revenue is realized downstream when leads convert to customers.',
    conversionDefinition: 'Form submission, phone call, demo booking, or other lead capture action. NOT a direct sale.',
    typicalCustomerJourney: 'Research phase → consideration → form fill → sales follow-up → close. Multiple touches before conversion.',
  },

  kpis: {
    primary: [
      {
        metric: 'costPerLead',
        importance: 'critical',
        description: 'Cost to acquire each lead',
        targetDirection: 'lower',
        benchmark: 50,
        businessContext: 'Primary efficiency metric. Must be sustainable relative to customer lifetime value.',
      },
      {
        metric: 'leadVolume',
        importance: 'critical',
        description: 'Total number of leads generated',
        targetDirection: 'higher',
        businessContext: 'Growth metric. Balance with CPL - volume at any cost is not the goal.',
      },
      {
        metric: 'conversionRate',
        importance: 'high',
        description: 'Percentage of clicks that become leads',
        targetDirection: 'higher',
        benchmark: 0.05,
        businessContext: 'Indicates landing page and offer effectiveness. 5%+ is good for B2B.',
      },
    ],
    secondary: [
      {
        metric: 'ctr',
        importance: 'medium',
        description: 'Ad click-through rate',
        targetDirection: 'higher',
        benchmark: 0.035,
        businessContext: 'Indicates ad relevance. Higher CTR = lower CPC in Google Ads.',
      },
      {
        metric: 'qualityScore',
        importance: 'medium',
        description: 'Google Ads quality score',
        targetDirection: 'higher',
        businessContext: 'Affects CPC and ad position. Optimize for long-term efficiency.',
      },
    ],
    irrelevant: ['roas', 'revenue', 'aov', 'cartAbandonmentRate'],
  },

  benchmarks: {
    ctr: { excellent: 0.05, good: 0.035, average: 0.025, poor: 0.015 },
    conversionRate: { excellent: 0.08, good: 0.05, average: 0.03, poor: 0.015 },
    cpc: { excellent: 1.5, good: 2.5, average: 4.0, poor: 6.0 },
    costPerConversion: { excellent: 30, good: 50, average: 80, poor: 120 },
  },

  analysis: {
    keyPatterns: [
      {
        id: 'high-intent-efficiency',
        name: 'High-Intent Keyword Efficiency',
        description: 'Demo/pricing/quote keywords should have best CPL',
        indicators: ['contains demo/pricing/quote/consultation', 'conversion rate > 5%'],
        recommendation: 'Increase bids and budget allocation to high-intent terms',
      },
      {
        id: 'competitor-targeting',
        name: 'Competitor Keyword Performance',
        description: 'Competitor name keywords often have high intent',
        indicators: ['contains competitor name', 'decent conversion rate'],
        recommendation: 'Evaluate competitor keyword ROI carefully - can be expensive but valuable',
      },
    ],
    antiPatterns: [
      {
        id: 'informational-high-spend',
        name: 'High Spend on Informational Queries',
        description: 'Spending too much on top-of-funnel queries',
        indicators: ['informational intent', 'high spend', 'low conversion rate'],
        recommendation: 'Reduce bids or move to content marketing strategy',
      },
      {
        id: 'generic-broad-match',
        name: 'Generic Broad Match Waste',
        description: 'Broad match driving irrelevant traffic',
        indicators: ['broad match', 'high impressions', 'low conversion'],
        recommendation: 'Add negative keywords or switch to phrase/exact match',
      },
    ],
    opportunities: [
      {
        type: 'demo-intent-capture',
        description: 'Capture high-intent demo/trial searches',
        signals: ['demo', 'free trial', 'pricing', 'vs competitor'],
        typicalAction: 'Create dedicated campaigns with aggressive bidding',
      },
      {
        type: 'remarketing-nurture',
        description: 'Nurture non-converting visitors',
        signals: ['visited site', 'did not convert', 'engaged with content'],
        typicalAction: 'Build remarketing lists for nurture campaigns',
      },
    ],
  },

  prompt: {
    roleContext: `You are analyzing a lead generation business. This is NOT ecommerce - there are no direct sales.

Key understanding:
- Conversions are leads (form fills, calls, demo requests), not purchases
- ROAS is NOT applicable - do not mention or calculate ROAS
- Cost Per Lead (CPL) is the primary efficiency metric
- Lead quality matters as much as volume
- The sales cycle continues after the lead is captured`,

    analysisInstructions: `Analyze the keyword data with these lead-gen specific considerations:

1. HIGH-INTENT SIGNALS: Demo, pricing, quote, consultation, free trial, vs [competitor]
   - These should have the best CPL and deserve more budget

2. INTENT FUNNEL:
   - Bottom funnel (demo, pricing) → Aggressive bids, tight targeting
   - Mid funnel (comparison, reviews) → Moderate bids, good for nurture
   - Top funnel (what is, how to) → Low bids or content strategy

3. COMPETITOR KEYWORDS:
   - [competitor] + alternative, vs, comparison → Often high value
   - Monitor CPL carefully - can be expensive

4. AVOID COMMON MISTAKES:
   - Don't recommend ROAS optimization (not applicable)
   - Don't recommend shopping campaigns (no products)
   - Don't focus on revenue metrics (leads ≠ revenue)`,

    outputGuidance: `Focus recommendations on:
- Reducing cost per lead while maintaining quality
- Increasing lead volume from high-intent keywords
- Improving conversion rates through better targeting
- Budget reallocation from low-intent to high-intent keywords

Quantify impact in terms of:
- Estimated CPL reduction ($ or %)
- Estimated lead volume increase
- Budget efficiency improvements`,

    examples: [
      {
        scenario: 'High spend on broad informational keywords',
        data: '["software development" - $2,000/mo, 0.5% CVR, $200 CPL]',
        recommendation: 'Reduce bids on broad "software development" by 40% and reallocate budget to "software development company" and "custom software quote" which have 3x better CPL',
        reasoning: 'Broad informational queries attract researchers, not buyers. Adding qualifiers indicates higher intent.',
      },
      {
        scenario: 'Competitor keyword opportunity',
        data: '["salesforce alternative" - no current coverage, competitor pages rank]',
        recommendation: 'Create a dedicated campaign for "[competitor] alternative" keywords with landing page addressing specific pain points. Start with $500/mo test budget.',
        reasoning: 'Users searching for alternatives are actively considering switching - high intent signal.',
      },
    ],

    constraints: [
      'Do NOT recommend ROAS-based bidding strategies',
      'Do NOT recommend Shopping or Performance Max campaigns',
      'Do NOT mention revenue or AOV metrics',
      'Do NOT recommend product feed optimizations',
      'Focus on lead generation metrics only',
    ],
  },

  output: {
    recommendationTypes: {
      prioritize: [
        'high-intent-bid-increase',
        'cpl-reduction',
        'conversion-rate-optimization',
        'negative-keyword-addition',
        'landing-page-alignment',
      ],
      deprioritize: [
        'brand-awareness-campaigns',
        'display-expansion',
      ],
      exclude: [
        'shopping-campaign-optimization',
        'product-feed-improvement',
        'roas-bidding-strategy',
        'merchant-center-fixes',
      ],
    },
    maxRecommendations: 8,
    requireQuantifiedImpact: true,
  },
};
```

### Lead-Gen SEO Skill

```typescript
// apps/api/src/services/interplay-report/skills/lead-gen/seo.skill.ts

import { SEOSkillDefinition } from '../types';

export const leadGenSEOSkill: SEOSkillDefinition = {
  version: '1.0.0',

  context: {
    siteType: 'Lead generation website focused on capturing inquiries and building trust',
    primaryGoal: 'Generate qualified leads through organic search traffic',
    contentStrategy: 'Thought leadership content attracts top-of-funnel traffic; service pages capture bottom-of-funnel conversions',
  },

  schema: {
    required: [
      {
        type: 'Organization',
        description: 'Establishes business identity and trust signals',
        importance: 'required',
        validationNotes: 'Include logo, contact info, social profiles',
      },
      {
        type: 'WebSite',
        description: 'Enables sitelinks searchbox',
        importance: 'required',
        validationNotes: 'Include search action if site has search',
      },
    ],
    recommended: [
      {
        type: 'FAQPage',
        description: 'Captures FAQ rich results for informational queries',
        importance: 'recommended',
        validationNotes: 'Use on FAQ pages and service pages with common questions',
      },
      {
        type: 'Service',
        description: 'Describes services offered',
        importance: 'recommended',
        validationNotes: 'Include service type, provider, area served',
      },
      {
        type: 'ProfessionalService',
        description: 'For B2B professional services',
        importance: 'recommended',
        validationNotes: 'Alternative to Service for professional services',
      },
      {
        type: 'HowTo',
        description: 'For tutorial and guide content',
        importance: 'optional',
        validationNotes: 'Use on step-by-step guide pages',
      },
    ],
    invalid: [
      {
        type: 'Product',
        description: 'Product schema is for ecommerce, not lead-gen',
        importance: 'required',
        validationNotes: 'REMOVE if present - this is incorrect for lead-gen sites',
      },
      {
        type: 'Offer',
        description: 'Offer schema is for products with prices',
        importance: 'required',
        validationNotes: 'REMOVE if present - services are not "offers"',
      },
      {
        type: 'AggregateOffer',
        description: 'For product price ranges - not applicable',
        importance: 'required',
        validationNotes: 'REMOVE if present',
      },
    ],
    pageTypeRules: [
      {
        pageType: 'homepage',
        requiredSchema: ['Organization', 'WebSite'],
        recommendedSchema: [],
        invalidSchema: ['Product', 'Offer'],
      },
      {
        pageType: 'service',
        requiredSchema: ['Service'],
        recommendedSchema: ['FAQPage'],
        invalidSchema: ['Product', 'Offer'],
      },
      {
        pageType: 'blog',
        requiredSchema: ['Article'],
        recommendedSchema: ['FAQPage', 'HowTo'],
        invalidSchema: ['Product', 'Offer'],
      },
      {
        pageType: 'landing',
        requiredSchema: [],
        recommendedSchema: ['FAQPage'],
        invalidSchema: ['Product', 'Offer'],
      },
    ],
  },

  kpis: {
    primary: [
      {
        metric: 'organicLeads',
        importance: 'critical',
        description: 'Leads generated from organic traffic',
        targetDirection: 'higher',
        businessContext: 'Ultimate measure of SEO ROI for lead-gen',
      },
      {
        metric: 'organicTraffic',
        importance: 'high',
        description: 'Total organic sessions',
        targetDirection: 'higher',
        businessContext: 'Leading indicator of potential leads',
      },
      {
        metric: 'conversionRate',
        importance: 'high',
        description: 'Organic traffic to lead conversion rate',
        targetDirection: 'higher',
        benchmark: 0.03,
        businessContext: 'Indicates content-to-conversion alignment',
      },
    ],
    secondary: [
      {
        metric: 'avgPosition',
        importance: 'medium',
        description: 'Average search position',
        targetDirection: 'higher',
        businessContext: 'Proxy for visibility on target keywords',
      },
      {
        metric: 'organicCtr',
        importance: 'medium',
        description: 'Click-through rate from search results',
        targetDirection: 'higher',
        benchmark: 0.03,
        businessContext: 'Indicates title/meta effectiveness',
      },
    ],
    irrelevant: ['revenue', 'aov', 'roas', 'transactionCount'],
  },

  benchmarks: {
    organicCtr: { excellent: 0.05, good: 0.03, average: 0.02, poor: 0.01 },
    bounceRate: { excellent: 0.40, good: 0.50, average: 0.60, poor: 0.75 },
    avgPosition: { excellent: 3, good: 7, average: 15, poor: 25 },
  },

  analysis: {
    contentPatterns: [
      {
        id: 'service-page-depth',
        name: 'Service Page Content Depth',
        goodPattern: 'Comprehensive service pages with 1500+ words, FAQs, case studies',
        badPattern: 'Thin service pages with < 500 words, no proof points',
        recommendation: 'Expand service pages with detailed benefits, process, FAQs, and social proof',
      },
      {
        id: 'thought-leadership',
        name: 'Thought Leadership Content',
        goodPattern: 'Regular blog content targeting informational queries with clear CTAs',
        badPattern: 'No blog or thin content that doesn\'t capture top-of-funnel searches',
        recommendation: 'Build content hub targeting informational queries that lead to service pages',
      },
    ],
    technicalChecks: [
      {
        id: 'form-above-fold',
        name: 'Form/CTA Visibility',
        importance: 'critical',
        description: 'Lead capture form or CTA should be visible without scrolling',
      },
      {
        id: 'mobile-form-usability',
        name: 'Mobile Form Experience',
        importance: 'high',
        description: 'Forms must be easy to complete on mobile devices',
      },
      {
        id: 'page-speed',
        name: 'Page Load Speed',
        importance: 'high',
        description: 'Slow pages kill conversions - aim for < 3s load time',
      },
    ],
    onPageFactors: [
      {
        factor: 'title-tag',
        importance: 'critical',
        guidance: 'Include primary keyword and value proposition. Avoid generic titles.',
      },
      {
        factor: 'meta-description',
        importance: 'high',
        guidance: 'Include CTA language and differentiation. Make users want to click.',
      },
      {
        factor: 'h1-tag',
        importance: 'high',
        guidance: 'Clear, benefit-focused headline that matches search intent.',
      },
    ],
  },

  prompt: {
    roleContext: `You are analyzing a lead generation website. This is NOT ecommerce.

CRITICAL UNDERSTANDING:
- There are NO products to sell - do not recommend Product schema
- Pages should capture leads (form fills, calls, demos)
- Trust signals are crucial for conversion
- Content should address the buyer journey
- Service schema, not Product schema, is appropriate`,

    analysisInstructions: `Analyze pages with these lead-gen specific criteria:

1. SCHEMA VALIDATION (CRITICAL):
   - Product schema is WRONG for lead-gen - flag as error if present
   - Service, Organization, FAQPage are appropriate
   - Look for incorrect ecommerce schema and flag for removal

2. CONVERSION ELEMENTS:
   - Is there a clear CTA above the fold?
   - Is the form/contact method prominent?
   - Are trust signals present (testimonials, logos, certifications)?

3. CONTENT QUALITY:
   - Does the content address user questions?
   - Is there enough depth to establish expertise?
   - Are there clear next steps for the reader?

4. INTENT ALIGNMENT:
   - Does the page match the search intent?
   - Informational pages → lead to service pages
   - Service pages → capture leads directly`,

    outputGuidance: `Prioritize recommendations that:
- Fix incorrect schema (especially Product schema that shouldn't exist)
- Improve lead capture elements
- Build trust and credibility
- Improve content depth for target keywords

DO NOT recommend:
- Product schema implementation
- Shopping feed setup
- Price markup
- Any ecommerce-specific optimizations`,

    examples: [
      {
        scenario: 'Service page with Product schema',
        pageData: 'Service page for "IT consulting" has Product schema with price',
        recommendation: 'CRITICAL: Remove Product schema from IT consulting service page. Replace with Service schema including service type, provider, and area served. Product schema is incorrect for services and may confuse Google.',
        reasoning: 'Product schema is specifically for physical or digital products for sale. Services should use Service or ProfessionalService schema.',
      },
      {
        scenario: 'Blog post ranking but not converting',
        pageData: 'Blog post "How to choose a CRM" ranks #3, high traffic, 0 conversions',
        recommendation: 'Add contextual CTA within blog content linking to CRM implementation service page. Add FAQ section with schema. Include lead magnet offer (CRM selection checklist) with email capture.',
        reasoning: 'Informational content needs clear pathways to conversion pages. Direct "contact us" CTAs rarely work on educational content - use value-add lead magnets.',
      },
    ],

    constraints: [
      'NEVER recommend Product schema - this is not ecommerce',
      'NEVER recommend shopping feed or Merchant Center setup',
      'NEVER mention revenue or AOV optimization',
      'Flag existing Product/Offer schema as errors to fix',
      'Focus on lead generation, not sales',
    ],
  },

  commonIssues: {
    critical: [
      {
        id: 'product-schema-on-service',
        pattern: 'Product schema on service or lead-gen pages',
        description: 'Product schema is incorrect for lead-gen sites and should be removed',
        recommendation: 'Remove Product schema, add Service or Organization schema instead',
      },
      {
        id: 'no-conversion-path',
        pattern: 'High-traffic pages with no CTA or form',
        description: 'Traffic without conversion opportunity is wasted',
        recommendation: 'Add clear CTA and/or lead capture form to all traffic-receiving pages',
      },
    ],
    warnings: [
      {
        id: 'thin-service-pages',
        pattern: 'Service pages with less than 500 words',
        description: 'Thin content struggles to rank and convert',
        recommendation: 'Expand with benefits, process, FAQs, case studies',
      },
      {
        id: 'missing-trust-signals',
        pattern: 'Pages without testimonials, logos, or social proof',
        description: 'Trust signals are crucial for lead-gen conversion',
        recommendation: 'Add client logos, testimonials, certifications, case study links',
      },
    ],
    falsePositives: [
      'Missing Product schema',           // Correct - should not have it
      'No shopping feed detected',        // Not applicable
      'No price information found',       // Often intentional
      'Missing Offer schema',             // Not applicable
    ],
  },

  output: {
    recommendationTypes: {
      prioritize: [
        'schema-correction',              // Fix wrong schema first
        'service-schema-implementation',
        'conversion-element-addition',
        'content-expansion',
        'trust-signal-addition',
      ],
      deprioritize: [
        'minor-technical-fixes',
        'image-optimization',
      ],
      exclude: [
        'product-schema-implementation',
        'shopping-feed-setup',
        'price-markup',
        'merchant-center-optimization',
      ],
    },
    maxRecommendations: 8,
  },
};
```

### Lead-Gen Director Skill

```typescript
// apps/api/src/services/interplay-report/skills/lead-gen/director.skill.ts

import { DirectorSkillDefinition } from '../types';

export const leadGenDirectorSkill: DirectorSkillDefinition = {
  version: '1.0.0',

  context: {
    businessPriorities: [
      'Reduce cost per lead while maintaining quality',
      'Increase lead volume from qualified sources',
      'Improve lead-to-customer conversion rate',
      'Build sustainable organic lead pipeline',
    ],
    successMetrics: [
      'Cost per lead (CPL)',
      'Lead volume',
      'Lead quality score',
      'Organic traffic growth',
      'Conversion rate',
    ],
    executiveFraming: 'Focus on efficiency (CPL) and growth (volume). Do NOT mention ROAS or revenue - this is lead-gen, not ecommerce.',
  },

  synthesis: {
    conflictResolution: [
      {
        id: 'paid-vs-organic-overlap',
        semSignal: 'Reduce paid spend on keyword',
        seoSignal: 'Organic not yet ranking for keyword',
        resolution: 'Maintain paid coverage until organic reaches page 1, then gradually reduce',
        resultingType: 'hybrid',
      },
      {
        id: 'content-vs-landing',
        semSignal: 'Send traffic to conversion page',
        seoSignal: 'Content page ranks better',
        resolution: 'Optimize content page with stronger CTA, keep paid going to landing page',
        resultingType: 'hybrid',
      },
    ],
    synergyIdentification: [
      {
        id: 'intent-alignment',
        semCondition: 'High-performing paid keyword',
        seoCondition: 'No organic content for same topic',
        combinedRecommendation: 'Create organic content targeting validated high-intent topic to build sustainable traffic',
      },
      {
        id: 'conversion-lift',
        semCondition: 'Low landing page conversion rate',
        seoCondition: 'Page has UX issues identified',
        combinedRecommendation: 'Fix page UX issues to improve both paid and organic conversion rates',
      },
    ],
    prioritization: [
      {
        condition: 'Recommendation reduces CPL',
        adjustment: 'boost',
        factor: 1.5,
        reason: 'CPL reduction directly impacts efficiency',
      },
      {
        condition: 'Recommendation increases lead volume from high-intent keywords',
        adjustment: 'boost',
        factor: 1.3,
        reason: 'High-intent leads have better downstream conversion',
      },
      {
        condition: 'Recommendation fixes incorrect schema',
        adjustment: 'boost',
        factor: 1.4,
        reason: 'Schema errors can cause ranking penalties',
      },
      {
        condition: 'Recommendation mentions ROAS or revenue',
        adjustment: 'exclude',
        factor: 0,
        reason: 'Not applicable to lead-gen business model',
      },
    ],
  },

  filtering: {
    maxRecommendations: 10,
    minImpactThreshold: 'medium',
    impactWeights: {
      revenue: 0,        // Not applicable
      cost: 0.4,         // CPL matters
      effort: 0.3,       // Implementation difficulty
      risk: 0.3,         // Risk of negative impact
    },
    mustInclude: [
      'schema-correction',      // Always fix schema errors
      'high-intent-optimization', // High-intent keywords are gold
    ],
    mustExclude: [
      'roas-optimization',
      'shopping-campaign',
      'product-schema',
      'merchant-center',
    ],
  },

  executiveSummary: {
    focusAreas: [
      'Lead generation efficiency',
      'Pipeline health',
      'Cost optimization',
      'Growth opportunities',
    ],
    metricsToQuantify: [
      'costPerLead',
      'estimatedLeadIncrease',
      'budgetSavings',
      'conversionRateImprovement',
    ],
    framingGuidance: `Frame the summary around:
- How to get more leads for less money
- Which channels are working and which need work
- Quick wins vs long-term improvements

DO NOT frame around:
- Revenue or ROAS (not applicable)
- Shopping or product performance
- AOV or cart metrics`,
    maxHighlights: 5,
  },

  prompt: {
    roleContext: `You are synthesizing recommendations for a lead generation client. This business captures leads (form submissions, calls, demos) that later convert to customers through a sales process.

CRITICAL: This is NOT ecommerce. There are no products, no shopping carts, no ROAS. Cost per lead (CPL) and lead volume are the primary metrics.`,

    synthesisInstructions: `When combining SEM and SEO recommendations:

1. FILTER OUT irrelevant recommendations:
   - Anything mentioning ROAS, revenue, AOV → EXCLUDE
   - Shopping campaigns, product feeds → EXCLUDE
   - Product schema implementation → EXCLUDE

2. PRIORITIZE:
   - CPL reduction opportunities → HIGH priority
   - Lead volume increases from high-intent sources → HIGH priority
   - Schema corrections (removing wrong Product schema) → HIGH priority
   - Conversion rate improvements → MEDIUM priority

3. IDENTIFY SYNERGIES:
   - Paid keyword success → Create organic content for same topic
   - SEO content ranking → Reduce paid spend on that topic
   - Both channels have same landing page issue → Fix once, benefit twice`,

    prioritizationGuidance: `Prioritize by business impact:
1. Quick wins that reduce CPL immediately
2. Schema fixes that prevent ranking penalties
3. High-intent keyword optimizations
4. Conversion rate improvements
5. Long-term organic growth plays

Cap at 10 recommendations. Better to do 10 things well than 20 things poorly.`,

    outputFormat: `Structure the output as:

Executive Summary:
- 3-5 sentences on account health
- Focus on lead efficiency and growth
- Quantify opportunity where possible
- NO mention of ROAS or revenue

Key Highlights:
- Top 5 bullet points
- Each should be actionable
- Include expected impact

Unified Recommendations:
- Max 10 recommendations
- Each with title, description, type, impact, effort, action items
- Sorted by business impact`,

    constraints: [
      'NEVER mention ROAS - not applicable to lead-gen',
      'NEVER mention revenue or AOV',
      'NEVER include shopping/product recommendations',
      'Always frame in terms of CPL and lead volume',
      'Exclude any ecommerce-specific recommendations from specialists',
    ],
  },

  output: {
    recommendationFormat: {
      requireTitle: true,
      requireDescription: true,
      requireImpact: true,
      requireEffort: true,
      requireActionItems: true,
      maxActionItems: 5,
    },
    categoryLabels: {
      sem: 'Paid Search',
      seo: 'Organic Search',
      hybrid: 'Cross-Channel',
    },
  },
};
```

---

## Skill Bundle Assembly

```typescript
// apps/api/src/services/interplay-report/skills/index.ts

import { AgentSkillBundle, BusinessType } from './types';

// Import implemented skill bundles
import { ecommerceSkillBundle } from './ecommerce';
import { leadGenSkillBundle } from './lead-gen';

const skillRegistry: Record<BusinessType, AgentSkillBundle | null> = {
  'ecommerce': ecommerceSkillBundle,
  'lead-gen': leadGenSkillBundle,
  'saas': null,    // TODO: Phase 10
  'local': null,   // TODO: Phase 10
};

// Fallback mappings for unimplemented types
// Maps unimplemented type → closest implemented type
const FALLBACK_MAPPINGS: Partial<Record<BusinessType, BusinessType>> = {
  'saas': 'lead-gen',      // SaaS is similar to lead-gen (both lead-based)
  'local': 'ecommerce',    // Local has some ecommerce patterns
};

export interface SkillLoadResult {
  bundle: AgentSkillBundle;
  usingFallback: boolean;
  fallbackFrom?: BusinessType;
  warning?: string;
}

export function loadSkillBundle(businessType: BusinessType): SkillLoadResult {
  const bundle = skillRegistry[businessType];

  if (bundle) {
    return {
      bundle,
      usingFallback: false,
    };
  }

  // Fall back to mapped type with explicit warning
  const fallbackType = FALLBACK_MAPPINGS[businessType];
  if (fallbackType && skillRegistry[fallbackType]) {
    const warning = `Skills for "${businessType}" are not yet implemented. ` +
      `Using "${fallbackType}" skills as a fallback. ` +
      `Some recommendations may not be fully tailored to ${businessType} businesses.`;

    logger.warn({
      requestedType: businessType,
      fallbackType,
    }, 'Using fallback skill bundle');

    return {
      bundle: skillRegistry[fallbackType]!,
      usingFallback: true,
      fallbackFrom: businessType,
      warning,
    };
  }

  // This shouldn't happen if FALLBACK_MAPPINGS is complete
  throw new Error(`No skill bundle or fallback for business type: ${businessType}`);
}

// For API: only return types that are fully implemented
export function getAvailableBusinessTypes(): BusinessType[] {
  return Object.entries(skillRegistry)
    .filter(([_, bundle]) => bundle !== null)
    .map(([type]) => type as BusinessType);
}

// For admin/debug: all types including unimplemented
export function getAllBusinessTypes(): BusinessType[] {
  return ['ecommerce', 'lead-gen', 'saas', 'local'];
}

// Check if a type is fully supported
export function isBusinessTypeSupported(type: BusinessType): boolean {
  return skillRegistry[type] !== null;
}

// Individual skill loaders for agents that only need their specific skill
export function loadScoutSkill(businessType: BusinessType) {
  return loadSkillBundle(businessType).bundle.scout;
}

export function loadResearcherSkill(businessType: BusinessType) {
  return loadSkillBundle(businessType).bundle.researcher;
}

export function loadSEMSkill(businessType: BusinessType) {
  return loadSkillBundle(businessType).bundle.sem;
}

export function loadSEOSkill(businessType: BusinessType) {
  return loadSkillBundle(businessType).bundle.seo;
}

export function loadDirectorSkill(businessType: BusinessType) {
  return loadSkillBundle(businessType).bundle.director;
}
```

```typescript
// apps/api/src/services/interplay-report/skills/lead-gen/index.ts

import { AgentSkillBundle } from '../types';
import { leadGenScoutSkill } from './scout.skill';
import { leadGenResearcherSkill } from './researcher.skill';
import { leadGenSEMSkill } from './sem.skill';
import { leadGenSEOSkill } from './seo.skill';
import { leadGenDirectorSkill } from './director.skill';

export const leadGenSkillBundle: AgentSkillBundle = {
  businessType: 'lead-gen',
  version: '1.0.0',

  scout: leadGenScoutSkill,
  researcher: leadGenResearcherSkill,
  sem: leadGenSEMSkill,
  seo: leadGenSEOSkill,
  director: leadGenDirectorSkill,
};
```

---

## Orchestrator Integration

```typescript
// apps/api/src/services/interplay-report/orchestrator.ts

import { loadSkillBundle } from './skills';

export async function generateInterplayReport(
  clientAccountId: string,
  options: GenerateReportOptions
): Promise<string> {
  // 1. Get client and load skill bundle
  const client = await getClient(clientAccountId);
  const { bundle: skillBundle, usingFallback, warning } = loadSkillBundle(client.businessType);

  logger.info({
    clientAccountId,
    businessType: client.businessType,
    skillVersion: skillBundle.version,
    usingFallback,
  }, 'Loaded skill bundle for report generation');

  // Surface fallback warning in report metadata if applicable
  if (usingFallback && warning) {
    reportMetadata.warnings.push({
      type: 'skill-fallback',
      message: warning,
    });
  }

  // 2. Each agent receives ONLY its specific skill
  const scoutFindings = runScout(interplayData, skillBundle.scout);

  const researcherData = await runResearcher(
    clientAccountId,
    scoutFindings,
    dateRange,
    skillBundle.researcher
  );

  const [semOutput, seoOutput] = await Promise.all([
    runSEMAgent(researcherData.enrichedKeywords, {
      ...clientContext,
      skill: skillBundle.sem,
    }),
    runSEOAgent(researcherData.enrichedPages, {
      ...clientContext,
      skill: skillBundle.seo,
    }),
  ]);

  const directorOutput = await runDirectorAgent(
    semOutput,
    seoOutput,
    {
      ...clientContext,
      skill: skillBundle.director,
    }
  );

  // ... rest of pipeline
}
```

---

## Database Changes

### Schema Updates

Use Drizzle's pgEnum for type safety. The migration will create both the enum type and column.

```typescript
// apps/api/src/db/schema.ts

export const businessTypeEnum = pgEnum('business_type', [
  'ecommerce',
  'lead-gen',
  'saas',
  'local'
]);

export const clientAccounts = pgTable('client_accounts', {
  // ... existing columns
  businessType: businessTypeEnum('business_type').default('ecommerce').notNull(),
});
```

### Generated Migration

Drizzle will generate SQL like:

```sql
-- Generated by drizzle-kit
DO $$ BEGIN
  CREATE TYPE "business_type" AS ENUM('ecommerce', 'lead-gen', 'saas', 'local');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "client_accounts"
ADD COLUMN "business_type" "business_type" DEFAULT 'ecommerce' NOT NULL;

CREATE INDEX "idx_client_accounts_business_type"
ON "client_accounts"("business_type");
```

**Important:** Use Drizzle's enum approach only. Do not mix with raw VARCHAR + CHECK constraints.

---

## Implementation Phases

### Phase 1: Skill Infrastructure

**Files to create:**

1. `apps/api/src/services/interplay-report/skills/types.ts`
   - All skill type definitions (Scout, Researcher, SEM, SEO, Director)
   - AgentSkillBundle interface
   - Supporting types (KPIDefinition, ThresholdSet, etc.)

2. `apps/api/src/services/interplay-report/skills/index.ts`
   - Skill registry
   - `loadSkillBundle(businessType)` function
   - Individual skill loaders

### Phase 2: Skill Files (Per Business Type)

**For each business type (ecommerce, lead-gen, saas, local):**

3. `skills/{business-type}/index.ts` - Bundle export
4. `skills/{business-type}/scout.skill.ts` - Scout expertise
5. `skills/{business-type}/researcher.skill.ts` - Researcher expertise
6. `skills/{business-type}/sem.skill.ts` - SEM expertise
7. `skills/{business-type}/seo.skill.ts` - SEO expertise
8. `skills/{business-type}/director.skill.ts` - Director expertise

**Total: 24 skill files (6 per business type × 4 business types)**

### Phase 3: Agent Integration

**Files to modify:**

9. `apps/api/src/services/interplay-report/orchestrator.ts`
    - Load skill bundle at pipeline start
    - Pass individual skills to each agent

10. `apps/api/src/services/interplay-report/agents/scout.agent.ts`
    - Accept `ScoutSkillDefinition` parameter
    - Use skill thresholds and priority rules

11. `apps/api/src/services/interplay-report/agents/researcher.agent.ts`
    - Accept `ResearcherSkillDefinition` parameter
    - Use skill enrichment configuration

12. `apps/api/src/services/interplay-report/prompts/sem.prompt.ts`
    - Accept `SEMSkillDefinition` parameter
    - Inject skill context, guidance, examples, constraints

13. `apps/api/src/services/interplay-report/prompts/seo.prompt.ts`
    - Accept `SEOSkillDefinition` parameter
    - Inject skill context, schema rules, constraints

14. `apps/api/src/services/interplay-report/prompts/director.prompt.ts`
    - Accept `DirectorSkillDefinition` parameter
    - Inject synthesis rules, filtering, executive framing

### Phase 4: Database & API

**Files to modify:**

15. `apps/api/src/db/schema.ts` - Add businessType column
16. `apps/api/drizzle/` - Migration file
17. `apps/api/src/routes/clients.routes.ts` - Accept/return businessType

### Phase 5: Frontend Integration

**Files to modify:**

18. `apps/web/src/pages/Onboarding.tsx` - Business type selection
19. `apps/web/src/components/clients/` - Client settings
20. `packages/shared/src/types/` - BusinessType type

---

## Testing Strategy

### Unit Tests

1. **Skill Loading**
   - Test `loadSkillBundle()` returns correct bundle
   - Test individual skill loaders
   - Test fallback for unknown business type

2. **Scout Skill Application**
   - Test threshold overrides work
   - Test priority rules are applied
   - Test metric filtering

3. **Prompt Injection**
   - Test SEM prompt includes skill context
   - Test SEO prompt includes schema rules
   - Test Director prompt includes synthesis rules

### Integration Tests

4. **Full Pipeline with Different Skills**
   - Run pipeline with ecommerce skill → verify Product schema recommended
   - Run pipeline with lead-gen skill → verify Product schema flagged as error
   - Compare output differences

5. **Skill Constraint Enforcement**
   - Verify lead-gen never recommends ROAS optimization
   - Verify ecommerce never recommends Service schema as required
   - Verify local business always recommends LocalBusiness schema

### Validation Tests

6. **Business Scenario Testing**
   - Lead-gen client with Product schema → SEO skill flags as critical error
   - Ecommerce client missing Product schema → SEO skill flags as critical issue
   - Local business without LocalBusiness schema → flagged appropriately

---

## Success Metrics & Instrumentation

### Establishing Baselines (Pre-Launch)

Before shipping skills, generate baseline data from existing reports:

```typescript
// Run this analysis on existing reports before skill system launch
interface BaselineAnalysis {
  reportId: string;
  clientId: string;
  generatedAt: Date;

  // Manual labeling (sample 50 reports)
  manualReview?: {
    falsePositiveCount: number;      // Recommendations that don't apply
    irrelevantMetricMentions: number; // ROAS in lead-gen, etc.
    wrongSchemaRecommendations: number;
    reviewedBy: string;
    reviewedAt: Date;
  };

  // Automated detection (all reports)
  automated: {
    roasMentions: number;            // grep for /roas|return on ad spend/i
    productSchemaMentions: number;   // grep for /product schema/i
    shoppingCampaignMentions: number;
    totalRecommendations: number;
  };
}

// Baseline query for lead-gen clients
// SELECT
//   r.id,
//   (r.director_output::text ILIKE '%roas%')::int as roas_mentions,
//   (r.seo_output::text ILIKE '%product schema%')::int as product_schema,
//   jsonb_array_length(r.director_output->'unifiedRecommendations') as rec_count
// FROM interplay_reports r
// JOIN client_accounts c ON r.client_account_id = c.id
// WHERE c.business_type = 'lead-gen'  -- or manually tagged
```

### Automated Metrics (Post-Launch)

```typescript
// Log on every report generation
interface ReportMetrics {
  reportId: string;
  clientAccountId: string;
  businessType: BusinessType;
  skillVersion: string;

  // Constraint enforcement
  constraintViolations: number;
  violationsByRule: Record<string, number>;

  // Content analysis
  roasMentionsInOutput: number;
  productSchemaRecommended: boolean;
  invalidMetricsDetected: string[];

  // Performance
  skillLoadTimeMs: number;
  totalGenerationTimeMs: number;
  tokenBudget: {
    mode: 'full' | 'compact';
    truncationApplied: boolean;
  };
}

// Store in report_metrics table
// Aggregate weekly for dashboards
```

### Metric Definitions

| Metric | Definition | Target | How to Measure |
|--------|------------|--------|----------------|
| **False Positive Rate** | Recommendations that don't apply to business type | < 5% (down from ~15% baseline) | Manual review of sample + automated constraint violations |
| **ROAS Mentions (Lead-Gen)** | Reports mentioning ROAS for lead-gen clients | 0 | `grep -i 'roas\|return on ad spend'` on director output |
| **Product Schema (Lead-Gen)** | Lead-gen reports recommending Product schema | 0 | `grep -i 'product schema'` + type=schema-implementation |
| **Constraint Violation Rate** | % of reports with upstream violations caught by Director | < 2% | `constraintViolations > 0` per report |
| **Skill Load Time** | Time to load skill bundle | < 15ms p95 | Instrumented in `loadSkillBundle()` |

### Instrumentation Code

```typescript
// In orchestrator.ts
async function generateInterplayReport(
  clientAccountId: string,
  options: GenerateReportOptions
): Promise<string> {
  const metrics: Partial<ReportMetrics> = {
    clientAccountId,
    startTime: Date.now(),
  };

  // Measure skill loading
  const skillLoadStart = performance.now();
  const { bundle: skillBundle, usingFallback } = loadSkillBundle(client.businessType);
  metrics.skillLoadTimeMs = performance.now() - skillLoadStart;
  metrics.businessType = client.businessType;
  metrics.skillVersion = skillBundle.version;
  metrics.usingFallback = usingFallback;

  // ... run pipeline ...

  // Analyze output for metric violations
  const outputAnalysis = analyzeOutputForViolations(
    directorOutput,
    client.businessType
  );
  metrics.roasMentionsInOutput = outputAnalysis.roasMentions;
  metrics.productSchemaRecommended = outputAnalysis.productSchemaRecommended;
  metrics.invalidMetricsDetected = outputAnalysis.invalidMetrics;

  // Log metrics
  metrics.totalGenerationTimeMs = Date.now() - metrics.startTime;
  await saveReportMetrics(reportId, metrics);

  // Alert if unexpected content slipped through
  if (
    client.businessType === 'lead-gen' &&
    (metrics.roasMentionsInOutput > 0 || metrics.productSchemaRecommended)
  ) {
    logger.error({
      reportId,
      metrics,
    }, 'CRITICAL: Invalid content in lead-gen report - skill constraints failed');
  }

  return reportId;
}

function analyzeOutputForViolations(
  output: DirectorOutput,
  businessType: BusinessType
): OutputAnalysis {
  const fullText = JSON.stringify(output).toLowerCase();

  return {
    roasMentions: (fullText.match(/\broas\b|return on ad spend/gi) || []).length,
    productSchemaRecommended: /add.*product schema|implement.*product schema/i.test(fullText),
    invalidMetrics: detectInvalidMetrics(fullText, businessType),
  };
}
```

### Weekly Dashboard Query

```sql
-- Weekly skill effectiveness report
SELECT
  DATE_TRUNC('week', created_at) as week,
  business_type,
  skill_version,
  COUNT(*) as reports_generated,
  AVG(constraint_violations) as avg_violations,
  SUM(CASE WHEN roas_mentions > 0 AND business_type = 'lead-gen' THEN 1 ELSE 0 END) as leadgen_roas_leaks,
  SUM(CASE WHEN product_schema_recommended AND business_type = 'lead-gen' THEN 1 ELSE 0 END) as leadgen_product_schema_leaks,
  AVG(skill_load_time_ms) as avg_skill_load_ms,
  AVG(total_generation_time_ms) as avg_total_time_ms
FROM report_metrics
WHERE created_at > NOW() - INTERVAL '4 weeks'
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 2;
```

### Success Criteria

| Phase | Metric | Baseline | Target |
|-------|--------|----------|--------|
| Pre-launch | ROAS mentions in lead-gen reports | ~30% of reports | - |
| Pre-launch | Product schema in lead-gen reports | ~20% of reports | - |
| Week 1 | ROAS mentions in lead-gen reports | - | < 5% |
| Week 1 | Product schema in lead-gen reports | - | 0% |
| Week 2 | Constraint violation rate | - | < 2% |
| Week 4 | Manual review false positive rate | ~15% | < 5% |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| More files to maintain | Higher maintenance burden | Clear file templates; automated testing; good documentation |
| Skill drift between agents | Inconsistent recommendations | Version all skills together; integration tests catch drift |
| Complex debugging | Harder to trace issues | Structured logging per skill; skill version in report metadata |
| Skill file bloat | Performance impact | Lazy loading; skill caching; regular audits |

---

## Future Enhancements

### Phase 2: Skill Inheritance

Allow skills to extend base skills:

```typescript
// saas/sem.skill.ts extends lead-gen/sem.skill.ts
import { leadGenSEMSkill } from '../lead-gen/sem.skill';

export const saasSEMSkill: SEMSkillDefinition = {
  ...leadGenSEMSkill,
  version: '1.0.0',

  // Override specific sections
  context: {
    ...leadGenSEMSkill.context,
    businessModel: 'SaaS subscription model with free trials...',
  },

  // Add SaaS-specific patterns
  analysis: {
    ...leadGenSEMSkill.analysis,
    keyPatterns: [
      ...leadGenSEMSkill.analysis.keyPatterns,
      { id: 'trial-intent', name: 'Free Trial Intent', ... },
    ],
  },
};
```

### Phase 3: Industry-Specific Skills

Add industry layer on top of business type:

```
ecommerce/
├── base/           # Base ecommerce skills
├── fashion/        # Fashion-specific overrides
├── electronics/    # Electronics-specific overrides
└── food/           # Food/grocery-specific overrides
```

### Phase 4: Skill Analytics

Track skill effectiveness:
- Which skill recommendations get approved most
- Which constraints are most often overridden
- A/B test skill variations

---

## Skill-to-Prompt Serialisation

### The Translation Layer

Skill definitions are TypeScript objects for maintainability, but agents receive text prompts. Each prompt builder is responsible for serialising relevant skill properties into prompt content.

**Design Principle:** The skill file is the source of truth. The prompt builder is a pure function that transforms skill → prompt text. No prompt content lives outside the skill file.

### Serialisation Examples

```typescript
// apps/api/src/services/interplay-report/prompts/sem.prompt.ts

import { SEMSkillDefinition, KPIDefinition, ThresholdSet } from '../skills/types';

export function buildSEMPrompt(
  keywords: EnrichedKeyword[],
  context: SEMAgentContext
): string {
  const { skill } = context;

  // Serialise KPIs into readable format
  const kpiSection = formatKPIs(skill.kpis);

  // Serialise benchmarks into comparison table
  const benchmarkSection = formatBenchmarks(skill.benchmarks);

  // Serialise examples into few-shot format
  const examplesSection = formatExamples(skill.prompt.examples);

  // Serialise constraints into explicit rules
  const constraintsSection = formatConstraints(skill.prompt.constraints);

  return `
${skill.prompt.roleContext}

## Business Context
${skill.context.businessModel}

Conversion Definition: ${skill.context.conversionDefinition}
Customer Journey: ${skill.context.typicalCustomerJourney}

## Key Performance Indicators

### Primary KPIs (Focus Here)
${kpiSection.primary}

### Secondary KPIs
${kpiSection.secondary}

### Metrics to IGNORE (Not Applicable)
${kpiSection.irrelevant}

## Benchmarks for This Business Type
${benchmarkSection}

## Analysis Guidance
${skill.prompt.analysisInstructions}

## Patterns to Look For
${formatPatterns(skill.analysis.keyPatterns)}

## Anti-Patterns (Problems to Flag)
${formatPatterns(skill.analysis.antiPatterns)}

## Data to Analyze
\`\`\`json
${JSON.stringify(keywords, null, 2)}
\`\`\`

## Output Requirements
${skill.prompt.outputGuidance}

## Examples
${examplesSection}

## CRITICAL CONSTRAINTS
${constraintsSection}

Return your analysis as valid JSON matching the schema below...
`;
}

// Helper functions for serialisation
function formatKPIs(kpis: SEMSkillDefinition['kpis']): {
  primary: string;
  secondary: string;
  irrelevant: string;
} {
  const formatKPI = (kpi: KPIDefinition) =>
    `- **${kpi.metric}** (${kpi.importance}): ${kpi.description}
    Target: ${kpi.targetDirection}${kpi.benchmark ? ` | Benchmark: ${kpi.benchmark}` : ''}
    Why it matters: ${kpi.businessContext}`;

  return {
    primary: kpis.primary.map(formatKPI).join('\n\n'),
    secondary: kpis.secondary.map(formatKPI).join('\n\n'),
    irrelevant: kpis.irrelevant.map(m => `- ${m}`).join('\n'),
  };
}

function formatBenchmarks(benchmarks: SEMSkillDefinition['benchmarks']): string {
  const rows = Object.entries(benchmarks)
    .filter(([_, v]) => v !== undefined)
    .map(([metric, thresholds]) => {
      const t = thresholds as ThresholdSet;
      return `| ${metric} | ${t.excellent} | ${t.good} | ${t.average} | ${t.poor} |`;
    });

  return `| Metric | Excellent | Good | Average | Poor |
|--------|-----------|------|---------|------|
${rows.join('\n')}`;
}

function formatPatterns(patterns: AnalysisPattern[]): string {
  return patterns.map(p =>
    `### ${p.name}
${p.description}
- **Indicators:** ${p.indicators.join(', ')}
- **Recommended Action:** ${p.recommendation}`
  ).join('\n\n');
}

function formatExamples(examples: SEMExample[]): string {
  return examples.map((ex, i) =>
    `### Example ${i + 1}: ${ex.scenario}
**Data:** ${ex.data}
**Recommendation:** ${ex.recommendation}
**Reasoning:** ${ex.reasoning}`
  ).join('\n\n');
}

function formatConstraints(constraints: string[]): string {
  return constraints.map((c, i) => `${i + 1}. ${c}`).join('\n');
}
```

**Key points:**
- Every skill property has a corresponding serialisation function
- Prompts are deterministic given a skill + data
- No hardcoded prompt content outside skill files
- Format functions can be unit tested independently

### Token Budget Considerations

The serialised output can get long. Monitor token usage, especially for SEO agent which also receives page content.

#### Concrete Limits

```typescript
// Token budget constants (Claude Sonnet context window considerations)
const TOKEN_LIMITS = {
  // Approximate token counts (1 token ≈ 4 chars)
  MAX_PROMPT_TOKENS: 30000,          // Leave room for response
  MAX_DATA_TOKENS: 15000,            // Keywords/pages JSON
  MAX_SKILL_CONTEXT_TOKENS: 5000,    // Skill serialisation

  // Record limits
  MAX_KEYWORDS_FULL: 20,
  MAX_KEYWORDS_COMPACT: 10,
  MAX_PAGES_FULL: 10,
  MAX_PAGES_COMPACT: 5,

  // Content limits per record
  MAX_CONTENT_PREVIEW_CHARS: 500,
  MAX_PAGE_TITLE_CHARS: 100,
};

type SerializationMode = 'full' | 'compact';

interface TokenBudgetResult {
  mode: SerializationMode;
  keywordsIncluded: number;
  keywordsDropped: number;
  pagesIncluded: number;
  pagesDropped: number;
  truncationApplied: boolean;
}
```

#### Mode Selection & Truncation

```typescript
function determineSerializationMode(
  keywords: EnrichedKeyword[],
  pages: EnrichedPage[]
): { mode: SerializationMode; budget: TokenBudgetResult } {
  const keywordCount = keywords.length;
  const pageCount = pages.length;

  // Estimate token usage
  const estimatedDataTokens = estimateTokens(keywords, pages);

  let mode: SerializationMode = 'full';
  let keywordsIncluded = keywordCount;
  let pagesIncluded = pageCount;

  // Switch to compact if over budget
  if (
    keywordCount > TOKEN_LIMITS.MAX_KEYWORDS_FULL ||
    pageCount > TOKEN_LIMITS.MAX_PAGES_FULL ||
    estimatedDataTokens > TOKEN_LIMITS.MAX_DATA_TOKENS
  ) {
    mode = 'compact';
    keywordsIncluded = Math.min(keywordCount, TOKEN_LIMITS.MAX_KEYWORDS_COMPACT);
    pagesIncluded = Math.min(pageCount, TOKEN_LIMITS.MAX_PAGES_COMPACT);
  }

  const budget: TokenBudgetResult = {
    mode,
    keywordsIncluded,
    keywordsDropped: keywordCount - keywordsIncluded,
    pagesIncluded,
    pagesDropped: pageCount - pagesIncluded,
    truncationApplied: keywordsIncluded < keywordCount || pagesIncluded < pageCount,
  };

  // Log if truncation occurred
  if (budget.truncationApplied) {
    logger.warn({
      originalKeywords: keywordCount,
      originalPages: pageCount,
      ...budget,
    }, 'Data truncated due to token budget');
  }

  return { mode, budget };
}

function estimateTokens(keywords: EnrichedKeyword[], pages: EnrichedPage[]): number {
  // Rough estimation: JSON.stringify length / 4
  const keywordJson = JSON.stringify(keywords);
  const pageJson = JSON.stringify(pages);
  return Math.ceil((keywordJson.length + pageJson.length) / 4);
}
```

#### Compact Mode Differences

| Element | Full Mode | Compact Mode |
|---------|-----------|--------------|
| Primary KPIs | All with full context | All, shortened descriptions |
| Secondary KPIs | All | Omitted |
| Benchmarks | Full table | Single "good" threshold only |
| Examples | All (2-3) | First example only |
| Patterns | All key + anti patterns | Top 3 by relevance |
| Constraints | All | All (never truncate) |
| Keywords | Up to 20 | Up to 10, highest priority |
| Pages | Up to 10 | Up to 5, highest priority |
| Content preview | 500 chars | 200 chars |

#### Priority Scoring for Truncation

When truncating data, we need deterministic priority scoring. First, define the expected data shapes:

```typescript
// Data shapes from Researcher agent (after enrichment)
interface EnrichedKeyword {
  // Core identifiers
  query: string;
  queryHash: string;

  // Scout-assigned metadata
  priorityReason: string;          // e.g., 'high-spend-low-roas', 'cannibalization-risk'

  // Google Ads metrics
  spend: number;                   // Total spend in dollars (e.g., 250.50)
  clicks: number;
  impressions: number;
  conversions?: number;            // May be null if no conversion tracking
  conversionValue?: number;        // Revenue from conversions
  cpc: number;                     // Cost per click in dollars
  ctr: number;                     // Click-through rate as decimal (0.025 = 2.5%)
  roas?: number;                   // Return on ad spend (conversionValue / spend)

  // Search Console metrics
  organicPosition?: number;        // Average organic ranking position
  organicClicks?: number;
  organicImpressions?: number;
  organicCtr?: number;

  // Competitive data (from Researcher enrichment)
  competitiveMetrics?: {
    impressionShare: number;       // As decimal (0.65 = 65%)
    lostImpressionShareBudget: number;
    lostImpressionShareRank: number;
    topOfPageRate: number;
    absoluteTopOfPageRate: number;
  };
}

interface EnrichedPage {
  // Core identifiers
  url: string;
  path: string;

  // Scout-assigned metadata
  priorityReason: string;          // e.g., 'high-paid-spend-low-organic', 'high-traffic-high-bounce'

  // Paid metrics (aggregated for this URL)
  paidSpend?: number;              // Total spend driving traffic to this URL
  paidClicks?: number;

  // Organic metrics
  organicImpressions?: number;
  organicClicks?: number;
  organicPosition?: number;        // Average position for queries landing on this page
  organicCtr?: number;

  // GA4 / behavior metrics
  bounceRate?: number;             // As decimal (0.65 = 65%)
  avgTimeOnPage?: number;          // In seconds

  // Fetched content (from Researcher)
  fetchedContent?: {
    title: string;
    h1: string;
    metaDescription: string;
    wordCount: number;
    contentPreview: string;        // First ~500 chars of body text
    detectedSchema: string[];      // Schema types found on page
    contentSignals: Record<string, boolean>;  // Skill-specific signals detected
  };
}
```

Define how keywords and pages are ranked:

```typescript
// Priority score calculation for keywords
function calculateKeywordPriority(keyword: EnrichedKeyword): number {
  let score = 0;

  // Base score from Scout's priority reason (set during Scout phase)
  const priorityWeights: Record<string, number> = {
    'high-spend-low-roas': 100,
    'cannibalization-risk': 90,
    'growth-potential': 70,
    'competitive-pressure': 60,
  };
  score += priorityWeights[keyword.priorityReason] || 50;

  // Boost based on spend (higher spend = more important to analyze)
  if (keyword.spend > 500) score += 30;
  else if (keyword.spend > 200) score += 20;
  else if (keyword.spend > 100) score += 10;

  // Boost based on conversion data availability
  if (keyword.conversions && keyword.conversions > 0) score += 15;

  // Boost if competitive data is available
  if (keyword.competitiveMetrics) score += 10;

  return score;
}

// Priority score calculation for pages
function calculatePagePriority(page: EnrichedPage): number {
  let score = 0;

  // Base score from Scout's priority reason (set during Scout phase)
  const priorityWeights: Record<string, number> = {
    'high-paid-spend-low-organic': 100,
    'high-traffic-high-bounce': 80,
    'high-impressions-low-ctr': 70,
  };
  score += priorityWeights[page.priorityReason] || 50;

  // Boost based on paid spend (opportunity cost)
  if (page.paidSpend && page.paidSpend > 300) score += 25;
  else if (page.paidSpend && page.paidSpend > 100) score += 15;

  // Boost if content was successfully fetched
  if (page.fetchedContent) score += 10;

  // Boost based on organic impressions
  if (page.organicImpressions && page.organicImpressions > 1000) score += 10;

  return score;
}

// Generic prioritize and truncate function
function prioritizeAndTruncate<T>(
  items: T[],
  limit: number,
  calculatePriority: (item: T) => number
): { included: T[]; dropped: number } {
  if (items.length <= limit) {
    return { included: items, dropped: 0 };
  }

  const scored = items.map(item => ({
    item,
    score: calculatePriority(item),
  }));

  const sorted = scored.sort((a, b) => b.score - a.score);
  const included = sorted.slice(0, limit).map(s => s.item);
  const dropped = items.length - limit;

  return { included, dropped };
}
```

**Note:** `priorityReason` is set by the Scout agent when it identifies battleground keywords and critical pages. It's part of the `EnrichedKeyword` and `EnrichedPage` interfaces returned by the Researcher.

#### Error Handling

```typescript
function buildSEMPrompt(
  keywords: EnrichedKeyword[],
  context: SEMAgentContext
): string {
  const { mode, budget } = determineSerializationMode(keywords, []);

  // Truncate keywords if needed, keeping highest priority
  const { included: includedKeywords, dropped } = prioritizeAndTruncate(
    keywords,
    budget.keywordsIncluded,
    calculateKeywordPriority
  );

  // Add truncation notice to prompt if data was dropped
  const truncationNotice = dropped > 0
    ? `\n\nNOTE: Data was truncated for token limits. ${dropped} lower-priority keywords omitted. Focus analysis on the provided high-priority items.\n`
    : '';

  const prompt = mode === 'compact'
    ? buildCompactPrompt(includedKeywords, context.skill, truncationNotice)
    : buildFullPrompt(includedKeywords, context.skill, truncationNotice);

  // Final safety check
  const estimatedTokens = Math.ceil(prompt.length / 4);
  if (estimatedTokens > TOKEN_LIMITS.MAX_PROMPT_TOKENS) {
    logger.error({
      estimatedTokens,
      limit: TOKEN_LIMITS.MAX_PROMPT_TOKENS,
    }, 'Prompt exceeds token limit even after truncation');
    throw new Error('Prompt too large for model context window');
  }

  return prompt;
}
```

---

## Researcher Skill Deep Dive

The Researcher agent is mechanical (no AI) but still needs business-type-aware logic for content extraction and quality assessment.

### Enhanced Researcher Skill Definition

```typescript
interface ResearcherSkillDefinition {
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

  // Page content enrichment - THIS IS THE KEY PART
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
      patterns: PagePattern[];      // URL/content patterns to classify page type
      defaultType: string;
      confidenceThreshold: number;  // 0-1, below this use defaultType
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

interface ContentSignal {
  id: string;
  name: string;
  selector: string;              // CSS selector or detection rule
  importance: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  businessContext: string;       // Why this matters for this business type
}

interface PagePattern {
  pattern: string;               // Regex or URL pattern
  pageType: string;              // Classification result
  description: string;
  confidence: number;            // 0-1, how confident this pattern is
}
```

### Lead-Gen Researcher Skill Example

```typescript
// apps/api/src/services/interplay-report/skills/lead-gen/researcher.skill.ts

export const leadGenResearcherSkill: ResearcherSkillDefinition = {
  version: '1.0.0',

  keywordEnrichment: {
    competitiveMetrics: {
      required: ['impressionShare', 'topOfPageRate'],
      optional: ['outranking', 'overlapRate'],
      irrelevant: ['benchmarkCtr'],  // Less relevant for lead-gen
    },
    priorityBoosts: [
      {
        metric: 'conversionRate',
        condition: '> 0.05',
        boost: 1.5,
        reason: 'High-converting keywords are gold for lead-gen',
      },
      {
        metric: 'queryContains',
        condition: 'demo|pricing|quote|consultation',
        boost: 1.3,
        reason: 'High-intent keywords',
      },
    ],
  },

  pageEnrichment: {
    standardExtractions: {
      title: true,
      h1: true,
      metaDescription: true,
      canonicalUrl: true,
      wordCount: true,
    },

    schemaExtraction: {
      lookFor: ['Organization', 'Service', 'FAQPage', 'LocalBusiness'],
      flagIfPresent: ['Product', 'Offer', 'AggregateOffer'],  // Wrong for lead-gen
      flagIfMissing: ['Organization'],                         // Should always have
    },

    // Lead-gen specific content signals
    contentSignals: [
      {
        id: 'form-presence',
        name: 'Lead Capture Form',
        selector: 'form[action*="submit"], form[action*="contact"], form[action*="lead"], .contact-form, #contact-form, [data-form="lead"]',
        importance: 'critical',
        description: 'Presence of lead capture form on page',
        businessContext: 'Lead-gen pages must have conversion opportunity',
      },
      {
        id: 'form-above-fold',
        name: 'Form Above Fold',
        selector: 'form:not([style*="display: none"])', // + viewport check in code
        importance: 'high',
        description: 'Form visible without scrolling',
        businessContext: 'Above-fold forms convert better',
      },
      {
        id: 'phone-number',
        name: 'Phone Number Present',
        selector: 'a[href^="tel:"], .phone, .telephone',
        importance: 'high',
        description: 'Clickable phone number for calls',
        businessContext: 'Phone leads are often higher quality',
      },
      {
        id: 'trust-signals',
        name: 'Trust Signals',
        selector: '.testimonial, .review, .client-logo, .trust-badge, .certification, [class*="testimonial"], [class*="client"]',
        importance: 'high',
        description: 'Social proof elements',
        businessContext: 'Trust signals critical for lead-gen conversion',
      },
      {
        id: 'cta-button',
        name: 'Call-to-Action Buttons',
        selector: 'a.btn, button.cta, .cta-button, a[href*="contact"], a[href*="demo"], a[href*="quote"]',
        importance: 'high',
        description: 'Prominent CTA buttons',
        businessContext: 'Clear CTAs guide users to convert',
      },
      {
        id: 'pricing-hidden',
        name: 'Pricing Information',
        selector: '.pricing, .price, [class*="pricing"]',
        importance: 'medium',
        description: 'Pricing visibility (often intentionally hidden for lead-gen)',
        businessContext: 'Lead-gen often hides pricing to force contact',
      },
    ],

    pageClassification: {
      patterns: [
        { pattern: '/(contact|get-in-touch|reach-us)', pageType: 'contact', description: 'Contact pages' },
        { pattern: '/(services?|solutions?|what-we-do)', pageType: 'service', description: 'Service pages' },
        { pattern: '/(about|who-we-are|team)', pageType: 'about', description: 'About pages' },
        { pattern: '/(blog|news|articles?|insights?)', pageType: 'blog', description: 'Blog content' },
        { pattern: '/(case-stud|portfolio|work|projects?)', pageType: 'case-study', description: 'Case studies' },
        { pattern: '/(demo|free-trial|get-started)', pageType: 'conversion', description: 'Conversion pages' },
        { pattern: '/(pricing|plans?|packages?)', pageType: 'pricing', description: 'Pricing pages' },
      ],
      defaultType: 'landing',
    },
  },

  dataQuality: {
    minKeywordsWithCompetitiveData: 5,
    minPagesWithContent: 3,
    maxFetchTimeout: 10000,
    maxConcurrentFetches: 3,
  },
};
```

### Ecommerce Researcher Skill Example

```typescript
// apps/api/src/services/interplay-report/skills/ecommerce/researcher.skill.ts

export const ecommerceResearcherSkill: ResearcherSkillDefinition = {
  version: '1.0.0',

  keywordEnrichment: {
    competitiveMetrics: {
      required: ['impressionShare', 'topOfPageRate', 'benchmarkCtr'],
      optional: ['outranking', 'overlapRate'],
      irrelevant: [],
    },
    priorityBoosts: [
      {
        metric: 'roas',
        condition: '> 4',
        boost: 1.5,
        reason: 'High-ROAS keywords should be prioritised',
      },
      {
        metric: 'queryContains',
        condition: 'buy|shop|order|purchase|price',
        boost: 1.3,
        reason: 'Transactional intent keywords',
      },
    ],
  },

  pageEnrichment: {
    standardExtractions: {
      title: true,
      h1: true,
      metaDescription: true,
      canonicalUrl: true,
      wordCount: true,
    },

    schemaExtraction: {
      lookFor: ['Product', 'Offer', 'AggregateOffer', 'BreadcrumbList', 'Organization'],
      flagIfPresent: [],                                    // All schema is potentially valid
      flagIfMissing: ['Product', 'BreadcrumbList'],         // Critical for ecommerce
    },

    // Ecommerce-specific content signals
    contentSignals: [
      {
        id: 'add-to-cart',
        name: 'Add to Cart Button',
        selector: 'button[class*="add-to-cart"], .add-to-cart, [data-action="add-to-cart"], form[action*="cart"]',
        importance: 'critical',
        description: 'Add to cart functionality',
        businessContext: 'Product pages must have purchase path',
      },
      {
        id: 'price-display',
        name: 'Price Display',
        selector: '.price, .product-price, [class*="price"], [itemprop="price"]',
        importance: 'critical',
        description: 'Visible product pricing',
        businessContext: 'Price must be visible for purchase decisions',
      },
      {
        id: 'product-images',
        name: 'Product Images',
        selector: '.product-image, .product-gallery, [class*="product-image"]',
        importance: 'high',
        description: 'Product image gallery',
        businessContext: 'Images drive conversion on product pages',
      },
      {
        id: 'reviews',
        name: 'Customer Reviews',
        selector: '.reviews, .product-reviews, [class*="review"], [itemprop="review"]',
        importance: 'high',
        description: 'Customer review section',
        businessContext: 'Reviews build trust and enable rich snippets',
      },
      {
        id: 'availability',
        name: 'Stock Availability',
        selector: '.stock, .availability, [class*="stock"], [itemprop="availability"]',
        importance: 'high',
        description: 'Stock/availability indicator',
        businessContext: 'Out-of-stock pages waste ad spend',
      },
      {
        id: 'product-grid',
        name: 'Product Grid/Listing',
        selector: '.product-grid, .product-list, [class*="product-grid"]',
        importance: 'medium',
        description: 'Product listing layout (category pages)',
        businessContext: 'Indicates category vs product page',
      },
      {
        id: 'breadcrumbs',
        name: 'Breadcrumb Navigation',
        selector: '.breadcrumb, .breadcrumbs, [class*="breadcrumb"], nav[aria-label="breadcrumb"]',
        importance: 'medium',
        description: 'Breadcrumb navigation',
        businessContext: 'Helps SEO and user navigation',
      },
    ],

    pageClassification: {
      patterns: [
        { pattern: '/(product|item|p)/[^/]+$', pageType: 'product', description: 'Product detail pages' },
        { pattern: '/(category|collection|shop|c)/[^/]+$', pageType: 'category', description: 'Category pages' },
        { pattern: '/(cart|basket|bag)', pageType: 'cart', description: 'Shopping cart' },
        { pattern: '/(checkout|payment)', pageType: 'checkout', description: 'Checkout flow' },
        { pattern: '/(search|results)', pageType: 'search', description: 'Search results' },
        { pattern: '/(sale|clearance|deals)', pageType: 'promotion', description: 'Promotional pages' },
      ],
      defaultType: 'landing',
    },
  },

  dataQuality: {
    minKeywordsWithCompetitiveData: 10,
    minPagesWithContent: 5,
    maxFetchTimeout: 10000,
    maxConcurrentFetches: 5,
  },
};
```

---

## Constraint Enforcement Strategy

### Design Decision: Strict Upstream

**Principle:** Agents should never generate invalid recommendations in the first place. The Director is a safety net, not a filter.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Constraint Enforcement                        │
│                                                                  │
│  SEM Agent: "Do NOT recommend ROAS-based bidding"               │
│      ↓ (should never output ROAS recommendations)               │
│                                                                  │
│  SEO Agent: "Do NOT recommend Product schema"                   │
│      ↓ (should never output Product schema recommendations)     │
│                                                                  │
│  Director: Validates no ROAS/Product recommendations exist      │
│      ↓ (logs warning if upstream constraint was violated)       │
│                                                                  │
│  Final Output: Clean, business-appropriate recommendations      │
└─────────────────────────────────────────────────────────────────┘
```

### Action Schemas

Define normalized action shapes that constraint matching operates on:

```typescript
// Normalized action structure for constraint matching
interface NormalizedAction {
  id: string;
  source: 'sem' | 'seo';
  type: ActionType;
  text: string;              // Full recommendation text (lowercased for matching)
  keywords: string[];        // Extracted keywords/entities
  metrics: string[];         // Metrics mentioned (roas, cpl, revenue, etc.)
  schemas: string[];         // Schema types mentioned (Product, Service, etc.)
}

type ActionType =
  | 'bid-adjustment'
  | 'budget-change'
  | 'campaign-structure'
  | 'keyword-targeting'
  | 'schema-implementation'
  | 'schema-removal'
  | 'content-change'
  | 'technical-fix'
  | 'other';

// Extract normalized action from SEM output
function normalizeSEMAction(action: SEMAction): NormalizedAction {
  const text = `${action.action} ${action.reasoning}`.toLowerCase();

  return {
    id: action.id || crypto.randomUUID(),
    source: 'sem',
    type: inferActionType(text, 'sem'),
    text,
    keywords: extractKeywords(text),
    metrics: extractMetrics(text),
    schemas: [],  // SEM actions don't typically mention schemas
  };
}

// Extract normalized action from SEO output
function normalizeSEOAction(action: SEOAction): NormalizedAction {
  const text = `${action.recommendation} ${action.specificActions.join(' ')}`.toLowerCase();

  return {
    id: action.id || crypto.randomUUID(),
    source: 'seo',
    type: inferActionType(text, 'seo'),
    text,
    keywords: extractKeywords(text),
    metrics: extractMetrics(text),
    schemas: extractSchemaTypes(text),
  };
}

// Action type inference based on text content
const ACTION_TYPE_PATTERNS: Record<ActionType, RegExp[]> = {
  'bid-adjustment': [
    /\b(reduce|increase|adjust|lower|raise)\s+(bids?|bidding)/i,
    /\bbid\s+(strategy|adjustment|modifier)/i,
  ],
  'budget-change': [
    /\b(increase|decrease|reallocate|shift)\s+budget/i,
    /\bbudget\s+(allocation|reallocation)/i,
  ],
  'campaign-structure': [
    /\b(create|restructure|consolidate|split)\s+(campaign|ad\s*group)/i,
    /\bcampaign\s+structure/i,
  ],
  'keyword-targeting': [
    /\b(add|remove|pause)\s+(keyword|negative)/i,
    /\bmatch\s+type/i,
    /\bkeyword\s+(targeting|expansion)/i,
  ],
  'schema-implementation': [
    /\b(add|implement|create)\s+\w*\s*schema/i,
    /\bschema\s+(markup|implementation)/i,
  ],
  'schema-removal': [
    /\b(remove|delete|fix)\s+\w*\s*schema/i,
    /\bincorrect\s+schema/i,
  ],
  'content-change': [
    /\b(update|rewrite|improve|optimize)\s+(title|meta|h1|content|copy)/i,
    /\bcontent\s+(optimization|improvement)/i,
  ],
  'technical-fix': [
    /\b(fix|resolve|address)\s+(page\s*speed|mobile|ssl|redirect|404)/i,
    /\btechnical\s+(seo|issue|fix)/i,
  ],
  'other': [], // Fallback, no patterns
};

function inferActionType(text: string, source: 'sem' | 'seo'): ActionType {
  // Check each action type's patterns
  for (const [actionType, patterns] of Object.entries(ACTION_TYPE_PATTERNS)) {
    if (actionType === 'other') continue;
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return actionType as ActionType;
      }
    }
  }

  // Default based on source if no pattern matches
  return source === 'sem' ? 'keyword-targeting' : 'content-change';
}

// Keyword/entity extraction (simplified - extracts quoted terms and capitalized phrases)
function extractKeywords(text: string): string[] {
  const keywords: string[] = [];

  // Extract quoted strings
  const quotedMatches = text.match(/"([^"]+)"|'([^']+)'/g);
  if (quotedMatches) {
    keywords.push(...quotedMatches.map(q => q.replace(/['"]/g, '')));
  }

  // Extract bracketed terms (common in keyword references)
  const bracketedMatches = text.match(/\[([^\]]+)\]/g);
  if (bracketedMatches) {
    keywords.push(...bracketedMatches.map(b => b.replace(/[\[\]]/g, '')));
  }

  return [...new Set(keywords)]; // Dedupe
}

// Metric extraction patterns
const METRIC_PATTERNS: Record<string, RegExp> = {
  'roas': /\broas\b|return on ad spend/i,
  'revenue': /\brevenue\b|\bearnings\b/i,
  'aov': /\baov\b|average order value/i,
  'cpl': /\bcpl\b|cost per lead/i,
  'cpc': /\bcpc\b|cost per click/i,
  'ctr': /\bctr\b|click.through rate/i,
};

function extractMetrics(text: string): string[] {
  return Object.entries(METRIC_PATTERNS)
    .filter(([_, pattern]) => pattern.test(text))
    .map(([metric]) => metric);
}

// Schema type extraction
const SCHEMA_TYPES = [
  'Product', 'Offer', 'AggregateOffer', 'Service', 'ProfessionalService',
  'LocalBusiness', 'Organization', 'FAQPage', 'Article', 'BreadcrumbList',
  'HowTo', 'Review', 'AggregateRating'
];

function extractSchemaTypes(text: string): string[] {
  return SCHEMA_TYPES.filter(schema =>
    new RegExp(`\\b${schema}\\b`, 'i').test(text)
  );
}
```

### Constraint Matching Rules

```typescript
// Exclusion rule definition
interface ExclusionRule {
  id: string;
  description: string;
  match: (action: NormalizedAction) => boolean;
}

// Build exclusion rules from skill configuration
function buildExclusionRules(mustExclude: string[]): ExclusionRule[] {
  return mustExclude.map(exclusion => {
    // Pattern: "metric:roas" - exclude if mentions ROAS
    if (exclusion.startsWith('metric:')) {
      const metric = exclusion.replace('metric:', '');
      return {
        id: exclusion,
        description: `Excludes actions mentioning ${metric}`,
        match: (action) => action.metrics.includes(metric),
      };
    }

    // Pattern: "schema:Product" - exclude if recommends Product schema
    if (exclusion.startsWith('schema:')) {
      const schema = exclusion.replace('schema:', '');
      return {
        id: exclusion,
        description: `Excludes actions recommending ${schema} schema`,
        match: (action) =>
          action.schemas.includes(schema) &&
          action.type === 'schema-implementation',
      };
    }

    // Pattern: "type:shopping-campaign" - exclude by action type keyword
    if (exclusion.startsWith('type:')) {
      const keyword = exclusion.replace('type:', '').replace(/-/g, ' ');
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

// Example mustExclude configuration in skill:
// mustExclude: [
//   'metric:roas',
//   'metric:revenue',
//   'schema:Product',
//   'type:shopping-campaign',
//   'type:merchant-center',
// ]
```

### Implementation

```typescript
// In Director agent - constraint validation with logging

interface ConstraintViolation {
  source: 'sem' | 'seo';
  actionId: string;
  ruleId: string;
  ruleDescription: string;
  matchedContent: string;
}

function validateUpstreamConstraints(
  semOutput: SEMAgentOutput,
  seoOutput: SEOAgentOutput,
  skill: DirectorSkillDefinition
): { violations: ConstraintViolation[]; filtered: NormalizedAction[] } {
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
          matchedContent: action.text.slice(0, 200),  // Truncate for logging
        });
        excluded = true;
        break;  // One violation is enough to exclude
      }
    }

    if (!excluded) {
      filtered.push(action);
    }
  }

  // Log violations
  if (violations.length > 0) {
    logger.warn({
      violationCount: violations.length,
      violations,
      skillVersion: skill.version,
    }, 'Upstream constraint violations detected - filtering from output');
  }

  return { violations, filtered };
}
```

**Key behaviours:**
1. **SEM/SEO agents** have explicit constraints in their prompts
2. **Director** validates constraints were respected
3. **Violations are logged** for debugging and skill refinement
4. **Violations are filtered** from final output (defence in depth)
5. **Metrics tracked** on violation frequency to identify prompt weaknesses

### Violation Tracking

Store violations for analysis:

```typescript
// In database: constraint_violations table
interface ConstraintViolation {
  id: string;
  reportId: string;
  clientAccountId: string;
  businessType: BusinessType;
  source: 'sem' | 'seo';
  constraint: string;
  violatingContent: string;
  skillVersion: string;
  createdAt: Date;
}

// Simple query to surface problem areas
// SELECT constraint, source, COUNT(*) as violation_count
// FROM constraint_violations
// WHERE created_at > NOW() - INTERVAL '7 days'
// GROUP BY constraint, source
// ORDER BY violation_count DESC
```

When violation frequency spikes for a specific constraint/agent combo, that's the signal to tighten the prompt in that skill file.

---

## Business Type Mismatch Detection

### Problem

If a client is miscategorised (e.g., SaaS marked as ecommerce), reports will be confidently wrong.

### Solution: Mismatch Warning System

```typescript
interface MismatchSignal {
  id: string;
  description: string;
  expectedFor: BusinessType[];
  notExpectedFor: BusinessType[];
  weight: number;  // How strong an indicator this is
}

interface MismatchAnalysis {
  selectedType: BusinessType;
  confidence: number;  // 0-100
  signals: DetectedSignal[];
  suggestedType?: BusinessType;
  warning?: string;
}

const mismatchSignals: MismatchSignal[] = [
  // Ecommerce signals
  {
    id: 'has-transactions',
    description: 'Account has transaction/revenue data',
    expectedFor: ['ecommerce'],
    notExpectedFor: ['lead-gen', 'saas'],
    weight: 0.8,
  },
  {
    id: 'has-shopping-campaigns',
    description: 'Account has Shopping campaigns',
    expectedFor: ['ecommerce'],
    notExpectedFor: ['lead-gen', 'saas', 'local'],
    weight: 0.9,
  },
  {
    id: 'product-urls',
    description: 'Site has /product/ or /shop/ URL patterns',
    expectedFor: ['ecommerce'],
    notExpectedFor: ['lead-gen', 'saas'],
    weight: 0.6,
  },

  // Lead-gen signals
  {
    id: 'form-conversions',
    description: 'Conversions are form submissions, not purchases',
    expectedFor: ['lead-gen', 'saas'],
    notExpectedFor: ['ecommerce'],
    weight: 0.7,
  },
  {
    id: 'no-revenue-data',
    description: 'No revenue/transaction data in account',
    expectedFor: ['lead-gen', 'saas', 'local'],
    notExpectedFor: ['ecommerce'],
    weight: 0.5,
  },
  {
    id: 'service-urls',
    description: 'Site has /services/ or /solutions/ URL patterns',
    expectedFor: ['lead-gen', 'saas'],
    notExpectedFor: ['ecommerce'],
    weight: 0.5,
  },

  // SaaS signals
  {
    id: 'trial-keywords',
    description: 'Keywords contain "free trial", "demo", "signup"',
    expectedFor: ['saas'],
    notExpectedFor: ['ecommerce', 'local'],
    weight: 0.6,
  },
  {
    id: 'pricing-page',
    description: 'Site has /pricing/ page with tiers',
    expectedFor: ['saas'],
    notExpectedFor: ['local'],
    weight: 0.5,
  },

  // Local signals
  {
    id: 'location-keywords',
    description: 'Keywords contain city/location names',
    expectedFor: ['local'],
    notExpectedFor: ['saas'],
    weight: 0.6,
  },
  {
    id: 'gmb-presence',
    description: 'Has Google Business Profile linked',
    expectedFor: ['local'],
    notExpectedFor: [],
    weight: 0.7,
  },
  {
    id: 'service-area',
    description: 'Site mentions service area or locations served',
    expectedFor: ['local'],
    notExpectedFor: [],
    weight: 0.5,
  },
];

function analyzeMismatch(
  selectedType: BusinessType,
  data: InterplayData,
  pageContent: EnrichedPage[]
): MismatchAnalysis {
  const detectedSignals: DetectedSignal[] = [];

  for (const signal of mismatchSignals) {
    const detected = detectSignal(signal, data, pageContent);
    if (detected) {
      detectedSignals.push({
        ...signal,
        detected: true,
        evidence: detected.evidence,
      });
    }
  }

  // Calculate confidence for selected type
  const supportingSignals = detectedSignals.filter(s =>
    s.expectedFor.includes(selectedType)
  );
  const contradictingSignals = detectedSignals.filter(s =>
    s.notExpectedFor.includes(selectedType)
  );

  const supportScore = supportingSignals.reduce((sum, s) => sum + s.weight, 0);
  const contradictScore = contradictingSignals.reduce((sum, s) => sum + s.weight, 0);

  const confidence = Math.max(0, Math.min(100,
    50 + (supportScore - contradictScore) * 25
  ));

  // Suggest alternative if confidence is low
  let suggestedType: BusinessType | undefined;
  let warning: string | undefined;

  if (confidence < 40) {
    suggestedType = inferBestType(detectedSignals);
    warning = `Low confidence (${confidence}%) that this is a ${selectedType} business. ` +
      `Detected signals suggest this may be ${suggestedType}. ` +
      `Consider updating the business type in client settings.`;
  } else if (confidence < 60) {
    warning = `Moderate confidence (${confidence}%) in business type classification. ` +
      `Some signals don't match typical ${selectedType} patterns.`;
  }

  return {
    selectedType,
    confidence,
    signals: detectedSignals,
    suggestedType,
    warning,
  };
}
```

### Performance Considerations

Full mismatch analysis on every report is expensive. Use a tiered approach:

**Lightweight check (every report):**
```typescript
// Only check critical contradictions - fast, no page fetching
function quickMismatchCheck(
  selectedType: BusinessType,
  data: InterplayData
): { hasCriticalMismatch: boolean; signal?: string } {
  // Ecommerce client with no transactions/revenue
  if (selectedType === 'ecommerce' && !data.hasTransactionData) {
    return { hasCriticalMismatch: true, signal: 'no-transactions' };
  }

  // Lead-gen client with shopping campaigns
  if (selectedType === 'lead-gen' && data.hasShoppingCampaigns) {
    return { hasCriticalMismatch: true, signal: 'has-shopping' };
  }

  return { hasCriticalMismatch: false };
}
```

**Full analysis (cached per client):**
```typescript
// Run weekly or when account data changes significantly
// Cache result in client_accounts table
interface ClientAccount {
  // ... existing fields
  mismatchAnalysisCache?: {
    confidence: number;
    suggestedType?: BusinessType;
    analyzedAt: string;
  };
}
```

### Integration Points

1. **During report generation (lightweight):**
   ```typescript
   const quickCheck = quickMismatchCheck(client.businessType, interplayData);

   if (quickCheck.hasCriticalMismatch) {
     logger.warn({ signal: quickCheck.signal }, 'Critical business type mismatch');
     reportMetadata.warnings.push({
       type: 'business-type-mismatch',
       message: `This client may be miscategorised. Detected: ${quickCheck.signal}`,
     });
   }
   ```

2. **In report UI:**
   ```typescript
   {report.metadata.warnings?.some(w => w.type === 'business-type-mismatch') && (
     <Alert variant="warning">
       <AlertTitle>Business Type Review Suggested</AlertTitle>
       <AlertDescription>
         {report.metadata.warnings.find(w => w.type === 'business-type-mismatch').message}
         <Button onClick={() => openClientSettings()}>Review Settings</Button>
       </AlertDescription>
     </Alert>
   )}
   ```

3. **Full analysis (background job, weekly):**
   - Run full `analyzeMismatch()` for all clients
   - Update cache in database
   - Surface in client settings if confidence < 60%

---

## Business Type Changes

### What Happens When a Client's Business Type Changes?

A startup might be lead-gen initially, then launch a product and become ecommerce. Historical reports were generated with lead-gen skills.

**v1 approach: Accept it, don't retroactively update.**

```typescript
// When business type changes:
// 1. Update client_accounts.business_type
// 2. Future reports use new skills
// 3. Historical reports retain their original skill metadata
// 4. No retroactive regeneration

// Report metadata shows what skill was used
{
  "reportId": "abc123",
  "generatedAt": "2025-01-15",
  "skillBundle": {
    "businessType": "lead-gen",  // What it was at generation time
    "version": "1.0.0"
  }
}
```

**Why this is fine:**
- Reports are point-in-time snapshots
- The recommendations were valid for the business type at that time
- Users can regenerate specific reports if needed
- Simpler than version migration

**UI consideration:** When viewing historical reports after a type change, show a subtle indicator:
```
"This report was generated when [Client] was categorised as Lead Generation"
```

---

## Versioning (Simplified for v1)

For v1, keep versioning minimal:

```typescript
// Store in report metadata for debugging only
interface ReportMetadata {
  skillBundle: {
    businessType: BusinessType;
    version: string;  // e.g., "1.0.0"
  };
  generatedAt: string;
}
```

**v1 approach:**
- All clients use latest skill version
- Version stored in report metadata for debugging
- No pinning, no rollback UI

**Future (if needed for enterprise):**
- Version pinning per client
- Rollback support
- Changelog tracking

---

## Implementation Priority

Front-load all scaffolding so the skill system is fully functional with placeholder skills. Actual skill content comes last.

### Phase 1: Type Definitions & Interfaces

**Goal:** Define all the shapes so everything compiles.

1. `apps/api/src/services/interplay-report/skills/types.ts`
   - `BusinessType` enum
   - `AgentSkillBundle` interface
   - `ScoutSkillDefinition` interface
   - `ResearcherSkillDefinition` interface
   - `SEMSkillDefinition` interface
   - `SEOSkillDefinition` interface
   - `DirectorSkillDefinition` interface
   - All supporting types (`KPIDefinition`, `ThresholdSet`, `ContentSignal`, etc.)

### Phase 2: Skill Loader & Registry

**Goal:** Ability to load skills by business type with fallbacks.

2. `apps/api/src/services/interplay-report/skills/index.ts`
   - `loadSkillBundle(businessType)` function
   - `getAvailableBusinessTypes()` function
   - `getImplementedBusinessTypes()` function
   - Individual skill loaders (`loadScoutSkill`, `loadSEMSkill`, etc.)
   - Fallback logic for unimplemented types

3. Create placeholder skill bundles (minimal valid content):
   - `skills/ecommerce/index.ts` - exports placeholder bundle
   - `skills/lead-gen/index.ts` - exports placeholder bundle
   - `skills/saas/index.ts` - exports `null` (uses fallback)
   - `skills/local/index.ts` - exports `null` (uses fallback)

### Phase 3: Prompt Serialisation Layer

**Goal:** Transform skill definitions into prompt text.

4. `apps/api/src/services/interplay-report/prompts/serialization.ts`
   - `formatKPIs()` function
   - `formatBenchmarks()` function
   - `formatPatterns()` function
   - `formatExamples()` function
   - `formatConstraints()` function
   - `formatSchemaRules()` function
   - `determineSerializationMode()` function
   - Token budget constants and truncation logic

5. Update existing prompt builders to accept skills:
   - `prompts/sem.prompt.ts` - inject skill via serialisation
   - `prompts/seo.prompt.ts` - inject skill via serialisation
   - `prompts/director.prompt.ts` - inject skill via serialisation

### Phase 4: Agent Integration

**Goal:** All agents accept and use their specific skill.

6. Modify `agents/scout.agent.ts`
   - Accept `ScoutSkillDefinition` parameter
   - Use skill thresholds instead of hardcoded values
   - Apply skill priority rules and metric filtering

7. Modify `agents/researcher.agent.ts`
   - Accept `ResearcherSkillDefinition` parameter
   - Use skill content signals for extraction
   - Use skill page classification patterns

8. Modify `agents/sem.agent.ts`
   - Accept skill via context
   - Pass to prompt builder

9. Modify `agents/seo.agent.ts`
   - Accept skill via context
   - Pass to prompt builder

10. Modify `agents/director.agent.ts`
    - Accept skill via context
    - Pass to prompt builder

### Phase 5: Orchestrator Integration

**Goal:** Pipeline loads and distributes skills.

11. Modify `orchestrator.ts`
    - Load skill bundle at pipeline start
    - Pass individual skills to each agent
    - Add skill version to report metadata

### Phase 6: Constraint Enforcement

**Goal:** Director validates and filters upstream output.

12. Create `utils/constraint-validation.ts`
    - `NormalizedAction` interface
    - `normalizeSEMAction()` function
    - `normalizeSEOAction()` function
    - `buildExclusionRules()` function
    - `validateUpstreamConstraints()` function

13. Integrate into Director agent
    - Validate before synthesis
    - Log violations
    - Filter excluded actions

### Phase 7: Database & API

**Goal:** Persist business type per client.

14. Database migration
    - Add `business_type` enum type
    - Add `business_type` column to `client_accounts`
    - Default to 'ecommerce'

15. Update `apps/api/src/db/schema.ts`
    - Add `businessTypeEnum`
    - Add column to `clientAccounts`

16. Update `apps/api/src/routes/clients.routes.ts`
    - Accept `businessType` in create/update
    - Return `businessType` in responses

17. Update `packages/shared/src/types/`
    - Export `BusinessType` type

### Phase 8: Frontend Integration

**Goal:** Users can select business type.

18. Update onboarding flow
    - Add business type selection step
    - Store selection with client

19. Update client settings
    - Allow changing business type
    - Show current type

### Phase 9: Instrumentation

**Goal:** Measure skill effectiveness.

20. Create `report_metrics` table
21. Add metrics logging to orchestrator
22. Add `analyzeOutputForViolations()` function
23. Create baseline analysis queries

### Phase 10: Skill Content (LAST)

**Goal:** Write the actual domain expertise.

24. **Ecommerce skills** (all 5 agents)
    - `skills/ecommerce/scout.skill.ts`
    - `skills/ecommerce/researcher.skill.ts`
    - `skills/ecommerce/sem.skill.ts`
    - `skills/ecommerce/seo.skill.ts`
    - `skills/ecommerce/director.skill.ts`

25. **Lead-gen skills** (all 5 agents)
    - `skills/lead-gen/scout.skill.ts`
    - `skills/lead-gen/researcher.skill.ts`
    - `skills/lead-gen/sem.skill.ts`
    - `skills/lead-gen/seo.skill.ts`
    - `skills/lead-gen/director.skill.ts`

26. **SaaS skills** (extend from lead-gen)
    - `skills/saas/scout.skill.ts`
    - `skills/saas/researcher.skill.ts`
    - `skills/saas/sem.skill.ts`
    - `skills/saas/seo.skill.ts`
    - `skills/saas/director.skill.ts`

27. **Local skills** (all 5 agents)
    - `skills/local/scout.skill.ts`
    - `skills/local/researcher.skill.ts`
    - `skills/local/sem.skill.ts`
    - `skills/local/seo.skill.ts`
    - `skills/local/director.skill.ts`

---

## Placeholder Skill Structure

Until real skills are written, use minimal placeholders that satisfy the type system:

```typescript
// apps/api/src/services/interplay-report/skills/ecommerce/index.ts

import { AgentSkillBundle } from '../types';
import { createPlaceholderScoutSkill } from '../placeholders/scout.placeholder';
import { createPlaceholderResearcherSkill } from '../placeholders/researcher.placeholder';
import { createPlaceholderSEMSkill } from '../placeholders/sem.placeholder';
import { createPlaceholderSEOSkill } from '../placeholders/seo.placeholder';
import { createPlaceholderDirectorSkill } from '../placeholders/director.placeholder';

export const ecommerceSkillBundle: AgentSkillBundle = {
  businessType: 'ecommerce',
  version: '0.1.0-placeholder',

  scout: createPlaceholderScoutSkill('ecommerce'),
  researcher: createPlaceholderResearcherSkill('ecommerce'),
  sem: createPlaceholderSEMSkill('ecommerce'),
  seo: createPlaceholderSEOSkill('ecommerce'),
  director: createPlaceholderDirectorSkill('ecommerce'),
};
```

```typescript
// apps/api/src/services/interplay-report/skills/placeholders/sem.placeholder.ts

import { SEMSkillDefinition, BusinessType } from '../types';

export function createPlaceholderSEMSkill(businessType: BusinessType): SEMSkillDefinition {
  return {
    version: '0.1.0-placeholder',

    context: {
      businessModel: `This is a ${businessType} business.`,
      conversionDefinition: 'Conversions as tracked in Google Ads.',
      typicalCustomerJourney: 'Standard search → click → convert journey.',
    },

    kpis: {
      primary: [
        {
          metric: 'conversions',
          importance: 'critical',
          description: 'Total conversions',
          targetDirection: 'higher',
          businessContext: 'Primary goal metric',
        },
      ],
      secondary: [],
      irrelevant: [],
    },

    benchmarks: {
      ctr: { excellent: 0.05, good: 0.03, average: 0.02, poor: 0.01 },
      conversionRate: { excellent: 0.05, good: 0.03, average: 0.02, poor: 0.01 },
      cpc: { excellent: 1, good: 2, average: 3, poor: 5 },
    },

    analysis: {
      keyPatterns: [],
      antiPatterns: [],
      opportunities: [],
    },

    prompt: {
      roleContext: `You are analyzing a ${businessType} Google Ads account.`,
      analysisInstructions: 'Analyze the keyword data and provide recommendations.',
      outputGuidance: 'Focus on actionable improvements.',
      examples: [],
      constraints: [],
    },

    output: {
      recommendationTypes: {
        prioritize: [],
        deprioritize: [],
        exclude: [],
      },
      maxRecommendations: 8,
      requireQuantifiedImpact: false,
    },
  };
}
```

This allows the entire system to be built and tested before investing time in writing detailed skill content.

---

## Appendix: Skill File Templates

See individual skill examples above for complete templates. Each business type needs:

1. **scout.skill.ts** - Thresholds, priority rules, metrics
2. **researcher.skill.ts** - Enrichment config, content signals, page classification
3. **sem.skill.ts** - KPIs, benchmarks, prompt, constraints
4. **seo.skill.ts** - Schema rules, KPIs, prompt, constraints
5. **director.skill.ts** - Synthesis rules, filtering, executive framing
6. **index.ts** - Bundle assembly
