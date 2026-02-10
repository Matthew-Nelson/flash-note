import type pg from 'pg';
import { db } from '../index.js';
import type { InviteCodeRow } from '../../types/database.js';
import { generateCodeString } from '../../utils/invite-code-format.js';

// Explicit column list — never SELECT *
const INVITE_CODE_COLUMNS = `
  id, code, type, organization_id, created_by,
  used_by, used_at, expires_at, is_active, created_at
`;

/**
 * Application-level invite code type (camelCase)
 */
export interface InviteCode {
  id: string;
  code: string;
  type: 'beta' | 'clinic';
  organizationId: string | null;
  createdBy: string;
  usedBy: string | null;
  usedAt: Date | null;
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
}

/**
 * Transform database row (snake_case) to application type (camelCase)
 */
function rowToInviteCode(row: InviteCodeRow): InviteCode {
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    organizationId: row.organization_id,
    createdBy: row.created_by,
    usedBy: row.used_by,
    usedAt: row.used_at,
    expiresAt: row.expires_at,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

// Re-export for consumers that need code generation without DB dependency
export { generateCodeString } from '../../utils/invite-code-format.js';

/**
 * Generate a unique invite code, retrying on collision
 * With 31^8 (~852B) combinations, collisions are astronomically unlikely
 */
export async function generateUniqueCode(): Promise<string> {
  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const code = generateCodeString();
    const existing = await db.query<{ id: string }>(
      'SELECT id FROM invite_codes WHERE code = $1',
      [code]
    );
    if (existing.rows.length === 0) {
      return code;
    }
  }
  throw new Error('Failed to generate unique invite code after maximum retries');
}

/**
 * Create a new invite code in the database
 */
export async function createInviteCode(
  code: string,
  type: 'beta' | 'clinic',
  createdBy: string,
  expiresAt: Date,
  organizationId?: string | null
): Promise<InviteCode> {
  const result = await db.query<InviteCodeRow>(
    `INSERT INTO invite_codes (code, type, created_by, expires_at, organization_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${INVITE_CODE_COLUMNS}`,
    [code, type, createdBy, expiresAt, organizationId ?? null]
  );

  return rowToInviteCode(result.rows[0]!);
}

/**
 * Find an invite code by its code string (case-sensitive — caller must uppercase)
 */
export async function findByCode(code: string): Promise<InviteCode | null> {
  const result = await db.query<InviteCodeRow>(
    `SELECT ${INVITE_CODE_COLUMNS} FROM invite_codes WHERE code = $1`,
    [code]
  );

  if (result.rows.length === 0) return null;
  return rowToInviteCode(result.rows[0]!);
}

/**
 * Find an invite code by its code string with FOR UPDATE lock
 * Must be called within a transaction (uses PoolClient)
 * Prevents race conditions on code redemption
 */
export async function findByCodeForUpdate(
  client: pg.PoolClient,
  code: string
): Promise<InviteCode | null> {
  const result = await client.query<InviteCodeRow>(
    `SELECT ${INVITE_CODE_COLUMNS} FROM invite_codes WHERE code = $1 FOR UPDATE`,
    [code]
  );

  if (result.rows.length === 0) return null;
  return rowToInviteCode(result.rows[0]!);
}

/**
 * Mark an invite code as used by a specific user
 * Must be called within a transaction (uses PoolClient)
 */
export async function markCodeAsUsed(
  client: pg.PoolClient,
  codeId: string,
  userId: string
): Promise<void> {
  await client.query(
    `UPDATE invite_codes SET used_by = $1, used_at = NOW() WHERE id = $2`,
    [userId, codeId]
  );
}

/**
 * Revoke an invite code (set is_active = false)
 */
export async function revokeCode(codeId: string): Promise<void> {
  await db.query(
    'UPDATE invite_codes SET is_active = FALSE WHERE id = $1',
    [codeId]
  );
}

/**
 * Validate that an invite code is redeemable
 * Returns null if valid, or a reason string if invalid
 */
export function validateCodeRedeemable(code: InviteCode): string | null {
  if (!code.isActive) return 'inactive';
  if (code.usedBy !== null) return 'already_used';
  if (new Date() > code.expiresAt) return 'expired';
  return null;
}
