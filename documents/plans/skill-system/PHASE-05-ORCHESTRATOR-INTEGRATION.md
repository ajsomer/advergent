# Phase 5: Orchestrator Integration

## Goal

Modify the report orchestrator to load skill bundles at pipeline start and distribute individual skills to each agent.

## File to Modify

### `apps/api/src/services/interplay-report/orchestrator.ts`

```typescript
import { loadSkillBundle, SkillLoadResult } from './skills';
import { BusinessType } from './skills/types';
import { runScout } from './agents/scout.agent';
import { runResearcher } from './agents/researcher.agent';
import { runSEMAgent } from './agents/sem.agent';
import { runSEOAgent } from './agents/seo.agent';
import { runDirectorAgent } from './agents/director.agent';
import { logger } from '@/utils/logger';

export interface GenerateReportOptions {
  dateRange: DateRange;
  forceRefresh?: boolean;
}

export interface ReportMetadata {
  reportId: string;
  clientAccountId: string;
  generatedAt: string;
  skillBundle: {
    businessType: BusinessType;
    version: string;
    usingFallback: boolean;
    fallbackFrom?: BusinessType;
  };
  warnings: ReportWarning[];
  performance: {
    totalDurationMs: number;
    scoutDurationMs: number;
    researcherDurationMs: number;
    semDurationMs: number;
    seoDurationMs: number;
    directorDurationMs: number;
    skillLoadTimeMs: number;
  };
}

interface ReportWarning {
  type: string;
  message: string;
}

export async function generateInterplayReport(
  clientAccountId: string,
  options: GenerateReportOptions
): Promise<{ reportId: string; metadata: ReportMetadata }> {
  const startTime = Date.now();
  const metadata: Partial<ReportMetadata> = {
    clientAccountId,
    warnings: [],
    performance: {} as ReportMetadata['performance'],
  };

  // 1. Get client and business type
  const client = await getClient(clientAccountId);

  // 2. Load skill bundle based on business type
  const skillLoadStart = performance.now();
  const skillResult: SkillLoadResult = loadSkillBundle(client.businessType);
  const skillLoadTimeMs = performance.now() - skillLoadStart;

  metadata.skillBundle = {
    businessType: client.businessType,
    version: skillResult.bundle.version,
    usingFallback: skillResult.usingFallback,
    fallbackFrom: skillResult.fallbackFrom,
  };
  metadata.performance!.skillLoadTimeMs = skillLoadTimeMs;

  logger.info({
    clientAccountId,
    businessType: client.businessType,
    skillVersion: skillResult.bundle.version,
    usingFallback: skillResult.usingFallback,
  }, 'Loaded skill bundle for report generation');

  // Surface fallback warning if applicable
  if (skillResult.usingFallback && skillResult.warning) {
    metadata.warnings!.push({
      type: 'skill-fallback',
      message: skillResult.warning,
    });
  }

  // 3. Fetch raw data
  const { googleAdsData, searchConsoleData } = await fetchRawData(
    clientAccountId,
    options.dateRange
  );

  // 4. Run Scout with scout skill
  const scoutStart = performance.now();
  const scoutFindings = runScout({
    googleAdsData,
    searchConsoleData,
    skill: skillResult.bundle.scout,
  });
  metadata.performance!.scoutDurationMs = performance.now() - scoutStart;

  logger.debug({
    battlegroundKeywords: scoutFindings.battlegroundKeywords.length,
    criticalPages: scoutFindings.criticalPages.length,
  }, 'Scout phase complete');

  // 5. Run Researcher with researcher skill
  const researcherStart = performance.now();
  const researcherData = await runResearcher({
    battlegroundKeywords: scoutFindings.battlegroundKeywords,
    criticalPages: scoutFindings.criticalPages,
    skill: skillResult.bundle.researcher,
  });
  metadata.performance!.researcherDurationMs = performance.now() - researcherStart;

  logger.debug({
    enrichedKeywords: researcherData.enrichedKeywords.length,
    enrichedPages: researcherData.enrichedPages.length,
    dataQuality: researcherData.dataQualityMetrics,
  }, 'Researcher phase complete');

  // 6. Run SEM and SEO agents in parallel with their respective skills
  const clientContext = buildClientContext(client);

  const [semResult, seoResult] = await Promise.all([
    (async () => {
      const start = performance.now();
      const result = await runSEMAgent({
        enrichedKeywords: researcherData.enrichedKeywords,
        skill: skillResult.bundle.sem,
        clientContext,
      });
      metadata.performance!.semDurationMs = performance.now() - start;
      return result;
    })(),
    (async () => {
      const start = performance.now();
      const result = await runSEOAgent({
        enrichedPages: researcherData.enrichedPages,
        skill: skillResult.bundle.seo,
        clientContext,
      });
      metadata.performance!.seoDurationMs = performance.now() - start;
      return result;
    })(),
  ]);

  logger.debug({
    semRecommendations: semResult.recommendations.length,
    seoRecommendations: seoResult.recommendations.length,
  }, 'SEM and SEO agents complete');

  // 7. Run Director with director skill
  const directorStart = performance.now();
  const directorOutput = await runDirectorAgent({
    semOutput: semResult,
    seoOutput: seoResult,
    skill: skillResult.bundle.director,
    clientContext,
  });
  metadata.performance!.directorDurationMs = performance.now() - directorStart;

  logger.debug({
    unifiedRecommendations: directorOutput.unifiedRecommendations.length,
    highlights: directorOutput.highlights.length,
  }, 'Director phase complete');

  // 8. Store report
  const reportId = await storeReport({
    clientAccountId,
    scoutFindings,
    researcherData,
    semOutput: semResult,
    seoOutput: seoResult,
    directorOutput,
    metadata: {
      ...metadata,
      reportId: '', // Will be set by store function
      generatedAt: new Date().toISOString(),
      performance: {
        ...metadata.performance!,
        totalDurationMs: Date.now() - startTime,
      },
    } as ReportMetadata,
  });

  const finalMetadata: ReportMetadata = {
    ...metadata as ReportMetadata,
    reportId,
    generatedAt: new Date().toISOString(),
    performance: {
      ...metadata.performance!,
      totalDurationMs: Date.now() - startTime,
    },
  };

  logger.info({
    reportId,
    clientAccountId,
    businessType: client.businessType,
    totalDurationMs: finalMetadata.performance.totalDurationMs,
  }, 'Report generation complete');

  return { reportId, metadata: finalMetadata };
}

// Helper function to build client context passed to AI agents
function buildClientContext(client: ClientAccount): ClientContext {
  return {
    clientName: client.name,
    industry: client.industry,
    businessType: client.businessType,
    websiteUrl: client.websiteUrl,
    // ... other relevant context
  };
}
```

