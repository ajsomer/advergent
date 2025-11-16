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

    // Fetch user from database or create if doesn't exist
    let user = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, auth.userId))
      .limit(1);

    if (!user.length) {
      authLogger.info({ clerkUserId: auth.userId }, 'User not found in database, fetching from Clerk');

      // Fetch user details from Clerk
      try {
        const clerkUser = await clerkClient.users.getUser(auth.userId);

        // Create agency first (for now, create a default agency per user)
        const { agencies } = await import('@/db/schema.js');
        const [agency] = await db
          .insert(agencies)
          .values({
            name: `${clerkUser.firstName || 'User'}'s Agency`,
            clerkOrgId: auth.orgId || null,
            billingTier: 'starter',
            clientLimit: 5,
          })
          .returning();

        // Create user in database
        user = await db
          .insert(users)
          .values({
            clerkUserId: auth.userId,
            agencyId: agency.id,
            email: clerkUser.emailAddresses[0]?.emailAddress || '',
            name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User',
            role: 'owner',
          })
          .returning();

        authLogger.info({ clerkUserId: auth.userId, userId: user[0].id }, 'User auto-created from Clerk');
      } catch (error) {
        authLogger.error({ error, clerkUserId: auth.userId }, 'Failed to create user from Clerk');
        return res.status(500).json({ error: 'Failed to create user' });
      }
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
