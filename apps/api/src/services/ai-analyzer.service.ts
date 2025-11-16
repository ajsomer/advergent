import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { z } from 'zod';
import { logger } from '@/utils/logger.js';
import { config } from '@/config/index.js';
import type { QueryOverlap } from './query-matcher.service.js';

export const aiLogger = logger.child({ module: 'ai-analyzer' });

/**
 * Zod schema for AI recommendation response validation
 */
export const recommendationSchema = z.object({
  recommendation_type: z.enum(['reduce', 'pause', 'increase', 'maintain']),
  confidence_level: z.enum(['high', 'medium', 'low']),
  current_monthly_spend: z.number().min(0),
  recommended_monthly_spend: z.number().min(0),
  estimated_monthly_savings: z.number(),
  reasoning: z.string().min(10).max(500),
  key_factors: z.array(z.string()).min(1).max(5),
});

export type Recommendation = z.infer<typeof recommendationSchema>;

/**
 * Optional client context to enhance AI analysis
 */
export interface ClientContext {
  industry?: string;
  targetMarket?: string;
  averageCpc?: number;
  competitiveLevel?: 'low' | 'medium' | 'high';
}

/**
 * Build the analysis prompt for AI models
 */
function buildAnalysisPrompt(overlap: QueryOverlap, clientContext?: ClientContext): string {
  const { queryText, googleAds, searchConsole } = overlap;

  let contextSection = '';
  if (clientContext) {
    contextSection = `
Client Context:
${clientContext.industry ? `- Industry: ${clientContext.industry}` : ''}
${clientContext.targetMarket ? `- Target Market: ${clientContext.targetMarket}` : ''}
${clientContext.averageCpc ? `- Average CPC: $${clientContext.averageCpc.toFixed(2)}` : ''}
${clientContext.competitiveLevel ? `- Competitive Level: ${clientContext.competitiveLevel}` : ''}
`;
  }

  return `You are an expert SEO/PPC analyst. Analyze this query overlap data and provide a recommendation.

Query: "${queryText}"
${contextSection}
Google Ads Data:
- CPC: $${googleAds.cpc.toFixed(2)}
- Monthly Spend: $${googleAds.spend.toFixed(2)}
- Clicks: ${googleAds.clicks}
- Conversions: ${googleAds.conversions}
- Conversion Value: $${googleAds.conversionValue.toFixed(2)}
- Position: Paid ads (top of SERP)

Search Console Data:
- Organic Position: ${searchConsole.position.toFixed(1)}
- CTR: ${(searchConsole.ctr * 100).toFixed(2)}%
- Impressions: ${searchConsole.impressions}
- Clicks: ${searchConsole.clicks}

Consider:
1. Competitive dynamics (is this a competitive keyword?)
2. SERP features (are there shopping results, featured snippets?)
3. Conversion quality (are paid clicks converting better?)
4. User intent (transactional vs informational)
5. Organic ranking strength (position 1-3 vs 4-10)

Provide a recommendation in JSON format:
{
  "recommendation_type": "reduce" | "pause" | "increase" | "maintain",
  "confidence_level": "high" | "medium" | "low",
  "current_monthly_spend": number,
  "recommended_monthly_spend": number,
  "estimated_monthly_savings": number,
  "reasoning": "string (2-3 sentences)",
  "key_factors": ["factor1", "factor2", "factor3"]
}`;
}

/**
 * Analyze query overlap using Anthropic Claude
 */
async function analyzeWithAnthropic(
  prompt: string,
  retryCount: number = 0
): Promise<Recommendation> {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second

  try {
    const anthropic = new Anthropic({
      apiKey: config.anthropicApiKey,
    });

    aiLogger.info(
      {
        provider: 'anthropic',
        model: config.anthropicModel,
        attempt: retryCount + 1,
      },
      'Calling Anthropic API'
    );

    const message = await anthropic.messages.create({
      model: config.anthropicModel,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    aiLogger.debug({ responseText }, 'Received Anthropic response');

    // Parse and validate JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validated = recommendationSchema.parse(parsed);

    return validated;
  } catch (error) {
    aiLogger.error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        attempt: retryCount + 1,
        maxRetries,
      },
      'Anthropic API call failed'
    );

    if (retryCount < maxRetries) {
      const delay = baseDelay * Math.pow(2, retryCount);
      aiLogger.info({ delay, attempt: retryCount + 2 }, 'Retrying Anthropic API call');
      await new Promise(resolve => setTimeout(resolve, delay));
      return analyzeWithAnthropic(prompt, retryCount + 1);
    }

    throw error;
  }
}

