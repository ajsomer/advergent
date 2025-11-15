import { Router } from 'express';
import { Webhook } from 'svix';
import { WebhookEvent } from '@clerk/backend';
import { db, users, agencies } from '@/db/index.js';
import { eq } from 'drizzle-orm';
import { logger } from '@/utils/logger.js';

const router = Router();

/**
 * Clerk webhook endpoint for syncing users and organizations to database
 *
 * Handles events:
 * - user.created: Create user in database
 * - user.updated: Update user in database
 * - organization.created: Create agency in database
 * - organizationMembership.created: Link user to agency
 * - organizationMembership.updated: Update user role
 * - organizationMembership.deleted: Remove user from agency
 */
router.post('/webhooks/clerk', async (req, res) => {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    logger.error('Missing CLERK_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const svix_id = req.headers['svix-id'] as string;
  const svix_timestamp = req.headers['svix-timestamp'] as string;
  const svix_signature = req.headers['svix-signature'] as string;

  if (!svix_id || !svix_timestamp || !svix_signature) {
    logger.warn('Missing svix headers');
    return res.status(400).json({ error: 'Missing svix headers' });
  }

  const webhook = new Webhook(WEBHOOK_SECRET);
  let event: WebhookEvent;

  try {
    event = webhook.verify(JSON.stringify(req.body), {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    logger.error({ err }, 'Webhook verification failed');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  logger.info({ type: event.type }, 'Clerk webhook received');

  try {
    switch (event.type) {
      case 'user.created': {
        // Create user in database
        // Note: User will be linked to agency when organizationMembership.created fires
        // Use a temporary placeholder agency ID
        const email = event.data.email_addresses[0]?.email_address;
        const name = `${event.data.first_name || ''} ${event.data.last_name || ''}`.trim() || 'User';

        if (!email) {
          logger.error({ clerkUserId: event.data.id }, 'User created without email');
          return res.status(400).json({ error: 'User must have email' });
        }

        // Check if agency with placeholder ID exists, if not create it
        let placeholderAgency = await db.query.agencies.findFirst({
          where: eq(agencies.clerkOrgId, 'placeholder'),
        });

        if (!placeholderAgency) {
          const [newPlaceholderAgency] = await db
            .insert(agencies)
            .values({
              clerkOrgId: 'placeholder',
              name: 'Pending Organization',
              billingTier: 'starter',
              clientLimit: 5,
            })
            .returning();
          placeholderAgency = newPlaceholderAgency;
        }

        await db.insert(users).values({
          clerkUserId: event.data.id,
          email,
          name,
          agencyId: placeholderAgency.id,
          role: 'member',
        });

        logger.info({ clerkUserId: event.data.id, email }, 'User created in database');
        break;
      }

      case 'user.updated': {
        // Update user in database
        const email = event.data.email_addresses[0]?.email_address;
        const name = `${event.data.first_name || ''} ${event.data.last_name || ''}`.trim();

        await db
          .update(users)
          .set({
            email,
            name: name || undefined,
          })
          .where(eq(users.clerkUserId, event.data.id));

        logger.info({ clerkUserId: event.data.id }, 'User updated in database');
        break;
      }

      case 'organization.created': {
        // Create agency in database
        await db.insert(agencies).values({
          clerkOrgId: event.data.id,
          name: event.data.name,
          billingTier: 'starter', // Default tier
          clientLimit: 5, // Default limit for starter
        });

        logger.info({ clerkOrgId: event.data.id, name: event.data.name }, 'Agency created in database');
        break;
      }

      case 'organizationMembership.created': {
        // Link user to agency
        const membership = event.data;
        const userId = membership.public_user_data.user_id;
        const orgId = membership.organization.id;
        const clerkRole = membership.role;

        // Map Clerk roles to our roles
        let role: 'owner' | 'admin' | 'member' = 'member';
        if (clerkRole === 'org:admin') {
          role = 'admin';
        } else if (clerkRole === 'org:owner') {
          role = 'owner';
        }

        // Find the agency
        const agency = await db.query.agencies.findFirst({
          where: eq(agencies.clerkOrgId, orgId),
        });

        if (!agency) {
          logger.error({ orgId }, 'Agency not found for membership');
          return res.status(404).json({ error: 'Agency not found' });
        }

        // Update user with agency and role
        await db
          .update(users)
          .set({
            agencyId: agency.id,
            role,
          })
          .where(eq(users.clerkUserId, userId));

        logger.info(
          { userId, orgId, role },
          'User linked to agency'
        );
        break;
      }

      case 'organizationMembership.updated': {
        // Update user role if changed
        const membership = event.data;
        const userId = membership.public_user_data.user_id;
        const clerkRole = membership.role;

        // Map Clerk roles to our roles
        let role: 'owner' | 'admin' | 'member' = 'member';
        if (clerkRole === 'org:admin') {
          role = 'admin';
        } else if (clerkRole === 'org:owner') {
          role = 'owner';
        }

        await db
          .update(users)
          .set({ role })
          .where(eq(users.clerkUserId, userId));

        logger.info({ userId, role }, 'User role updated');
        break;
      }

      case 'organizationMembership.deleted': {
        // When user leaves organization, move them to placeholder agency
        const membership = event.data;
        const userId = membership.public_user_data.user_id;

        // Get placeholder agency
        let placeholderAgency = await db.query.agencies.findFirst({
          where: eq(agencies.clerkOrgId, 'placeholder'),
        });

        if (!placeholderAgency) {
          const [newPlaceholderAgency] = await db
            .insert(agencies)
            .values({
              clerkOrgId: 'placeholder',
              name: 'Pending Organization',
              billingTier: 'starter',
              clientLimit: 5,
            })
            .returning();
          placeholderAgency = newPlaceholderAgency;
        }

        await db
          .update(users)
          .set({
            agencyId: placeholderAgency.id,
            role: 'member',
          })
          .where(eq(users.clerkUserId, userId));

        logger.info({ userId }, 'User removed from organization');
        break;
      }

      default:
        logger.debug({ type: event.type }, 'Unhandled webhook event');
    }

    return res.json({ success: true });
  } catch (error) {
    logger.error({ error, eventType: event.type }, 'Error processing webhook');
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