## Key Integration Points

### Skill Bundle Loading

```typescript
// Load once at pipeline start
const skillResult = loadSkillBundle(client.businessType);

// Access individual skills for each agent
skillResult.bundle.scout      // → Scout agent
skillResult.bundle.researcher // → Researcher agent
skillResult.bundle.sem        // → SEM agent
skillResult.bundle.seo        // → SEO agent
skillResult.bundle.director   // → Director agent
```

### Metadata Tracking

Every report stores:
- `businessType` - The client's business type
- `version` - Skill bundle version used
- `usingFallback` - Whether fallback was used
- `fallbackFrom` - Original type if using fallback
- `skillLoadTimeMs` - Performance metric

### Fallback Warning Propagation

```typescript
if (skillResult.usingFallback && skillResult.warning) {
  metadata.warnings.push({
    type: 'skill-fallback',
    message: skillResult.warning,
  });
}
```

This warning surfaces in the UI to inform users that full skill support isn't available for their business type.

## Dependencies

- Phase 1 (Type Definitions)
- Phase 2 (Skill Loader)
- Phase 3 (Prompt Serialisation)
- Phase 4 (Agent Integration)

## Validation Criteria

- [ ] Skill bundle loads successfully for each business type
- [ ] Each agent receives only its specific skill
- [ ] Fallback warning appears in report metadata when applicable
- [ ] Skill version is tracked in report metadata
- [ ] Performance metrics include skill load time
- [ ] Report generation completes successfully with skills

## Estimated Effort

Small - primarily wiring up existing components and adding metadata tracking.
