# SEM Agent JSON Parsing Hardening

**Date:** 2025-12-08
**Issue:** Interplay report generation failing with "SEM Agent failed to generate valid JSON analysis"

## Problem

The SEM agent (`apps/api/src/services/interplay-report/agents/sem.agent.ts`) was throwing errors that aborted entire report generation when:

1. AI returned valid JSON with an empty `semActions` array (`{"semActions": []}`)
2. AI response contained markdown code fences around the JSON
3. AI response had leading prose before the JSON object

The Zod schema (`semAgentOutputSchema`) enforced `.min(1)` on the actions array, treating empty results as validation failures rather than legitimate outcomes.

## Root Cause

1. **Schema too strict**: `semAgentOutputSchema` required at least 1 action, but sometimes there genuinely are no actionable SEM recommendations
2. **No JSON extraction**: The agent called `JSON.parse()` directly on the AI response without stripping markdown wrappers
3. **Poor diagnostics**: Error logs only showed "Failed to generate valid analysis" without the actual response or Zod validation details

## Solution

### 1. Schema Update (`schemas.ts`)

Removed `.min(1)` constraint to allow empty arrays:

```typescript
// Before
semActions: z.array(semActionSchema).min(1).max(15)

// After
semActions: z.array(semActionSchema).max(15)
```

### 2. JSON Extraction Helper (`sem.agent.ts`)

Added `extractJsonFromResponse()` function that:
- Strips markdown code fences (` ```json ... ``` ` or ` ``` ... ``` `)
- Finds JSON objects via regex (`/\{[\s\S]*\}/`)
- Falls back to finding JSON arrays (`/\[[\s\S]*\]/`)

### 3. Improved Validation (`sem.agent.ts`)

Added `parseAndValidateResponse()` function that:
- Uses `safeParse()` instead of `parse()` for graceful error handling
- Returns detailed error objects with response preview (first 500 chars)
- Logs full Zod validation errors (path, code, message)
- Returns warnings for empty results instead of throwing

### 4. Graceful Empty Handling

Empty `semActions` arrays now:
- Return successfully with `{ semActions: [] }`
- Log a warning: "AI returned zero SEM actions - data may lack actionable insights"
- Allow report generation to continue with empty SEM section

## Files Modified

| File | Change |
|------|--------|
| `apps/api/src/services/interplay-report/schemas.ts` | Removed `.min(1)` from `semAgentOutputSchema` |
| `apps/api/src/services/interplay-report/agents/sem.agent.ts` | Added JSON extraction, improved error handling and logging |

## Testing

- Dev server compiles successfully
- Empty array responses now handled gracefully
- Markdown-wrapped JSON responses parsed correctly
- Detailed error logs available for debugging future issues

## Impact

Reports will no longer fail when:
- A client has no actionable SEM recommendations
- AI occasionally wraps response in markdown
- AI includes brief preamble before JSON

## Related

- Phase 4 implementation: `documents/dev-logs/2025-12-01-phase4-multi-agent-system.md`
- AI Reporting plan: `documents/plans/ai-reporting/README.md`
