# Skill System Implementation - Phase 4: Agent Integration

**Date**: 2025-12-11
**Branch**: `main`
**Status**: Complete
**Previous**: `2025-12-11-skill-system-phases-1-3.md`

## Overview

Implemented Phase 4 of the skill system: modifying all five agents (Scout, Researcher, SEM, SEO, Director) to accept and use their specific skill definitions. Each agent now has both a legacy function (for backward compatibility) and a skill-based function that uses business-type-aware configuration.

## Motivation

Phases 1-3 established the skill type definitions, loader/registry, and prompt serialization layer. Phase 4 wires these components into the actual agent execution pipeline, enabling the system to generate business-type-aware recommendations.

## Changes Summary

### 1. Scout Agent (`scout.agent.ts`)

**New Exports:**
- `ScoutInput` - Input type with optional skill
- `ScoutOutput` - Extended output with metrics and skill version
- `runScoutWithSkill()` - Skill-based execution function

**Key Features:**
- Uses skill thresholds instead of hardcoded values
- Evaluates priority rules from skill configuration
- Maps skill `PriorityLevel` to `BattlegroundPriority`
- Applies skill limits for max keywords/pages
- Tracks thresholds applied in output metrics

**Example threshold usage:**
```typescript
const thresholds = skill?.thresholds ?? {
  highSpendThreshold: DEFAULT_THRESHOLDS.highSpend,
  lowRoasThreshold: DEFAULT_THRESHOLDS.lowRoas,
  cannibalizationPosition: DEFAULT_THRESHOLDS.cannibalizationPosition,
  // ...
};
```

**Rule evaluation:**
```typescript
function evaluateRuleCondition(ruleId: string, data): boolean {
  switch (ruleId) {
    case 'brand-cannibalization':
      return organicPosition <= thresholds.cannibalizationPosition &&
             spend > thresholds.highSpendThreshold * 0.5;
    // ... other rules
  }
}
```

### 2. Researcher Agent (`researcher.agent.ts`)

**New Exports:**
- `ResearcherInput` - Input with optional skill
- `ResearcherOutput` - Extended output with quality metrics
- `ExtendedPageContent` - Content with schema, signals, page type
- `ExtendedEnrichedPage` - Page with extended content
- `runResearcherWithSkill()` - Skill-based execution function

**Key Features:**
- Priority boosts for keywords based on skill configuration
- Skill-based page content extraction (schema, signals, classification)
- Configurable fetch timeout and concurrency from skill
- Schema extraction with flagIfPresent/flagIfMissing validation
- Content signal detection via CSS selectors
- URL-based page type classification

**Priority boost calculation:**
```typescript
function calculatePriorityBoost(keyword, metrics, boosts: PriorityBoost[]): number {
  for (const boost of boosts) {
    const metricValue = getMetricValue(keyword, metrics, boost.metric);
    if (evaluateBoostCondition(metricValue, boost.condition)) {
      totalBoost += boost.boost;
    }
  }
  return totalBoost;
}
```

**Schema extraction:**
```typescript
function extractSchema(doc, schemaConfig) {
  // Parse JSON-LD scripts
  // Flag missing required schemas
  // Flag inappropriate schemas
  return { detectedSchema, schemaErrors };
}
```

### 3. SEM Agent (`sem.agent.ts`)

**New Exports:**
- `SEMAgentInput` - Input with skill and client context
- `SEMAgentOutputWithMeta` - Output with skill version
- `runSEMAgentWithSkill()` - Skill-based execution function

**Key Features:**
- Uses `buildSEMPromptWithSkill()` for prompt generation
- Applies output filtering from skill configuration
- Prioritizes/deprioritizes recommendation types
- Excludes unwanted recommendation types
- Limits to max recommendations from skill

**Filtering logic:**
```typescript
function filterSEMRecommendations(actions, outputConfig) {
  // 1. Exclude recommendations matching exclude types
  // 2. Sort to prioritize certain types
  // 3. Move deprioritized types to end
  // 4. Limit to maxRecommendations
}
```

### 4. SEO Agent (`seo.agent.ts`)

**New Exports:**
- `SEOAgentInput` - Input with skill and client context
- `SEOAgentOutputWithMeta` - Output with skill version
- `runSEOAgentWithSkill()` - Skill-based execution function

**Key Features:**
- Uses `buildSEOPromptWithSkill()` for prompt generation
- Applies output filtering from skill configuration
- Same prioritize/deprioritize/exclude pattern as SEM
- Limits to max recommendations from skill

### 5. Director Agent (`director.agent.ts`)

**New Exports:**
- `DirectorAgentInput` - Input with SEM/SEO outputs, skill, context
- `DirectorOutputWithMeta` - Output with skill version
- `runDirectorAgentWithSkill()` - Skill-based execution function

