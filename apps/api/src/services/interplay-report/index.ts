/**
 * Interplay Report Service - Public API
 *
 * Phase 4: Multi-Agent SEO/SEM Interplay Report System
 */

// Main orchestrator functions
export {
  generateInterplayReport,
  getLatestInterplayReport,
  getInterplayReportById,
  getInterplayReportDebug,
  hasExistingReports,
} from './orchestrator.js';

// Types
export type {
  GenerateReportOptions,
  InterplayReportResponse,
  DebugReportResponse,
  ReportTrigger,
  ReportStatus,
  UnifiedRecommendation,
  ExecutiveSummary,
} from './types.js';
