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

  if (result.warning) {
    seoLogger.warn(
      { warning: result.warning, actionCount: result.data.seoActions.length },
      'SEO Agent: Analysis completed with warning'
    );
  } else {
    seoLogger.info(
      { actionCount: result.data.seoActions.length },
      'SEO Agent: Analysis complete'
    );
  }

  return result.data;
}
