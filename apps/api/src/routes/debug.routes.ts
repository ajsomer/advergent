import { Router } from 'express';
import { db } from '@/db/index.js';
import { searchConsoleQueries, syncJobs, clientAccounts, searchQueries } from '@/db/schema.js';
import { sql } from 'drizzle-orm';

const router = Router();

router.get('/db-status', async (req, res) => {
  try {
    // Check client accounts
    const clients = await db.select().from(clientAccounts);

    // Check sync jobs
    const jobs = await db.select().from(syncJobs).orderBy(sql`${syncJobs.startedAt} DESC`).limit(5);

    // Check search queries
    const queries = await db.select().from(searchQueries).limit(5);

    // Check search console queries
    const scQueries = await db.select().from(searchConsoleQueries).limit(5);

    // Count total records
    const [scCount] = await db.select({ count: sql<number>`count(*)` }).from(searchConsoleQueries);
    const [queriesCount] = await db.select({ count: sql<number>`count(*)` }).from(searchQueries);

    res.json({
      status: 'ok',
      counts: {
        clientAccounts: clients.length,
        syncJobs: jobs.length,
        searchQueries: queriesCount.count,
        searchConsoleQueries: scCount.count,
      },
      latestSyncJob: jobs[0] || null,
      sampleData: {
        searchQueries: queries.slice(0, 2),
        searchConsoleQueries: scQueries.slice(0, 2),
      }
    });
  } catch (error) {
    console.error('Error checking database:', error);
    res.status(500).json({ error: 'Failed to check database', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
