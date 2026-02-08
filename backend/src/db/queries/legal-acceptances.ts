import type pg from 'pg';
import { LEGAL_DOCUMENT_VERSIONS } from '../../config.js';
import type { LegalAcceptanceRow } from '../../types/database.js';

/**
 * Record legal consent for all document types.
 * Inserts one row per document type (baa, terms_of_service, privacy_policy).
 * Must be called within a transaction using the provided client.
 */
export async function recordLegalAcceptances(
  client: pg.PoolClient,
  userId: string,
  ipAddress: string | null,
  userAgent: string | null
): Promise<LegalAcceptanceRow[]> {
  const rows: LegalAcceptanceRow[] = [];

  for (const [docType, version] of Object.entries(LEGAL_DOCUMENT_VERSIONS)) {
    const result = await client.query<LegalAcceptanceRow>(
      `INSERT INTO legal_acceptances (user_id, document_type, document_version, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, docType, version, ipAddress, userAgent]
    );
    rows.push(result.rows[0]!);
  }

  return rows;
}
