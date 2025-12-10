import type { ResearcherSkillDefinition, BusinessType } from '../types.js';

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
