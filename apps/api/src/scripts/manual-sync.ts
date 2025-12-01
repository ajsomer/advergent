#!/usr/bin/env tsx
/**
 * Manual sync trigger script
 * Usage: tsx src/scripts/manual-sync.ts <client-id>
 */

import 'dotenv/config';
import { runClientSync } from '../services/client-sync.service.js';
import { db } from '../db/index.js';
import { clientAccounts } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { syncLogger } from '../utils/logger.js';

async function main() {
  const clientId = process.argv[2];

  if (!clientId) {
    console.error('Usage: tsx src/scripts/manual-sync.ts <client-id>');
    process.exit(1);
  }

  syncLogger.info({ clientId }, 'Manual sync triggered via script');

  try {
    // Verify client exists
    const [client] = await db
      .select()
      .from(clientAccounts)
      .where(eq(clientAccounts.id, clientId))
      .limit(1);

    if (!client) {
      syncLogger.error({ clientId }, 'Client not found');
      process.exit(1);
    }

    syncLogger.info({ clientId, clientName: client.name }, 'Starting sync for client');

    // Run the sync
    const result = await runClientSync(clientId, 'manual');

    syncLogger.info(
      { clientId, recordsProcessed: result.recordsProcessed },
      'Sync completed successfully'
    );

    console.log(`\n✅ Sync completed successfully!`);
    console.log(`   Records processed: ${result.recordsProcessed}`);
    console.log(`   Client: ${client.name}\n`);

    process.exit(0);
  } catch (error) {
    syncLogger.error({ clientId, error }, 'Sync failed');
    console.error('\n❌ Sync failed:', error);
    process.exit(1);
  }
}

main();
