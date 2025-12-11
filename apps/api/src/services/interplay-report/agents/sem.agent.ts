/**
 * SEM Agent - AI Analysis of Battleground Keywords
 *
 * Supports skill-based configuration for business-type-aware analysis
 * with token budget management.
 */

import { logger } from '@/utils/logger.js';
import { callGenericAI } from '@/services/ai-analyzer.service.js';
import { semAgentOutputSchema } from '../schemas.js';
import { buildSEMPrompt } from '../prompts/index.js';
import type { EnrichedKeyword, SEMAgentOutput } from '../types.js';
import type { SEMSkillDefinition } from '../skills/types.js';

const semLogger = logger.child({ module: 'sem-agent' });

// ============================================================================
// INPUT/OUTPUT TYPES
// ============================================================================

export interface SEMAgentContext {
  industry?: string;
  targetMarket?: string;
  clientName?: string;
}

export interface SEMAgentInput {
  enrichedKeywords: EnrichedKeyword[];
  skill: SEMSkillDefinition;
  clientContext: SEMAgentContext;
}

export interface SEMAgentOutputWithMeta extends SEMAgentOutput {
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
 * Returns the validated output or null if parsing/validation fails.
 */
function parseAndValidateResponse(
  response: string
): { data: SEMAgentOutput; warning?: string } | { error: string; details?: unknown } {
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
  const validationResult = semAgentOutputSchema.safeParse(parsed);

  if (!validationResult.success) {
    const zodErrors = validationResult.error.errors;

    // Check if this is specifically an empty array issue
    const isEmptyArrayIssue =
      zodErrors.length === 1 &&
      zodErrors[0].path.includes('semActions') &&
      zodErrors[0].code === 'too_small';

    if (isEmptyArrayIssue) {
      // This shouldn't happen now that we removed .min(1), but handle defensively
      return {
        data: { semActions: [] },
        warning: 'AI returned empty semActions array',
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

  // Check for empty results and add warning
  if (validationResult.data.semActions.length === 0) {
    return {
      data: validationResult.data,
      warning: 'AI returned zero SEM actions - data may lack actionable insights',
    };
  }

  return { data: validationResult.data };
}

// ============================================================================
// SEM AGENT
// ============================================================================

/**
 * Run SEM agent with skill configuration.
 * Uses skill-based prompt building and output filtering.
 */
export async function runSEMAgent(input: SEMAgentInput): Promise<SEMAgentOutputWithMeta> {
  const { enrichedKeywords, skill, clientContext } = input;

  semLogger.info(
    {
      keywordCount: enrichedKeywords.length,
      skillVersion: skill.version,
    },
    'SEM Agent: Starting skill-based AI analysis'
  );

  if (enrichedKeywords.length === 0) {
    semLogger.warn('SEM Agent: No keywords to analyze');
    return { semActions: [], skillVersion: skill.version };
  }

  // Build prompt using skill configuration
  const prompt = buildSEMPrompt(enrichedKeywords, {
    skill,
    ...clientContext,
  });

  let response: string;
  try {
    response = await callGenericAI(prompt);
  } catch (error) {
    semLogger.error(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'SEM Agent: AI call failed'
    );
    throw new Error('SEM Agent failed to call AI service');
  }

  const result = parseAndValidateResponse(response);

  if ('error' in result) {
    semLogger.error(
      {
        error: result.error,
        details: result.details,
      },
      'SEM Agent: Failed to parse or validate AI response'
    );
    throw new Error(`SEM Agent failed to generate valid JSON analysis: ${result.error}`);
  }

  // Apply output filtering from skill
  const filteredActions = filterSEMRecommendations(result.data.semActions, skill.output);

  if (result.warning) {
    semLogger.warn(
      {
        warning: result.warning,
        originalCount: result.data.semActions.length,
        filteredCount: filteredActions.length,
      },
      'SEM Agent: Skill-based analysis completed with warning'
    );
  } else {
    semLogger.info(
      {
        originalCount: result.data.semActions.length,
        filteredCount: filteredActions.length,
        skillVersion: skill.version,
      },
      'SEM Agent: Skill-based analysis complete'
    );
  }

  return {
    semActions: filteredActions,
    skillVersion: skill.version,
  };
}

/**
 * Filter SEM recommendations based on skill output configuration.
 */
function filterSEMRecommendations(
  actions: SEMAgentOutput['semActions'],
  outputConfig: SEMSkillDefinition['output']
): SEMAgentOutput['semActions'] {
  let filtered = [...actions];

  // Exclude recommendations matching exclude types
  if (outputConfig.recommendationTypes.exclude.length > 0) {
    filtered = filtered.filter((action) =>
      !outputConfig.recommendationTypes.exclude.some((excludeType) =>
        action.action.toLowerCase().includes(excludeType.toLowerCase())
      )
    );
  }

  // Sort to prioritize certain types
  if (outputConfig.recommendationTypes.prioritize.length > 0) {
    filtered = filtered.sort((a, b) => {
      const aPriority = outputConfig.recommendationTypes.prioritize.findIndex((type) =>
        a.action.toLowerCase().includes(type.toLowerCase())
      );
      const bPriority = outputConfig.recommendationTypes.prioritize.findIndex((type) =>
        b.action.toLowerCase().includes(type.toLowerCase())
      );
      // Items matching priority types come first, then by original order
      const aRank = aPriority === -1 ? 999 : aPriority;
      const bRank = bPriority === -1 ? 999 : bPriority;
      return aRank - bRank;
    });
  }

  // Deprioritize certain types (move to end)
  if (outputConfig.recommendationTypes.deprioritize.length > 0) {
    const deprioritized: typeof filtered = [];
    const regular: typeof filtered = [];

    for (const action of filtered) {
      const isDeprioritized = outputConfig.recommendationTypes.deprioritize.some((type) =>
        action.action.toLowerCase().includes(type.toLowerCase())
      );
      if (isDeprioritized) {
        deprioritized.push(action);
      } else {
        regular.push(action);
      }
    }

    filtered = [...regular, ...deprioritized];
  }

  // Limit to max recommendations
  return filtered.slice(0, outputConfig.maxRecommendations);
}

