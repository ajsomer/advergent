#!/usr/bin/env node
import { db } from '@/db/index.js';
import { clientAccounts, syncJobs } from '@/db/schema.js';
import { eq, and, or, sql } from 'drizzle-orm';
import { runClientSync } from '@/services/client-sync.service.js';
import { workerLogger } from '@/utils/logger.js';

async function main() {
  workerLogger.info('Starting daily sync job');

  // Clean up stale jobs (running > 1 hour = assume crashed)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const staleJobs = await db
    .update(syncJobs)
    .set({
      status: 'failed',
      completedAt: new Date(),
      errorMessage: 'Job timed out or process crashed',
    })
    .where(and(
      or(
        eq(syncJobs.status, 'pending'),
        eq(syncJobs.status, 'running')
      ),
      sql`${syncJobs.startedAt} < ${oneHourAgo}`
    ))
    .returning();

  if (staleJobs.length > 0) {
    workerLogger.warn(
      { staleJobCount: staleJobs.length },
      'Cleaned up stale sync jobs'
    );
  }

  // Fetch all active clients
  const clients = await db
    .select()
    .from(clientAccounts)
    .where(eq(clientAccounts.isActive, true));

  workerLogger.info({ clientCount: clients.length }, 'Found active clients');

  let successCount = 0;
  let failureCount = 0;

  // Run syncs sequentially
  for (const client of clients) {
    try {
      const result = await runClientSync(client.id, 'scheduled');
      successCount++;
      workerLogger.info(
        { clientId: client.id, recordsProcessed: result.recordsProcessed },
        'Client sync succeeded'
      );
    } catch (error) {
      failureCount++;
      // Error already logged by runClientSync, just count it
      workerLogger.error(
        { clientId: client.id, error: error instanceof Error ? error.message : 'Unknown error' },
        'Client sync failed'
      );
    }
  }

  workerLogger.info(
    { total: clients.length, succeeded: successCount, failed: failureCount },
    'Daily sync job completed'
  );

  // Exit with error code if any syncs failed
  process.exit(failureCount > 0 ? 1 : 0);
}

main().catch(error => {
  workerLogger.error({ error }, 'Daily sync job crashed');
  process.exit(1);
});
