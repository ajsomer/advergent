# Phase 2: Skill Loader & Registry

## Goal

Implement the skill loading system that can retrieve the appropriate skill bundle for any business type, with fallback support for unimplemented types.

## Files to Create

### 1. `apps/api/src/services/interplay-report/skills/index.ts`

Main skill loader and registry.

```typescript
import { AgentSkillBundle, BusinessType } from './types';
import { logger } from '@/utils/logger';

// Import implemented skill bundles
import { ecommerceSkillBundle } from './ecommerce';
import { leadGenSkillBundle } from './lead-gen';

const skillRegistry: Record<BusinessType, AgentSkillBundle | null> = {
  'ecommerce': ecommerceSkillBundle,
  'lead-gen': leadGenSkillBundle,
  'saas': null,    // Uses fallback
  'local': null,   // Uses fallback
};

// Fallback mappings for unimplemented types
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

### 2. Placeholder Skill Bundles

Create placeholder bundles that satisfy the type system until real skills are written.

**`apps/api/src/services/interplay-report/skills/placeholders/scout.placeholder.ts`**

```typescript
import { ScoutSkillDefinition, BusinessType } from '../types';

export function createPlaceholderScoutSkill(businessType: BusinessType): ScoutSkillDefinition {
  return {
    version: '0.1.0-placeholder',
    thresholds: {
      highSpendThreshold: 100,
      lowRoasThreshold: 2.0,
      cannibalizationPosition: 5,
      highBounceRateThreshold: 70,
      lowCtrThreshold: 2.0,
      minImpressionsForAnalysis: 100,
    },
    priorityRules: {
      battlegroundKeywords: [],
      criticalPages: [],
    },
    metrics: {
      include: ['spend', 'conversions', 'ctr', 'impressions', 'position'],
      exclude: [],
      primary: ['spend', 'conversions'],
    },
    limits: {
      maxBattlegroundKeywords: 20,
      maxCriticalPages: 10,
    },
  };
}
```

**`apps/api/src/services/interplay-report/skills/placeholders/researcher.placeholder.ts`**

```typescript
import { ResearcherSkillDefinition, BusinessType } from '../types';

export function createPlaceholderResearcherSkill(businessType: BusinessType): ResearcherSkillDefinition {
  return {
    version: '0.1.0-placeholder',
    keywordEnrichment: {
      competitiveMetrics: {
        required: ['impressionShare'],
        optional: ['topOfPageRate'],
        irrelevant: [],
      },
      priorityBoosts: [],
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
        lookFor: ['Organization'],
        flagIfPresent: [],
        flagIfMissing: [],
      },
      contentSignals: [],
      pageClassification: {
        patterns: [],
        defaultType: 'landing',
        confidenceThreshold: 0.5,
      },
    },
    dataQuality: {
      minKeywordsWithCompetitiveData: 5,
      minPagesWithContent: 3,
      maxFetchTimeout: 10000,
      maxConcurrentFetches: 3,
    },
  };
}
```

**`apps/api/src/services/interplay-report/skills/placeholders/sem.placeholder.ts`**

```typescript
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

**`apps/api/src/services/interplay-report/skills/placeholders/seo.placeholder.ts`**

```typescript
import { SEOSkillDefinition, BusinessType } from '../types';

export function createPlaceholderSEOSkill(businessType: BusinessType): SEOSkillDefinition {
  return {
    version: '0.1.0-placeholder',
    context: {
      siteType: `${businessType} website`,
      primaryGoal: 'Drive organic traffic and conversions',
      contentStrategy: 'Content aligned with business goals',
    },
    schema: {
      required: [],
      recommended: [],
      invalid: [],
      pageTypeRules: [],
    },
    kpis: {
      primary: [
        {
          metric: 'organicTraffic',
          importance: 'critical',
          description: 'Total organic sessions',
          targetDirection: 'higher',
          businessContext: 'Primary traffic metric',
        },
      ],
      secondary: [],
      irrelevant: [],
    },
    benchmarks: {
      organicCtr: { excellent: 0.05, good: 0.03, average: 0.02, poor: 0.01 },
      bounceRate: { excellent: 0.40, good: 0.50, average: 0.60, poor: 0.75 },
      avgPosition: { excellent: 3, good: 7, average: 15, poor: 25 },
    },
    analysis: {
      contentPatterns: [],
      technicalChecks: [],
      onPageFactors: [],
    },
    prompt: {
      roleContext: `You are analyzing a ${businessType} website for SEO.`,
      analysisInstructions: 'Analyze the page data and provide SEO recommendations.',
      outputGuidance: 'Focus on actionable improvements.',
      examples: [],
      constraints: [],
    },
    commonIssues: {
      critical: [],
      warnings: [],
      falsePositives: [],
    },
    output: {
      recommendationTypes: {
        prioritize: [],
        deprioritize: [],
        exclude: [],
      },
      maxRecommendations: 8,
    },
  };
}
```

**`apps/api/src/services/interplay-report/skills/placeholders/director.placeholder.ts`**

