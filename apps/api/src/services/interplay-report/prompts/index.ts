/**
 * Prompts Module - Re-exports all prompt builders
 */

// Legacy prompt builders (backward compatibility)
export { buildSEMPrompt, type SEMPromptContext } from './sem.prompt.js';
export { buildSEOPrompt, type SEOPromptContext } from './seo.prompt.js';
export { buildDirectorPrompt, type DirectorPromptContext } from './director.prompt.js';

// New skill-based prompt builders
export { buildSEMPromptWithSkill, type SEMAgentContext } from './sem.prompt.js';
export { buildSEOPromptWithSkill, type SEOAgentContext } from './seo.prompt.js';
export { buildDirectorPromptWithSkill, type DirectorAgentContext } from './director.prompt.js';

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
