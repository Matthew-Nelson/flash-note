import 'server-only';

import { db } from '@/server/db';
import type { Patient, Pronoun, QueryScope } from '@/lib/types';
import type { PatientRow } from '@/lib/types/database';

/**
 * Data Access Layer for patients table.
 *
 * Rule 5 boundary: every function takes a `QueryScope` (or explicit user/org
 * ids on create) and filters all SQL by it. A user cannot read, update, or
 * archive a patient outside their scope.
 *
 * Search: LIKE metacharacters (% and _) in the search term are escaped before
 * being wrapped in `%...%` so user input cannot match unintended rows.
 *
 * Rule 10: all RETURNING paths defensively check `result.rows.length === 0`
 * before accessing `rows[0]`.
 */

const PATIENT_COLUMNS = `id, user_id, organization_id, first_name, last_name,
                         date_of_birth, pronoun, phone, email, context,
                         archived_at, created_at, updated_at`;

function rowToPatient(row: PatientRow): Patient {
  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
    pronoun: row.pronoun as Pronoun | null,
    phone: row.phone,
    email: row.email,
    context: row.context,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Build a scope WHERE-clause fragment starting at the given parameter index.
 * Returns both the SQL snippet ("user_id = $N") and the params array that
 * populates it, so the caller can append further params without shifting indexes.
 */
function scopeWhereClause(
  scope: QueryScope,
  startIdx: number
): { sql: string; params: unknown[] } {
  if (scope.type === 'user') {
    return { sql: `user_id = $${startIdx}`, params: [scope.userId] };
  }
  return {
    sql: `organization_id = $${startIdx}`,
    params: [scope.organizationId],
  };
}

export interface CreatePatientDalInput {
  firstName: string;
  lastName: string;
  dateOfBirth?: Date | string | null;
  pronoun?: Pronoun | null;
  phone?: string | null;
  email?: string | null;
  context?: string | null;
}

/**
 * Create a patient row. `scope` MUST include userId (every patient is anchored
 * to a single creating user) and may optionally include organizationId for
 * clinic-scoped patients.
 */
export async function createPatient(
  scope: { userId: string; organizationId: string | null },
  input: CreatePatientDalInput
): Promise<Patient> {
  const result = await db.query<PatientRow>(
    `INSERT INTO patients
       (user_id, organization_id, first_name, last_name, date_of_birth, pronoun, phone, email, context)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${PATIENT_COLUMNS}`,
    [
      scope.userId,
      scope.organizationId ?? null,
      input.firstName,
      input.lastName,
      input.dateOfBirth ?? null,
      input.pronoun ?? null,
      input.phone ?? null,
      input.email ?? null,
      input.context ?? null,
    ]
  );

  if (result.rows.length === 0) {
    throw new Error('createPatient: INSERT RETURNING returned no rows');
  }
  return rowToPatient(result.rows[0]);
}

/**
 * Find a single patient by ID within scope. Returns null if not found, archived,
 * or out-of-scope — callers cannot distinguish (defense-in-depth: do not leak
 * "patient exists but you can't see it").
 */
export async function findPatientById(
  scope: QueryScope,
  patientId: string
): Promise<Patient | null> {
  const { sql: scopeSql, params: scopeParams } = scopeWhereClause(scope, 1);
  const idIndex = scopeParams.length + 1;
  const result = await db.query<PatientRow>(
    `SELECT ${PATIENT_COLUMNS} FROM patients
     WHERE ${scopeSql} AND id = $${idIndex} AND archived_at IS NULL`,
    [...scopeParams, patientId]
  );

  if (result.rows.length === 0) return null;
  return rowToPatient(result.rows[0]);
}

export interface FindPatientsByScopeInput {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface FindPatientsByScopeResult {
  patients: Patient[];
  total: number;
}

/**
 * List patients within scope, optionally filtered by a search term.
 *
 * Search strategy: ILIKE against first_name, last_name, and the concatenated
 * "first last" string. LIKE metacharacters in the input are escaped to prevent
 * accidental wildcard matching from user input.
 *
 * Pagination: limit clamped to [1, 100] and offset clamped to >= 0 — defense
 * in depth so even a buggy caller can't blow past the cap.
 */
export async function findPatientsByScope(
  scope: QueryScope,
  input: FindPatientsByScopeInput = {}
): Promise<FindPatientsByScopeResult> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);

  const { sql: scopeSql, params: scopeParams } = scopeWhereClause(scope, 1);
  const paramList: unknown[] = [...scopeParams];

  let searchClause = '';
  if (input.search && input.search.trim().length > 0) {
    // Escape LIKE metacharacters (% and _) and the escape char (\) itself.
    const safe = input.search.trim().replace(/[\\%_]/g, '\\$&');
    const pattern = `%${safe}%`;
    paramList.push(pattern);
    const idx = paramList.length;
    searchClause =
      ` AND (first_name ILIKE $${idx} OR last_name ILIKE $${idx} OR (first_name || ' ' || last_name) ILIKE $${idx})`;
  }

  const countResult = await db.query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM patients
     WHERE ${scopeSql} AND archived_at IS NULL${searchClause}`,
    paramList
  );
  const total = countResult.rows[0]?.total ?? 0;

  paramList.push(limit, offset);
  const listResult = await db.query<PatientRow>(
    `SELECT ${PATIENT_COLUMNS} FROM patients
     WHERE ${scopeSql} AND archived_at IS NULL${searchClause}
     ORDER BY last_name, first_name
     LIMIT $${paramList.length - 1} OFFSET $${paramList.length}`,
    paramList
  );

  return {
    patients: listResult.rows.map((r) => rowToPatient(r)),
    total,
  };
}

export interface UpdatePatientDalInput {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: Date | string | null;
  pronoun?: Pronoun | null;
  phone?: string | null;
  email?: string | null;
  context?: string | null;
}

/**
 * Update fields on a patient row within scope. Only fields present in the input
 * (own-property check) are included in the dynamic SET clause — missing fields
 * are left unchanged (distinct from `null`, which clears the column).
 *
 * Returns null if the row does not exist, is archived, or is out-of-scope.
 */
export async function updatePatient(
  scope: QueryScope,
  patientId: string,
  input: UpdatePatientDalInput
): Promise<Patient | null> {
  const setClauses: string[] = [];
  const params: unknown[] = [];

  const addField = (column: string, value: unknown): void => {
    params.push(value);
    setClauses.push(`${column} = $${params.length}`);
  };

  if (Object.prototype.hasOwnProperty.call(input, 'firstName')) addField('first_name', input.firstName);
  if (Object.prototype.hasOwnProperty.call(input, 'lastName')) addField('last_name', input.lastName);
  if (Object.prototype.hasOwnProperty.call(input, 'dateOfBirth')) addField('date_of_birth', input.dateOfBirth ?? null);
  if (Object.prototype.hasOwnProperty.call(input, 'pronoun')) addField('pronoun', input.pronoun ?? null);
  if (Object.prototype.hasOwnProperty.call(input, 'phone')) addField('phone', input.phone ?? null);
  if (Object.prototype.hasOwnProperty.call(input, 'email')) addField('email', input.email ?? null);
  if (Object.prototype.hasOwnProperty.call(input, 'context')) addField('context', input.context ?? null);

  if (setClauses.length === 0) {
    // No updatable fields provided — return current row (or null if out of scope).
    return findPatientById(scope, patientId);
  }

  const { sql: scopeSql, params: scopeParams } = scopeWhereClause(
    scope,
    params.length + 1
  );
  params.push(...scopeParams);
  const idIndex = params.length + 1;
  params.push(patientId);

  const result = await db.query<PatientRow>(
    `UPDATE patients SET ${setClauses.join(', ')}
     WHERE ${scopeSql} AND id = $${idIndex} AND archived_at IS NULL
     RETURNING ${PATIENT_COLUMNS}`,
    params
  );

  if (result.rows.length === 0) return null;
  return rowToPatient(result.rows[0]);
}

/**
 * Soft-delete a patient within scope. Returns true if a row was archived,
 * false otherwise (not found / already archived / out-of-scope).
 */
export async function archivePatient(
  scope: QueryScope,
  patientId: string
): Promise<boolean> {
  const { sql: scopeSql, params: scopeParams } = scopeWhereClause(scope, 1);
  const idIndex = scopeParams.length + 1;
  const result = await db.query<{ id: string }>(
    `UPDATE patients SET archived_at = NOW()
     WHERE ${scopeSql} AND id = $${idIndex} AND archived_at IS NULL
     RETURNING id`,
    [...scopeParams, patientId]
  );
  return result.rows.length > 0;
}
