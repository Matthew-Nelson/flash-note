import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { mockDbQuery, mockClientQuery, resetMocks } from '@/test/dal-helpers';
import {
  createMockVersionRow,
  createMockVersionWithSectionRow,
} from '@/test/factories/note-version-factory';
import { createMockNoteSection } from '@/test/factories/clinical-note-factory';
import type { QueryScope } from '@/lib/types';
import {
  createInitialVersions,
  createVersionForSection,
  findVersionsByNoteId,
  findLatestVersionsByNoteId,
} from './note-versions';

const USER_A = '00000000-0000-0000-0000-0000000000a1';
const ORG_A = '00000000-0000-0000-0000-00000000c0a1';
const NOTE_1 = '00000000-0000-0000-0000-0000000cdcde';
const SECTION_1 = '00000000-0000-0000-0000-000000000011';

const userScope: QueryScope = { type: 'user', userId: USER_A };
const orgScope: QueryScope = { type: 'organization', organizationId: ORG_A };

function mockClient() {
  return { query: mockClientQuery } as never;
}

describe('note-versions DAL', () => {
  beforeEach(() => {
    resetMocks();
  });

  // ---------------------------------------------------------------------------
  // Append-only invariant — no UPDATE/DELETE SQL in the module
  // ---------------------------------------------------------------------------

  describe('module-level append-only invariant', () => {
    it('source file contains NO UPDATE or DELETE SQL against note_versions', () => {
      const source = fs.readFileSync(
        path.join(process.cwd(), 'src/server/dal/note-versions.ts'),
        'utf8'
      );
      expect(source).not.toMatch(/UPDATE\s+note_versions/i);
      expect(source).not.toMatch(/DELETE\s+FROM\s+note_versions/i);
    });
  });

  // ---------------------------------------------------------------------------
  // createInitialVersions — bulk insert one per section, version=1
  // ---------------------------------------------------------------------------

  describe('createInitialVersions', () => {
    it('uses unnest() to bulk-insert one row per section', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [createMockVersionRow()],
      });
      await createInitialVersions(
        mockClient(),
        NOTE_1,
        [createMockNoteSection()],
        USER_A
      );

      const [sql] = mockClientQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('unnest($2::uuid[])');
      expect(sql).toContain('unnest($3::text[])');
    });

    it("uses source='generated' and version=1 literal in SQL", async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [createMockVersionRow()],
      });
      await createInitialVersions(
        mockClient(),
        NOTE_1,
        [createMockNoteSection()],
        USER_A
      );
      const [sql] = mockClientQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("1, unnest($3::text[]), 'generated'");
    });

    it('returns empty array when content is empty (no SQL executed)', async () => {
      const result = await createInitialVersions(
        mockClient(),
        NOTE_1,
        [],
        USER_A
      );
      expect(result).toEqual([]);
      expect(mockClientQuery).not.toHaveBeenCalled();
    });

    it('maps returned rows to NoteVersion domain shape', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [
          createMockVersionRow({
            section_id: SECTION_1,
            content: 'Subjective text',
          }),
        ],
      });
      const result = await createInitialVersions(
        mockClient(),
        NOTE_1,
        [createMockNoteSection()],
        USER_A
      );
      expect(result[0].sectionId).toBe(SECTION_1);
      expect(result[0].content).toBe('Subjective text');
      expect(result[0].source).toBe('generated');
    });

    it('passes sectionIds and contents as parallel arrays', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [createMockVersionRow()],
      });
      const content = [
        createMockNoteSection({ sectionId: SECTION_1, content: 's-text' }),
        createMockNoteSection({
          sectionId: '00000000-0000-0000-0000-000000000012',
          content: 'o-text',
        }),
      ];
      await createInitialVersions(mockClient(), NOTE_1, content, USER_A);
      const [, params] = mockClientQuery.mock.calls[0] as [string, unknown[]];
      expect(params[1]).toEqual([
        SECTION_1,
        '00000000-0000-0000-0000-000000000012',
      ]);
      expect(params[2]).toEqual(['s-text', 'o-text']);
    });
  });

  // ---------------------------------------------------------------------------
  // createVersionForSection — subquery MAX+1
  // ---------------------------------------------------------------------------

  describe('createVersionForSection', () => {
    it('uses COALESCE(MAX(version), 0) + 1 subquery for version number', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [createMockVersionRow({ version: 2, source: 'manual' })],
      });

      await createVersionForSection(
        mockClient(),
        NOTE_1,
        SECTION_1,
        'updated content',
        'manual',
        USER_A
      );

      const [sql] = mockClientQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('COALESCE(MAX(version), 0) + 1');
      expect(sql).toContain('FROM note_versions WHERE note_id = $1 AND section_id = $2');
    });

    it('Rule 10: throws when INSERT RETURNING returns no rows', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] });
      await expect(
        createVersionForSection(
          mockClient(),
          NOTE_1,
          SECTION_1,
          'x',
          'manual',
          USER_A
        )
      ).rejects.toThrow(/INSERT RETURNING returned no rows/);
    });

    it('returns mapped NoteVersion on success', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [
          createMockVersionRow({
            version: 3,
            source: 'manual',
            content: 'new content',
          }),
        ],
      });
      const result = await createVersionForSection(
        mockClient(),
        NOTE_1,
        SECTION_1,
        'new content',
        'manual',
        USER_A
      );
      expect(result.version).toBe(3);
      expect(result.source).toBe('manual');
    });

    it('accepts source = magic_edit (reserved for Phase 6)', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [createMockVersionRow({ source: 'magic_edit' })],
      });
      const result = await createVersionForSection(
        mockClient(),
        NOTE_1,
        SECTION_1,
        'ai-edited',
        'magic_edit',
        USER_A
      );
      expect(result.source).toBe('magic_edit');
    });
  });

  // ---------------------------------------------------------------------------
  // findVersionsByNoteId — scope via clinical_notes JOIN
  // ---------------------------------------------------------------------------

  describe('findVersionsByNoteId', () => {
    it('INNER JOINs clinical_notes for scope enforcement (Rule 5)', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      await findVersionsByNoteId(userScope, NOTE_1);

      const [sql] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('INNER JOIN clinical_notes cn');
      expect(sql).toContain('cn.user_id = $1');
    });

    it('scopes by organization_id under org scope', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      await findVersionsByNoteId(orgScope, NOTE_1);
      const [sql] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('cn.organization_id = $1');
    });

    it('joins note_template_sections for section_title', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      await findVersionsByNoteId(userScope, NOTE_1);
      const [sql] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('INNER JOIN note_template_sections nts');
      expect(sql).toContain('nts.title AS section_title');
    });

    it('orders by section_id, version DESC', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      await findVersionsByNoteId(userScope, NOTE_1);
      const [sql] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('ORDER BY nv.section_id, nv.version DESC');
    });

    it('maps rows with section_title to NoteVersionWithSection', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [
          createMockVersionWithSectionRow({ section_title: 'Subjective' }),
        ],
      });
      const result = await findVersionsByNoteId(userScope, NOTE_1);
      expect(result[0].sectionTitle).toBe('Subjective');
    });

    it('returns empty array when no rows match', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      const result = await findVersionsByNoteId(userScope, NOTE_1);
      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // findLatestVersionsByNoteId — DISTINCT ON
  // ---------------------------------------------------------------------------

  describe('findLatestVersionsByNoteId', () => {
    it('uses DISTINCT ON (nv.section_id) with version DESC', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      await findLatestVersionsByNoteId(userScope, NOTE_1);
      const [sql] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('DISTINCT ON (nv.section_id)');
      expect(sql).toContain('ORDER BY nv.section_id, nv.version DESC');
    });

    it('scopes by user_id', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      await findLatestVersionsByNoteId(userScope, NOTE_1);
      const [sql] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('cn.user_id = $1');
    });

    it('returns mapped NoteVersionWithSection rows', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [createMockVersionWithSectionRow({ version: 5 })],
      });
      const result = await findLatestVersionsByNoteId(userScope, NOTE_1);
      expect(result[0].version).toBe(5);
      expect(result[0].sectionTitle).toBe('Subjective');
    });
  });
});
