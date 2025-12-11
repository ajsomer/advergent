/**
 * Prompts Module - Re-exports all prompt builders
 *
 * All prompt builders use skill-based configuration for business-type-aware prompts.
 */

// Skill-based prompt builders
export { buildSEMPrompt, type SEMAgentContext } from './sem.prompt.js';
export { buildSEOPrompt, type SEOAgentContext } from './seo.prompt.js';
export { buildDirectorPrompt, type DirectorAgentContext } from './director.prompt.js';

// Serialization utilities
export {
  // Token budget constants and types
  TOKEN_LIMITS,
  type SerializationMode,
  type TokenBudgetResult,

  // KPI formatting
  formatKPIs,
  formatKPIsCompact,

  // Benchmark formatting
  formatBenchmarks,
  formatBenchmarksCompact,

  // Pattern formatting
  formatPatterns,
  formatPatternsCompact,

  // Example formatting
  formatSEMExamples,
  formatSEMExamplesCompact,
  formatSEOExamples,
  formatSEOExamplesCompact,

  // Constraint formatting
  formatConstraints,

  // SEO-specific formatting
  formatSchemaRules,
  formatContentPatterns,
  formatContentPatternsCompact,

  // Director-specific formatting
  formatConflictRules,
  formatSynergyRules,
  formatPrioritizationRules,

  // Token budget management
  estimateTokens,
  determineSerializationMode,
  validatePromptSize,

  // Priority scoring and truncation
  calculateKeywordPriority,
  calculatePagePriority,
  prioritizeAndTruncate,

  // Serializable types
  type SerializableKeyword,
  type SerializablePage,
} from './serialization.js';
