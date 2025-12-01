import { Router, Request, Response } from 'express';
import multer from 'multer';
import { db } from '@/db/index.js';
import { clientAccounts, csvUploads } from '@/db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '@/utils/logger.js';
import { processUploadSession } from '@/services/csv-import.service.js';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

/**
 * POST /api/clients/:clientId/csv-upload
 * Upload multiple CSV files in a single session
 */
router.post(
  '/:clientId/csv-upload',
  upload.array('files', 20), // Max 20 files
  async (req: Request, res: Response) => {
    try {
      const { clientId } = req.params;
      const user = (req as any).user;
      const files = req.files as Express.Multer.File[];

      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      // Verify client exists and belongs to user's agency
      const [client] = await db
        .select()
        .from(clientAccounts)
        .where(and(eq(clientAccounts.id, clientId), eq(clientAccounts.agencyId, user.agencyId)))
        .limit(1);

      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const fileData = files.map((f) => ({
        buffer: f.buffer,
        filename: f.originalname,
        size: f.size,
      }));

      logger.info(
        { clientId, userId: user.id, fileCount: files.length },
        'CSV upload initiated'
      );

      const result = await processUploadSession(clientId, fileData, user.id);

      logger.info(
        {
          clientId,
          sessionId: result.sessionId,
          imported: result.imported.length,
          skipped: result.skipped.length,
          failed: result.failed.length,
        },
        'CSV upload completed'
      );

      res.json(result);
    } catch (error) {
      logger.error({ error }, 'CSV upload failed');
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);

/**
 * GET /api/clients/:clientId/csv-uploads
 * Get upload history for a client
 */
router.get('/:clientId/csv-uploads', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Verify client exists and belongs to user's agency
    const [client] = await db
      .select()
      .from(clientAccounts)
      .where(and(eq(clientAccounts.id, clientId), eq(clientAccounts.agencyId, user.agencyId)))
      .limit(1);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const uploads = await db
      .select()
      .from(csvUploads)
      .where(eq(csvUploads.clientAccountId, clientId))
      .orderBy(desc(csvUploads.createdAt))
      .limit(50);

    res.json(uploads);
  } catch (error) {
    logger.error({ error }, 'Failed to get upload history');
    res.status(500).json({ error: 'Failed to get upload history' });
  }
});

/**
 * GET /api/clients/:clientId/csv-uploads/:sessionId
 * Get details of a specific upload session
 */
router.get('/:clientId/csv-uploads/:sessionId', async (req: Request, res: Response) => {
  try {
    const { clientId, sessionId } = req.params;
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Verify client exists and belongs to user's agency
    const [client] = await db
      .select()
      .from(clientAccounts)
      .where(and(eq(clientAccounts.id, clientId), eq(clientAccounts.agencyId, user.agencyId)))
      .limit(1);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const uploads = await db
      .select()
      .from(csvUploads)
      .where(
        and(
          eq(csvUploads.uploadSessionId, sessionId),
          eq(csvUploads.clientAccountId, clientId)
        )
      )
      .orderBy(csvUploads.fileName);

    res.json(uploads);
  } catch (error) {
    logger.error({ error }, 'Failed to get upload session');
    res.status(500).json({ error: 'Failed to get upload session' });
  }
});

export default router;
