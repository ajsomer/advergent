# Phase 4: Agent Integration

## Goal

Modify all agents (Scout, Researcher, SEM, SEO, Director) to accept and use their specific skill definitions.

## Files to Modify

### 1. `apps/api/src/services/interplay-report/agents/scout.agent.ts`

The Scout agent performs data triage (no AI). Modify to use skill thresholds and priority rules.

```typescript
import { ScoutSkillDefinition, PriorityRule } from '../skills/types';

export interface ScoutInput {
  googleAdsData: GoogleAdsKeyword[];
  searchConsoleData: SearchConsoleQuery[];
  skill: ScoutSkillDefinition;
}

export interface ScoutOutput {
  battlegroundKeywords: BattlegroundKeyword[];
  criticalPages: CriticalPage[];
  metrics: {
    totalKeywordsAnalyzed: number;
    totalPagesAnalyzed: number;
    thresholdsApplied: typeof ScoutSkillDefinition.prototype.thresholds;
  };
}

export function runScout(input: ScoutInput): ScoutOutput {
  const { googleAdsData, searchConsoleData, skill } = input;
  const { thresholds, priorityRules, metrics, limits } = skill;

  // Use skill thresholds instead of hardcoded values
  const battlegroundKeywords = identifyBattlegroundKeywords(
    googleAdsData,
    searchConsoleData,
    thresholds,
    priorityRules.battlegroundKeywords,
    metrics
  );

  const criticalPages = identifyCriticalPages(
    googleAdsData,
    searchConsoleData,
    thresholds,
    priorityRules.criticalPages,
    metrics
  );

  // Apply limits from skill
  return {
    battlegroundKeywords: battlegroundKeywords.slice(0, limits.maxBattlegroundKeywords),
    criticalPages: criticalPages.slice(0, limits.maxCriticalPages),
    metrics: {
      totalKeywordsAnalyzed: googleAdsData.length,
      totalPagesAnalyzed: new Set([...googleAdsData.map(k => k.landingPage)]).size,
      thresholdsApplied: thresholds,
    },
  };
}

function identifyBattlegroundKeywords(
  adsData: GoogleAdsKeyword[],
  consoleData: SearchConsoleQuery[],
  thresholds: ScoutSkillDefinition['thresholds'],
  rules: PriorityRule[],
  metricsConfig: ScoutSkillDefinition['metrics']
): BattlegroundKeyword[] {
  const keywords: BattlegroundKeyword[] = [];

  for (const ad of adsData) {
    // Skip if below minimum impressions
    if (ad.impressions < thresholds.minImpressionsForAnalysis) continue;

    // Check each priority rule
    for (const rule of rules) {
      if (!rule.enabled) continue;

      // Evaluate rule condition using thresholds
      const matches = evaluateRule(ad, consoleData, rule, thresholds);

      if (matches) {
        keywords.push({
          query: ad.query,
          priority: rule.priority,
          priorityReason: rule.id,
          ...extractRelevantMetrics(ad, metricsConfig),
        });
        break; // Stop at first matching rule
      }
    }
  }

  // Sort by priority
  return keywords.sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority));
}

function evaluateRule(
  ad: GoogleAdsKeyword,
  consoleData: SearchConsoleQuery[],
  rule: PriorityRule,
  thresholds: ScoutSkillDefinition['thresholds']
): boolean {
  // Rule evaluation logic based on rule.condition
  // This would be expanded based on actual rule conditions
  switch (rule.id) {
    case 'brand-cannibalization':
      const organic = consoleData.find(c => c.query === ad.query);
      return organic &&
             organic.position <= thresholds.cannibalizationPosition &&
             ad.spend > thresholds.highSpendThreshold;

    case 'high-spend-low-roas':
      return ad.spend > thresholds.highSpendThreshold &&
             (ad.roas ?? Infinity) < thresholds.lowRoasThreshold;

    // ... other rule evaluations
    default:
      return false;
  }
}

function extractRelevantMetrics(
  ad: GoogleAdsKeyword,
  metricsConfig: ScoutSkillDefinition['metrics']
): Record<string, number | undefined> {
  const result: Record<string, number | undefined> = {};

  for (const metric of metricsConfig.include) {
    if (metric in ad) {
      result[metric] = (ad as any)[metric];
    }
  }

  return result;
}

function priorityOrder(priority: 'critical' | 'high' | 'medium' | 'low'): number {
  return { critical: 0, high: 1, medium: 2, low: 3 }[priority];
}
```

### 2. `apps/api/src/services/interplay-report/agents/researcher.agent.ts`

The Researcher agent enriches data. Modify to use skill content signals and page classification.

