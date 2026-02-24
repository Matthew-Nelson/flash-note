import 'server-only';

import type pg from 'pg';

import { LEGAL_DOCUMENT_VERSIONS } from '@/server/db/config';
import { sanitizeIpAddress } from '@/server/lib/request-utils';
import type { LegalAcceptanceRow } from '@/lib/types/database';

/**
 * Record legal consent for all document types.
 * Inserts one row per document type (baa, terms_of_service, privacy_policy).
 * Must be called within a transaction using the provided client.
 */
// H-12 fix: Check rows.length before accessing result.rows[0]
export async function recordLegalAcceptances(
  client: pg.PoolClient,
  userId: string,
  ipAddress: string | null,
  userAgent: string | null
): Promise<LegalAcceptanceRow[]> {
  const safeIp = sanitizeIpAddress(ipAddress);
  const rows: LegalAcceptanceRow[] = [];

  for (const [docType, version] of Object.entries(LEGAL_DOCUMENT_VERSIONS)) {
    const result = await client.query<LegalAcceptanceRow>(
      `INSERT INTO legal_acceptances (user_id, document_type, document_version, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, document_type, document_version, ip_address, user_agent, accepted_at`,
      [userId, docType, version, safeIp, userAgent]
    );
    if (result.rows.length === 0) {
      throw new Error(`recordLegalAcceptances: INSERT RETURNING returned no rows for ${docType}`);
    }
    rows.push(result.rows[0]);
  }

  return rows;
}
