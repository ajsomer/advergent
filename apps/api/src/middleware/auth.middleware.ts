import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db, userSessions, users } from '@/db/index.js';
import { authLogger } from '@/utils/logger';
import { eq, and, gt } from 'drizzle-orm';

interface JWTPayload {
  userId: string;
  sessionId: string;
  type: 'access' | 'refresh';
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.access_token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as JWTPayload;

    // Check if session is valid using Drizzle
    const session = await db
      .select({ userId: userSessions.userId })
      .from(userSessions)
      .where(
        and(
          eq(userSessions.id, decoded.sessionId),
          eq(userSessions.accessToken, token),
          gt(userSessions.accessTokenExpiresAt, new Date())
        )
      )
      .limit(1);

    if (!session.length) {
      return res.status(401).json({ error: 'Session expired' });
    }

    // Get user details using Drizzle
    const user = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        agencyId: users.agencyId,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (!user.length) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Convert snake_case to camelCase for backward compatibility
    (req as any).user = {
      id: user[0].id,
      email: user[0].email,
      name: user[0].name,
      agency_id: user[0].agencyId,
      role: user[0].role,
    };
    (req as any).sessionId = decoded.sessionId;

    return next();
  } catch (error) {
    authLogger.warn({ error }, 'authentication failed');
    return res.status(401).json({ error: 'Invalid token' });
  }
}