/**
 * Analyze query overlap using OpenAI
 */
async function analyzeWithOpenAI(
  prompt: string,
  retryCount: number = 0
): Promise<Recommendation> {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second

  try {
    const openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });

    aiLogger.info(
      {
        provider: 'openai',
        model: config.openaiModel,
        attempt: retryCount + 1,
      },
      'Calling OpenAI API'
    );

    const completion = await openai.chat.completions.create({
      model: config.openaiModel,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '';

    aiLogger.debug({ responseText }, 'Received OpenAI response');

    const parsed = JSON.parse(responseText);
    const validated = recommendationSchema.parse(parsed);

    return validated;
  } catch (error) {
    aiLogger.error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        attempt: retryCount + 1,
        maxRetries,
      },
      'OpenAI API call failed'
    );

    if (retryCount < maxRetries) {
      const delay = baseDelay * Math.pow(2, retryCount);
      aiLogger.info({ delay, attempt: retryCount + 2 }, 'Retrying OpenAI API call');
      await new Promise(resolve => setTimeout(resolve, delay));
      return analyzeWithOpenAI(prompt, retryCount + 1);
    }

    throw error;
  }
}

/**
 * Main function to analyze query overlap using configured AI provider
 */
export async function analyzeQueryOverlap(
  overlap: QueryOverlap,
  clientContext?: ClientContext
): Promise<Recommendation> {
  const prompt = buildAnalysisPrompt(overlap, clientContext);

  aiLogger.info(
    {
      provider: config.aiProvider,
      model: config.aiProvider === 'anthropic'
        ? config.anthropicModel
        : config.openaiModel,
      query: overlap.queryText,
      spend: overlap.googleAds.spend,
      position: overlap.searchConsole.position,
    },
    'Starting AI analysis'
  );

  try {
    let recommendation: Recommendation;

    if (config.aiProvider === 'anthropic') {
      recommendation = await analyzeWithAnthropic(prompt);
    } else if (config.aiProvider === 'openai') {
      recommendation = await analyzeWithOpenAI(prompt);
    } else {
      throw new Error(`Unknown AI provider: ${config.aiProvider}`);
    }

    aiLogger.info(
      {
        query: overlap.queryText,
        recommendationType: recommendation.recommendation_type,
        confidence: recommendation.confidence_level,
        savings: recommendation.estimated_monthly_savings,
      },
      'AI analysis complete'
    );

    return recommendation;
  } catch (error) {
    aiLogger.error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: overlap.queryText,
      },
      'AI analysis failed'
    );
    throw error;
  }
}

/**
 * Batch analyze multiple query overlaps with rate limiting
 */
export async function analyzeBatchQueryOverlaps(
  overlaps: QueryOverlap[],
  clientContext?: ClientContext,
  options?: {
    batchSize?: number;
    delayMs?: number;
  }
): Promise<Map<string, Recommendation | Error>> {
  const { batchSize = 5, delayMs = 1000 } = options || {};
  const results = new Map<string, Recommendation | Error>();

  aiLogger.info(
    {
      totalOverlaps: overlaps.length,
      batchSize,
      delayMs,
    },
    'Starting batch analysis'
  );

  for (let i = 0; i < overlaps.length; i += batchSize) {
    const batch = overlaps.slice(i, i + batchSize);

    const batchResults = await Promise.allSettled(
      batch.map(overlap => analyzeQueryOverlap(overlap, clientContext))
    );

    batchResults.forEach((result, index) => {
      const overlap = batch[index];
      if (result.status === 'fulfilled') {
        results.set(overlap.queryHash, result.value);
      } else {
        results.set(overlap.queryHash, result.reason);
      }
    });

    // Add delay between batches to respect rate limits
    if (i + batchSize < overlaps.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  aiLogger.info(
    {
      totalAnalyzed: results.size,
      successful: Array.from(results.values()).filter(r => !(r instanceof Error)).length,
      failed: Array.from(results.values()).filter(r => r instanceof Error).length,
    },
    'Batch analysis complete'
  );

  return results;
}
