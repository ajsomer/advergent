/**
 * SEO Agent - AI Analysis of Critical Pages
 *
 * Supports skill-based configuration for business-type-aware analysis
 * with token budget management.
 */

import { logger } from '@/utils/logger.js';
import { callGenericAI } from '@/services/ai-analyzer.service.js';
import { seoAgentOutputSchema } from '../schemas.js';
import { buildSEOPrompt } from '../prompts/index.js';
import type { EnrichedPage, SEOAgentOutput } from '../types.js';
import type { SEOSkillDefinition } from '../skills/types.js';

const seoLogger = logger.child({ module: 'seo-agent' });

// ============================================================================
// INPUT/OUTPUT TYPES
// ============================================================================

export interface SEOAgentContext {
  industry?: string;
  targetMarket?: string;
  clientName?: string;
}

export interface SEOAgentInput {
  enrichedPages: EnrichedPage[];
  skill: SEOSkillDefinition;
  clientContext: SEOAgentContext;
}

export interface SEOAgentOutputWithMeta extends SEOAgentOutput {
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
): { data: SEOAgentOutput; warning?: string } | { error: string; details?: unknown } {
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
  const validationResult = seoAgentOutputSchema.safeParse(parsed);

  if (!validationResult.success) {
    const zodErrors = validationResult.error.errors;

    // Check if this is specifically an empty array issue
    const isEmptyArrayIssue =
      zodErrors.length === 1 &&
      zodErrors[0].path.includes('seoActions') &&
      zodErrors[0].code === 'too_small';

    if (isEmptyArrayIssue) {
      // Handle empty results gracefully
      return {
        data: { seoActions: [] },
        warning: 'AI returned empty seoActions array',
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
  if (validationResult.data.seoActions.length === 0) {
    return {
      data: validationResult.data,
      warning: 'AI returned zero SEO actions - data may lack actionable insights',
    };
  }

  return { data: validationResult.data };
}

// ============================================================================
// SEO AGENT
// ============================================================================

/**
 * Run SEO agent with skill configuration.
 * Uses skill-based prompt building and output filtering.
 */
export async function runSEOAgent(input: SEOAgentInput): Promise<SEOAgentOutputWithMeta> {
  const { enrichedPages, skill, clientContext } = input;

  seoLogger.info(
    {
      pageCount: enrichedPages.length,
      skillVersion: skill.version,
    },
    'SEO Agent: Starting skill-based AI analysis'
  );

  if (enrichedPages.length === 0) {
    seoLogger.warn('SEO Agent: No pages to analyze');
    return { seoActions: [], skillVersion: skill.version };
  }

  // Build prompt using skill configuration
  const prompt = buildSEOPrompt(enrichedPages, {
    skill,
    ...clientContext,
  });

  let response: string;
  try {
    response = await callGenericAI(prompt);
  } catch (error) {
    seoLogger.error(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'SEO Agent: AI call failed'
    );
    throw new Error('SEO Agent failed to call AI service');
  }

  const result = parseAndValidateResponse(response);

  if ('error' in result) {
    seoLogger.error(
      {
        error: result.error,
        details: result.details,
      },
      'SEO Agent: Failed to parse or validate AI response'
    );
    throw new Error(`SEO Agent failed to generate valid JSON analysis: ${result.error}`);
  }

  // Apply output filtering from skill
  const filteredActions = filterSEORecommendations(result.data.seoActions, skill.output);

  if (result.warning) {
    seoLogger.warn(
      {
        warning: result.warning,
        originalCount: result.data.seoActions.length,
        filteredCount: filteredActions.length,
      },
      'SEO Agent: Skill-based analysis completed with warning'
    );
  } else {
    seoLogger.info(
      {
        originalCount: result.data.seoActions.length,
        filteredCount: filteredActions.length,
        skillVersion: skill.version,
      },
      'SEO Agent: Skill-based analysis complete'
    );
  }

  return {
    seoActions: filteredActions,
    skillVersion: skill.version,
  };
}

/**
 * Filter SEO recommendations based on skill output configuration.
 */
function filterSEORecommendations(
  actions: SEOAgentOutput['seoActions'],
  outputConfig: SEOSkillDefinition['output']
): SEOAgentOutput['seoActions'] {
  let filtered = [...actions];

  // Exclude recommendations matching exclude types
  if (outputConfig.recommendationTypes.exclude.length > 0) {
    filtered = filtered.filter((action) =>
      !outputConfig.recommendationTypes.exclude.some((excludeType) =>
        action.recommendation.toLowerCase().includes(excludeType.toLowerCase()) ||
        action.condition.toLowerCase().includes(excludeType.toLowerCase())
      )
    );
  }

  // Sort to prioritize certain types
  if (outputConfig.recommendationTypes.prioritize.length > 0) {
    filtered = filtered.sort((a, b) => {
      const aPriority = outputConfig.recommendationTypes.prioritize.findIndex((type) =>
        a.recommendation.toLowerCase().includes(type.toLowerCase())
      );
      const bPriority = outputConfig.recommendationTypes.prioritize.findIndex((type) =>
        b.recommendation.toLowerCase().includes(type.toLowerCase())
      );
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
        action.recommendation.toLowerCase().includes(type.toLowerCase())
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

