import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { aiLogger } from '@/utils/logger';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const responseSchema = z.object({
  recommendation_type: z.enum(['reduce', 'pause', 'increase', 'maintain']),
  confidence_level: z.enum(['high', 'medium', 'low']),
  current_monthly_spend: z.number(),
  recommended_monthly_spend: z.number(),
  estimated_monthly_savings: z.number(),
  reasoning: z.string(),
  key_factors: z.array(z.string())
});

export async function analyzeQuery(queryId: string) {
  aiLogger.info({ queryId }, 'analysis placeholder');
  // TODO: pull data, send to Claude, store recommendation
  return null;
}
