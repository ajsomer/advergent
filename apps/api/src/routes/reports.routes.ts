/**
 * Reports Routes - Interplay Report Endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '@/db/index.js';
import { clientAccounts } from '@/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/utils/logger.js';
import {
  generateInterplayReport,
  getLatestInterplayReport,
  getInterplayReportDebug,
} from '@/services/interplay-report/index.js';

const router = Router();
const routeLogger = logger.child({ module: 'reports-routes' });

/**
 * Helper to verify client belongs to user's agency
 * Returns the client if found and authorized, null otherwise
 */
async function verifyClientOwnership(clientId: string, agencyId: string) {
  const [client] = await db
    .select()
    .from(clientAccounts)
    .where(
      and(
        eq(clientAccounts.id, clientId),
        eq(clientAccounts.agencyId, agencyId)
      )
    )
    .limit(1);
  return client || null;
}

// Validation schemas
const regenerateSchema = z.object({
  days: z.number().min(7).max(90).optional().default(30),
});

/**
 * GET /api/clients/:clientId/interplay-report
 * Get the latest interplay report for a client
 */
router.get('/:clientId/interplay-report', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientId } = req.params;
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Verify client belongs to user's agency
    const client = await verifyClientOwnership(clientId, user.agencyId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const report = await getLatestInterplayReport(clientId);

    if (!report) {
      return res.status(404).json({
        error: 'No interplay report found for this client',
        message: 'Generate a report first by uploading data or triggering manual generation',
      });
    }

    res.json(report);
  } catch (error) {
    routeLogger.error({ error }, 'Failed to get interplay report');
    next(error);
  }
});

/**
 * POST /api/clients/:clientId/interplay-report/regenerate
 * Trigger manual report regeneration
 */
router.post('/:clientId/interplay-report/regenerate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientId } = req.params;
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Verify client belongs to user's agency
    const client = await verifyClientOwnership(clientId, user.agencyId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const body = regenerateSchema.parse(req.body);

    routeLogger.info({ clientId, days: body.days }, 'Manual report regeneration requested');

    // Start generation in background (fire-and-forget)
    const reportPromise = generateInterplayReport(clientId, {
      days: body.days,
      trigger: 'manual',
    });

    // Return immediately with accepted status
    res.status(202).json({
      message: 'Report generation started',
      clientId,
      days: body.days,
    });

    // Log when complete (don't await in response)
    reportPromise
      .then(({ reportId, metadata }) => {
        routeLogger.info(
          {
            clientId,
            reportId,
            businessType: metadata.skillBundle.businessType,
            skillVersion: metadata.skillBundle.version,
            totalDurationMs: metadata.performance.totalDurationMs,
            warningCount: metadata.warnings.length,
          },
          'Manual report generation complete'
        );
      })
      .catch((error) => {
        routeLogger.error({ clientId, error: error.message }, 'Manual report generation failed');
      });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    routeLogger.error({ error }, 'Failed to start report regeneration');
    next(error);
  }
});

/**
 * GET /api/clients/:clientId/interplay-report/debug
 * Get full debug data for QA (all agent outputs)
 */
router.get('/:clientId/interplay-report/debug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientId } = req.params;
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Verify client belongs to user's agency
    const client = await verifyClientOwnership(clientId, user.agencyId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // First get the latest report to find its ID
    const latestReport = await getLatestInterplayReport(clientId);

    if (!latestReport) {
      return res.status(404).json({
        error: 'No interplay report found for this client',
      });
    }

    const debugReport = await getInterplayReportDebug(latestReport.id);

    if (!debugReport) {
      return res.status(404).json({
        error: 'Debug data not available',
      });
    }

    res.json(debugReport);
  } catch (error) {
    routeLogger.error({ error }, 'Failed to get debug report');
    next(error);
  }
});

export default router;
