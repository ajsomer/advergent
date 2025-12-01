import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { z } from 'zod';
import { logger } from '@/utils/logger.js';
import { config } from '@/config/index.js';
import type { QueryOverlap } from './query-matcher.service.js';
import { SemAgent } from './analysis-agents/sem-agent.js';
import { SeoAgent } from './analysis-agents/seo-agent.js';
import { StrategyAgent } from './analysis-agents/strategy-agent.js';
import { InterplayData, AgentContext, StrategyAnalysis, QueryData, GA4PageMetrics } from './analysis-agents/types.js';
import { GoogleAdsQuery } from './google-ads.service.js';
import { SearchConsoleQuery } from './search-console.service.js';
import { GA4LandingPageMetric } from './ga4.service.js';

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
 * Zod schema for landing page-grouped analysis (new structured format)
 */
export const queryRecommendationSchema = z.object({
  query: z.string(),
  currentPosition: z.number(),
  impressions: z.number(),
  clicks: z.number(),
  ctr: z.number(),
  type: z.enum(['quick_win', 'high_potential', 'underperforming', 'maintain']),
  potentialImpact: z.enum(['high', 'medium', 'low', 'very_high', 'critical']),
  action: z.string(),
  reasoning: z.string()
});

export const pageIssueSchema = z.object({
  category: z.enum(['content', 'ux', 'engagement', 'conversion', 'seo']),
  priority: z.enum(['high', 'medium', 'low', 'very_high', 'critical']),
  issue: z.string(),
  action: z.string()
});

export const landingPageRecommendationSchema = z.object({
  page: z.string(),
  pageScore: z.number().min(0).max(100),
  totalImpressions: z.number(),
  totalClicks: z.number(),
  ga4Metrics: z.object({
    sessions: z.number(),
    engagementRate: z.number(),
    bounceRate: z.number(),
    conversions: z.number(),
    revenue: z.number()
  }).optional(),
  queryRecommendations: z.array(queryRecommendationSchema),
  pageRecommendations: z.array(pageIssueSchema)
});

export const groupedSearchConsoleAnalysisSchema = z.object({
  summary: z.string().min(10),
  overallTrends: z.array(z.string()).min(1),
  landingPageAnalysis: z.array(landingPageRecommendationSchema),
  topQuickWins: z.array(z.object({
    page: z.string(),
    query: z.string(),
    action: z.string(),
    estimatedImpact: z.string()
  })).max(10),
  strategicAdvice: z.string().min(10)
});

export type QueryRecommendation = z.infer<typeof queryRecommendationSchema>;
export type PageIssue = z.infer<typeof pageIssueSchema>;
export type LandingPageRecommendation = z.infer<typeof landingPageRecommendationSchema>;
export type GroupedSearchConsoleAnalysis = z.infer<typeof groupedSearchConsoleAnalysisSchema>;

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

  const googleAdsSection = googleAds ? `
Google Ads Data:
- CPC: $${googleAds.cpc.toFixed(2)}
- Monthly Spend: $${googleAds.spend.toFixed(2)}
- Clicks: ${googleAds.clicks}
- Conversions: ${googleAds.conversions}
- Conversion Value: $${googleAds.conversionValue.toFixed(2)}
- Position: Paid ads (top of SERP)` : `
Google Ads Data:
- No paid data available for this query`;

  return `You are an expert SEO/PPC analyst. Analyze this query overlap data and provide a recommendation.

Query: "${queryText}"
${contextSection}
${googleAdsSection}

Search Console Data:
- Organic Position: ${searchConsole.position.toFixed(1)}
- CTR: ${(searchConsole.ctr * 100).toFixed(2)}%
- Impressions: ${searchConsole.impressions}
- Clicks: ${searchConsole.clicks}
${landingPageSection}

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
 * Build the analysis prompt for grouped landing page analysis
 */
function buildGroupedSearchConsolePrompt(
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

  // Sort landing pages by total clicks (descending) and limit to top 5 (reduced to avoid JSON parse errors)
  const topPages = data.queriesByLandingPage
    ? data.queriesByLandingPage
      .sort((a, b) => b.totalClicks - a.totalClicks)
      .slice(0, 5)
    : [];

  // Build detailed landing page sections
  let landingPagesDetail = '';
  if (topPages.length > 0) {
    landingPagesDetail = topPages.map((pageData, index) => {
      const pageNum = index + 1;
      let pageSection = `\n--- Landing Page ${pageNum} ---\nURL: ${pageData.page}\nTotal Clicks: ${pageData.totalClicks}\nTotal Impressions: ${pageData.totalImpressions}\nNumber of Ranking Queries: ${pageData.queries.length}`;

      // GA4 metrics if available
      if (pageData.ga4Metrics) {
        const ga4 = pageData.ga4Metrics;
        pageSection += `

