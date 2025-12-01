#!/usr/bin/env tsx
/**
 * Cleanup stuck sync jobs
 * Usage: tsx src/scripts/cleanup-sync.ts <client-id>
 */

import 'dotenv/config';
import { db } from '../db/index.js';
import { syncJobs } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

async function main() {
  const clientId = process.argv[2];

  if (!clientId) {
    console.error('Usage: tsx src/scripts/cleanup-sync.ts <client-id>');
    process.exit(1);
  }

  console.log(`Cleaning up sync jobs for client: ${clientId}`);

  const result = await db
    .update(syncJobs)
    .set({
      status: 'failed',
      completedAt: new Date(),
      errorMessage: 'Manually cancelled for optimization',
    })
    .where(
      and(
        eq(syncJobs.clientAccountId, clientId),
        eq(syncJobs.status, 'running')
      )
    )
    .returning();

  console.log(`✅ Cleaned up ${result.length} sync job(s)`);
  process.exit(0);
}

main();
