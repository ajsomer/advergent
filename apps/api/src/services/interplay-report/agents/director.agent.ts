/**
 * Director Agent - Strategy Synthesis
 *
 * Combines SEM and SEO agent outputs into a unified executive report
 * with prioritized, deduplicated recommendations.
 *
 * Supports skill-based configuration for business-type-aware synthesis
 * and filtering rules.
 */

import { logger } from '@/utils/logger.js';
import { callGenericAI } from '@/services/ai-analyzer.service.js';
import { directorOutputSchema } from '../schemas.js';
import { buildDirectorPrompt } from '../prompts/index.js';
import type { SEMAgentOutput, SEOAgentOutput, DirectorOutput } from '../types.js';
import type { DirectorSkillDefinition } from '../skills/types.js';

const directorLogger = logger.child({ module: 'director-agent' });

// ============================================================================
// INPUT/OUTPUT TYPES
// ============================================================================

export interface DirectorAgentContext {
  industry?: string;
  targetMarket?: string;
  clientName?: string;
}

export interface DirectorAgentInput {
  semOutput: SEMAgentOutput;
  seoOutput: SEOAgentOutput;
  skill: DirectorSkillDefinition;
  clientContext: DirectorAgentContext;
}

export interface DirectorOutputWithMeta extends DirectorOutput {
  skillVersion?: string;
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

// ============================================================================
// DIRECTOR AGENT
// ============================================================================

/**
 * Run Director agent with skill configuration.
 * Uses skill-based prompt building and filtering rules.
 */
export async function runDirectorAgent(input: DirectorAgentInput): Promise<DirectorOutputWithMeta> {
  const { semOutput, seoOutput, skill, clientContext } = input;

  directorLogger.info(
    {
      semActionCount: semOutput.semActions.length,
      seoActionCount: seoOutput.seoActions.length,
      skillVersion: skill.version,
    },
    'Director Agent: Starting skill-based synthesis'
  );

  // Handle edge case where both agents have no recommendations
  if (semOutput.semActions.length === 0 && seoOutput.seoActions.length === 0) {
    directorLogger.warn('Director Agent: No recommendations to synthesize');
    return {
      executiveSummary: {
        summary: 'No significant optimization opportunities were identified in the current data. This may indicate the account is well-optimized or that additional data is needed for analysis.',
        keyHighlights: ['No urgent issues detected', 'Consider expanding data sources'],
      },
      unifiedRecommendations: [],
      skillVersion: skill.version,
    };
  }

  // Build prompt using skill configuration
  const prompt = buildDirectorPrompt(semOutput, seoOutput, {
    skill,
    ...clientContext,
  });

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

  // Apply skill-based filtering
  const filteredRecommendations = applySkillBasedFiltering(
    result.data.unifiedRecommendations,
    skill.filtering
  );

  if (result.warning) {
    directorLogger.warn(
      {
        warning: result.warning,
        originalCount: result.data.unifiedRecommendations.length,
        filteredCount: filteredRecommendations.length,
      },
      'Director Agent: Skill-based synthesis completed with warning'
    );
  } else {
    directorLogger.info(
      {
        originalCount: result.data.unifiedRecommendations.length,
        filteredCount: filteredRecommendations.length,
        skillVersion: skill.version,
      },
      'Director Agent: Skill-based synthesis complete'
    );
  }

  return {
    ...result.data,
    unifiedRecommendations: filteredRecommendations,
    skillVersion: skill.version,
  };
}

/**
 * Apply skill-based filtering to recommendations.
 */
function applySkillBasedFiltering(
  recommendations: DirectorOutput['unifiedRecommendations'],
  filterConfig: DirectorSkillDefinition['filtering']
): DirectorOutput['unifiedRecommendations'] {
  let filtered = [...recommendations];

  // Separate must-include recommendations
  const mustIncludeRecs = filtered.filter((rec) =>
    filterConfig.mustInclude.some(
      (includeType) =>
        rec.type.toLowerCase().includes(includeType.toLowerCase()) ||
        rec.title.toLowerCase().includes(includeType.toLowerCase())
    )
  );

  // Exclude recommendations matching mustExclude patterns
  if (filterConfig.mustExclude.length > 0) {
    filtered = filtered.filter(
      (rec) =>
        !filterConfig.mustExclude.some(
          (excludeType) =>
            rec.type.toLowerCase().includes(excludeType.toLowerCase()) ||
            rec.title.toLowerCase().includes(excludeType.toLowerCase()) ||
            rec.description.toLowerCase().includes(excludeType.toLowerCase())
        )
    );
  }

  // Filter by minimum impact threshold
  const impactPriority: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const minImpactValue = impactPriority[filterConfig.minImpactThreshold] ?? 0;

  filtered = filtered.filter((rec) => {
    const recImpactValue = impactPriority[rec.impact] ?? 0;
    return recImpactValue >= minImpactValue;
  });

  // Sort by weighted impact score
  const { impactWeights } = filterConfig;
  filtered = filtered.sort((a, b) => {
    const aScore = calculateWeightedScore(a, impactWeights);
    const bScore = calculateWeightedScore(b, impactWeights);
    return bScore - aScore;
  });

  // Ensure must-includes are present (add back if filtered out)
  for (const must of mustIncludeRecs) {
    if (!filtered.includes(must)) {
      filtered.unshift(must);
    }
  }

  // Limit to max recommendations
  return filtered.slice(0, filterConfig.maxRecommendations);
}

/**
 * Calculate weighted score for a recommendation.
 */
function calculateWeightedScore(
  rec: DirectorOutput['unifiedRecommendations'][0],
  weights: DirectorSkillDefinition['filtering']['impactWeights']
): number {
  const impactScore = { high: 3, medium: 2, low: 1 }[rec.impact] ?? 0;
  const effortScore = { low: 3, medium: 2, high: 1 }[rec.effort] ?? 0; // Inverted - low effort is better

  // Higher impact and lower effort = higher score
  // Use revenue weight for impact, effort weight for effort
  return impactScore * weights.revenue + effortScore * weights.effort;
}

