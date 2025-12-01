import { InterplayData, AgentContext, SeoAnalysis, seoAnalysisSchema, QueryData } from './types.js';
import { callGenericAI } from '../ai-analyzer.service.js';
import { logger } from '@/utils/logger.js';
import { JSDOM } from 'jsdom';

export class SeoAgent {
    constructor(private context: AgentContext) { }

    async analyze(data: InterplayData): Promise<SeoAnalysis> {
        logger.info({ clientId: this.context.clientId }, 'SEO Agent: Starting analysis');

        // 1. Scout (Triage)
        const criticalPages = this.triage(data);
        logger.info({ count: criticalPages.length }, 'SEO Agent: Identified critical pages');

        // 2. Researcher (Fetch Content)
        if (criticalPages.length > 0) {
            await this.research(criticalPages);
            logger.info('SEO Agent: Fetched page content');
        }

        // 3. Analyst (LLM)
        const prompt = this.buildPrompt(data);
        const response = await callGenericAI(prompt);

        try {
            return seoAnalysisSchema.parse(JSON.parse(response));
        } catch (error) {
            logger.error({ error, response }, 'Failed to parse SEO Agent response');
            throw new Error('SEO Agent failed to generate valid JSON');
        }
    }

    private triage(data: InterplayData): QueryData[] {
        // Identify top 5 "Critical Pages"
        // Criteria: High Spend/Traffic AND Poor Engagement (High Bounce Rate)
        // We need queries that have GA4 metrics attached (via landing page)
        return data.queries
            .filter(q => q.ga4Metrics && q.searchConsole?.url) // Must have GA4 data and URL
            .sort((a, b) => {
                // Sort by "Pain Score": Spend * Bounce Rate
                const scoreA = (a.googleAds?.spend || 0) * (a.ga4Metrics?.bounceRate || 0);
                const scoreB = (b.googleAds?.spend || 0) * (b.ga4Metrics?.bounceRate || 0);
                return scoreB - scoreA;
            })
            .slice(0, 5);
    }

    private async research(queries: QueryData[]) {
        // Fetch content for unique URLs
        const uniqueUrls = [...new Set(queries.map(q => q.searchConsole!.url!))];

        const contentMap = new Map<string, string>();

        await Promise.all(uniqueUrls.map(async (url) => {
            try {
                const content = await this.fetchPageContent(url);
                contentMap.set(url, content);
            } catch (error) {
                logger.warn({ url, error }, 'Failed to fetch page content');
            }
        }));

        // Enrich queries with content
        for (const q of queries) {
            if (q.searchConsole?.url) {
                q.pageContent = contentMap.get(q.searchConsole.url);
            }
        }
    }

    private async fetchPageContent(url: string): Promise<string> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

            const response = await fetch(url, {
                signal: controller.signal,
                headers: { 'User-Agent': 'Advergent-Analysis-Bot/1.0' }
            });
            clearTimeout(timeoutId);

            if (!response.ok) return '';

            const html = await response.text();
            const dom = new JSDOM(html);
            const doc = dom.window.document;

            // Remove scripts, styles, etc.
            doc.querySelectorAll('script, style, noscript, iframe, svg').forEach(el => el.remove());

            // Get text content and clean it up
            const text = doc.body.textContent || '';
            return text.replace(/\s+/g, ' ').trim().slice(0, 2000); // Limit to 2000 chars
        } catch (e) {
            return '';
        }
    }

    private buildPrompt(data: InterplayData): string {
        // Format data for prompt
        // Prioritize queries with content first, then top organic opportunities
        const queriesWithContent = data.queries.filter(q => q.pageContent);
        const otherQueries = data.queries
            .filter(q => !q.pageContent)
            .sort((a, b) => (b.searchConsole?.clicks || 0) - (a.searchConsole?.clicks || 0))
            .slice(0, 30);

        const allQueries = [...queriesWithContent, ...otherQueries];

        const queriesJson = JSON.stringify(allQueries.map(q => ({
            query: q.query,
            url: q.searchConsole?.url,
            googleAds: q.googleAds,
            searchConsole: q.searchConsole,
            ga4Metrics: q.ga4Metrics,
            pageContent: q.pageContent ? `[Content Preview: ${q.pageContent.slice(0, 200)}...]` : undefined
        })), null, 2);

        return `You are an expert SEO Strategist. Your goal is to use Paid Search data as a "cheat sheet" to accelerate organic growth and fix technical/content issues.

Input Data:
- Query Overlap Data (Same as SEM Agent).
- **Page Content**: HTML/Text content for specific high-priority pages (fetched by Researcher).
- Client Context: Industry: ${this.context.industry || 'Unknown'}, Target Market: ${this.context.targetMarket || 'Unknown'}.

**Your Mandate:**
Analyze the data to find where Organic Search is underperforming relative to its potential, using Paid data as a benchmark. Look for:
- **Content Diagnosis**: For pages with provided content, analyze *why* they might be failing. Is the content relevant to the high-spend keywords? Is the CTA clear?
- **Content Gaps**: Keywords where Paid Ads convert well, but Organic rank is poor (indicating we lack relevant content).
- **CTR Issues**: Keywords where we rank well but get fewer clicks than expected (or fewer than Paid Ads), suggesting poor titles/descriptions.
- **UX/Conversion Mismatches**: Pages that rank well but convert poorly compared to their Paid counterparts.
- **Keyword Expansion**: High-volume terms from Paid Search that we completely miss in Organic.

**Output Requirements:**
- **Condition**: Briefly describe the data pattern you found (e.g., "High Paid Conversions vs. Low Organic Rank").
- **Recommendation**: The high-level strategy (e.g., "Create dedicated landing page").
- **Specific Actions**: Concrete steps to take (e.g., "Draft 1500w guide on [Topic]", "Update meta title to match Paid Ad copy").

Output Format (JSON):
{
  "seoActions": [
    {
      "condition": "string",
      "recommendation": "string",
      "specificActions": ["string", "string"],
      "impact": "high" | "medium" | "low"
    }
  ]
}

Data:
${queriesJson}
`;
    }
}
