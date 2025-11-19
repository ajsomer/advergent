# Search Console AI Analysis Feature

## Overview
The Search Console AI Analysis feature allows users to generate strategic SEO insights directly from their Google Search Console data. By clicking "Analyze with AI" on the Search Console tab, the system processes the client's organic search performance and provides actionable recommendations.

## How It Works

1.  **User Action**: The user clicks the "Analyze with AI" button in the Client Details > Search Console tab.
2.  **Data Retrieval**:
    *   The frontend sends a request to `POST /api/clients/:id/search-console/analyze`.
    *   The backend fetches the top 20 Search Console queries for the last 30 days from the database (`search_console_queries` table).
    *   Data is aggregated to calculate total impressions, clicks, average CTR, and average position.
3.  **Prompt Construction**:
    *   The system constructs a prompt containing the client's performance data and context (if available).
    *   See "System Prompt" below for the exact template.
4.  **AI Processing**:
    *   The prompt is sent to the configured AI provider (Anthropic Claude or OpenAI GPT).
    *   The system uses `ai-analyzer.service.ts` to handle the API call with retries and error handling.
5.  **Response Parsing**:
    *   The AI returns a JSON object containing a summary, key trends, opportunities, and strategic advice.
    *   The response is validated against a Zod schema to ensure it matches the expected format.
6.  **Display**:
    *   The structured analysis is sent back to the frontend.
    *   A modal (`SearchConsoleAnalysisModal`) displays the insights in a user-friendly format.

## Configuration
The feature is configured via environment variables in `apps/api/.env`:
- `AI_PROVIDER`: `anthropic` or `openai`
- `ANTHROPIC_API_KEY`: Your Anthropic API key
- `OPENAI_API_KEY`: Your OpenAI API key
- `ANTHROPIC_MODEL`: (Optional) Model to use, e.g., `claude-3-5-sonnet-20240620`

## System Prompt
The following prompt is used to instruct the AI. Dynamic values are replaced with actual client data at runtime.

```text
You are an expert SEO analyst. Analyze this Search Console data and provide strategic insights.

[Client Context Section - Industry, Target Market, etc. if available]

Data Summary:
- Date Range: [Start Date] to [End Date]
- Total Queries Analyzed: [Total Count]

Top Performing Queries:
- "[Query 1]": [Clicks] clicks, [Impressions] impr, [CTR]% CTR, Pos [Position]
- "[Query 2]": ...
(up to top 20 queries)

Analyze the data to identify:
1. Quick wins (keywords with good impressions but low CTR or position 4-10)
2. High potential opportunities (keywords driving traffic that could be scaled)
3. Underperforming areas (keywords losing visibility)

Provide an analysis in JSON format:
{
  "summary": "Executive summary of performance (2-3 sentences)",
  "key_trends": ["trend1", "trend2", "trend3"],
  "opportunities": [
    {
      "query": "specific query or topic",
      "type": "quick_win" | "high_potential" | "underperforming",
      "potential_impact": "high" | "medium" | "low",
      "action": "specific action to take"
    }
  ],
  "strategic_advice": "High-level strategic advice based on the data (2-3 sentences)"
}
```

## Troubleshooting
- **500 Error**: Usually indicates missing API keys. Check server logs for "Anthropic API key not configured".
- **Slow Response**: The AI analysis can take 10-30 seconds depending on the model and data volume.
- **Empty/Failed Response**: Check if the AI model is overloaded or if the API key has sufficient credits.