```typescript
import { ResearcherSkillDefinition, ContentSignal, PagePattern } from '../skills/types';

export interface ResearcherInput {
  battlegroundKeywords: BattlegroundKeyword[];
  criticalPages: CriticalPage[];
  skill: ResearcherSkillDefinition;
}

export interface ResearcherOutput {
  enrichedKeywords: EnrichedKeyword[];
  enrichedPages: EnrichedPage[];
  dataQualityMetrics: DataQualityMetrics;
}

export async function runResearcher(input: ResearcherInput): Promise<ResearcherOutput> {
  const { battlegroundKeywords, criticalPages, skill } = input;

  // Enrich keywords with competitive data
  const enrichedKeywords = await enrichKeywords(
    battlegroundKeywords,
    skill.keywordEnrichment
  );

  // Enrich pages with content analysis
  const enrichedPages = await enrichPages(
    criticalPages,
    skill.pageEnrichment,
    skill.dataQuality
  );

  // Calculate data quality metrics
  const dataQualityMetrics = calculateDataQuality(
    enrichedKeywords,
    enrichedPages,
    skill.dataQuality
  );

  return {
    enrichedKeywords,
    enrichedPages,
    dataQualityMetrics,
  };
}

async function enrichPages(
  pages: CriticalPage[],
  config: ResearcherSkillDefinition['pageEnrichment'],
  qualityConfig: ResearcherSkillDefinition['dataQuality']
): Promise<EnrichedPage[]> {
  const enrichedPages: EnrichedPage[] = [];

  // Fetch pages with concurrency limit from skill
  const batches = chunk(pages, qualityConfig.maxConcurrentFetches);

  for (const batch of batches) {
    const results = await Promise.all(
      batch.map(page => fetchAndAnalyzePage(page, config, qualityConfig.maxFetchTimeout))
    );
    enrichedPages.push(...results);
  }

  return enrichedPages;
}

async function fetchAndAnalyzePage(
  page: CriticalPage,
  config: ResearcherSkillDefinition['pageEnrichment'],
  timeout: number
): Promise<EnrichedPage> {
  const fetchedContent = await fetchPageContent(page.url, timeout);

  if (!fetchedContent) {
    return { ...page, fetchedContent: undefined };
  }

  // Standard extractions
  const standardData = extractStandardContent(fetchedContent, config.standardExtractions);

  // Schema extraction with business-type awareness
  const schemaData = extractSchema(
    fetchedContent,
    config.schemaExtraction.lookFor,
    config.schemaExtraction.flagIfPresent,
    config.schemaExtraction.flagIfMissing
  );

  // Business-specific content signals
  const contentSignals = detectContentSignals(
    fetchedContent,
    config.contentSignals
  );

  // Page classification
  const pageType = classifyPage(
    page.url,
    fetchedContent,
    config.pageClassification
  );

  return {
    ...page,
    fetchedContent: {
      ...standardData,
      detectedSchema: schemaData.found,
      schemaErrors: schemaData.errors,
      contentSignals,
      pageType,
    },
  };
}

function detectContentSignals(
  content: PageContent,
  signals: ContentSignal[]
): Record<string, boolean> {
  const result: Record<string, boolean> = {};

  for (const signal of signals) {
    // Use CSS selector to detect signal
    result[signal.id] = content.matchesSelector(signal.selector);
  }

  return result;
}

function classifyPage(
  url: string,
  content: PageContent,
  config: ResearcherSkillDefinition['pageEnrichment']['pageClassification']
): string {
  let bestMatch: { type: string; confidence: number } | null = null;

  for (const pattern of config.patterns) {
    const regex = new RegExp(pattern.pattern, 'i');
    if (regex.test(url)) {
      if (!bestMatch || pattern.confidence > bestMatch.confidence) {
        bestMatch = { type: pattern.pageType, confidence: pattern.confidence };
      }
    }
  }

  if (bestMatch && bestMatch.confidence >= config.confidenceThreshold) {
    return bestMatch.type;
  }

  return config.defaultType;
}
```

### 3. `apps/api/src/services/interplay-report/agents/sem.agent.ts`

Modify to pass skill to prompt builder.

```typescript
import { SEMSkillDefinition } from '../skills/types';
import { buildSEMPrompt } from '../prompts/sem.prompt';

export interface SEMAgentInput {
  enrichedKeywords: EnrichedKeyword[];
  skill: SEMSkillDefinition;
  clientContext: ClientContext;
}

export async function runSEMAgent(input: SEMAgentInput): Promise<SEMAgentOutput> {
  const { enrichedKeywords, skill, clientContext } = input;

  // Build prompt using skill
  const prompt = buildSEMPrompt(enrichedKeywords, {
    skill,
    ...clientContext,
  });

  // Call Claude
  const response = await callClaude(prompt, {
    maxTokens: 4000,
    temperature: 0.3,
  });

  // Parse and validate response
  const parsed = parseSEMResponse(response);

  // Apply output filtering from skill
  const filtered = filterRecommendations(
    parsed.recommendations,
    skill.output
  );

  return {
    ...parsed,
    recommendations: filtered,
    skillVersion: skill.version,
  };
}

function filterRecommendations(
  recommendations: SEMRecommendation[],
  outputConfig: SEMSkillDefinition['output']
): SEMRecommendation[] {
  // Exclude recommendations matching exclude types
  let filtered = recommendations.filter(rec =>
    !outputConfig.recommendationTypes.exclude.some(type =>
      rec.type.toLowerCase().includes(type.toLowerCase())
    )
  );

  // Sort to prioritize certain types
  filtered = filtered.sort((a, b) => {
    const aPriority = outputConfig.recommendationTypes.prioritize.findIndex(t =>
      a.type.toLowerCase().includes(t.toLowerCase())
    );
    const bPriority = outputConfig.recommendationTypes.prioritize.findIndex(t =>
      b.type.toLowerCase().includes(t.toLowerCase())
    );
    return (aPriority === -1 ? 999 : aPriority) - (bPriority === -1 ? 999 : bPriority);
  });

  // Limit to max
  return filtered.slice(0, outputConfig.maxRecommendations);
}
```

