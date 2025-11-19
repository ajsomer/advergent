import 'dotenv/config';
import { db, agencies, users } from './index.js';
import { dbLogger } from '@/utils/logger.js';
import { eq } from 'drizzle-orm';

async function testDrizzleConnection() {
  try {
    dbLogger.info('Testing Drizzle connection to Neon...');

    // Test 1: Simple select to check connection
    const agenciesList = await db.select().from(agencies).limit(5);
    dbLogger.info({ count: agenciesList.length }, 'Successfully queried agencies table');

    // Test 2: Test relations
    const usersWithAgencies = await db.query.users.findMany({
      limit: 5,
      with: {
        agency: true,
      },
    });
    dbLogger.info({ count: usersWithAgencies.length }, 'Successfully queried users with relations');

    // Test 3: Test schema export
    dbLogger.info({ tables: Object.keys(db._.schema || {}) }, 'Schema tables available');

    dbLogger.info('✅ All Drizzle tests passed!');
    process.exit(0);
  } catch (error) {
    dbLogger.error({ error }, '❌ Drizzle connection test failed');
    process.exit(1);
  }
}

testDrizzleConnection();
