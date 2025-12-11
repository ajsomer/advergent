# Skill System Phase 6: Constraint Enforcement

**Date:** 2025-12-11
**Author:** Claude Opus 4.5

## Overview

Implemented a constraint validation system in the Director agent that validates upstream agent outputs against skill constraints, filters violations, and logs for debugging.

## Design Principle: Strict Upstream

Agents should never generate invalid recommendations in the first place. The Director is a safety net, not a primary filter.

```
SEM Agent: "Do NOT recommend ROAS-based bidding" (in prompt)
    ↓ (should never output ROAS recommendations)

SEO Agent: "Do NOT recommend Product schema" (in prompt)
    ↓ (should never output Product schema recommendations)

Director: Validates no ROAS/Product recommendations exist
    ↓ (logs warning if upstream constraint was violated)

Final Output: Clean, business-appropriate recommendations
```

## Files Created

### 1. `apps/api/src/services/interplay-report/utils/constraint-validation.ts`

Core constraint validation utilities (~320 lines):

**Normalized Action Types:**
- `NormalizedAction` - Unified representation of SEM/SEO actions
- `ActionType` - Categorized action types (bid-adjustment, budget-change, schema-implementation, etc.)

**Extraction Functions:**
- `extractKeywords()` - Extracts quoted strings and bracketed terms
- `extractMetrics()` - Detects metrics mentioned (roas, cpl, ctr, etc.)
- `extractSchemaTypes()` - Identifies schema types (Product, Service, FAQPage, etc.)

**Normalization:**
- `normalizeSEMAction()` - Converts SEM action to normalized format
- `normalizeSEOAction()` - Converts SEO action to normalized format

**Exclusion Rules:**
- `buildExclusionRules()` - Creates matchers from skill patterns
- Pattern support: `metric:X`, `schema:X`, `type:X`, plain text

**Validation:**
- `validateUpstreamConstraints()` - Main validation function
- Returns violations, filtered actions, and counts

### 2. Database Migration (via Drizzle)

`drizzle/0010_furry_greymalkin.sql`:

```sql
CREATE TYPE "constraint_violation_source" AS ENUM('sem', 'seo');
CREATE TABLE "constraint_violations" (
  id UUID PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES interplay_reports(id),
  client_account_id UUID NOT NULL REFERENCES client_accounts(id),
  business_type VARCHAR(50) NOT NULL,
  source constraint_violation_source NOT NULL,
  constraint_id VARCHAR(100) NOT NULL,
  violating_content TEXT NOT NULL,
  skill_version VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

With indexes for:
- report_id, client_account_id, business_type, source, constraint_id, created_at
- Composite trend index: (business_type, constraint_id, created_at)

## Files Modified

### 1. `apps/api/src/db/schema.ts`

- Added `constraintViolationSourceEnum` enum
- Added `constraintViolations` table definition
- Added `constraintViolationsRelations` for Drizzle ORM

### 2. `apps/api/src/services/interplay-report/utils/index.ts`

Exports new constraint validation module:
```typescript
export {
  validateUpstreamConstraints,
  buildExclusionRules,
  normalizeSEMAction,
  normalizeSEOAction,
  extractFilteredSEMActions,
  extractFilteredSEOActions,
  type NormalizedAction,
  type ActionType,
  type ExclusionRule,
  type ConstraintViolation,
  type ConstraintValidationResult,
} from './constraint-validation.js';
```

### 3. `apps/api/src/services/interplay-report/agents/director.agent.ts`

Integrated constraint validation before synthesis:

1. Added imports for constraint validation utilities
2. Extended `DirectorAgentContext` with `clientId` and `businessType`
3. Added `ConstraintValidationMeta` interface
4. Extended `DirectorOutputWithMeta` with validation metadata
5. Updated `runDirectorAgent()` to:
   - Call `validateUpstreamConstraints()` before prompt building
   - Log violations at ERROR level (indicates prompt weakness)
   - Filter invalid actions before synthesis
   - Include validation metadata in output

### 4. `apps/api/src/services/interplay-report/queries.ts`

Added constraint violation database operations:

```typescript
export async function storeConstraintViolations(params: {
  reportId: string;
  clientAccountId: string;
  businessType: string;
  violations: ConstraintViolation[];
  skillVersion: string;
}): Promise<void>;

