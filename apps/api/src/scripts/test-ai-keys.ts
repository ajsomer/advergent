import dotenv from 'dotenv';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from apps/api root (assuming script is in apps/api/src/scripts)
const envPath = path.resolve(__dirname, '../../.env');
console.log(`Loading .env from: ${envPath}`);
dotenv.config({ path: envPath });

async function testKeys() {
    console.log('Testing AI API Keys...');

    // Test Anthropic
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
        console.log('\nTesting Anthropic...');
        try {
            const anthropic = new Anthropic({ apiKey: anthropicKey });
            await anthropic.messages.create({
                model: 'claude-3-haiku-20240307',
                max_tokens: 10,
                messages: [{ role: 'user', content: 'Hello' }],
            });
            console.log('✅ Anthropic key is working!');
        } catch (error: any) {
            console.error('❌ Anthropic key failed:', error.message);
        }
    } else {
        console.log('⚠️ Anthropic key not found in .env');
    }

    // Test OpenAI
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
        console.log('\nTesting OpenAI...');
        try {
            const openai = new OpenAI({ apiKey: openaiKey });
            await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: 'Hello' }],
                max_tokens: 5,
            });
            console.log('✅ OpenAI key is working!');
        } catch (error: any) {
            console.error('❌ OpenAI key failed:', error.message);
        }
    } else {
        console.log('⚠️ OpenAI key not found in .env');
    }
}

testKeys();
