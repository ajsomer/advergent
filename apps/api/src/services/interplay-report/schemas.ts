/**
 * Phase 4: Interplay Report Zod Schemas
 * Validation schemas for agent outputs
 */

import { z } from 'zod';

// ============================================================================
// SHARED SCHEMAS
// ============================================================================

export const impactLevelSchema = z.enum(['high', 'medium', 'low']);
export const effortLevelSchema = z.enum(['high', 'medium', 'low']);

// ============================================================================
// SEM AGENT SCHEMAS
// ============================================================================

export const semActionSchema = z.object({
  action: z.string().min(5),
  level: z.enum(['campaign', 'ad_group', 'keyword']),
  expectedUplift: z.string().min(5),
  reasoning: z.string().min(10),
  impact: impactLevelSchema,
  keyword: z.string().optional(),
});

export const semAgentOutputSchema = z.object({
  semActions: z.array(semActionSchema).min(1).max(15),
});

// ============================================================================
// SEO AGENT SCHEMAS
// ============================================================================

export const seoActionSchema = z.object({
  condition: z.string().min(5),
  recommendation: z.string().min(5),
  specificActions: z.array(z.string().min(5)).min(1).max(5),
  impact: impactLevelSchema,
  url: z.string().optional(),
});

export const seoAgentOutputSchema = z.object({
  seoActions: z.array(seoActionSchema).min(1).max(15),
});

// ============================================================================
// DIRECTOR AGENT SCHEMAS
// ============================================================================

export const unifiedRecommendationSchema = z.object({
  title: z.string().min(5).max(100),
  description: z.string().min(10).max(500),
  type: z.enum(['sem', 'seo', 'hybrid']),
  impact: impactLevelSchema,
  effort: effortLevelSchema,
  actionItems: z.array(z.string().min(5)).min(1).max(5),
});

export const executiveSummarySchema = z.object({
  summary: z.string().min(20).max(1000),
  keyHighlights: z.array(z.string().min(5)).min(1).max(5),
});

export const directorOutputSchema = z.object({
  executiveSummary: executiveSummarySchema,
  unifiedRecommendations: z.array(unifiedRecommendationSchema).min(1).max(10),
});

// Export types inferred from schemas
export type SEMAction = z.infer<typeof semActionSchema>;
export type SEMAgentOutput = z.infer<typeof semAgentOutputSchema>;
export type SEOAction = z.infer<typeof seoActionSchema>;
export type SEOAgentOutput = z.infer<typeof seoAgentOutputSchema>;
export type UnifiedRecommendation = z.infer<typeof unifiedRecommendationSchema>;
export type ExecutiveSummary = z.infer<typeof executiveSummarySchema>;
export type DirectorOutput = z.infer<typeof directorOutputSchema>;