export async function getConstraintViolationsForReport(reportId: string);

export async function getConstraintViolationsByBusinessType(businessType: string);
```

### 5. `apps/api/src/services/interplay-report/orchestrator.ts`

Updated to store violations and pass context:

1. Added `storeConstraintViolations` import
2. Passes `clientId` and `businessType` to director context
3. Stores violations to database when detected
4. Adds warning to report metadata for violations

### 6. `apps/api/src/services/interplay-report/skills/placeholders/director.placeholder.ts`

Added business-type-specific exclusion patterns:

```typescript
const BUSINESS_TYPE_EXCLUSIONS: Record<BusinessType, string[]> = {
  'lead-gen': [
    'metric:roas',      // ROAS not applicable
    'metric:revenue',   // Revenue not primary metric
    'metric:aov',       // AOV not applicable
    'schema:Product',   // Product schema wrong for services
    'schema:Offer',     // E-commerce focused
    'type:shopping-campaign',
    'type:merchant-center',
    'type:product-feed',
  ],
  ecommerce: [
    'schema:ProfessionalService',  // Service schema not for products
  ],
  saas: [
    'metric:aov',
    'schema:Product',
    'schema:Offer',
    'type:shopping-campaign',
    'type:merchant-center',
  ],
  local: [
    'metric:roas',      // Offline conversions common
    'schema:Product',
    'type:merchant-center',
  ],
};
```

## Validation Flow

```
1. SEM Agent → semActions[]
2. SEO Agent → seoActions[]
3. Director receives both outputs
4. validateUpstreamConstraints() runs:
   a. Normalize all actions (extract metrics, schemas, keywords)
   b. Build exclusion rules from skill.filtering.mustExclude
   c. Check each action against rules
   d. Filter violating actions
   e. Log violations at ERROR level
5. Director prompt built with filtered actions only
6. Claude synthesizes clean recommendations
7. Violations stored to constraint_violations table
8. Warning added to report metadata
```

## Example: Lead-Gen Constraint Enforcement

When SEM agent outputs:
```json
{
  "action": "Implement ROAS-based bidding to improve return on ad spend",
  "reasoning": "Current ROAS is below target..."
}
```

The constraint validation:
1. Normalizes action, extracting `metrics: ['roas']`
2. Matches against `metric:roas` rule for lead-gen
3. Filters action from Director input
4. Logs violation for debugging
5. Stores violation in database

## Testing Scenarios

| Scenario | Input | Expected |
|----------|-------|----------|
| Lead-gen + ROAS | SEM mentions "improve ROAS by 20%" | Caught by `metric:roas`, logged, filtered |
| Lead-gen + Product schema | SEO recommends "Add Product schema" | Caught by `schema:Product`, logged, filtered |
| E-commerce + ROAS | SEM recommends ROAS optimization | Passes validation (ROAS valid for e-commerce) |
| SaaS + Shopping campaign | SEM recommends shopping campaign | Caught by `type:shopping-campaign`, filtered |

## Metrics & Monitoring

Violations are tracked for:
1. **Prompt Quality Analysis** - High violation counts indicate weak upstream prompts
2. **Business Type Trends** - Which types have most violations
3. **Constraint Pattern Analysis** - Which rules trigger most often

Queries available:
- `getConstraintViolationsForReport(reportId)` - Debug specific report
- `getConstraintViolationsByBusinessType(type)` - Trend analysis

## Dependencies

- Phase 1 (Type Definitions) - `DirectorSkillDefinition.filtering.mustExclude`
- Phase 4 (Agent Integration) - Director agent structure
- Phase 5 (Orchestrator) - Report generation flow

## Build Verification

```bash
npm run build  # Passes
npx tsc --noEmit  # No type errors
```

## Next Steps

1. **Enhance Upstream Prompts** - Add explicit constraints to SEM/SEO agent prompts
2. **Monitoring Dashboard** - Visualize violation trends by business type
3. **Alert System** - Notify when violation rate exceeds threshold
4. **Constraint Refinement** - Tune exclusion patterns based on real data
