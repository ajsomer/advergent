import { Request, Response, NextFunction } from 'express';
import { clerkClient, getAuth } from '@clerk/express';
import { authLogger } from '@/utils/logger';
import { db, users } from '@/db/index.js';
import { eq } from 'drizzle-orm';

// Extend Express Request to include Clerk auth
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string | null;
        orgId: string | null;
        sessionId: string | null;
      };
    }
  }
}

/**
 * Clerk authentication middleware
 * Validates Clerk session token and attaches user/org info to request
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = getAuth(req);

    if (!auth.userId) {
      authLogger.warn('No Clerk userId in request');
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Optionally fetch user from your database
    // This allows you to store additional user data beyond what Clerk provides
    const user = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, auth.userId))
      .limit(1);

    if (!user.length) {
      authLogger.warn({ clerkUserId: auth.userId }, 'User not found in database');
      // Optionally create user here via webhook sync
      return res.status(401).json({ error: 'User not found' });
    }

    // Attach auth info to request
    req.auth = {
      userId: auth.userId,
      orgId: auth.orgId || null,
      sessionId: auth.sessionId || null,
    };

    // Attach user data to request for convenience
    (req as any).user = user[0];

    authLogger.debug({ userId: auth.userId, orgId: auth.orgId }, 'User authenticated');

    return next();
  } catch (error) {
    authLogger.error({ error }, 'Authentication failed');
    return res.status(401).json({ error: 'Invalid session' });
  }
}

/**
 * Optional: Require organization context
 * Use this for routes that should only be accessed within an organization
 */
export function requireOrganization(req: Request, res: Response, next: NextFunction) {
  if (!req.auth?.orgId) {
    authLogger.warn({ userId: req.auth?.userId }, 'No organization context');
    return res.status(403).json({ error: 'Organization context required' });
  }
  return next();
}
