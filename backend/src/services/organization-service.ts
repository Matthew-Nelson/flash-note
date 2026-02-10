import type pg from 'pg';
import * as Sentry from '@sentry/node';
import { db } from '../db/index.js';
import { createOrganization, findOrganizationByIdForUpdate } from '../db/queries/organizations.js';
import type { Organization } from '../db/queries/organizations.js';
import { addMember, countBillableSeats, hasActiveMembership } from '../db/queries/organization-members.js';
import { findByCodeForUpdate, validateCodeRedeemable, markCodeAsUsed } from '../db/queries/invite-codes.js';
import { updateUserOrganization } from '../db/queries/users.js';
import { AppError } from '../middleware/error-handler.js';

interface JoinResult {
  organizationId: string;
  organizationName: string;
  codeId: string;
}

class OrganizationService {
  /**
   * Create a new organization with an owner.
   * Used by Stripe webhook (Wave 3), defined now for testability.
   *
   * Owner is non-billable by default: clinic admin/practice manager doesn't
   * consume a clinical seat; can be toggled from team dashboard if they also
   * generate notes.
   */
  async createOrganization(
    name: string,
    maxSeats: number,
    ownerId: string,
    client: pg.PoolClient
  ): Promise<Organization> {
    const org = await createOrganization(client, name, maxSeats);
    await addMember(client, org.id, ownerId, 'owner', false);
    await updateUserOrganization(client, ownerId, org.id);
    return org;
  }

  /**
   * Join an organization via clinic invite code.
   * For the POST /organization/join endpoint (existing user re-join).
   *
   * Owns the full transaction including invite code handling.
   */
  async joinOrganization(userId: string, inviteCode: string): Promise<JoinResult> {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Lock invite code (FOR UPDATE)
      const validatedCode = await findByCodeForUpdate(client, inviteCode);
      if (!validatedCode) {
        throw new AppError(400, 'invalid_invite_code', 'This invite code is invalid or has expired');
      }

      const invalidReason = validateCodeRedeemable(validatedCode);
      if (invalidReason) {
        throw new AppError(400, 'invalid_invite_code', 'This invite code is invalid or has expired');
      }

      // Validate code type is 'clinic'
      if (validatedCode.type !== 'clinic') {
        throw new AppError(400, 'invalid_code_type', 'This code is not a clinic invite code');
      }

      // Fail-secure: clinic code MUST have an organizationId
      if (!validatedCode.organizationId) {
        throw new AppError(500, 'invalid_invite_code', 'Clinic invite code missing organization');
      }

      // Lock org row (FOR UPDATE) for seat allocation
      const orgRow = await findOrganizationByIdForUpdate(client, validatedCode.organizationId);
      if (!orgRow) {
        throw new AppError(500, 'invalid_invite_code', 'Organization not found for clinic invite code');
      }

      // Count billable seats
      const billableSeats = await countBillableSeats(client, validatedCode.organizationId);
      if (billableSeats >= orgRow.maxSeats) {
        throw new AppError(409, 'no_seats_available',
          'This clinic has no available seats. Contact your clinic administrator.');
      }

      // Check user has no active membership (authoritative check inside transaction).
      // Uses FOR UPDATE to serialize concurrent join attempts for the same user.
      const alreadyMember = await hasActiveMembership(client, userId);
      if (alreadyMember) {
        throw new AppError(409, 'already_in_organization',
          'You are already a member of an organization');
      }

      // Add member
      await addMember(client, validatedCode.organizationId, userId, 'member', true);

      // Denormalize
      await updateUserOrganization(client, userId, validatedCode.organizationId);

      // Mark invite code as used
      await markCodeAsUsed(client, validatedCode.id, userId);

      await client.query('COMMIT');

      return {
        organizationId: validatedCode.organizationId,
        organizationName: orgRow.name,
        codeId: validatedCode.id,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      // Capture unexpected errors (DB failures, etc.) but not expected AppErrors
      if (!(error instanceof AppError)) {
        Sentry.captureException(error, {
          extra: {
            source: 'organization_service',
            errorType: 'join_organization_failed',
            userId,
          },
        });
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

export const organizationService = new OrganizationService();
