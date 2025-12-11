# Phase 6: Constraint Enforcement

## Goal

Implement a constraint validation system in the Director agent that validates upstream agent outputs against skill constraints, filters violations, and logs for debugging.

## Design Principle

**Strict Upstream:** Agents should never generate invalid recommendations in the first place. The Director is a safety net, not a primary filter.

```
SEM Agent: "Do NOT recommend ROAS-based bidding" (in prompt)
    ↓ (should never output ROAS recommendations)

SEO Agent: "Do NOT recommend Product schema" (in prompt)
    ↓ (should never output Product schema recommendations)

Director: Validates no ROAS/Product recommendations exist
    ↓ (logs warning if upstream constraint was violated)

Final Output: Clean, business-appropriate recommendations
```

## Files to Create

### 1. `apps/api/src/services/interplay-report/utils/constraint-validation.ts`

Core constraint validation utilities.

```typescript
import { DirectorSkillDefinition } from '../skills/types';
import { logger } from '@/utils/logger';
import crypto from 'crypto';

// ============================================================================
// Normalized Action Types
// ============================================================================

export interface NormalizedAction {
  id: string;
  source: 'sem' | 'seo';
  type: ActionType;
  text: string;              // Full recommendation text (lowercased for matching)
  keywords: string[];        // Extracted keywords/entities
  metrics: string[];         // Metrics mentioned (roas, cpl, revenue, etc.)
  schemas: string[];         // Schema types mentioned (Product, Service, etc.)
}

export type ActionType =
  | 'bid-adjustment'
  | 'budget-change'
  | 'campaign-structure'
  | 'keyword-targeting'
  | 'schema-implementation'
  | 'schema-removal'
  | 'content-change'
  | 'technical-fix'
  | 'other';

// ============================================================================
// Action Type Inference
// ============================================================================

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
  'other': [],
};

function inferActionType(text: string, source: 'sem' | 'seo'): ActionType {
  for (const [actionType, patterns] of Object.entries(ACTION_TYPE_PATTERNS)) {
    if (actionType === 'other') continue;
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return actionType as ActionType;
      }
    }
  }
  return source === 'sem' ? 'keyword-targeting' : 'content-change';
}

// ============================================================================
// Extraction Functions
// ============================================================================

function extractKeywords(text: string): string[] {
  const keywords: string[] = [];

  // Extract quoted strings
  const quotedMatches = text.match(/"([^"]+)"|'([^']+)'/g);
  if (quotedMatches) {
    keywords.push(...quotedMatches.map(q => q.replace(/['"]/g, '')));
  }

  // Extract bracketed terms
  const bracketedMatches = text.match(/\[([^\]]+)\]/g);
  if (bracketedMatches) {
    keywords.push(...bracketedMatches.map(b => b.replace(/[\[\]]/g, '')));
  }

  return [...new Set(keywords)];
}

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

// ============================================================================
// Action Normalization
// ============================================================================

export interface SEMAction {
  id?: string;
  action: string;
  reasoning: string;
  type?: string;
}

export interface SEOAction {
  id?: string;
  recommendation: string;
  specificActions: string[];
  type?: string;
}

export function normalizeSEMAction(action: SEMAction): NormalizedAction {
  const text = `${action.action} ${action.reasoning}`.toLowerCase();

  return {
    id: action.id || crypto.randomUUID(),
    source: 'sem',
    type: inferActionType(text, 'sem'),
    text,
    keywords: extractKeywords(text),
    metrics: extractMetrics(text),
    schemas: [],
  };
}

export function normalizeSEOAction(action: SEOAction): NormalizedAction {
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

// ============================================================================
// Exclusion Rules
// ============================================================================

export interface ExclusionRule {
  id: string;
  description: string;
  match: (action: NormalizedAction) => boolean;
}

export function buildExclusionRules(mustExclude: string[]): ExclusionRule[] {
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

// ============================================================================
// Constraint Validation
// ============================================================================

export interface ConstraintViolation {
  source: 'sem' | 'seo';
  actionId: string;
  ruleId: string;
  ruleDescription: string;
  matchedContent: string;
}

export interface ConstraintValidationResult {
  violations: ConstraintViolation[];
  filtered: NormalizedAction[];
  originalCount: number;
  filteredCount: number;
}

export interface SEMAgentOutput {
  semActions: SEMAction[];
  // ... other fields
}

export interface SEOAgentOutput {
  seoActions: SEOAction[];
  // ... other fields
}

export function validateUpstreamConstraints(
  semOutput: SEMAgentOutput,
  seoOutput: SEOAgentOutput,
  skill: DirectorSkillDefinition
): ConstraintValidationResult {
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
          matchedContent: action.text.slice(0, 200),
        });
        excluded = true;
        break;
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

  return {
    violations,
    filtered,
    originalCount: allActions.length,
    filteredCount: filtered.length,
  };
}
```

### 2. Update `apps/api/src/services/interplay-report/agents/director.agent.ts`

Integrate constraint validation before synthesis.

