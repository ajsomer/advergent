import dotenv from 'dotenv';
dotenv.config();

import { db } from './src/db/index.js';
import { searchConsoleQueries, syncJobs, clientAccounts } from './src/db/schema.js';
import { sql } from 'drizzle-orm';

async function checkDatabase() {
  console.log('Checking database...\n');

  try {
    // Check client accounts
    const clients = await db.select().from(clientAccounts);
    console.log(`✓ Client Accounts: ${clients.length} found`);

    // Check sync jobs
    const jobs = await db.select().from(syncJobs);
    console.log(`✓ Sync Jobs: ${jobs.length} found`);
    if (jobs.length > 0) {
      console.log('  Latest sync job:');
      console.log(`    - ID: ${jobs[jobs.length - 1].id}`);
      console.log(`    - Status: ${jobs[jobs.length - 1].status}`);
      console.log(`    - Started: ${jobs[jobs.length - 1].startedAt}`);
      console.log(`    - Completed: ${jobs[jobs.length - 1].completedAt}`);
      console.log(`    - Records: ${jobs[jobs.length - 1].recordsProcessed}`);
    }

    // Check search console queries
    const scQueries = await db.select().from(searchConsoleQueries).limit(5);
    console.log(`\n✓ Search Console Queries: ${scQueries.length} sample records found`);
    if (scQueries.length > 0) {
      console.log('  Sample query:');
      console.log(`    - Date: ${scQueries[0].date}`);
      console.log(`    - Impressions: ${scQueries[0].impressions}`);
      console.log(`    - Clicks: ${scQueries[0].clicks}`);
      console.log(`    - CTR: ${scQueries[0].ctr}`);
      console.log(`    - Position: ${scQueries[0].position}`);
    }

    // Count total records
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(searchConsoleQueries);
    console.log(`\n✓ Total Search Console Query Records: ${countResult.count}`);

  } catch (error) {
    console.error('Error checking database:', error);
  }

  process.exit(0);
}

checkDatabase();
