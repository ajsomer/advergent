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

/**
 * Extracts JSON from an AI response that may contain markdown fences or leading prose.
 * Returns the extracted JSON string or null if no valid JSON structure is found.
 */
function extractJsonFromResponse(response: string): string | null {
  if (!response || typeof response !== 'string') {
    return null;
  }

  const trimmed = response.trim();

  // Try markdown code block extraction first (```json ... ``` or ``` ... ```)
  const markdownMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (markdownMatch) {
    const extracted = markdownMatch[1].trim();
    if (extracted.startsWith('{') || extracted.startsWith('[')) {
      return extracted;
    }
  }

  // Try to find a JSON object in the response
  const jsonObjectMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    return jsonObjectMatch[0];
  }

  // Try to find a JSON array in the response
  const jsonArrayMatch = trimmed.match(/\[[\s\S]*\]/);
  if (jsonArrayMatch) {
    return jsonArrayMatch[0];
  }

  return null;
}

/**
 * Safely parses and validates the AI response, with detailed error logging.
 * Returns the validated output or an error object.
 */
function parseAndValidateResponse(
  response: string
): { data: DirectorOutput; warning?: string } | { error: string; details?: unknown } {
  // Extract JSON from the response
  const jsonString = extractJsonFromResponse(response);

  if (!jsonString) {
    return {
      error: 'No JSON structure found in response',
      details: {
        responsePreview: response.slice(0, 500),
        responseLength: response.length,
      },
    };
  }

  // Attempt to parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (parseError) {
    return {
      error: 'JSON parse error',
      details: {
        parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error',
        jsonPreview: jsonString.slice(0, 500),
        jsonLength: jsonString.length,
      },
    };
  }

  // Validate against schema
  const validationResult = directorOutputSchema.safeParse(parsed);

  if (!validationResult.success) {
    const zodErrors = validationResult.error.errors;

    // Check if this is specifically an empty recommendations array issue
    const isEmptyRecsIssue =
      zodErrors.length === 1 &&
      zodErrors[0].path.includes('unifiedRecommendations') &&
      zodErrors[0].code === 'too_small';

    if (isEmptyRecsIssue) {
      // Handle empty results gracefully - create fallback output
      return {
        data: {
          executiveSummary: {
            summary: 'Analysis completed but no specific recommendations were generated. The account may already be well-optimized or additional data may be needed.',
            keyHighlights: ['Analysis completed', 'No urgent optimizations identified'],
          },
          unifiedRecommendations: [],
        },
        warning: 'AI returned empty unifiedRecommendations array',
      };
    }

    return {
      error: 'Zod validation failed',
      details: {
        zodErrors: zodErrors.map((e) => ({
          path: e.path.join('.'),
          code: e.code,
          message: e.message,
        })),
        parsedPreview: JSON.stringify(parsed).slice(0, 500),
      },
    };
  }

  return { data: validationResult.data };
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

  let response: string;
  try {
    response = await callGenericAI(prompt);
  } catch (error) {
    directorLogger.error(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'Director Agent: AI call failed'
    );
    throw new Error('Director Agent failed to call AI service');
  }

  const result = parseAndValidateResponse(response);

  if ('error' in result) {
    directorLogger.error(
      {
        error: result.error,
        details: result.details,
      },
      'Director Agent: Failed to parse or validate AI response'
    );
    throw new Error(`Director Agent failed to generate valid JSON synthesis: ${result.error}`);
  }

  // Apply final filtering to ensure max 10 recommendations
  const filteredRecommendations = applyRecommendationFiltering(
    result.data.unifiedRecommendations
  );

  if (result.warning) {
    directorLogger.warn(
      { warning: result.warning, recommendationCount: filteredRecommendations.length },
      'Director Agent: Synthesis completed with warning'
    );
  } else {
    directorLogger.info(
      {
        originalCount: result.data.unifiedRecommendations.length,
        filteredCount: filteredRecommendations.length,
      },
      'Director Agent: Synthesis complete'
    );
  }

  return {
    ...result.data,
    unifiedRecommendations: filteredRecommendations,
  };
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