```typescript
import { DirectorSkillDefinition } from '../skills/types';
import { buildDirectorPrompt } from '../prompts/director.prompt';
import {
  validateUpstreamConstraints,
  ConstraintValidationResult,
  SEMAgentOutput,
  SEOAgentOutput,
} from '../utils/constraint-validation';
import { logger } from '@/utils/logger';

export interface DirectorAgentInput {
  semOutput: SEMAgentOutput;
  seoOutput: SEOAgentOutput;
  skill: DirectorSkillDefinition;
  clientContext: ClientContext;
}

export interface DirectorOutput {
  executiveSummary: string;
  highlights: Highlight[];
  unifiedRecommendations: UnifiedRecommendation[];
  skillVersion: string;
  constraintValidation: {
    violationCount: number;
    filteredCount: number;
  };
}

export async function runDirectorAgent(input: DirectorAgentInput): Promise<DirectorOutput> {
  const { semOutput, seoOutput, skill, clientContext } = input;

  // Step 1: Validate upstream constraints
  const validationResult = validateUpstreamConstraints(
    semOutput,
    seoOutput,
    skill
  );

  // Log if violations were detected (indicates prompt weakness)
  if (validationResult.violations.length > 0) {
    logger.error({
      clientAccountId: clientContext.clientId,
      businessType: clientContext.businessType,
      violations: validationResult.violations,
    }, 'CONSTRAINT VIOLATIONS: Upstream agents generated invalid recommendations');
  }

  // Step 2: Build prompt with filtered actions
  const prompt = buildDirectorPrompt(
    { ...semOutput, filteredActions: validationResult.filtered.filter(a => a.source === 'sem') },
    { ...seoOutput, filteredActions: validationResult.filtered.filter(a => a.source === 'seo') },
    {
      skill,
      ...clientContext,
    }
  );

  // Step 3: Call Claude
  const response = await callClaude(prompt, {
    maxTokens: 6000,
    temperature: 0.3,
  });

  // Step 4: Parse and validate response
  const parsed = parseDirectorResponse(response);

  // Step 5: Apply additional filtering from skill
  const finalFiltered = applyDirectorFiltering(parsed, skill.filtering);

  return {
    ...finalFiltered,
    skillVersion: skill.version,
    constraintValidation: {
      violationCount: validationResult.violations.length,
      filteredCount: validationResult.filteredCount,
    },
  };
}
```

### 3. Create Database Schema for Violation Tracking

```sql
-- Migration: Create constraint_violations table
CREATE TABLE constraint_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES interplay_reports(id),
  client_account_id UUID NOT NULL REFERENCES client_accounts(id),
  business_type VARCHAR(50) NOT NULL,
  source VARCHAR(10) NOT NULL CHECK (source IN ('sem', 'seo')),
  constraint_id VARCHAR(100) NOT NULL,
  violating_content TEXT NOT NULL,
  skill_version VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_constraint_violations_report ON constraint_violations(report_id);
CREATE INDEX idx_constraint_violations_business_type ON constraint_violations(business_type);
CREATE INDEX idx_constraint_violations_created_at ON constraint_violations(created_at);
```

### 4. Add Violation Storage

```typescript
// In orchestrator.ts, after director completes
if (directorOutput.constraintValidation.violationCount > 0) {
  await storeConstraintViolations(
    reportId,
    clientAccountId,
    client.businessType,
    validationResult.violations,
    skillResult.bundle.version
  );
}
```

## Example: Lead-Gen Skill Exclusions

```typescript
// In lead-gen/director.skill.ts
filtering: {
  mustExclude: [
    'metric:roas',           // ROAS not applicable
    'metric:revenue',        // Revenue not applicable
    'metric:aov',            // AOV not applicable
    'schema:Product',        // Product schema is wrong
    'type:shopping-campaign', // No shopping campaigns
    'type:merchant-center',  // No merchant center
    'type:product-feed',     // No product feeds
  ],
}
```

When the SEM or SEO agent inadvertently mentions ROAS or recommends Product schema for a lead-gen client:

1. `validateUpstreamConstraints()` catches it
2. The recommendation is filtered from Director input
3. Violation is logged for debugging
4. Metrics are tracked to identify prompt weaknesses

## Dependencies

- Phase 1 (Type Definitions)
- Phase 4 (Agent Integration)

## Validation Criteria

- [ ] `normalizeSEMAction()` correctly extracts metrics and keywords
- [ ] `normalizeSEOAction()` correctly extracts schema types
- [ ] `buildExclusionRules()` creates correct matchers for each pattern
- [ ] Violations are detected when upstream agents mention excluded terms
- [ ] Violations are logged with full context
- [ ] Filtered actions are passed to Director prompt
- [ ] Violation count appears in report metadata

## Testing Scenarios

1. **Lead-gen with ROAS mention**
   - SEM agent output includes "improve ROAS by 20%"
   - Expected: Caught by `metric:roas` rule, logged, filtered

2. **Lead-gen with Product schema**
   - SEO agent output includes "Add Product schema to service page"
   - Expected: Caught by `schema:Product` rule, logged, filtered

3. **Ecommerce (no violations)**
   - Both agents recommend ROAS optimization and Product schema
   - Expected: No violations, all recommendations pass through

## Estimated Effort

Medium - requires implementing extraction logic and validation framework.
