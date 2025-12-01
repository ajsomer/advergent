import { InterplayData, AgentContext, SemAnalysis, semAnalysisSchema, QueryData } from './types.js';
import { callGenericAI } from '../ai-analyzer.service.js';
import { getKeywordCompetitiveMetrics } from '../google-ads.service.js';
import { logger } from '@/utils/logger.js';

export class SemAgent {
    constructor(private context: AgentContext) { }

    async analyze(data: InterplayData, dateRange: { startDate: string; endDate: string }): Promise<SemAnalysis> {
        logger.info({ clientId: this.context.clientId }, 'SEM Agent: Starting analysis');

        // 1. Scout (Triage)
        const battlegroundKeywords = this.triage(data);
        logger.info({ count: battlegroundKeywords.length }, 'SEM Agent: Identified battleground keywords');

        // 2. Researcher (Fetch Metrics)
        if (battlegroundKeywords.length > 0) {
            await this.research(battlegroundKeywords, dateRange);
            logger.info('SEM Agent: Fetched competitive metrics');
        }

        // 3. Analyst (LLM)
        const prompt = this.buildPrompt(data);
        const response = await callGenericAI(prompt);

        try {
            return semAnalysisSchema.parse(JSON.parse(response));
        } catch (error) {
            logger.error({ error, response }, 'Failed to parse SEM Agent response');
            // Fallback or re-throw? For now re-throw to fail fast
            throw new Error('SEM Agent failed to generate valid JSON');
        }
    }

    private triage(data: InterplayData): QueryData[] {
        // Identify top 10 "Battleground Keywords"
        // Criteria: High Spend, Cannibalization Risk, Growth Potential
        // For now, we prioritize by Spend as a proxy for importance
        return data.queries
            .filter(q => q.googleAds && q.googleAds.spend > 0)
            .sort((a, b) => (b.googleAds?.spend || 0) - (a.googleAds?.spend || 0))
            .slice(0, 10);
    }

    private async research(keywords: QueryData[], dateRange: { startDate: string; endDate: string }) {
        const keywordTexts = keywords.map(k => k.query);
        const metricsMap = await getKeywordCompetitiveMetrics(
            this.context.clientId,
            dateRange.startDate,
            dateRange.endDate,
            keywordTexts
        );

        // Enrich the data objects in place
        for (const k of keywords) {
            const metrics = metricsMap.get(k.query);
            if (metrics) {
                k.competitiveMetrics = metrics;
            }
        }
    }

    private buildPrompt(data: InterplayData): string {
        // Filter and format data for the prompt to respect token limits
        // We'll take top 30 queries by spend + top 10 organic opportunities
        const topQueries = data.queries
            .sort((a, b) => (b.googleAds?.spend || 0) - (a.googleAds?.spend || 0))
            .slice(0, 40);

        const queriesJson = JSON.stringify(topQueries.map(q => ({
            query: q.query,
            googleAds: q.googleAds ? {
                spend: q.googleAds.spend,
                cpc: q.googleAds.cpc,
                clicks: q.googleAds.clicks,
                conversions: q.googleAds.conversions,
                roas: q.googleAds.roas
            } : undefined,
            searchConsole: q.searchConsole ? {
                position: q.searchConsole.position,
                ctr: q.searchConsole.ctr,
                impressions: q.searchConsole.impressions
            } : undefined,
            competitiveMetrics: q.competitiveMetrics,
            ga4Metrics: q.ga4Metrics ? {
                engagementRate: q.ga4Metrics.engagementRate,
                bounceRate: q.ga4Metrics.bounceRate,
                revenue: q.ga4Metrics.revenue
            } : undefined
        })), null, 2);

        return `You are an elite Google Ads Strategist. Your goal is to maximize ROAS and efficiency by deeply analyzing the relationship between our Paid Search data, Organic Search performance, and GA4 User Behavior.

Input Data:
- Query Overlap Data: A comprehensive list of keywords containing:
    - Google Ads: Spend, CPC, Clicks, Conversions, ROAS.
    - **Competitive Metrics** (for Battleground Keywords): Search Impression Share, Lost IS (Rank), Lost IS (Budget).
    - Search Console: Position, CTR, Impressions.
    - GA4 (via Landing Page): Engagement Rate, Bounce Rate, Revenue.
- Client Context: Industry: ${this.context.industry || 'Unknown'}, Target Market: ${this.context.targetMarket || 'Unknown'}.

**Your Mandate:**
Analyze the provided data to identify *any* significant opportunities or inefficiencies. Do not limit yourself to pre-defined rules. Look for patterns such as (but not limited to):
- **Efficiency Gains**: Where can we pull back spend because organic is doing the heavy lifting?
- **Aggressive Expansion**: Where is organic failing to convert high-intent traffic that paid ads could capture?
- **Quality Control**: Are we paying for traffic that bounces immediately (High Spend + High Bounce Rate)?
- **Defensive Gaps**: High Lost IS (Rank) on brand terms or high-converting keywords.
- **Budget Constraints**: High Lost IS (Budget) on high-ROAS keywords.

**Output Requirements:**
For each opportunity you find, provide a specific, actionable recommendation.
- **Action**: What exactly should be changed in Google Ads? (e.g., "Reduce bids," "Add negative keyword," "Create new ad group").
- **Level**: Is this a campaign, ad group, or keyword level change?
- **Reasoning**: Explain *why* based on the specific data points (e.g., "High Lost IS (Rank) of 60% suggests heavy competition; increase bids to protect market share").
- **Expected Uplift**: Estimate the impact (e.g., "Potential 15% cost saving," "Estimated 10% increase in leads").

Output Format (JSON):
{
  "semActions": [
    {
      "action": "string",
      "level": "campaign" | "keyword" | "ad_group",
      "expectedUplift": "string",
      "reasoning": "string",
      "impact": "high" | "medium" | "low"
    }
  ]
}

Data:
${queriesJson}
`;
    }
}
