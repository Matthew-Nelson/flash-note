import type pg from 'pg';
import { db } from '../index.js';
import type { OrganizationMemberRow } from '../../types/database.js';
import type { OrgRole } from '../../types/index.js';

/**
 * Application-level membership type (camelCase)
 */
export interface ActiveMembership {
  organizationId: string;
  role: OrgRole;
  isBillable: boolean;
}

/**
 * Add a member to an organization within a transaction.
 */
export async function addMember(
  client: pg.PoolClient,
  organizationId: string,
  userId: string,
  role: OrgRole,
  isBillable: boolean
): Promise<void> {
  await client.query(
    `INSERT INTO organization_members (organization_id, user_id, role, is_billable)
     VALUES ($1, $2, $3, $4)`,
    [organizationId, userId, role, isBillable]
  );
}

/**
 * Find the user's active membership (WHERE removed_at IS NULL).
 * Returns null if the user has no active membership.
 * Uses the connection pool — for use outside transactions.
 */
export async function findActiveMembership(
  userId: string
): Promise<ActiveMembership | null> {
  const result = await db.query<OrganizationMemberRow>(
    `SELECT id, organization_id, user_id, role, is_billable, joined_at, removed_at
     FROM organization_members
     WHERE user_id = $1 AND removed_at IS NULL`,
    [userId]
  );

  if (result.rows.length === 0) return null;
  const row = result.rows[0]!;
  return {
    organizationId: row.organization_id,
    role: row.role as OrgRole,
    isBillable: row.is_billable,
  };
}

/**
 * Check if a user has any active membership, within a transaction.
 * Uses FOR UPDATE to serialize concurrent join attempts for the same user.
 */
export async function hasActiveMembership(
  client: pg.PoolClient,
  userId: string
): Promise<boolean> {
  const result = await client.query<{ id: string }>(
    `SELECT id FROM organization_members
     WHERE user_id = $1 AND removed_at IS NULL
     FOR UPDATE`,
    [userId]
  );

  return result.rows.length > 0;
}

/**
 * Find membership by org and user (including removed members, for re-join checks).
 */
export async function findMemberByOrgAndUser(
  orgId: string,
  userId: string
): Promise<OrganizationMemberRow | null> {
  const result = await db.query<OrganizationMemberRow>(
    `SELECT id, organization_id, user_id, role, is_billable, joined_at, removed_at
     FROM organization_members
     WHERE organization_id = $1 AND user_id = $2`,
    [orgId, userId]
  );

  if (result.rows.length === 0) return null;
  return result.rows[0]!;
}

/**
 * Count billable seats for an organization within a transaction.
 * Caller must lock the org row first via FOR UPDATE to serialize seat allocation.
 */
export async function countBillableSeats(
  client: pg.PoolClient,
  orgId: string
): Promise<number> {
  const result = await client.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM organization_members
     WHERE organization_id = $1 AND removed_at IS NULL AND is_billable = TRUE`,
    [orgId]
  );

  return parseInt(result.rows[0]!.count, 10);
}

/**
 * Remove a member from an organization (soft delete via removed_at).
 * Must be called within a transaction (uses PoolClient).
 */
export async function removeMember(
  client: pg.PoolClient,
  orgId: string,
  userId: string
): Promise<void> {
  await client.query(
    `UPDATE organization_members
     SET removed_at = NOW()
     WHERE organization_id = $1 AND user_id = $2 AND removed_at IS NULL`,
    [orgId, userId]
  );
}
