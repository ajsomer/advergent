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

  if (result.warning) {
    semLogger.warn(
      { warning: result.warning, actionCount: result.data.semActions.length },
      'SEM Agent: Analysis completed with warning'
    );
  } else {
    semLogger.info(
      { actionCount: result.data.semActions.length },
      'SEM Agent: Analysis complete'
    );
  }

  return result.data;
}
