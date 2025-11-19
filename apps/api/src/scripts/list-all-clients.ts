import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { clientAccounts } from '../db/schema.js';

async function listAllClients() {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required');
    }

    const client = postgres(process.env.DATABASE_URL, { ssl: 'require' });
    const db = drizzle(client);

    try {
        console.log('=== All Clients in Database ===\n');

        const clients = await db
            .select({
                id: clientAccounts.id,
                name: clientAccounts.name,
                googleAdsCustomerId: clientAccounts.googleAdsCustomerId,
                searchConsoleSiteUrl: clientAccounts.searchConsoleSiteUrl,
                ga4PropertyId: clientAccounts.ga4PropertyId,
                isActive: clientAccounts.isActive,
                createdAt: clientAccounts.createdAt,
            })
            .from(clientAccounts);

        console.log(`Found ${clients.length} client(s):\n`);

        for (const client of clients) {
            console.log(`📋 ${client.name}`);
            console.log(`   ID: ${client.id}`);
            console.log(`   Google Ads: ${client.googleAdsCustomerId || '❌ Not connected'}`);
            console.log(`   Search Console: ${client.searchConsoleSiteUrl || '❌ Not connected'}`);
            console.log(`   GA4: ${client.ga4PropertyId || '❌ Not connected'}`);
            console.log(`   Active: ${client.isActive ? '✅' : '❌'}`);
            console.log(`   Created: ${client.createdAt}`);
            console.log('');
        }

    } catch (error) {
        console.error('Error listing clients:', error);
    } finally {
        await client.end();
    }
}

listAllClients();
