/**
 * SEO Agent - AI Analysis of Critical Pages
 */

import { logger } from '@/utils/logger.js';
import { callGenericAI } from '@/services/ai-analyzer.service.js';
import { seoAgentOutputSchema } from '../schemas.js';
import { buildSEOPrompt } from '../prompts/index.js';
import type { EnrichedPage, SEOAgentOutput } from '../types.js';

const seoLogger = logger.child({ module: 'seo-agent' });

export interface SEOAgentContext {
  industry?: string;
  targetMarket?: string;
  clientName?: string;
}

export async function runSEOAgent(
  enrichedPages: EnrichedPage[],
  context: SEOAgentContext
): Promise<SEOAgentOutput> {
  seoLogger.info(
    { pageCount: enrichedPages.length },
    'SEO Agent: Starting AI analysis'
  );

  if (enrichedPages.length === 0) {
    seoLogger.warn('SEO Agent: No pages to analyze');
    return { seoActions: [] };
  }

  const prompt = buildSEOPrompt(enrichedPages, context);

  try {
    const response = await callGenericAI(prompt);
    const parsed = JSON.parse(response);
    const validated = seoAgentOutputSchema.parse(parsed);

    seoLogger.info(
      { actionCount: validated.seoActions.length },
      'SEO Agent: Analysis complete'
    );

    return validated;
  } catch (error) {
    seoLogger.error(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'SEO Agent: Failed to generate valid analysis'
    );
    throw new Error('SEO Agent failed to generate valid JSON analysis');
  }
}
