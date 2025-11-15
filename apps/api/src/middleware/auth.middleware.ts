import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '@/db';
import { authLogger } from '@/utils/logger';

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

    const sessions = await query(
      `SELECT user_id FROM user_sessions
       WHERE id = $1 AND access_token = $2 AND access_token_expires_at > NOW()`,
      [decoded.sessionId, token]
    );

    if (!sessions.length) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const users = await query(
      `SELECT id, email, name, agency_id, role FROM users WHERE id = $1`,
      [decoded.userId]
    );

    if (!users.length) {
      return res.status(401).json({ error: 'User not found' });
    }

    (req as any).user = users[0];
    (req as any).sessionId = decoded.sessionId;

    return next();
  } catch (error) {
    authLogger.warn({ error }, 'authentication failed');
    return res.status(401).json({ error: 'Invalid token' });
  }
}
