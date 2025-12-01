/**
 * Director Agent - Strategy Synthesis
 *
 * Combines SEM and SEO agent outputs into a unified executive report
 * with prioritized, deduplicated recommendations.
 */

import { logger } from '@/utils/logger.js';
import { callGenericAI } from '@/services/ai-analyzer.service.js';
import { directorOutputSchema } from '../schemas.js';
import { buildDirectorPrompt } from '../prompts/index.js';
import type { SEMAgentOutput, SEOAgentOutput, DirectorOutput } from '../types.js';

const directorLogger = logger.child({ module: 'director-agent' });

export interface DirectorAgentContext {
  industry?: string;
  targetMarket?: string;
  clientName?: string;
}

export async function runDirectorAgent(
  semAnalysis: SEMAgentOutput,
  seoAnalysis: SEOAgentOutput,
  context: DirectorAgentContext
): Promise<DirectorOutput> {
  directorLogger.info(
    {
      semActionCount: semAnalysis.semActions.length,
      seoActionCount: seoAnalysis.seoActions.length,
    },
    'Director Agent: Starting synthesis'
  );

  // Handle edge case where both agents have no recommendations
  if (semAnalysis.semActions.length === 0 && seoAnalysis.seoActions.length === 0) {
    directorLogger.warn('Director Agent: No recommendations to synthesize');
    return {
      executiveSummary: {
        summary: 'No significant optimization opportunities were identified in the current data. This may indicate the account is well-optimized or that additional data is needed for analysis.',
        keyHighlights: ['No urgent issues detected', 'Consider expanding data sources'],
      },
      unifiedRecommendations: [],
    };
  }

  const prompt = buildDirectorPrompt(semAnalysis, seoAnalysis, context);

  try {
    const response = await callGenericAI(prompt);
    const parsed = JSON.parse(response);
    const validated = directorOutputSchema.parse(parsed);

    // Apply final filtering to ensure max 10 recommendations
    const filteredRecommendations = applyRecommendationFiltering(
      validated.unifiedRecommendations
    );

    directorLogger.info(
      {
        originalCount: validated.unifiedRecommendations.length,
        filteredCount: filteredRecommendations.length,
      },
      'Director Agent: Synthesis complete'
    );

    return {
      ...validated,
      unifiedRecommendations: filteredRecommendations,
    };
  } catch (error) {
    directorLogger.error(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'Director Agent: Failed to generate valid synthesis'
    );
    throw new Error('Director Agent failed to generate valid JSON synthesis');
  }
}

/**
 * Apply filtering rules:
 * - If > 10 high/medium recommendations: drop low
 * - If < 5 high/medium: include best low to reach 5-7
 * - Cap at 10 max
 */
function applyRecommendationFiltering(
  recommendations: DirectorOutput['unifiedRecommendations']
): DirectorOutput['unifiedRecommendations'] {
  // Sort by impact priority (high > medium > low)
  const sorted = [...recommendations].sort((a, b) => {
    const priority = { high: 3, medium: 2, low: 1 };
    return priority[b.impact] - priority[a.impact];
  });

  const highMedium = sorted.filter((r) => r.impact !== 'low');
  const low = sorted.filter((r) => r.impact === 'low');

  let result: DirectorOutput['unifiedRecommendations'];

  if (highMedium.length > 10) {
    // More than 10 high/medium: take top 10, drop all low
    result = highMedium.slice(0, 10);
  } else if (highMedium.length >= 5) {
    // 5-10 high/medium: cap at 10
    const remaining = 10 - highMedium.length;
    result = [...highMedium, ...low.slice(0, remaining)];
  } else {
    // < 5 high/medium: include low to reach 5-7
    const target = Math.max(5, Math.min(7, highMedium.length + low.length));
    const lowToInclude = target - highMedium.length;
    result = [...highMedium, ...low.slice(0, lowToInclude)];
  }

  return result.slice(0, 10); // Final cap
}
