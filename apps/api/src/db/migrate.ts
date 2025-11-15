import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { dbLogger } from '@/utils/logger.js';

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  // Create a dedicated migration client (single connection)
  const migrationClient = postgres(process.env.DATABASE_URL, {
    max: 1,
    ssl: 'require',
  });

  const db = drizzle(migrationClient);

  try {
    dbLogger.info('Starting database migrations...');
    await migrate(db, { migrationsFolder: './drizzle' });
    dbLogger.info('Migrations completed successfully');
  } catch (err) {
    dbLogger.error({ err }, 'Migration failed');
    throw err;
  } finally {
    await migrationClient.end();
  }
}

runMigrations().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
