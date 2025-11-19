import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../utils/logger';

export class ContentFetcherService {
    /**
     * Fetches and extracts main text content from a URL
     */
    async fetchPageContent(url: string): Promise<string | null> {
        try {
            logger.info({ url }, 'Fetching page content');

            const response = await axios.get(url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Advergent-AI-Analyzer/1.0'
                }
            });

            const html = response.data;
            const $ = cheerio.load(html);

            // Remove clutter
            $('script').remove();
            $('style').remove();
            $('nav').remove();
            $('footer').remove();
            $('header').remove();
            $('iframe').remove();
            $('noscript').remove();
            $('[role="navigation"]').remove();
            $('[role="banner"]').remove();
            $('[role="contentinfo"]').remove();

            // Extract text from body
            let text = $('body').text();

            // Clean whitespace
            text = text.replace(/\s+/g, ' ').trim();

            // Truncate if excessively long (e.g. > 15k chars) to save tokens
            if (text.length > 15000) {
                text = text.substring(0, 15000) + '...[truncated]';
            }

            logger.info({ url, length: text.length }, 'Successfully extracted page content');
            return text;
        } catch (error) {
            logger.error({ url, error }, 'Failed to fetch page content');
            return null;
        }
    }
}

export const contentFetcher = new ContentFetcherService();
