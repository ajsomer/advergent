import crypto from 'crypto';
import { logger } from '@/utils/logger.js';

export interface TempOAuthSession {
  refreshToken: string;
  accessToken?: string;
  clientId: string;
  service: 'ads' | 'search_console' | 'ga4' | 'all';
  expiresAt: number;
}

/**
 * In-memory store for temporary OAuth sessions during account selection
 * Sessions expire after 10 minutes
 *
 * Note: In a multi-instance production environment, this should be replaced
 * with Redis-backed storage using Upstash.
 */
class TempOAuthStore {
  private sessions = new Map<string, TempOAuthSession>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired sessions every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 5 * 60 * 1000);
  }

  /**
   * Generates a secure random session token
   */
  generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Stores OAuth tokens temporarily with 10-minute expiration
   */
  storeSession(sessionToken: string, data: Omit<TempOAuthSession, 'expiresAt'>): void {
    this.sessions.set(sessionToken, {
      ...data,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    logger.info(
      { sessionToken: sessionToken.substring(0, 8) + '...', clientId: data.clientId, service: data.service },
      'OAuth session stored temporarily'
    );
  }

  /**
   * Retrieves OAuth session by token
   * Returns null if not found or expired
   */
  getSession(sessionToken: string): TempOAuthSession | null {
    const session = this.sessions.get(sessionToken);

    if (!session) {
      logger.debug({ sessionToken: sessionToken.substring(0, 8) + '...' }, 'OAuth session not found');
      return null;
    }

    // Check if expired
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionToken);
      logger.info({ sessionToken: sessionToken.substring(0, 8) + '...' }, 'OAuth session expired');
      return null;
    }

    return session;
  }

  /**
   * Deletes OAuth session
   */
  deleteSession(sessionToken: string): void {
    const deleted = this.sessions.delete(sessionToken);
    if (deleted) {
      logger.info({ sessionToken: sessionToken.substring(0, 8) + '...' }, 'OAuth session deleted');
    }
  }

  /**
   * Removes all expired sessions
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [token, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(token);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info({ cleanedCount }, 'Cleaned up expired OAuth sessions');
    }
  }

  /**
   * Clears cleanup interval (for graceful shutdown)
   */
  shutdown(): void {
    clearInterval(this.cleanupInterval);
    this.sessions.clear();
    logger.info('Temp OAuth store shutdown complete');
  }
}

// Export singleton instance
export const tempOAuthStore = new TempOAuthStore();

// Graceful shutdown handlers
process.on('SIGTERM', () => tempOAuthStore.shutdown());
process.on('SIGINT', () => tempOAuthStore.shutdown());
