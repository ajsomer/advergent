/**
 * SEM Agent - AI Analysis of Battleground Keywords
 */

import { logger } from '@/utils/logger.js';
import { callGenericAI } from '@/services/ai-analyzer.service.js';
import { semAgentOutputSchema } from '../schemas.js';
import { buildSEMPrompt } from '../prompts/index.js';
import type { EnrichedKeyword, SEMAgentOutput } from '../types.js';

const semLogger = logger.child({ module: 'sem-agent' });

export interface SEMAgentContext {
  industry?: string;
  targetMarket?: string;
  clientName?: string;
}

export async function runSEMAgent(
  enrichedKeywords: EnrichedKeyword[],
  context: SEMAgentContext
): Promise<SEMAgentOutput> {
  semLogger.info(
    { keywordCount: enrichedKeywords.length },
    'SEM Agent: Starting AI analysis'
  );

  if (enrichedKeywords.length === 0) {
    semLogger.warn('SEM Agent: No keywords to analyze');
    return { semActions: [] };
  }

  const prompt = buildSEMPrompt(enrichedKeywords, context);

  try {
    const response = await callGenericAI(prompt);
    const parsed = JSON.parse(response);
    const validated = semAgentOutputSchema.parse(parsed);

    semLogger.info(
      { actionCount: validated.semActions.length },
      'SEM Agent: Analysis complete'
    );

    return validated;
  } catch (error) {
    semLogger.error(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'SEM Agent: Failed to generate valid analysis'
    );
    throw new Error('SEM Agent failed to generate valid JSON analysis');
  }
}
