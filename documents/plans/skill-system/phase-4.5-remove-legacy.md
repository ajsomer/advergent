# Phase 4.5: Remove Legacy Report Generation

## Goal

Remove the legacy (non-skill-based) report generation pipeline and make skill-based generation the only path. This simplifies the codebase and ensures all reports benefit from business-type-aware analysis.

## Rationale

- The legacy pipeline is now redundant with full skill-based support
- Maintaining two code paths increases complexity and testing burden
- All business types have at least fallback skill support
- Defaulting to a sensible business type is better than no skill context

## Default Business Type Strategy

When no `businessType` is provided, default to `'ecommerce'` as the most common use case. This can be overridden by:
1. Explicit `businessType` in API call
2. Future: `business_type` column on `client_accounts` table

## Files to Modify

### 1. `apps/api/src/services/interplay-report/orchestrator.ts`

Remove `generateInterplayReportLegacy()` and simplify the main function:

```typescript
// BEFORE
export async function generateInterplayReport(
  clientAccountId: string,
  options: GenerateReportOptionsWithSkill
): Promise<string> {
  const businessType = options.businessType;

  if (businessType) {
    return generateInterplayReportWithSkill(clientAccountId, options, businessType, startTime);
  }

  return generateInterplayReportLegacy(clientAccountId, options, startTime);
}

// AFTER
const DEFAULT_BUSINESS_TYPE: BusinessType = 'ecommerce';

export async function generateInterplayReport(
  clientAccountId: string,
  options: GenerateReportOptions
): Promise<string> {
  const startTime = Date.now();
  const businessType = options.businessType ?? DEFAULT_BUSINESS_TYPE;

  return generateInterplayReportWithSkill(clientAccountId, options, businessType, startTime);
}
```

**Changes:**
- Remove `generateInterplayReportLegacy()` function entirely (~100 lines)
- Remove conditional routing in `generateInterplayReport()`
- Add `DEFAULT_BUSINESS_TYPE` constant
- Simplify `GenerateReportOptionsWithSkill` back to `GenerateReportOptions`
- Update logging to indicate default was used

### 2. `apps/api/src/services/interplay-report/types.ts`

Update `GenerateReportOptions` to include optional `businessType`:

```typescript
// Add businessType to the base options
export interface GenerateReportOptions {
  trigger: 'manual' | 'scheduled' | 'onboarding';
  days?: number;
  businessType?: BusinessType;
}
```

### 3. `apps/api/src/services/interplay-report/agents/scout.agent.ts`

Remove legacy `runScout()` function:

```typescript
// REMOVE this function entirely
export function runScout(data: InterplayData): ScoutFindings {
  // ... ~40 lines
}

// KEEP only runScoutWithSkill, but rename to runScout
export function runScout(input: ScoutInput): ScoutOutput {
  // existing runScoutWithSkill implementation
}
```

### 4. `apps/api/src/services/interplay-report/agents/researcher.agent.ts`

Remove legacy `runResearcher()` function:

```typescript
// REMOVE legacy function
export async function runResearcher(...): Promise<ResearcherData> {
  // ... ~40 lines
}

// REMOVE legacy helper functions
async function enrichPagesWithContent(...) { ... }
async function fetchPageContent(...) { ... }
function parsePageContent(...) { ... }

// KEEP skill-based functions, rename runResearcherWithSkill to runResearcher
export async function runResearcher(input: ResearcherInput): Promise<ResearcherOutput> {
  // existing runResearcherWithSkill implementation
}
```

### 5. `apps/api/src/services/interplay-report/agents/sem.agent.ts`

Remove legacy `runSEMAgent()` function:

```typescript
// REMOVE legacy function
export async function runSEMAgent(...): Promise<SEMAgentOutput> {
  // ... ~50 lines
}

// KEEP skill-based function, rename
export async function runSEMAgent(input: SEMAgentInput): Promise<SEMAgentOutput> {
  // existing runSEMAgentWithSkill implementation
  // Note: Can simplify return type since skillVersion is always present
}
```

### 6. `apps/api/src/services/interplay-report/agents/seo.agent.ts`

Remove legacy `runSEOAgent()` function:

```typescript
// REMOVE legacy function
export async function runSEOAgent(...): Promise<SEOAgentOutput> {
  // ... ~50 lines
}

// KEEP skill-based function, rename
export async function runSEOAgent(input: SEOAgentInput): Promise<SEOAgentOutput> {
  // existing runSEOAgentWithSkill implementation
}
```

### 7. `apps/api/src/services/interplay-report/agents/director.agent.ts`

Remove legacy `runDirectorAgent()` function:

