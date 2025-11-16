import 'dotenv/config';
import { db, users, agencies, searchQueries } from './db/index.js';
import { dbLogger } from './utils/logger.js';
import { eq } from 'drizzle-orm';

async function testMigrations() {
  try {
    dbLogger.info('Testing Drizzle migrations...');

    // Test 1: Create a test agency
    dbLogger.info('Test 1: Creating test agency...');
    const [agency] = await db.insert(agencies).values({
      clerkOrgId: 'test_org_' + Date.now(),
      name: 'Test Agency',
      billingTier: 'starter',
      clientLimit: 5,
    }).returning();
    dbLogger.info({ agencyId: agency.id }, '✅ Agency created');

    // Test 2: Create a test user
    dbLogger.info('Test 2: Creating test user...');
    const [user] = await db.insert(users).values({
      clerkUserId: 'test_user_' + Date.now(),
      agencyId: agency.id,
      email: 'test@example.com',
      name: 'Test User',
      role: 'owner',
    }).returning();
    dbLogger.info({ userId: user.id }, '✅ User created');

    // Test 3: Query user with agency relation
    dbLogger.info('Test 3: Querying user with agency...');
    const userWithAgency = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      with: {
        agency: true,
      },
    });
    dbLogger.info({
      userName: userWithAgency?.name,
      agencyName: userWithAgency?.agency?.name
    }, '✅ Query with relations works');

    // Test 4: Test query-matcher service functions
    dbLogger.info('Test 4: Testing query-matcher functions...');
    const [client] = await db.insert(await import('./db/schema.js').then(m => m.clientAccounts)).values({
      agencyId: agency.id,
      name: 'Test Client',
    }).returning();

    const { getOrCreateQuery } = await import('./services/query-matcher.service.js');
    const query1 = await getOrCreateQuery(client.id, 'Test Query');
    const query2 = await getOrCreateQuery(client.id, 'Test Query'); // Should return same

    if (query1.id === query2.id) {
      dbLogger.info({ queryId: query1.id }, '✅ Query deduplication works');
    } else {
      throw new Error('Query deduplication failed');
    }

    // Clean up test data
    dbLogger.info('Cleaning up test data...');
    await db.delete(searchQueries).where(eq(searchQueries.id, query1.id));
    await db.delete(users).where(eq(users.id, user.id));
    await db.delete(agencies).where(eq(agencies.id, agency.id));

    dbLogger.info('✅ All migration tests passed!');
    process.exit(0);
  } catch (error) {
    dbLogger.error({ error }, '❌ Migration test failed');
    process.exit(1);
  }
}

testMigrations();
