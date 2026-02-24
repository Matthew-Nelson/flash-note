import 'server-only';

import type pg from 'pg';

import { db } from '@/server/db';
import type { SubscriptionStatus } from '@/server/types';
import type { OrganizationRow, OrgSubscriptionRow } from '@/lib/types/database';

// Explicit column list — never SELECT *
const ORG_COLUMNS = `
  id, name, max_seats, stripe_customer_id, subscription_id,
  subscription_status, trial_ends_at, created_at, updated_at
`;

/**
 * Application-level organization type (camelCase)
 */
export interface Organization {
  id: string;
  name: string;
  maxSeats: number;
  stripeCustomerId: string | null;
  subscriptionId: string | null;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Transform database row (snake_case) to application type (camelCase)
 */
function rowToOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    maxSeats: row.max_seats,
    stripeCustomerId: row.stripe_customer_id,
    subscriptionId: row.subscription_id,
    subscriptionStatus: row.subscription_status,
    trialEndsAt: row.trial_ends_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// H-12 fix: Check rows.length before accessing result.rows[0]
export async function createOrganization(
  client: pg.PoolClient,
  name: string,
  maxSeats: number
): Promise<Organization> {
  const result = await client.query<OrganizationRow>(
    `INSERT INTO organizations (name, max_seats)
     VALUES ($1, $2)
     RETURNING ${ORG_COLUMNS}`,
    [name, maxSeats]
  );

  if (result.rows.length === 0) {
    throw new Error('createOrganization: INSERT RETURNING returned no rows');
  }
  return rowToOrganization(result.rows[0]);
}

export async function findOrganizationById(id: string): Promise<Organization | null> {
  const result = await db.query<OrganizationRow>(
    `SELECT ${ORG_COLUMNS} FROM organizations WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) return null;
  return rowToOrganization(result.rows[0]);
}

/**
 * Find an organization by ID with FOR UPDATE lock for seat allocation.
 * Must be called within a transaction (uses PoolClient).
 */
// H-12 fix: Remove non-null assertion, use rows[0] after length check
export async function findOrganizationByIdForUpdate(
  client: pg.PoolClient,
  id: string
): Promise<{ maxSeats: number; name: string } | null> {
  const result = await client.query<{ max_seats: number; name: string }>(
    `SELECT max_seats, name FROM organizations WHERE id = $1 FOR UPDATE`,
    [id]
  );

  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return { maxSeats: row.max_seats, name: row.name };
}

/**
 * Get org subscription status with defense-in-depth membership check.
 * JOINs organizations + organization_members to verify the user is still an active member.
 */
export async function getOrgSubscription(
  orgId: string,
  userId: string
): Promise<OrgSubscriptionRow | null> {
  const result = await db.query<OrgSubscriptionRow>(
    `SELECT o.subscription_status, o.trial_ends_at
     FROM organizations o
     JOIN organization_members om ON om.organization_id = o.id
     WHERE o.id = $1 AND om.user_id = $2 AND om.removed_at IS NULL`,
    [orgId, userId]
  );

  if (result.rows.length === 0) return null;
  return result.rows[0];
}