```typescript
import { DirectorSkillDefinition, BusinessType } from '../types';

export function createPlaceholderDirectorSkill(businessType: BusinessType): DirectorSkillDefinition {
  return {
    version: '0.1.0-placeholder',
    context: {
      businessPriorities: ['Improve performance'],
      successMetrics: ['conversions', 'traffic'],
      executiveFraming: `Focus on key metrics for ${businessType} businesses.`,
    },
    synthesis: {
      conflictResolution: [],
      synergyIdentification: [],
      prioritization: [],
    },
    filtering: {
      maxRecommendations: 10,
      minImpactThreshold: 'medium',
      impactWeights: {
        revenue: 0.3,
        cost: 0.3,
        effort: 0.2,
        risk: 0.2,
      },
      mustInclude: [],
      mustExclude: [],
    },
    executiveSummary: {
      focusAreas: ['Overall performance'],
      metricsToQuantify: ['conversions'],
      framingGuidance: 'Focus on actionable insights.',
      maxHighlights: 5,
    },
    prompt: {
      roleContext: `You are synthesizing recommendations for a ${businessType} client.`,
      synthesisInstructions: 'Combine SEM and SEO recommendations into a unified view.',
      prioritizationGuidance: 'Prioritize by business impact.',
      outputFormat: 'Structured recommendations with impact and effort.',
      constraints: [],
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
}
```

**`apps/api/src/services/interplay-report/skills/placeholders/index.ts`**

```typescript
export { createPlaceholderScoutSkill } from './scout.placeholder';
export { createPlaceholderResearcherSkill } from './researcher.placeholder';
export { createPlaceholderSEMSkill } from './sem.placeholder';
export { createPlaceholderSEOSkill } from './seo.placeholder';
export { createPlaceholderDirectorSkill } from './director.placeholder';
```

### 3. Business Type Skill Bundle Exports

**`apps/api/src/services/interplay-report/skills/ecommerce/index.ts`**

```typescript
import { AgentSkillBundle } from '../types';
import {
  createPlaceholderScoutSkill,
  createPlaceholderResearcherSkill,
  createPlaceholderSEMSkill,
  createPlaceholderSEOSkill,
  createPlaceholderDirectorSkill,
} from '../placeholders';

// Using placeholders until real skills are implemented in Phase 10
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

**`apps/api/src/services/interplay-report/skills/lead-gen/index.ts`**

```typescript
import { AgentSkillBundle } from '../types';
import {
  createPlaceholderScoutSkill,
  createPlaceholderResearcherSkill,
  createPlaceholderSEMSkill,
  createPlaceholderSEOSkill,
  createPlaceholderDirectorSkill,
} from '../placeholders';

// Using placeholders until real skills are implemented in Phase 10
export const leadGenSkillBundle: AgentSkillBundle = {
  businessType: 'lead-gen',
  version: '0.1.0-placeholder',

  scout: createPlaceholderScoutSkill('lead-gen'),
  researcher: createPlaceholderResearcherSkill('lead-gen'),
  sem: createPlaceholderSEMSkill('lead-gen'),
  seo: createPlaceholderSEOSkill('lead-gen'),
  director: createPlaceholderDirectorSkill('lead-gen'),
};
```

**`apps/api/src/services/interplay-report/skills/saas/index.ts`**

```typescript
// SaaS skills not yet implemented - uses lead-gen fallback
// Will be implemented in Phase 10
export const saasSkillBundle = null;
```

**`apps/api/src/services/interplay-report/skills/local/index.ts`**

```typescript
// Local business skills not yet implemented - uses ecommerce fallback
// Will be implemented in Phase 10
export const localSkillBundle = null;
```

## Directory Structure After Phase 2

```
apps/api/src/services/interplay-report/skills/
├── index.ts                           # Skill loader & registry
├── types.ts                           # All type definitions (from Phase 1)
│
├── placeholders/
│   ├── index.ts                       # Re-export all placeholders
│   ├── scout.placeholder.ts
│   ├── researcher.placeholder.ts
│   ├── sem.placeholder.ts
│   ├── seo.placeholder.ts
│   └── director.placeholder.ts
│
├── ecommerce/
│   └── index.ts                       # Bundle export (uses placeholders)
│
├── lead-gen/
│   └── index.ts                       # Bundle export (uses placeholders)
│
├── saas/
│   └── index.ts                       # exports null (uses fallback)
│
└── local/
    └── index.ts                       # exports null (uses fallback)
```

## Dependencies

- Phase 1 (Type Definitions)

## Validation Criteria

- [ ] `loadSkillBundle('ecommerce')` returns a valid bundle
- [ ] `loadSkillBundle('lead-gen')` returns a valid bundle
- [ ] `loadSkillBundle('saas')` returns lead-gen bundle with `usingFallback: true`
- [ ] `loadSkillBundle('local')` returns ecommerce bundle with `usingFallback: true`
- [ ] `getAvailableBusinessTypes()` returns `['ecommerce', 'lead-gen']`
- [ ] Individual skill loaders work correctly
- [ ] Warning is logged when using fallback

## Estimated Effort

Small - straightforward loader logic with placeholder data structures.
