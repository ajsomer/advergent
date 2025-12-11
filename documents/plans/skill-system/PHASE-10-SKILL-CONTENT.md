# Phase 10: Skill Content

## Goal

Write the actual domain expertise content for each business type's skill files. This is the final phase where placeholder skills are replaced with real, well-researched content.

## Overview

Each business type requires 5 skill files:
1. **scout.skill.ts** - Thresholds, priority rules, metrics
2. **researcher.skill.ts** - Enrichment config, content signals, page classification
3. **sem.skill.ts** - KPIs, benchmarks, prompt guidance, constraints
4. **seo.skill.ts** - Schema rules, KPIs, prompt guidance, constraints
5. **director.skill.ts** - Synthesis rules, filtering, executive framing

**Total: 20 skill files across 4 business types**

## Implementation Order

### 10.1 Ecommerce Skills (First Priority)

Most common business type, well-understood patterns.

**Files to create:**
- `apps/api/src/services/interplay-report/skills/ecommerce/scout.skill.ts`
- `apps/api/src/services/interplay-report/skills/ecommerce/researcher.skill.ts`
- `apps/api/src/services/interplay-report/skills/ecommerce/sem.skill.ts`
- `apps/api/src/services/interplay-report/skills/ecommerce/seo.skill.ts`
- `apps/api/src/services/interplay-report/skills/ecommerce/director.skill.ts`

**Key characteristics:**
- ROAS is the primary metric
- Product schema is required
- Shopping campaigns are relevant
- Revenue and AOV matter
- High transaction volumes expected

### 10.2 Lead-Gen Skills (Second Priority)

Critical differentiation - must NOT recommend ecommerce patterns.

**Files to create:**
- `apps/api/src/services/interplay-report/skills/lead-gen/scout.skill.ts`
- `apps/api/src/services/interplay-report/skills/lead-gen/researcher.skill.ts`
- `apps/api/src/services/interplay-report/skills/lead-gen/sem.skill.ts`
- `apps/api/src/services/interplay-report/skills/lead-gen/seo.skill.ts`
- `apps/api/src/services/interplay-report/skills/lead-gen/director.skill.ts`

**Key characteristics:**
- Cost Per Lead (CPL) is the primary metric
- ROAS is NOT applicable (must be excluded)
- Product schema is INVALID (must flag as error)
- Service/Organization schema is appropriate
- Form submissions are the conversion goal
- Trust signals are critical

### 10.3 SaaS Skills (Third Priority)

Extends lead-gen with SaaS-specific patterns.

**Files to create:**
- `apps/api/src/services/interplay-report/skills/saas/scout.skill.ts`
- `apps/api/src/services/interplay-report/skills/saas/researcher.skill.ts`
- `apps/api/src/services/interplay-report/skills/saas/sem.skill.ts`
- `apps/api/src/services/interplay-report/skills/saas/seo.skill.ts`
- `apps/api/src/services/interplay-report/skills/saas/director.skill.ts`

**Key characteristics:**
- Trial signups and demo requests are primary conversions
- Pricing page optimization is important
- Competitor comparison keywords are high value
- Feature pages need strong SEO
- Retention metrics may be relevant (expansion)

### 10.4 Local Business Skills (Fourth Priority)

Unique patterns for physical location businesses.

**Files to create:**
- `apps/api/src/services/interplay-report/skills/local/scout.skill.ts`
- `apps/api/src/services/interplay-report/skills/local/researcher.skill.ts`
- `apps/api/src/services/interplay-report/skills/local/sem.skill.ts`
- `apps/api/src/services/interplay-report/skills/local/seo.skill.ts`
- `apps/api/src/services/interplay-report/skills/local/director.skill.ts`

**Key characteristics:**
- LocalBusiness schema is required
- Location-based keywords are primary
- Google Business Profile integration matters
- Phone calls may be primary conversion
- NAP consistency is critical for SEO
- Service area pages need optimization

## Skill Content Guidelines

### Scout Skill Content

```typescript
// Key areas to define:
{
  thresholds: {
    // Business-specific values based on industry benchmarks
    highSpendThreshold: number,     // What's "high spend" for this business type?
    lowRoasThreshold: number,       // When is ROAS concerning? (or N/A)
    cannibalizationPosition: number, // How close organic must be to flag
    highBounceRateThreshold: number, // Acceptable bounce varies by page type
    lowCtrThreshold: number,         // CTR expectations differ by business
    minImpressionsForAnalysis: number,
  },

  priorityRules: {
    // Business-specific rules for identifying priority items
    battlegroundKeywords: [
      // e.g., "brand-cannibalization" for all types
      // e.g., "shopping-organic-overlap" only for ecommerce
      // e.g., "demo-intent-keywords" only for saas
    ],
    criticalPages: [
      // e.g., "product-page-issues" for ecommerce
      // e.g., "service-page-issues" for lead-gen
    ],
  },

  metrics: {
    // Which metrics matter for this business type
    include: [...],    // e.g., ['roas', 'revenue'] for ecommerce
    exclude: [...],    // e.g., ['roas', 'revenue'] for lead-gen
    primary: [...],    // Top metrics for sorting
  },
}
```

### Researcher Skill Content