**Key Features:**
- Uses `buildDirectorPromptWithSkill()` for prompt generation
- Applies skill-based filtering with weighted scoring
- Handles mustInclude/mustExclude patterns
- Filters by minimum impact threshold
- Uses impact weights for recommendation scoring

**Weighted scoring:**
```typescript
function calculateWeightedScore(rec, weights) {
  const impactScore = { high: 3, medium: 2, low: 1 }[rec.impact];
  const effortScore = { low: 3, medium: 2, high: 1 }[rec.effort]; // Inverted
  return impactScore * weights.revenue + effortScore * weights.effort;
}
```

### 6. Agent Index (`agents/index.ts`)

Updated to export all new functions and types:
```typescript
// Scout
export { runScout, runScoutWithSkill, type ScoutInput, type ScoutOutput };

// Researcher
export { runResearcher, runResearcherWithSkill, type ResearcherInput, ... };

// SEM
export { runSEMAgent, runSEMAgentWithSkill, type SEMAgentInput, ... };

// SEO
export { runSEOAgent, runSEOAgentWithSkill, type SEOAgentInput, ... };

// Director
export { runDirectorAgent, runDirectorAgentWithSkill, type DirectorAgentInput, ... };
```

### 7. Orchestrator (`orchestrator.ts`)

**New Exports:**
- `GenerateReportOptionsWithSkill` - Options with optional `businessType`

**Key Changes:**
- `generateInterplayReport()` now routes based on `businessType` presence
- Added `generateInterplayReportWithSkill()` for skill-based pipeline
- Added `generateInterplayReportLegacy()` for backward compatibility
- Loads skill bundle at start of skill-based generation
- Logs skill version and fallback warnings

**Routing logic:**
```typescript
export async function generateInterplayReport(
  clientAccountId: string,
  options: GenerateReportOptionsWithSkill
): Promise<string> {
  if (options.businessType) {
    return generateInterplayReportWithSkill(...);
  }
  return generateInterplayReportLegacy(...);
}
```

**Skill-based pipeline:**
```typescript
async function generateInterplayReportWithSkill(...) {
  const skillResult = loadSkillBundle(businessType);

  // Scout with skill
  const scoutOutput = runScoutWithSkill({ data, skill: skillBundle.scout });

  // Researcher with skill
  const researcherOutput = await runResearcherWithSkill({
    clientAccountId, scoutFindings, dateRange, skill: skillBundle.researcher
  });

  // SEM + SEO with skills (parallel)
  const [semOutput, seoOutput] = await Promise.all([
    runSEMAgentWithSkill({ enrichedKeywords, skill: skillBundle.sem, clientContext }),
    runSEOAgentWithSkill({ enrichedPages, skill: skillBundle.seo, clientContext }),
  ]);

  // Director with skill
  const directorOutput = await runDirectorAgentWithSkill({
    semOutput, seoOutput, skill: skillBundle.director, clientContext
  });
}
```

## API Usage

### Legacy Mode (backward compatible)
```typescript
await generateInterplayReport(clientAccountId, {
  trigger: 'manual',
  days: 30,
});
```

### Skill-Based Mode
```typescript
await generateInterplayReport(clientAccountId, {
  trigger: 'manual',
  days: 30,
  businessType: 'ecommerce',  // Activates skill-based pipeline
});
```

## Files Modified

| File | Changes |
|------|---------|
| `agents/scout.agent.ts` | +320 lines: Added skill-based functions and types |
| `agents/researcher.agent.ts` | +350 lines: Added skill-based extraction and enrichment |
| `agents/sem.agent.ts` | +100 lines: Added skill-based prompt and filtering |
| `agents/seo.agent.ts` | +100 lines: Added skill-based prompt and filtering |
| `agents/director.agent.ts` | +120 lines: Added skill-based synthesis and filtering |
| `agents/index.ts` | Rewrote to export all new functions and types |
| `orchestrator.ts` | +150 lines: Added skill-based pipeline and routing |

## Validation Criteria Met

- [x] Scout agent uses skill thresholds correctly
- [x] Scout agent applies priority rules from skill
- [x] Researcher agent uses content signals from skill
- [x] Researcher agent classifies pages using skill patterns
- [x] SEM agent passes skill to prompt builder
- [x] SEO agent passes skill to prompt builder
- [x] Director agent applies filtering from skill
- [x] All agents include skill version in output
- [x] Orchestrator routes based on businessType presence
- [x] All TypeScript type checks pass

## Testing

```bash
npm run type-check  # All workspaces pass
```

## Backward Compatibility

All existing code continues to work without modification:
- Legacy agent functions remain unchanged
- Orchestrator defaults to legacy pipeline when `businessType` is not provided
- No database schema changes required
- Existing API endpoints unaffected

## Next Steps

- **Phase 5**: Add API endpoint parameter for `businessType`
- **Phase 6**: Add client_accounts column for default business type
- **Phase 7-9**: UI integration for business type selection
- **Phase 10**: Implement production e-commerce and lead-gen skills with real benchmarks
