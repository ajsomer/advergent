/**
 * Phase 9: Critical Alert Logging
 *
 * Logs critical violations that indicate skill constraint failures.
 * These alerts should trigger investigation into prompt quality.
 */

import { logger } from '@/utils/logger.js';
import type { BusinessType } from '../skills/types.js';
import type { OutputAnalysis } from './output-analysis.js';

const alertLogger = logger.child({ module: 'skill-alerts' });

// ============================================================================
// ALERT DEFINITIONS
// ============================================================================

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface SkillAlert {
  severity: AlertSeverity;
  code: string;
  message: string;
  context: Record<string, unknown>;
}

// ============================================================================
// ALERT CHECKING
// ============================================================================

/**
 * Checks for critical violations in the output analysis and logs alerts.
 *
 * Critical violations indicate that skill constraints failed to prevent
 * inappropriate content from appearing in the final output.
 */
export function checkAndAlertCriticalViolations(
  reportId: string,
  businessType: BusinessType,
  analysis: OutputAnalysis
): SkillAlert[] {
  const alerts: SkillAlert[] = [];

  // Lead-gen specific critical checks
  if (businessType === 'lead-gen') {
    // CRITICAL: ROAS mentioned in lead-gen report
    if (analysis.roasMentions > 0) {
      const alert: SkillAlert = {
        severity: 'critical',
        code: 'LEADGEN_ROAS_LEAK',
        message: 'CRITICAL: ROAS mentioned in lead-gen report - skill constraints failed',
        context: {
          reportId,
          businessType,
          roasMentions: analysis.roasMentions,
        },
      };
      alerts.push(alert);
      alertLogger.error(alert.context, alert.message);
    }

    // CRITICAL: Product schema recommended for lead-gen
    if (analysis.productSchemaRecommended) {
      const alert: SkillAlert = {
        severity: 'critical',
        code: 'LEADGEN_PRODUCT_SCHEMA_LEAK',
        message: 'CRITICAL: Product schema recommended in lead-gen report - skill constraints failed',
        context: {
          reportId,
          businessType,
        },
      };
      alerts.push(alert);
      alertLogger.error(alert.context, alert.message);
    }

    // WARNING: Other invalid metrics in lead-gen
    const leadGenInvalidMetrics = analysis.invalidMetrics.filter(
      (m) => m !== 'roas' // Already handled above
    );
    if (leadGenInvalidMetrics.length > 0) {
      const alert: SkillAlert = {
        severity: 'warning',
        code: 'LEADGEN_INVALID_METRICS',
        message: 'Invalid metrics detected in lead-gen report',
        context: {
          reportId,
          businessType,
          invalidMetrics: leadGenInvalidMetrics,
        },
      };
      alerts.push(alert);
      alertLogger.warn(alert.context, alert.message);
    }
  }

  // SaaS specific checks
  if (businessType === 'saas') {
    // WARNING: ROAS mentioned in SaaS report (may not be applicable)
    if (analysis.roasMentions > 0) {
      const alert: SkillAlert = {
        severity: 'warning',
        code: 'SAAS_ROAS_WARNING',
        message: 'ROAS mentioned in SaaS report - may not be applicable',
        context: {
          reportId,
          businessType,
          roasMentions: analysis.roasMentions,
        },
      };
      alerts.push(alert);
      alertLogger.warn(alert.context, alert.message);
    }

    // WARNING: Product schema recommended for SaaS
    if (analysis.productSchemaRecommended) {
      const alert: SkillAlert = {
        severity: 'warning',
        code: 'SAAS_PRODUCT_SCHEMA_WARNING',
        message: 'Product schema recommended in SaaS report - verify appropriateness',
        context: {
          reportId,
          businessType,
        },
      };
      alerts.push(alert);
      alertLogger.warn(alert.context, alert.message);
    }
  }

  // Local business specific checks
  if (businessType === 'local') {
    // WARNING: SaaS metrics in local report
    const localInvalidMetrics = analysis.invalidMetrics;
    if (localInvalidMetrics.length > 0) {
      const alert: SkillAlert = {
        severity: 'warning',
        code: 'LOCAL_INVALID_METRICS',
        message: 'SaaS-specific metrics detected in local business report',
        context: {
          reportId,
          businessType,
          invalidMetrics: localInvalidMetrics,
        },
      };
      alerts.push(alert);
      alertLogger.warn(alert.context, alert.message);
    }
  }

  // Generic invalid metrics warning (for any business type)
  if (analysis.invalidMetrics.length > 0 && alerts.length === 0) {
    // Only log if we haven't already logged a more specific alert
    const alert: SkillAlert = {
      severity: 'warning',
      code: 'INVALID_METRICS_DETECTED',
      message: 'Invalid metrics detected in report output',
      context: {
        reportId,
        businessType,
        invalidMetrics: analysis.invalidMetrics,
      },
    };
    alerts.push(alert);
    alertLogger.warn(alert.context, alert.message);
  }

  // Log summary if any alerts were generated
  if (alerts.length > 0) {
    const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
    const warningCount = alerts.filter((a) => a.severity === 'warning').length;

    alertLogger.info(
      {
        reportId,
        businessType,
        alertCount: alerts.length,
        criticalCount,
        warningCount,
      },
      'Skill alert check completed'
    );
  }

  return alerts;
}

/**
 * Logs a constraint violation summary for debugging.
 * Used after all reports are generated for trend analysis.
 */
export function logConstraintViolationSummary(
  violations: Array<{
    reportId: string;
    businessType: BusinessType;
    constraintId: string;
    source: 'sem' | 'seo';
  }>
): void {
  if (violations.length === 0) {
    return;
  }

  // Group by constraint ID
  const byConstraint = violations.reduce(
    (acc, v) => {
      const key = v.constraintId;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(v);
      return acc;
    },
    {} as Record<string, typeof violations>
  );

  // Log summary
  alertLogger.info(
    {
      totalViolations: violations.length,
      byConstraint: Object.fromEntries(
        Object.entries(byConstraint).map(([k, v]) => [k, v.length])
      ),
    },
    'Constraint violation summary'
  );
}