```typescript
// REMOVE legacy function
export async function runDirectorAgent(...): Promise<DirectorOutput> {
  // ... ~70 lines
}

// REMOVE legacy helper
function applyRecommendationFiltering(...) { ... }

// KEEP skill-based function, rename
export async function runDirectorAgent(input: DirectorAgentInput): Promise<DirectorOutput> {
  // existing runDirectorAgentWithSkill implementation
}
```

### 8. `apps/api/src/services/interplay-report/agents/index.ts`

Simplify exports to single function per agent:

```typescript
// BEFORE (dual exports)
export {
  runScout,
  runScoutWithSkill,
  type ScoutInput,
  type ScoutOutput,
} from './scout.agent.js';

// AFTER (single export)
export {
  runScout,
  type ScoutInput,
  type ScoutOutput,
} from './scout.agent.js';

// Same pattern for all other agents
```

### 9. `apps/api/src/services/interplay-report/prompts/index.ts`

Remove legacy prompt builder exports:

```typescript
// REMOVE legacy exports
export { buildSEMPrompt, type SEMPromptContext } from './sem.prompt.js';
export { buildSEOPrompt, type SEOPromptContext } from './seo.prompt.js';
export { buildDirectorPrompt, type DirectorPromptContext } from './director.prompt.js';

// KEEP only skill-based exports, rename
export { buildSEMPrompt, type SEMAgentContext } from './sem.prompt.js';
export { buildSEOPrompt, type SEOAgentContext } from './seo.prompt.js';
export { buildDirectorPrompt, type DirectorAgentContext } from './director.prompt.js';
```

### 10. `apps/api/src/services/interplay-report/prompts/sem.prompt.ts`

Remove legacy `buildSEMPrompt()`:

```typescript
// REMOVE legacy function
export function buildSEMPrompt(...): string {
  // ... ~80 lines
}

// KEEP skill-based function, rename
export function buildSEMPrompt(
  enrichedKeywords: EnrichedKeyword[],
  context: SEMAgentContext
): string {
  // existing buildSEMPromptWithSkill implementation
}
```

### 11. `apps/api/src/services/interplay-report/prompts/seo.prompt.ts`

Remove legacy `buildSEOPrompt()`:

```typescript
// REMOVE legacy function
export function buildSEOPrompt(...): string {
  // ... ~80 lines
}

// KEEP skill-based function, rename
export function buildSEOPrompt(
  enrichedPages: EnrichedPage[],
  context: SEOAgentContext
): string {
  // existing buildSEOPromptWithSkill implementation
}
```

### 12. `apps/api/src/services/interplay-report/prompts/director.prompt.ts`

Remove legacy `buildDirectorPrompt()`:

```typescript
// REMOVE legacy function
export function buildDirectorPrompt(...): string {
  // ... ~70 lines
}

// KEEP skill-based function, rename
export function buildDirectorPrompt(
  semAnalysis: SEMAgentOutput,
  seoAnalysis: SEOAgentOutput,
  context: DirectorAgentContext
): string {
  // existing buildDirectorPromptWithSkill implementation
}
```

## Migration Checklist

1. [ ] Update `types.ts` with `businessType` in base options
2. [ ] Remove `generateInterplayReportLegacy()` from orchestrator
3. [ ] Simplify `generateInterplayReport()` with default business type
4. [ ] Remove legacy `runScout()`, rename `runScoutWithSkill()` to `runScout()`
5. [ ] Remove legacy `runResearcher()`, rename skill-based version
6. [ ] Remove legacy `runSEMAgent()`, rename skill-based version
7. [ ] Remove legacy `runSEOAgent()`, rename skill-based version
8. [ ] Remove legacy `runDirectorAgent()`, rename skill-based version
9. [ ] Update `agents/index.ts` exports
10. [ ] Remove legacy prompt builders, rename skill-based versions
11. [ ] Update `prompts/index.ts` exports
12. [ ] Run type check
13. [ ] Test report generation without `businessType` (should use default)
14. [ ] Test report generation with explicit `businessType`

## Estimated Lines Removed

| File | Lines Removed |
|------|---------------|
| `orchestrator.ts` | ~100 |
| `scout.agent.ts` | ~80 |
| `researcher.agent.ts` | ~100 |
| `sem.agent.ts` | ~50 |
| `seo.agent.ts` | ~50 |
| `director.agent.ts` | ~100 |
| `sem.prompt.ts` | ~80 |
| `seo.prompt.ts` | ~80 |
| `director.prompt.ts` | ~70 |
| **Total** | **~710 lines** |

## Dependencies

- Phase 4 (Agent Integration) must be complete

## Validation Criteria

- [ ] `npm run type-check` passes
- [ ] Report generation works without `businessType` parameter
- [ ] Report generation works with explicit `businessType` parameter
- [ ] Logs show skill version and business type for all reports
- [ ] No references to legacy functions remain in codebase

## Rollback Plan

If issues arise, revert the commit. The Phase 4 implementation with dual functions provides a safe fallback.
