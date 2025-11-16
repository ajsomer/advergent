import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import { dbLogger } from '@/utils/logger.js';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

// Create postgres.js client for Drizzle
const queryClient = postgres(process.env.DATABASE_URL, {
  max: 10,
  idle_timeout: 30,
  ssl: 'require',
  onnotice: (notice) => dbLogger.debug({ notice }, 'postgres notice'),
});

// Create Drizzle instance with schema and logging
export const db = drizzle(queryClient, {
  schema,
  logger: {
    logQuery(query, params) {
      dbLogger.debug({ query, params }, 'drizzle query');
    },
  },
});

// Export schema for use in queries
export * from './schema.js';

// Helper for raw queries when needed (backwards compatibility)
export const rawQuery = queryClient;

// Legacy query function for backwards compatibility during migration
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const start = Date.now();
  try {
    const result = await queryClient.unsafe(text, params as any[]);
    dbLogger.debug({ text, duration: Date.now() - start, rows: result.count }, 'legacy query executed');
    return result as unknown as T[];
  } catch (error) {
    dbLogger.error({ text, params, error }, 'legacy query failed');
    throw error;
  }
}

export async function testConnection() {
  try {
    const result = await queryClient`SELECT NOW() as now`;
    dbLogger.info({ time: result[0].now }, 'database connection successful');
  } catch (error) {
    dbLogger.error({ error }, 'database connection failed');
    throw error;
  }
}