### 4. `apps/api/src/services/interplay-report/agents/seo.agent.ts`

Similar pattern for SEO agent.

```typescript
import { SEOSkillDefinition } from '../skills/types';
import { buildSEOPrompt } from '../prompts/seo.prompt';

export interface SEOAgentInput {
  enrichedPages: EnrichedPage[];
  skill: SEOSkillDefinition;
  clientContext: ClientContext;
}

export async function runSEOAgent(input: SEOAgentInput): Promise<SEOAgentOutput> {
  const { enrichedPages, skill, clientContext } = input;

  // Build prompt using skill
  const prompt = buildSEOPrompt(enrichedPages, {
    skill,
    ...clientContext,
  });

  // Call Claude
  const response = await callClaude(prompt, {
    maxTokens: 4000,
    temperature: 0.3,
  });

  // Parse and validate response
  const parsed = parseSEOResponse(response);

  // Apply output filtering from skill
  const filtered = filterSEORecommendations(
    parsed.recommendations,
    skill.output
  );

  return {
    ...parsed,
    recommendations: filtered,
    skillVersion: skill.version,
  };
}
```

### 5. `apps/api/src/services/interplay-report/agents/director.agent.ts`

Modify to use skill for synthesis and filtering.

```typescript
import { DirectorSkillDefinition } from '../skills/types';
import { buildDirectorPrompt } from '../prompts/director.prompt';

export interface DirectorAgentInput {
  semOutput: SEMAgentOutput;
  seoOutput: SEOAgentOutput;
  skill: DirectorSkillDefinition;
  clientContext: ClientContext;
}

export async function runDirectorAgent(input: DirectorAgentInput): Promise<DirectorOutput> {
  const { semOutput, seoOutput, skill, clientContext } = input;

  // Build prompt using skill
  const prompt = buildDirectorPrompt(semOutput, seoOutput, {
    skill,
    ...clientContext,
  });

  // Call Claude
  const response = await callClaude(prompt, {
    maxTokens: 6000,
    temperature: 0.3,
  });

  // Parse and validate response
  const parsed = parseDirectorResponse(response);

  // Apply filtering from skill
  const filtered = applyDirectorFiltering(parsed, skill.filtering);

  return {
    ...filtered,
    skillVersion: skill.version,
  };
}

function applyDirectorFiltering(
  output: DirectorOutput,
  filterConfig: DirectorSkillDefinition['filtering']
): DirectorOutput {
  let recommendations = output.unifiedRecommendations;

  // Must include certain types if present
  const mustIncludeRecs = recommendations.filter(rec =>
    filterConfig.mustInclude.some(type =>
      rec.type.toLowerCase().includes(type.toLowerCase())
    )
  );

  // Exclude certain types
  recommendations = recommendations.filter(rec =>
    !filterConfig.mustExclude.some(type =>
      rec.type.toLowerCase().includes(type.toLowerCase()) ||
      rec.description.toLowerCase().includes(type.toLowerCase())
    )
  );

  // Ensure must-includes are present
  for (const must of mustIncludeRecs) {
    if (!recommendations.includes(must)) {
      recommendations.unshift(must);
    }
  }

  // Limit to max
  recommendations = recommendations.slice(0, filterConfig.maxRecommendations);

  return {
    ...output,
    unifiedRecommendations: recommendations,
  };
}
```

## Dependencies

- Phase 1 (Type Definitions)
- Phase 2 (Skill Loader)
- Phase 3 (Prompt Serialisation)

## Validation Criteria

- [ ] Scout agent uses skill thresholds correctly
- [ ] Scout agent applies priority rules from skill
- [ ] Researcher agent uses content signals from skill
- [ ] Researcher agent classifies pages using skill patterns
- [ ] SEM agent passes skill to prompt builder
- [ ] SEO agent passes skill to prompt builder
- [ ] Director agent applies filtering from skill
- [ ] All agents include skill version in output

## Estimated Effort

Medium-Large - requires modifying multiple agent files and ensuring skill data flows correctly through each.
