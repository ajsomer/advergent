import crypto from 'crypto';
import { query } from '@/db';

export function normalizeQuery(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}

export function hashQuery(value: string) {
  return crypto.createHash('md5').update(value).digest('hex');
}

export async function getOrCreateQuery(clientId: string, queryText: string) {
  const normalized = normalizeQuery(queryText);
  const hash = hashQuery(normalized);

  const existing = await query(
    `SELECT * FROM search_queries WHERE client_account_id = $1 AND query_hash = $2`,
    [clientId, hash]
  );

  if (existing.length) {
    return existing[0];
  }

  const inserted = await query(
    `INSERT INTO search_queries (client_account_id, query_text, query_normalized, query_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [clientId, queryText, normalized, hash]
  );

  return inserted[0];
}

export async function matchQueries(_clientId: string) {
  return [];
}
