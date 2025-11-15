import crypto from 'crypto';
import { db, searchQueries } from '@/db/index.js';
import { eq, and } from 'drizzle-orm';

export function normalizeQuery(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}

export function hashQuery(value: string) {
  return crypto.createHash('md5').update(value).digest('hex');
}

export async function getOrCreateQuery(clientId: string, queryText: string) {
  const normalized = normalizeQuery(queryText);
  const hash = hashQuery(normalized);

  // Check if query already exists using Drizzle
  const existing = await db
    .select()
    .from(searchQueries)
    .where(
      and(
        eq(searchQueries.clientAccountId, clientId),
        eq(searchQueries.queryHash, hash)
      )
    )
    .limit(1);

  if (existing.length) {
    return existing[0];
  }

  // Insert new query using Drizzle
  const [inserted] = await db
    .insert(searchQueries)
    .values({
      clientAccountId: clientId,
      queryText,
      queryNormalized: normalized,
      queryHash: hash,
    })
    .returning();

  return inserted;
}

export async function matchQueries(_clientId: string) {
  return [];
}
