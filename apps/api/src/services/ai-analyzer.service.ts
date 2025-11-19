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
 * Zod schema for Search Console analysis response validation
 */
export const searchConsoleAnalysisSchema = z.object({
  summary: z.string().min(10),
  key_trends: z.array(z.string()).min(1),
  opportunities: z.array(z.object({
    query: z.string(),
    type: z.enum(['quick_win', 'high_potential', 'underperforming']),
    potential_impact: z.enum(['high', 'medium', 'low']),
    action: z.string()
  })).min(1),
  strategic_advice: z.string().min(10),
  content_analysis: z.object({
    score: z.number().min(0).max(100),
    gaps: z.array(z.string()),
    suggestions: z.array(z.string())
  }).optional()
});

export type SearchConsoleAnalysis = z.infer<typeof searchConsoleAnalysisSchema>;

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

  // Build landing page insights section if available
  let landingPageSection = '';
  if ('landingPageInsights' in overlap && Array.isArray(overlap.landingPageInsights) && overlap.landingPageInsights.length > 0) {
    landingPageSection = `\n\nLanding Page Engagement (GA4 Organic Traffic):`;

    for (const insight of overlap.landingPageInsights) {
      const ga4Data = insight.ga4Metrics[0]; //  Use most recent
      if (ga4Data) {
        landingPageSection += `\n\nPage: ${insight.page}
- Search Console Performance:
  * Organic Position: ${insight.scMetrics.position.toFixed(1)}
  * CTR: ${(insight.scMetrics.ctr * 100).toFixed(2)}%
  * Impressions: ${insight.scMetrics.impressions}
  * Clicks: ${insight.scMetrics.clicks}
- GA4 Organic Engagement:
  * Sessions: ${ga4Data.sessions}
  * Engagement Rate: ${(ga4Data.engagementRate * 100).toFixed(1)}%
  * Bounce Rate: ${(ga4Data.bounceRate * 100).toFixed(1)}%
  * Avg Session Duration: ${ga4Data.avgSessionDuration.toFixed(0)}s
  * Conversions: ${ga4Data.conversions}
  * Revenue: $${ga4Data.revenue.toFixed(2)}`;
      }
    }
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
- Clicks: ${searchConsole.clicks}${landingPageSection}

Consider:
1. Competitive dynamics (is this a competitive keyword?)
2. SERP features (are there shopping results, featured snippets?)
3. Conversion quality (are paid clicks converting better?)
4. User intent (transactional vs informational)
5. Organic ranking strength (position 1-3 vs 4-10)
${landingPageSection ? '6. Landing page engagement quality (bounce rate, session duration, conversion rate from organic traffic)\n7. Organic vs Paid performance comparison (does organic traffic convert better?)' : ''}

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
 * Build the analysis prompt for Search Console data
 */
function buildSearchConsolePrompt(
  data: {
    queries: any[];
    totalQueries: number;
    dateRange: { startDate: string; endDate: string };
    queriesByLandingPage?: Array<{
      page: string;
      queries: any[];
      totalImpressions: number;
      totalClicks: number;
      ga4Metrics?: {
        sessions: number;
        engagementRate: number;
        bounceRate: number;
        conversions: number;
        revenue: number;
      };
    }>;
  },
  clientContext?: ClientContext,
  pageAnalysis?: {
    url: string;
    content: string;
  }
): string {
  let contextSection = '';
  if (clientContext) {
    contextSection = `
Client Context:
${clientContext.industry ? `- Industry: ${clientContext.industry}` : ''}
${clientContext.targetMarket ? `- Target Market: ${clientContext.targetMarket}` : ''}
${clientContext.competitiveLevel ? `- Competitive Level: ${clientContext.competitiveLevel}` : ''}
`;
  }

  // Format top queries with GA4 engagement data if available
  const topQueries = data.queries.slice(0, 20).map(q => {
    let baseInfo = `- \"${q.query}\": ${q.clicks} clicks, ${q.impressions} impr, ${q.ctr.toFixed(2)}% CTR, Pos ${q.position.toFixed(1)}`;
    if (q.ga4Engagement) {
      baseInfo += ` | GA4: ${(q.ga4Engagement.engagementRate * 100).toFixed(1)}% engagement, ${(q.ga4Engagement.bounceRate * 100).toFixed(1)}% bounce, ${q.ga4Engagement.conversions.toFixed(1)} conversions`;
    }
    return baseInfo;
  }).join('\n');

  // Build landing page performance section
  let landingPageSection = '';
  if (data.queriesByLandingPage && data.queriesByLandingPage.length > 0) {
    landingPageSection = `\n\nLanding Page Performance (GSC + GA4 Correlation):\n`;

    const topPages = data.queriesByLandingPage
      .sort((a, b) => b.totalClicks - a.totalClicks)
      .slice(0, 10);

    for (const pageData of topPages) {
      landingPageSection += `\nPage: ${pageData.page}
- Search Console: ${pageData.totalClicks} clicks, ${pageData.totalImpressions} impressions
- Number of ranking queries: ${pageData.queries.length}
- Top queries: ${pageData.queries.slice(0, 3).map(q => `"${q.query}" (pos ${q.position.toFixed(1)})`).join(', ')}`;

      if (pageData.ga4Metrics) {
        const ga4 = pageData.ga4Metrics;
        landingPageSection += `
- GA4 Organic Engagement:
  * Sessions: ${ga4.sessions}
  * Engagement Rate: ${(ga4.engagementRate * 100).toFixed(1)}%
  * Bounce Rate: ${(ga4.bounceRate * 100).toFixed(1)}%
  * Conversions: ${ga4.conversions.toFixed(1)}
  * Revenue: $${ga4.revenue.toFixed(2)}`;

        // Add performance indicator
        if (ga4.engagementRate < 0.3) {
          landingPageSection += `\n  ⚠️ Low engagement - content quality issue`;
        } else if (ga4.bounceRate > 0.7) {
          landingPageSection += `\n  ⚠️ High bounce rate - user experience issue`;
        } else if (ga4.conversions > 0 && ga4.engagementRate > 0.5) {
          landingPageSection += `\n  ✅ Strong performing page`;
        }
      } else {
        landingPageSection += `\n- GA4 Data: Not available`;
      }
    }
  }

  return `You are an expert SEO analyst. Analyze this Search Console data correlated with GA4 engagement metrics and provide strategic insights.

${contextSection}

Data Summary:
- Date Range: ${data.dateRange.startDate} to ${data.dateRange.endDate}
- Total Queries Analyzed: ${data.totalQueries}
${data.queriesByLandingPage ? `- Landing Pages Analyzed: ${data.queriesByLandingPage.length}` : ''}

Top Performing Queries (with GA4 Engagement):
${topQueries}
${landingPageSection}

${pageAnalysis ? `
Landing Page Content Analysis:
URL: ${pageAnalysis.url}
Content Preview:
"${pageAnalysis.content}"

Evaluate how well the content above matches the search queries.
` : ''}

Analyze the data to identify:
1. **Ranking Improvements**: Queries at position 4-10 that could reach top 3 with optimization
2. **CTR Optimization**: Queries with good position but low CTR (title/meta needs work)
3. **Content Quality Issues**: Queries driving traffic but poor engagement (high bounce, low session duration)
4. **Conversion Opportunities**: Pages with good traffic and engagement but low conversions
5. **Quick Wins**: Easy improvements with high impact potential
6. **Landing Page Issues**: Pages ranking for multiple queries but with poor GA4 engagement

Consider GA4 metrics to identify:
- Pages with good rankings but poor user engagement → Content quality problem
- Queries with traffic but high bounce rates → Intent mismatch or UX issues
- Pages with strong engagement but limited visibility → Expansion opportunity

IMPORTANT: Return ONLY valid JSON without any markdown formatting or code blocks. Do not wrap your response in backtick code blocks.

Provide an analysis in this exact JSON format:
{
  "summary": "Executive summary highlighting key insights from both GSC and GA4 data (2-3 sentences)",
  "key_trends": ["trend1 focusing on engagement correlation", "trend2", "trend3"],
  "opportunities": [
    {
      "query": "specific query or landing page",
      "type": "quick_win" | "high_potential" | "underperforming",
      "potential_impact": "high" | "medium" | "low",
      "action": "specific action considering both ranking AND engagement metrics"
    }
  ],
  "strategic_advice": "High-level strategic advice based on the correlated GSC+GA4 data (2-3 sentences)",
  "content_analysis": {
    "score": 0-100,
    "gaps": ["engagement issues", "content gaps", "UX problems"],
    "suggestions": ["ranking improvements", "engagement optimizations", "conversion enhancements"]
  }
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
 * Analyze Search Console data using configured AI provider
 */
export async function analyzeSearchConsoleData(
  data: {
    queries: any[];
    totalQueries: number;
    dateRange: { startDate: string; endDate: string };
  },
  clientContext?: ClientContext,
  pageAnalysis?: {
    url: string;
    content: string;
  }
): Promise<SearchConsoleAnalysis> {
  const prompt = buildSearchConsolePrompt(data, clientContext, pageAnalysis);

  aiLogger.info(
    {
      provider: config.aiProvider,
      queryCount: data.queries.length,
    },
    'Starting Search Console AI analysis'
  );

  try {
    let analysis: SearchConsoleAnalysis;
    const maxRetries = 3;
    const baseDelay = 1000;

    const executeAnalysis = async (retryCount: number = 0): Promise<SearchConsoleAnalysis> => {
      const startTime = Date.now();
      try {
        let responseText = '';

        aiLogger.info({ promptLength: prompt.length, promptPreview: prompt.slice(0, 200) + '...' }, 'Sending prompt to AI');

        if (config.aiProvider === 'anthropic') {
          if (!config.anthropicApiKey) throw new Error('Anthropic API key not configured');
          const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
          const message = await anthropic.messages.create({
            model: config.anthropicModel,
            max_tokens: 4096, // Increased for comprehensive Search Console analysis
            messages: [{ role: 'user', content: prompt }],
          });
          responseText = message.content[0].type === 'text' ? message.content[0].text : '';
        } else {
          if (!config.openaiApiKey) throw new Error('OpenAI API key not configured');
          const openai = new OpenAI({ apiKey: config.openaiApiKey });
          const completion = await openai.chat.completions.create({
            model: config.openaiModel,
            max_tokens: 4096, // Increased for comprehensive Search Console analysis
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
          });
          responseText = completion.choices[0]?.message?.content || '';
        }

        const duration = Date.now() - startTime;
        aiLogger.info({ durationMs: duration, responseLength: responseText.length, responsePreview: responseText.slice(0, 200) + '...' }, 'Received AI response');

        // Parse and validate - handle both markdown wrapped and raw JSON
        let jsonText = responseText;

        // Remove markdown code blocks if present
        const markdownMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (markdownMatch) {
          jsonText = markdownMatch[1];
          aiLogger.debug('Extracted JSON from markdown code block');
        } else {
          // Try to find JSON object in the response
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonText = jsonMatch[0];
          }
        }

        if (!jsonText || (!jsonText.trim().startsWith('{') && !jsonText.trim().startsWith('['))) {
          aiLogger.error({ responseText: responseText.slice(0, 500) }, 'No valid JSON found in response');
          throw new Error('No JSON found in response');
        }

        const parsed = JSON.parse(jsonText);
        return searchConsoleAnalysisSchema.parse(parsed);

      } catch (error) {
        const duration = Date.now() - startTime;
        aiLogger.warn({
          error: error instanceof Error ? error.message : 'Unknown error',
          attempt: retryCount + 1,
          durationMs: duration,
          errorType: error instanceof SyntaxError ? 'JSON_PARSE_ERROR' : 'OTHER'
        }, 'AI analysis attempt failed');
        if (retryCount < maxRetries) {
          const delay = baseDelay * Math.pow(2, retryCount);
          await new Promise(resolve => setTimeout(resolve, delay));
          return executeAnalysis(retryCount + 1);
        }
        throw error;
      }
    };

    analysis = await executeAnalysis();

    aiLogger.info({ summary: analysis.summary }, 'Search Console AI analysis complete');
    return analysis;

  } catch (error) {
    aiLogger.error(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'Search Console AI analysis failed'
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
