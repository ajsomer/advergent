import { StrategyAnalysis, strategyAnalysisSchema, SemAnalysis, SeoAnalysis, AgentContext } from './types.js';
import { callGenericAI } from '../ai-analyzer.service.js';
import { logger } from '@/utils/logger.js';

export class StrategyAgent {
    constructor(private context: AgentContext) { }

    async analyze(semResults: SemAnalysis, seoResults: SeoAnalysis): Promise<StrategyAnalysis> {
        logger.info('Strategy Agent: Starting synthesis');

        const prompt = this.buildPrompt(semResults, seoResults);
        const response = await callGenericAI(prompt);

        try {
            return strategyAnalysisSchema.parse(JSON.parse(response));
        } catch (error) {
            logger.error({ error, response }, 'Failed to parse Strategy Agent response');
            throw new Error('Strategy Agent failed to generate valid JSON');
        }
    }

    private buildPrompt(semResults: SemAnalysis, seoResults: SeoAnalysis): string {
        const inputData = JSON.stringify({
            semAnalysis: semResults,
            seoAnalysis: seoResults
        }, null, 2);

        return `You are a Digital Marketing Director presenting a strategic report to a client.

Input Data:
- **SEM Analysis**: The output from the SEM Agent.
- **SEO Analysis**: The output from the SEO Agent.
- Client Context: Industry: ${this.context.industry || 'Unknown'}, Target Market: ${this.context.targetMarket || 'Unknown'}.

**Your Mandate:**
1. **Synthesize & Prioritize**: You have received tactical advice from your SEM and SEO specialists. Your job is to review their recommendations, resolve any conflicts (e.g., SEM says "pause," SEO says "wait"), and order them by **Business Impact** (Revenue/Savings).
2. **Curation & Filtering**: The user should not be overwhelmed. Apply the following logic:
   - **Rank** all recommendations by Impact (High > Medium > Low).
   - **Filter**:
     - If you have **> 10 High/Medium** recommendations, **DROP** all Low recommendations.
     - If you have **< 5 High/Medium** recommendations, **INCLUDE** the best Low recommendations to reach a total of 5-7 items.
     - **Cap** the final list at **10 items maximum**.
3. **Executive Summary**: Write a narrative summary of the account's "Health State." Are they over-spending? Under-investing? Is their organic strategy aligned with their paid goals?
4. **Unified Recommendations**: Present the final curated list.

**Output Requirements:**
- **Executive Summary**: 3-5 sentences. Professional, insightful, and focused on the bottom line.
- **Unified Recommendations**: A sorted list of the most impactful actions from both agents.

Output Format (JSON):
{
  "executiveSummary": {
    "summary": "string",
    "keyHighlights": ["string", "string"]
  },
  "unifiedRecommendations": [
    {
      "title": "string",
      "description": "string",
      "type": "sem" | "seo" | "hybrid",
      "impact": "high" | "medium" | "low",
      "effort": "high" | "medium" | "low",
      "actionItems": ["string"]
    }
  ]
}

Data:
${inputData}
`;
    }
}
