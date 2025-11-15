import { Pool } from 'pg';
import { dbLogger } from '@/utils/logger';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30_000
});

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const start = Date.now();
  const client = await pool.connect();

  try {
    const result = await client.query(text, params);
    dbLogger.debug({ text, duration: Date.now() - start, rows: result.rowCount }, 'query executed');
    return result.rows as T[];
  } catch (error) {
    dbLogger.error({ text, params, error }, 'query failed');
    throw error;
  } finally {
    client.release();
  }
}

export async function testConnection() {
  const [{ now }] = await query<{ now: string }>('SELECT NOW()');
  dbLogger.info({ time: now }, 'database connection successful');
}
