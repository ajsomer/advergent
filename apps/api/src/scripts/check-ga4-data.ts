import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { clientAccounts, ga4Metrics } from '../db/schema.js';
import { isNotNull } from 'drizzle-orm';

async function checkGA4Data() {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required');
    }

    const client = postgres(process.env.DATABASE_URL, { ssl: 'require' });
    const db = drizzle(client);

    try {
        console.log('=== Checking GA4 Data in Database ===\n');

        // Check client_accounts for GA4 connections
        console.log('1. Checking client_accounts for GA4 connections:');
        const clientsWithGA4 = await db
            .select({
                id: clientAccounts.id,
                name: clientAccounts.name,
                ga4PropertyId: clientAccounts.ga4PropertyId,
                hasRefreshToken: clientAccounts.ga4RefreshTokenEncrypted,
            })
            .from(clientAccounts)
            .where(isNotNull(clientAccounts.ga4PropertyId));

        if (clientsWithGA4.length === 0) {
            console.log('   ❌ No clients have GA4 connected.\n');
        } else {
            console.log(`   ✅ Found ${clientsWithGA4.length} client(s) with GA4 connected:\n`);
            for (const client of clientsWithGA4) {
                console.log(`   - ${client.name} (ID: ${client.id})`);
                console.log(`     Property ID: ${client.ga4PropertyId}`);
                console.log(`     Has Refresh Token: ${!!client.hasRefreshToken}`);
                console.log('');
            }
        }

        // Check ga4_metrics table
        console.log('2. Checking ga4_metrics table:');
        const metricsCount = await db
            .select()
            .from(ga4Metrics)
            .limit(10);

        if (metricsCount.length === 0) {
            console.log('   ❌ No GA4 metrics data found.\n');
        } else {
            console.log(`   ✅ Found ${metricsCount.length} GA4 metric records (showing first 10):\n`);
            for (const metric of metricsCount) {
                console.log(`   - Date: ${metric.date}`);
                console.log(`     Client ID: ${metric.clientAccountId}`);
                console.log(`     Sessions: ${metric.sessions}`);
                console.log(`     Engagement Rate: ${metric.engagementRate}`);
                console.log('');
            }
        }

    } catch (error) {
        console.error('Error checking GA4 data:', error);
    } finally {
        await client.end();
    }
}

checkGA4Data();