GA4 Organic Engagement (Google/Organic Traffic Only):
- Sessions: ${ga4.sessions}
- Engagement Rate: ${(ga4.engagementRate * 100).toFixed(1)}%
- Bounce Rate: ${(ga4.bounceRate * 100).toFixed(1)}%
- Conversions: ${ga4.conversions.toFixed(1)}
- Revenue: $${ga4.revenue.toFixed(2)}`;

        // Health indicators
        const healthIndicators: string[] = [];
        if (ga4.engagementRate < 0.3) healthIndicators.push('⚠️ Low engagement rate');
        if (ga4.bounceRate > 0.7) healthIndicators.push('⚠️ High bounce rate');
        if (ga4.conversions > 0 && ga4.engagementRate > 0.5) healthIndicators.push('✅ Strong converter');
        if (healthIndicators.length > 0) {
          pageSection += `\nHealth Indicators: ${healthIndicators.join(', ')}`;
        }
      } else {
        pageSection += `\n\nGA4 Data: Not available for this page.`;
      }

      // Top queries for this page (sorted by impressions) - limit to 5 to reduce response size
      const topQueriesForPage = pageData.queries
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 5);

      pageSection += `\n\nTop Queries for This Page:`;
      topQueriesForPage.forEach((q, i) => {
        pageSection += `\n${i + 1}. "${q.query}"
   - Position: ${q.position.toFixed(1)}
   - Clicks: ${q.clicks} | Impressions: ${q.impressions}
   - CTR: ${(q.ctr * 100).toFixed(2)}%`;
        if (q.ga4Engagement) {
          pageSection += `
   - GA4: ${(q.ga4Engagement.engagementRate * 100).toFixed(1)}% engagement, ${(q.ga4Engagement.bounceRate * 100).toFixed(1)}% bounce`;
        }
      });

      return pageSection;
    }).join('\n\n');
  }

  return `You are an expert SEO analyst. Analyze this Search Console data grouped by landing pages and provide STRUCTURED recommendations for each page.

${contextSection}

Data Summary:
- Date Range: ${data.dateRange.startDate} to ${data.dateRange.endDate}
- Total Queries Analyzed: ${data.totalQueries}
- Landing Pages Analyzed: ${topPages.length}

${landingPagesDetail}

${pageAnalysis ? `
Content Analysis for Top Page:
URL: ${pageAnalysis.url}
Content Preview:
"${pageAnalysis.content.slice(0, 500)}..."
` : ''}

Your task is to analyze EACH landing page independently and provide:

1. **Page Health Score (0-100)**: Based on GSC performance + GA4 engagement metrics
   - Consider: organic rankings, CTR, engagement rate, bounce rate, conversions
   - Lower scores for poor engagement or high bounce rates
   - Higher scores for strong rankings + good user engagement

2. **Query-Level Recommendations**: For each page, analyze the top queries and categorize them:
   - **quick_win**: Queries at position 4-10 that could easily reach top 3
   - **high_potential**: Queries with high impressions but low CTR or engagement
   - **underperforming**: Queries with good position but poor engagement/conversions
   - **maintain**: Queries performing well, keep monitoring

   For each query recommendation, provide:
   - Specific actionable advice (e.g., "Optimize title tag to include 'X'", "Add FAQ schema", "Improve content for search intent")
   - Clear reasoning based on the data
   - **potentialImpact**: MUST be one of these exact values: "critical", "very_high", "high", "medium", "low" (no other values allowed)

3. **Page-Level Recommendations**: Identify issues affecting the entire page:
   - **content**: Content gaps, quality issues, missing information
   - **ux**: User experience problems (high bounce, low engagement)
   - **engagement**: Session duration, interaction issues
   - **conversion**: Conversion optimization opportunities
   - **seo**: Technical SEO issues (meta tags, schema, internal linking)
   - **priority**: MUST be one of these exact values: "critical", "very_high", "high", "medium", "low" (no other values allowed)

