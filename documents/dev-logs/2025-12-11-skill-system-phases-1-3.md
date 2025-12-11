# Skill System Implementation - Phases 1-3

**Date**: 2025-12-11
**Branch**: `main`
**Status**: Complete
**Commits**: `c901860`, `18b5749`, `ce71cde`

## Overview

Implemented the foundation of a business-type-aware skill system for the multi-agent interplay report pipeline. This system allows agents to customize their behavior, thresholds, benchmarks, and prompts based on the client's business type (ecommerce, lead-gen, saas, local).

## Motivation

Different business types have fundamentally different KPIs and success metrics:
- **E-commerce**: ROAS, revenue, AOV, conversion value
- **Lead-gen**: CPL, lead quality, form submissions
- **SaaS**: Trial signups, MRR impact, CAC
- **Local**: Phone calls, directions, foot traffic proxies

A one-size-fits-all prompt leads to irrelevant recommendations. The skill system injects business-type-specific context directly into agent prompts.

## Architecture

```
skills/
├── index.ts                    # Skill loader & registry
├── types.ts                    # All type definitions
│
├── placeholders/
│   ├── index.ts                # Re-export all placeholders
│   ├── scout.placeholder.ts
│   ├── researcher.placeholder.ts
│   ├── sem.placeholder.ts
│   ├── seo.placeholder.ts
│   └── director.placeholder.ts
│
├── ecommerce/
│   └── index.ts                # Bundle export (uses placeholders for now)
│
├── lead-gen/
│   └── index.ts                # Bundle export (uses placeholders for now)
│
├── saas/
│   └── index.ts                # exports null (falls back to lead-gen)
│
└── local/
    └── index.ts                # exports null (falls back to ecommerce)
```

## Phase 1: Type Definitions

**Commit**: `c901860`

Created comprehensive TypeScript interfaces for the entire skill system in `skills/types.ts`:

### Core Types
- `BusinessType` - 'ecommerce' | 'lead-gen' | 'saas' | 'local'
- `AgentSkillBundle` - Complete skill bundle containing all five agent definitions
- `KPIDefinition` - Metric with importance, target direction, benchmark
- `ThresholdSet` - Excellent/good/average/poor thresholds for benchmarking

### Agent Skill Definitions
| Agent | Key Configuration |
|-------|-------------------|
| **Scout** | Thresholds (high spend, low ROAS, etc.), priority rules, metric inclusion/exclusion |
| **Researcher** | Competitive metrics to fetch, page content signals, schema extraction rules |
| **SEM** | KPIs, benchmarks, analysis patterns, few-shot examples, output constraints |
| **SEO** | Schema rules, content patterns, technical checks, common issues per business type |
| **Director** | Conflict resolution rules, synergy identification, prioritization weights |

## Phase 2: Skill Loader & Registry

**Commit**: `18b5749`

Implemented the skill loading system in `skills/index.ts`:

### Registry Pattern
```typescript
const skillRegistry: Record<BusinessType, AgentSkillBundle | null> = {
  'ecommerce': ecommerceSkillBundle,
  'lead-gen': leadGenSkillBundle,
  'saas': null,    // Uses fallback
  'local': null,   // Uses fallback
};
```

### Fallback Support
Unimplemented business types fall back to similar implemented types:
- `saas` → `lead-gen` (both lead-based)
- `local` → `ecommerce` (transaction-oriented)

When fallback is used, a warning is logged and included in the result:
```typescript
const result = loadSkillBundle('saas');
// result.usingFallback === true
// result.warning === "Skills for 'saas' are not yet implemented..."
```

### Exported Functions
- `loadSkillBundle(businessType)` - Returns bundle with fallback info
- `getAvailableBusinessTypes()` - Returns implemented types only
- `getAllBusinessTypes()` - Returns all types including unimplemented
- `isBusinessTypeSupported(type)` - Checks if fully implemented
- Individual loaders: `loadScoutSkill()`, `loadResearcherSkill()`, etc.

### Placeholder Bundles
Created placeholder skill definitions that satisfy type requirements with reasonable defaults. These will be replaced with production skills in Phase 10.

## Phase 3: Prompt Serialization Layer

**Commit**: `ce71cde`

Created `prompts/serialization.ts` - the translation layer converting TypeScript skill definitions into prompt text.

### Token Budget Management

