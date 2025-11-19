import 'dotenv/config';
import { listGA4Properties } from '../services/ga4.service.js';

async function testGA4List() {
    try {
        console.log('Testing listGA4Properties with undefined token...');
        // @ts-ignore
        const properties = await listGA4Properties(undefined);
        console.log('Properties:', properties);
    } catch (error) {
        console.error('Caught error:', error);
    }
}

testGA4List();
