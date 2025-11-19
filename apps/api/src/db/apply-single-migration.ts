import postgres from 'postgres';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
}

const sql = postgres(process.env.DATABASE_URL);

async function applyMigration() {
    try {
        const migrationPath = join(__dirname, '../../drizzle/0006_watery_king_bedlam.sql');
        const migrationSQL = await readFile(migrationPath, 'utf-8');

        console.log('Applying migration 0006_watery_king_bedlam.sql...');

        await sql.begin(async (sql) => {
            await sql.unsafe(migrationSQL);

            // Record in migrations table
            await sql`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES ('0006_watery_king_bedlam', ${Date.now()})
        ON CONFLICT DO NOTHING
      `;
        });

        console.log('✓ Migration applied successfully');
    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    } finally {
        await sql.end();
    }
}

applyMigration();