```typescript
const TOKEN_LIMITS = {
  MAX_PROMPT_TOKENS: 30000,
  MAX_DATA_TOKENS: 15000,
  MAX_SKILL_CONTEXT_TOKENS: 5000,
  MAX_KEYWORDS_FULL: 20,
  MAX_KEYWORDS_COMPACT: 10,
  MAX_PAGES_FULL: 10,
  MAX_PAGES_COMPACT: 5,
};
```

System automatically switches between `full` and `compact` serialization modes based on data volume to stay within context limits.

### Formatting Functions
| Function | Purpose |
|----------|---------|
| `formatKPIs()` / `formatKPIsCompact()` | Convert KPI definitions to markdown |
| `formatBenchmarks()` | Generate markdown benchmark tables |
| `formatPatterns()` | Format analysis patterns with indicators |
| `formatSEMExamples()` / `formatSEOExamples()` | Few-shot examples for prompts |
| `formatSchemaRules()` | SEO schema requirements |
| `formatConflictRules()` | Director conflict resolution |
| `formatSynergyRules()` | Director synergy identification |

### Priority-Based Truncation

When data exceeds token budget, items are prioritized and lower-priority items are dropped:

```typescript
const KEYWORD_PRIORITY_WEIGHTS = {
  'high_spend_low_roas': 100,
  'cannibalization_risk': 90,
  'growth_potential': 70,
  'competitive_pressure': 60,
};
```

`prioritizeAndTruncate()` sorts by score and keeps the top N items.

### Updated Prompt Builders

Each prompt file now exports two functions:
- `buildSEMPrompt()` - Legacy, backward-compatible
- `buildSEMPromptWithSkill()` - New skill-based builder

The skill-based builders:
1. Determine serialization mode based on data volume
2. Truncate data if needed, keeping highest priority items
3. Format skill definitions into prompt sections
4. Add truncation notice if data was dropped
5. Validate final prompt size before returning

### Example Skill-Based Prompt Structure

```
{skill.prompt.roleContext}

## Business Context
{skill.context.businessModel}
Conversion Definition: {skill.context.conversionDefinition}
Customer Journey: {skill.context.typicalCustomerJourney}

## Key Performance Indicators
### Primary KPIs (Focus Here)
{formatted primary KPIs}

### Metrics to IGNORE (Not Applicable)
{formatted irrelevant metrics}

## Benchmarks for This Business Type
{formatted benchmark table}

## Analysis Guidance
{skill.prompt.analysisInstructions}

## Patterns to Look For
{formatted key patterns}

## Anti-Patterns (Problems to Flag)
{formatted anti-patterns}

## Data to Analyze
{JSON data}

## Output Requirements
{skill.prompt.outputGuidance}

## Examples
{formatted few-shot examples}

## CRITICAL CONSTRAINTS
{formatted constraints}
```

## Files Summary

### Created
| File | Lines | Purpose |
|------|-------|---------|
| `skills/types.ts` | ~400 | All skill type definitions |
| `skills/index.ts` | ~160 | Skill loader & registry |
| `skills/placeholders/*.ts` | ~200 | Placeholder skill factories |
| `skills/ecommerce/index.ts` | ~20 | E-commerce bundle export |
| `skills/lead-gen/index.ts` | ~20 | Lead-gen bundle export |
| `skills/saas/index.ts` | ~3 | Null export (fallback) |
| `skills/local/index.ts` | ~3 | Null export (fallback) |
| `prompts/serialization.ts` | ~450 | Prompt serialization utilities |

### Modified
| File | Changes |
|------|---------|
| `prompts/sem.prompt.ts` | Added `buildSEMPromptWithSkill()` |
| `prompts/seo.prompt.ts` | Added `buildSEOPromptWithSkill()` |
| `prompts/director.prompt.ts` | Added `buildDirectorPromptWithSkill()` |
| `prompts/index.ts` | Export new functions and types |

## Usage Example

```typescript
import { loadSkillBundle } from './skills';
import { buildSEMPromptWithSkill } from './prompts';

// Load skills for business type
const { bundle, usingFallback, warning } = loadSkillBundle('ecommerce');

if (warning) {
  logger.warn(warning);
}

// Build prompt with skill context
const prompt = buildSEMPromptWithSkill(enrichedKeywords, {
  skill: bundle.sem,
  industry: 'Fashion Retail',
  targetMarket: 'Australia',
});
```

## Testing

All phases pass TypeScript type checking:
```bash
npm run type-check  # ✓ All workspaces pass
```

## Next Steps

- **Phase 4-9**: Wire skills into agent execution pipeline
- **Phase 10**: Implement production e-commerce and lead-gen skills with real benchmarks, patterns, and examples
- **Phase 11+**: Add saas and local business type skills