```typescript
// Key areas to define:
{
  schemaExtraction: {
    lookFor: [...],       // Which schema types to detect
    flagIfPresent: [...], // Schema that shouldn't exist (e.g., Product for lead-gen)
    flagIfMissing: [...], // Schema that should exist
  },

  contentSignals: [
    // Business-specific page elements to detect
    // e.g., "add-to-cart" for ecommerce
    // e.g., "lead-form" for lead-gen
    // e.g., "pricing-table" for saas
    // e.g., "location-map" for local
  ],

  pageClassification: {
    patterns: [
      // URL patterns to classify page types
      // Differs significantly by business type
    ],
  },
}
```

### SEM Skill Content

```typescript
// Key areas to define:
{
  context: {
    businessModel: "...",        // Detailed description
    conversionDefinition: "...", // What counts as conversion
    typicalCustomerJourney: "...",
  },

  kpis: {
    primary: [
      // 2-3 most important metrics with full context
      // e.g., ROAS for ecommerce, CPL for lead-gen
    ],
    secondary: [...],
    irrelevant: [...], // Metrics to explicitly ignore
  },

  benchmarks: {
    // Industry-specific benchmark values
    ctr: { excellent: X, good: Y, average: Z, poor: W },
    // etc.
  },

  analysis: {
    keyPatterns: [
      // Positive patterns to identify
      // e.g., "high-intent-keywords" for lead-gen
      // e.g., "shopping-query-efficiency" for ecommerce
    ],
    antiPatterns: [
      // Problems to flag
      // e.g., "informational-high-spend" for lead-gen
    ],
  },

  prompt: {
    roleContext: "...",           // Role definition for Claude
    analysisInstructions: "...",  // Detailed guidance
    outputGuidance: "...",        // How to format output
    examples: [...],              // 2-3 business-specific examples
    constraints: [
      // CRITICAL: What NOT to recommend
      // e.g., "Do NOT recommend ROAS optimization" for lead-gen
    ],
  },

  output: {
    recommendationTypes: {
      prioritize: [...],   // Recommendation types to boost
      deprioritize: [...], // Types to lower
      exclude: [...],      // Types to completely filter out
    },
  },
}
```

### SEO Skill Content

```typescript
// Key areas to define:
{
  schema: {
    required: [
      // Schema types that MUST exist
      // e.g., Product for ecommerce, Organization for lead-gen
    ],
    recommended: [...],
    invalid: [
      // Schema types that should NOT exist
      // e.g., Product for lead-gen (flag as error!)
    ],
    pageTypeRules: [
      // Per-page-type schema requirements
    ],
  },

  prompt: {
    constraints: [
      // CRITICAL: What NOT to recommend
      // e.g., "NEVER recommend Product schema" for lead-gen
    ],
  },

  commonIssues: {
    critical: [
      // Business-specific critical issues
      // e.g., "missing-product-schema" for ecommerce
      // e.g., "product-schema-on-service-page" for lead-gen
    ],
    falsePositives: [
      // Things that look like issues but aren't
      // e.g., "Missing Product schema" is NOT an issue for lead-gen
    ],
  },
}
```

### Director Skill Content

```typescript
// Key areas to define:
{
  context: {
    businessPriorities: [...],  // What matters most
    successMetrics: [...],      // How to measure success
    executiveFraming: "...",    // How to frame for executives
  },

  synthesis: {
    conflictResolution: [
      // Rules for when SEM and SEO conflict
    ],
    synergyIdentification: [
      // Patterns that work well together
    ],
  },

  filtering: {
    mustInclude: [
      // Always include if present
      // e.g., "schema-correction" for lead-gen
    ],
    mustExclude: [
      // CRITICAL: Never include
      // e.g., "metric:roas" for lead-gen
      // e.g., "schema:Product" for lead-gen
    ],
  },

  prompt: {
    constraints: [
      // Final safety net constraints
      // e.g., "NEVER mention ROAS" for lead-gen
    ],
  },
}
```

## Quality Checklist

For each skill file, verify:

- [ ] **Accuracy**: Values based on real industry benchmarks
- [ ] **Completeness**: All required fields populated
- [ ] **Constraints**: Correct exclusions for business type
- [ ] **Examples**: At least 2 realistic examples
- [ ] **Differentiation**: Clearly different from other business types
- [ ] **Consistency**: Aligns with other skills for same business type

## Testing Strategy

### Per-Skill Testing

1. **Unit tests** for threshold logic
2. **Integration tests** with sample data
3. **Constraint validation** - verify exclusions work

### Cross-Business-Type Testing

1. Run same data through ecommerce vs lead-gen skills
2. Verify outputs are appropriately different
3. Verify no constraint leaks (e.g., ROAS in lead-gen output)

### Real-World Validation

1. Generate reports for known business types
2. Review with domain experts
3. Iterate based on feedback

## Dependencies

- Phases 1-9 (All infrastructure must be in place)

## Validation Criteria

- [ ] All 20 skill files created and compiling
- [ ] Each skill has accurate industry benchmarks
- [ ] Lead-gen skills exclude all ROAS/Product references
- [ ] Ecommerce skills include Product schema requirements
- [ ] SaaS skills extend lead-gen appropriately
- [ ] Local skills include LocalBusiness schema requirements
- [ ] Integration tests pass for each business type
- [ ] No constraint violations in test reports

## Estimated Effort

Large - requires significant domain expertise and research. Consider:
- Consulting with SEM/SEO specialists
- Reviewing industry benchmark reports
- Testing with real client data
- Iterating based on output quality

This phase should not be rushed - skill quality directly impacts report quality.
