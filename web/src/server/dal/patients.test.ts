import { describe, it, expect, beforeEach } from 'vitest';
import { mockDbQuery, resetMocks } from '@/test/dal-helpers';
import { createMockPatientRow } from '@/test/factories/patient-factory';
import type { QueryScope } from '@/lib/types';
import {
  createPatient,
  findPatientById,
  findPatientsByScope,
  updatePatient,
  archivePatient,
} from './patients';

const USER_A = '00000000-0000-0000-0000-0000000000a1';
const USER_B = '00000000-0000-0000-0000-0000000000b2';
const ORG_A = '00000000-0000-0000-0000-00000000c0a1';
const PATIENT_1 = '00000000-0000-0000-0000-000000000p01';

const userScope: QueryScope = { type: 'user', userId: USER_A };
const orgScope: QueryScope = { type: 'organization', organizationId: ORG_A };

describe('patients DAL', () => {
  beforeEach(() => {
    resetMocks();
  });

  // ---------------------------------------------------------------------------
  // createPatient
  // ---------------------------------------------------------------------------

  describe('createPatient', () => {
    it('inserts with user_id scope and returns mapped Patient', async () => {
      const row = createMockPatientRow({ user_id: USER_A, first_name: 'Jane' });
      mockDbQuery.mockResolvedValueOnce({ rows: [row] });

      const patient = await createPatient(
        { userId: USER_A, organizationId: null },
        { firstName: 'Jane', lastName: 'Doe' }
      );

      expect(patient.firstName).toBe('Jane');
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO patients'),
        expect.arrayContaining([USER_A, null, 'Jane', 'Doe'])
      );
    });

    it('includes organization_id when provided', async () => {
      const row = createMockPatientRow({ organization_id: ORG_A });
      mockDbQuery.mockResolvedValueOnce({ rows: [row] });

      await createPatient(
        { userId: USER_A, organizationId: ORG_A },
        { firstName: 'Jane', lastName: 'Doe' }
      );

      const [, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(params[1]).toBe(ORG_A);
    });

    it('Rule 10: throws when INSERT RETURNING returns no rows', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      await expect(
        createPatient(
          { userId: USER_A, organizationId: null },
          { firstName: 'Jane', lastName: 'Doe' }
        )
      ).rejects.toThrow(/INSERT RETURNING returned no rows/);
    });

    it('defaults all optional fields to null', async () => {
      const row = createMockPatientRow();
      mockDbQuery.mockResolvedValueOnce({ rows: [row] });

      await createPatient(
        { userId: USER_A, organizationId: null },
        { firstName: 'Jane', lastName: 'Doe' }
      );

      const [, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(params.slice(4)).toEqual([null, null, null, null, null]);
    });

    it('transforms snake_case row fields to camelCase', async () => {
      const row = createMockPatientRow({
        first_name: 'Jane',
        last_name: 'Doe',
        date_of_birth: new Date('1985-03-15'),
        archived_at: null,
      });
      mockDbQuery.mockResolvedValueOnce({ rows: [row] });

      const patient = await createPatient(
        { userId: USER_A, organizationId: null },
        { firstName: 'Jane', lastName: 'Doe' }
      );
      expect(patient.firstName).toBe('Jane');
      expect(patient.lastName).toBe('Doe');
      expect(patient.dateOfBirth).toEqual(new Date('1985-03-15'));
      expect(patient.archivedAt).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // findPatientById
  // ---------------------------------------------------------------------------

  describe('findPatientById', () => {
    it('filters by user_id when scope.type is user', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [createMockPatientRow()] });
      await findPatientById(userScope, PATIENT_1);

      const [sql, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('user_id = $1');
      expect(sql).toContain('archived_at IS NULL');
      expect(params).toEqual([USER_A, PATIENT_1]);
    });

    it('filters by organization_id when scope.type is organization', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [createMockPatientRow()] });
      await findPatientById(orgScope, PATIENT_1);

      const [sql, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('organization_id = $1');
      expect(params).toEqual([ORG_A, PATIENT_1]);
    });

    it('Rule 5: returns null when patient belongs to a different user', async () => {
      // Scope is user A, but DB returns 0 rows (the patient belongs to user B).
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      const result = await findPatientById({ type: 'user', userId: USER_B }, PATIENT_1);
      expect(result).toBeNull();
    });

    it('returns null when no rows match', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      const result = await findPatientById(userScope, PATIENT_1);
      expect(result).toBeNull();
    });

    it('returns mapped Patient when row exists', async () => {
      const row = createMockPatientRow({ id: PATIENT_1, first_name: 'Jane' });
      mockDbQuery.mockResolvedValueOnce({ rows: [row] });
      const result = await findPatientById(userScope, PATIENT_1);
      expect(result?.id).toBe(PATIENT_1);
      expect(result?.firstName).toBe('Jane');
    });
  });

  // ---------------------------------------------------------------------------
  // findPatientsByScope
  // ---------------------------------------------------------------------------

  describe('findPatientsByScope', () => {
    it('lists without search and uses default limit 50, offset 0', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      await findPatientsByScope(userScope);

      const [, listParams] = mockDbQuery.mock.calls[1] as [string, unknown[]];
      expect(listParams[listParams.length - 2]).toBe(50);
      expect(listParams[listParams.length - 1]).toBe(0);
    });

    it('clamps limit to 100 (defense-in-depth beyond Zod)', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      await findPatientsByScope(userScope, { limit: 999 });

      const [, listParams] = mockDbQuery.mock.calls[1] as [string, unknown[]];
      expect(listParams[listParams.length - 2]).toBe(100);
    });

    it('clamps offset to >= 0', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      await findPatientsByScope(userScope, { offset: -10 });

      const [, listParams] = mockDbQuery.mock.calls[1] as [string, unknown[]];
      expect(listParams[listParams.length - 1]).toBe(0);
    });

    it('escapes LIKE metacharacters in search input', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      await findPatientsByScope(userScope, { search: 'john%_test' });

      const [, countParams] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      // The escaped pattern is wrapped in %...% for the ILIKE match.
      expect(countParams).toContain('%john\\%\\_test%');
    });

    it('escapes backslash in search input', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      await findPatientsByScope(userScope, { search: 'name\\back' });

      const [, countParams] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(countParams).toContain('%name\\\\back%');
    });

    it('adds ILIKE clause across first_name, last_name, and concat', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      await findPatientsByScope(userScope, { search: 'jane' });

      const [countSql] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(countSql).toContain('first_name ILIKE');
      expect(countSql).toContain('last_name ILIKE');
      expect(countSql).toContain("first_name || ' ' || last_name");
    });

    it('does NOT add search clause when search is empty/whitespace', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      await findPatientsByScope(userScope, { search: '   ' });

      const [countSql] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(countSql).not.toContain('ILIKE');
    });

    it('returns mapped patients + total', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ total: 3 }] })
        .mockResolvedValueOnce({
          rows: [
            createMockPatientRow({ id: 'p1', first_name: 'Alice' }),
            createMockPatientRow({ id: 'p2', first_name: 'Bob' }),
          ],
        });

      const result = await findPatientsByScope(userScope);
      expect(result.total).toBe(3);
      expect(result.patients).toHaveLength(2);
      expect(result.patients[0].firstName).toBe('Alice');
    });

    it('handles empty count result defensively (no rows)', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await findPatientsByScope(userScope);
      expect(result.total).toBe(0);
    });

    it('filters by archived_at IS NULL', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      await findPatientsByScope(userScope);
      const [countSql] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(countSql).toContain('archived_at IS NULL');
    });
  });

  // ---------------------------------------------------------------------------
  // updatePatient
  // ---------------------------------------------------------------------------

  describe('updatePatient', () => {
    it('returns current row via findPatientById when no updatable fields provided', async () => {
      const row = createMockPatientRow({ id: PATIENT_1 });
      mockDbQuery.mockResolvedValueOnce({ rows: [row] });

      const result = await updatePatient(userScope, PATIENT_1, {});
      expect(result?.id).toBe(PATIENT_1);
      const [sql] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('SELECT');
      expect(sql).not.toContain('UPDATE patients');
    });

    it('builds dynamic SET clause with only provided fields', async () => {
      const row = createMockPatientRow({ id: PATIENT_1, first_name: 'Janet' });
      mockDbQuery.mockResolvedValueOnce({ rows: [row] });

      await updatePatient(userScope, PATIENT_1, { firstName: 'Janet' });

      const [sql, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('UPDATE patients SET first_name = $1');
      expect(sql).not.toContain('last_name = ');
      expect(params[0]).toBe('Janet');
    });

    it('handles explicit null for nullable fields (clears them)', async () => {
      const row = createMockPatientRow({ context: null });
      mockDbQuery.mockResolvedValueOnce({ rows: [row] });

      await updatePatient(userScope, PATIENT_1, { context: null });

      const [sql, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('context = $1');
      expect(params[0]).toBeNull();
    });

    it('applies scope filter to UPDATE (Rule 5)', async () => {
      const row = createMockPatientRow();
      mockDbQuery.mockResolvedValueOnce({ rows: [row] });

      await updatePatient(userScope, PATIENT_1, { firstName: 'Jane' });

      const [sql] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('user_id = $');
    });

    it('returns null when UPDATE affects 0 rows (out of scope or archived)', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const result = await updatePatient(userScope, PATIENT_1, {
        firstName: 'Janet',
      });
      expect(result).toBeNull();
    });

    it('filters archived_at IS NULL on UPDATE', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [createMockPatientRow()] });
      await updatePatient(userScope, PATIENT_1, { firstName: 'Janet' });

      const [sql] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('archived_at IS NULL');
    });

    it('updates all optional fields when provided', async () => {
      const row = createMockPatientRow();
      mockDbQuery.mockResolvedValueOnce({ rows: [row] });

      await updatePatient(userScope, PATIENT_1, {
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: new Date('1985-03-15'),
        pronoun: 'they/them',
        phone: '555-1234',
        email: 'jane@example.com',
        context: 'Post-op TKA',
      });

      const [sql] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('first_name = $1');
      expect(sql).toContain('last_name = $2');
      expect(sql).toContain('date_of_birth = $3');
      expect(sql).toContain('pronoun = $4');
      expect(sql).toContain('phone = $5');
      expect(sql).toContain('email = $6');
      expect(sql).toContain('context = $7');
    });

    it('coalesces undefined nullable fields to null (dateOfBirth)', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [createMockPatientRow()] });
      // Key is present but value is undefined — hasOwnProperty is true, ?? falls through
      const input: Record<string, unknown> = { dateOfBirth: undefined };
      await updatePatient(userScope, PATIENT_1, input);
      const [, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(params[0]).toBeNull();
    });

    it('coalesces undefined nullable fields to null (pronoun)', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [createMockPatientRow()] });
      const input: Record<string, unknown> = { pronoun: undefined };
      await updatePatient(userScope, PATIENT_1, input);
      const [, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(params[0]).toBeNull();
    });

    it('coalesces undefined nullable fields to null (phone)', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [createMockPatientRow()] });
      const input: Record<string, unknown> = { phone: undefined };
      await updatePatient(userScope, PATIENT_1, input);
      const [, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(params[0]).toBeNull();
    });

    it('coalesces undefined nullable fields to null (email)', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [createMockPatientRow()] });
      const input: Record<string, unknown> = { email: undefined };
      await updatePatient(userScope, PATIENT_1, input);
      const [, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(params[0]).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // archivePatient
  // ---------------------------------------------------------------------------

  describe('archivePatient', () => {
    it('returns true when a row is archived', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [{ id: PATIENT_1 }] });
      expect(await archivePatient(userScope, PATIENT_1)).toBe(true);
    });

    it('returns false when no rows are affected', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      expect(await archivePatient(userScope, PATIENT_1)).toBe(false);
    });

    it('issues an UPDATE that sets archived_at = NOW() with scope + id filter', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [{ id: PATIENT_1 }] });
      await archivePatient(userScope, PATIENT_1);

      const [sql, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('UPDATE patients SET archived_at = NOW()');
      expect(sql).toContain('user_id = $1');
      expect(sql).toContain('id = $2');
      expect(sql).toContain('archived_at IS NULL');
      expect(params).toEqual([USER_A, PATIENT_1]);
    });

    it('filters by organization_id under org scope', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [{ id: PATIENT_1 }] });
      await archivePatient(orgScope, PATIENT_1);
      const [sql] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('organization_id = $1');
    });
  });
});