4. **Top Quick Wins**: Across all pages, identify the 3-5 highest-impact actions that can be implemented quickly.

IMPORTANT: Return ONLY valid JSON without any markdown formatting or code blocks. Do not wrap your response in backtick code blocks.

CRITICAL REQUIREMENTS FOR JSON RESPONSE:
- "potentialImpact" field: ONLY use these exact values: "critical", "very_high", "high", "medium", or "low"
- "priority" field: ONLY use these exact values: "critical", "very_high", "high", "medium", or "low"
- "type" field: ONLY use these exact values: "quick_win", "high_potential", "underperforming", or "maintain"
- "category" field: ONLY use these exact values: "content", "ux", "engagement", "conversion", or "seo"
- DO NOT use ANY other values for these fields or the response will be rejected

Provide your analysis in this EXACT JSON format:
{
  "summary": "Executive summary of overall organic search performance across all landing pages (2-3 sentences)",
  "overallTrends": [
    "Trend 1 across multiple pages",
    "Trend 2 based on GA4 correlation",
    "Trend 3 highlighting opportunities"
  ],
  "landingPageAnalysis": [
    {
      "page": "Full URL of the landing page",
      "pageScore": 75,
      "totalImpressions": 12500,
      "totalClicks": 890,
      "ga4Metrics": {
        "sessions": 850,
        "engagementRate": 0.65,
        "bounceRate": 0.35,
        "conversions": 12,
        "revenue": 450.50
      },
      "queryRecommendations": [
        {
          "query": "specific search query",
          "currentPosition": 5.2,
          "impressions": 3500,
          "clicks": 150,
          "ctr": 0.043,
          "type": "quick_win",
          "potentialImpact": "high",
          "action": "Optimize H1 and title tag to include exact match keyword. Add FAQ schema.",
          "reasoning": "Position 5.2 with high impressions suggests strong relevance but needs better visibility to capture top 3 spot"
        }
      ],
      "pageRecommendations": [
        {
          "category": "ux",
          "priority": "high",
          "issue": "Bounce rate of 45% is above industry average",
          "action": "Improve page load speed and add engaging visual content above the fold"
        }
      ]
    }
  ],
  "topQuickWins": [
    {
      "page": "URL of page",
      "query": "specific query",
      "action": "Specific action to take",
      "estimatedImpact": "Expected result (e.g., 'Could move from position 6 to top 3, gaining ~150 clicks/month')"
    }
  ],
  "strategicAdvice": "High-level strategic advice for improving overall organic performance (2-3 sentences)"
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
      spend: overlap.googleAds?.spend ?? 0,
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
 * Analyze Search Console data with landing page grouping using configured AI provider
 */
export async function analyzeSearchConsoleDataGrouped(
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
): Promise<GroupedSearchConsoleAnalysis> {
  const prompt = buildGroupedSearchConsolePrompt(data, clientContext, pageAnalysis);

  aiLogger.info(
    {
      provider: config.aiProvider,
      queryCount: data.queries.length,
      landingPageCount: data.queriesByLandingPage?.length || 0,
    },
    'Starting grouped Search Console AI analysis'
  );

  try {
    let analysis: GroupedSearchConsoleAnalysis;
    const maxRetries = 3;
    const baseDelay = 1000;

    const executeAnalysis = async (retryCount: number = 0): Promise<GroupedSearchConsoleAnalysis> => {
      const startTime = Date.now();
      try {
        let responseText = '';

        aiLogger.info({ promptLength: prompt.length, promptPreview: prompt.slice(0, 200) + '...' }, 'Sending grouped prompt to AI');

        if (config.aiProvider === 'anthropic') {
          if (!config.anthropicApiKey) throw new Error('Anthropic API key not configured');
          const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
          const message = await anthropic.messages.create({
            model: config.anthropicModel,
            max_tokens: 8192, // Increased for comprehensive grouped analysis
            messages: [{ role: 'user', content: prompt }],
          });
          responseText = message.content[0].type === 'text' ? message.content[0].text : '';
        } else {
          if (!config.openaiApiKey) throw new Error('OpenAI API key not configured');
          const openai = new OpenAI({ apiKey: config.openaiApiKey });
          const completion = await openai.chat.completions.create({
            model: config.openaiModel,
            max_tokens: 8192, // Increased for comprehensive grouped analysis
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
          });
          responseText = completion.choices[0]?.message?.content || '';
        }

        const duration = Date.now() - startTime;
        aiLogger.info({ durationMs: duration, responseLength: responseText.length, responsePreview: responseText.slice(0, 200) + '...' }, 'Received grouped AI response');

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
        return groupedSearchConsoleAnalysisSchema.parse(parsed);

      } catch (error) {
        const duration = Date.now() - startTime;
        aiLogger.warn({
          error: error instanceof Error ? error.message : 'Unknown error',
          attempt: retryCount + 1,
          durationMs: duration,
          errorType: error instanceof SyntaxError ? 'JSON_PARSE_ERROR' : 'OTHER'
        }, 'Grouped AI analysis attempt failed');
        if (retryCount < maxRetries) {
          const delay = baseDelay * Math.pow(2, retryCount);
          await new Promise(resolve => setTimeout(resolve, delay));
          return executeAnalysis(retryCount + 1);
        }
        throw error;
      }
    };

    analysis = await executeAnalysis();

    aiLogger.info({
      summary: analysis.summary,
      landingPageCount: analysis.landingPageAnalysis.length,
      quickWinsCount: analysis.topQuickWins.length
    }, 'Grouped Search Console AI analysis complete');
    return analysis;

  } catch (error) {
    aiLogger.error(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'Grouped Search Console AI analysis failed'
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
/**
 * Generic function to call AI with a prompt and return the raw JSON response
 * Used by specialized agents (SEM, SEO, Strategy)
 */
export async function callGenericAI(
  prompt: string,
  modelOverride?: string
): Promise<string> {
  const maxRetries = 3;
  const baseDelay = 1000;

  const executeCall = async (retryCount: number = 0): Promise<string> => {
    try {
      let responseText = '';

      if (config.aiProvider === 'anthropic') {
        if (!config.anthropicApiKey) throw new Error('Anthropic API key not configured');
        const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

        const message = await anthropic.messages.create({
          model: modelOverride || config.anthropicModel,
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        });

        responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      } else {
        if (!config.openaiApiKey) throw new Error('OpenAI API key not configured');
        const openai = new OpenAI({ apiKey: config.openaiApiKey });

        const completion = await openai.chat.completions.create({
          model: modelOverride || config.openaiModel,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        });

        responseText = completion.choices[0]?.message?.content || '';
      }

      // Extract JSON if wrapped in markdown
      const markdownMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (markdownMatch) {
        return markdownMatch[1];
      }

      // Try to find JSON object
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return jsonMatch[0];
      }

      return responseText;
    } catch (error) {
      if (retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        return executeCall(retryCount + 1);
      }
      throw error;
    }
  };

  return executeCall();
}

/**
 * Orchestrates the multi-agent SEO/SEM analysis workflow
 */
export async function runSeoSemAnalysis(
  data: InterplayData,
  context: AgentContext,
  dateRange: { startDate: string; endDate: string }
): Promise<StrategyAnalysis> {
  aiLogger.info({ clientId: context.clientId }, 'Starting SEO/SEM Multi-Agent Analysis');

  const semAgent = new SemAgent(context);
  const seoAgent = new SeoAgent(context);
  const strategyAgent = new StrategyAgent(context);

  // Phase 1 & 2: Parallel Execution of Specialist Agents (Research + Analysis)
  // They handle their own "Active Research" internally
  const [semResults, seoResults] = await Promise.all([
    semAgent.analyze(data, dateRange),
    seoAgent.analyze(data)
  ]);

  aiLogger.info('Specialist agents finished. Starting Strategy synthesis.');

  // Phase 3: Strategy Synthesis
  const finalReport = await strategyAgent.analyze(semResults, seoResults);

  aiLogger.info('SEO/SEM Multi-Agent Analysis complete');
  return finalReport;
}

/**
 * Merges data from Google Ads, Search Console, and GA4 into a unified dataset
 */
export function constructInterplayData(
  googleAdsData: GoogleAdsQuery[],
  searchConsoleData: SearchConsoleQuery[],
  ga4Data: GA4LandingPageMetric[]
): InterplayData {
  const queryMap = new Map<string, QueryData>();

  // Helper to get or create
  const getOrCreate = (q: string) => {
    const normalized = q.toLowerCase().trim();
    if (!queryMap.has(normalized)) {
      queryMap.set(normalized, { query: q });
    }
    return queryMap.get(normalized)!;
  };

  // Process Google Ads
  for (const row of googleAdsData) {
    const q = getOrCreate(row.searchTerm);
    q.googleAds = {
      spend: row.costMicros / 1000000,
      clicks: row.clicks,
      impressions: row.impressions,
      cpc: row.averageCpc / 1000000,
      conversions: row.conversions,
      conversionValue: row.conversionValue,
      roas: 0
    };
    // Calculate ROAS
    if (q.googleAds.spend > 0) {
      q.googleAds.roas = q.googleAds.conversionValue / q.googleAds.spend;
    }
  }

  // Process Search Console
  for (const row of searchConsoleData) {
    const q = getOrCreate(row.query);
    q.searchConsole = {
      position: row.position,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      url: row.page
    };
  }

  // Process GA4 (Map URL -> Metrics)
  // Aggregate metrics by URL (since GA4 data is daily/segmented)
  const ga4Aggregates = new Map<string, {
    sessions: number;
    revenue: number;
    conversions: number;
    weightedEngagement: number;
    weightedBounce: number;
    weightedDuration: number;
  }>();

  for (const row of ga4Data) {
    let path = row.landingPage.split('?')[0];
    // Normalize to ensure it matches GSC URL path
    // GSC URL: https://example.com/foo
    // GA4 Path: /foo

    if (!ga4Aggregates.has(path)) {
      ga4Aggregates.set(path, {
        sessions: 0,
        revenue: 0,
        conversions: 0,
        weightedEngagement: 0,
        weightedBounce: 0,
        weightedDuration: 0
      });
    }

    const agg = ga4Aggregates.get(path)!;
    agg.sessions += row.sessions;
    agg.revenue += row.totalRevenue;
    agg.conversions += row.conversions;
    agg.weightedEngagement += row.engagementRate * row.sessions;
    agg.weightedBounce += row.bounceRate * row.sessions;
    agg.weightedDuration += row.averageSessionDuration * row.sessions;
  }

  // Convert to GA4PageMetrics
  const finalGa4Map = new Map<string, GA4PageMetrics>();
  for (const [path, agg] of ga4Aggregates.entries()) {
    if (agg.sessions > 0) {
      finalGa4Map.set(path, {
        sessions: agg.sessions,
        revenue: agg.revenue,
        conversions: agg.conversions,
        engagementRate: agg.weightedEngagement / agg.sessions,
        bounceRate: agg.weightedBounce / agg.sessions,
        averageSessionDuration: agg.weightedDuration / agg.sessions
      });
    }
  }

  // Attach GA4 to Queries
  for (const q of queryMap.values()) {
    if (q.searchConsole?.url) {
      try {
        const urlObj = new URL(q.searchConsole.url);
        const path = urlObj.pathname;
        const metrics = finalGa4Map.get(path) || finalGa4Map.get(q.searchConsole.url); // Try path then full URL
        if (metrics) {
          q.ga4Metrics = metrics;
        }
      } catch (e) {
        // Invalid URL, try direct match
        const metrics = finalGa4Map.get(q.searchConsole.url);
        if (metrics) {
          q.ga4Metrics = metrics;
        }
      }
    }
  }

  // Calculate Summary
  const summary = {
    totalSpend: 0,
    totalRevenue: 0,
    totalOrganicClicks: 0
  };

  for (const q of queryMap.values()) {
    if (q.googleAds) summary.totalSpend += q.googleAds.spend;
    if (q.ga4Metrics) summary.totalRevenue += q.ga4Metrics.revenue; // This might double count if multiple queries map to same page

    // Let's use Google Ads conversion value for totalRevenue in summary if available, or leave it.
    if (q.googleAds) summary.totalRevenue += q.googleAds.conversionValue;

    if (q.searchConsole) summary.totalOrganicClicks += q.searchConsole.clicks;
  }

  return {
    queries: Array.from(queryMap.values()),
    summary
  };
}

