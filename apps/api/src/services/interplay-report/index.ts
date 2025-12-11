/**
 * Interplay Report Service - Public API
 *
 * Multi-Agent SEO/SEM Interplay Report System with skill-based analysis.
 */

// Main orchestrator functions
export {
  generateInterplayReport,
  getLatestInterplayReport,
  getInterplayReportById,
  getInterplayReportDebug,
  hasExistingReports,
} from './orchestrator.js';

// Core types
export type {
  GenerateReportOptions,
  GenerateReportResult,
  InterplayReportResponse,
  DebugReportResponse,
  ReportTrigger,
  ReportStatus,
  UnifiedRecommendation,
  ExecutiveSummary,
} from './types.js';

// Metadata types
export type {
  ReportGenerationMetadata,
  SkillBundleMetadata,
  ReportPerformanceMetrics,
  ReportWarning,
} from './types.js';

// Business type from skills
export type { BusinessType } from './skills/types.js';
