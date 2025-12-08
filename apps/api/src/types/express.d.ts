import { SignedInAuthObject, SignedOutAuthObject } from '@clerk/backend/internal';
import { PendingSessionOptions } from '@clerk/types';

declare global {
  namespace Express {
    interface Request {
      /**
       * Clerk authentication function populated by clerkMiddleware.
       * Call as a function to get the auth object: req.auth()
       *
       * Also available as a property (deprecated) for backward compatibility,
       * which returns the auth object directly with userId, orgId, sessionId, etc.
       */
      auth: ((options?: PendingSessionOptions) => SignedInAuthObject | SignedOutAuthObject) &
        Partial<SignedInAuthObject>;
    }
  }
}

export {};
