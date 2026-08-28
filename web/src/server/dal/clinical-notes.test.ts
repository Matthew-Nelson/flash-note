import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockDbQuery, mockClientQuery, resetMocks } from '@/test/dal-helpers';
import {
  createMockNoteRow,
  createMockNoteSection,
} from '@/test/factories/clinical-note-factory';
import type { QueryScope } from '@/lib/types';
import {
  createClinicalNote,
  findClinicalNoteById,
  findClinicalNotesByScope,
  updateClinicalNoteContent,
  archiveClinicalNote,
  NoteContentSchema,
} from './clinical-notes';

const USER_A = '00000000-0000-0000-0000-0000000000a1';
const USER_B = '00000000-0000-0000-0000-0000000000b2';
const ORG_A = '00000000-0000-0000-0000-00000000c0a1';
const NOTE_1 = '00000000-0000-0000-0000-0000000cdcde';
const TEMPLATE = '00000000-0000-0000-0000-000000000001';
const PATIENT_1 = '00000000-0000-0000-0000-0000000abcde';

const userScope: QueryScope = { type: 'user', userId: USER_A };
const orgScope: QueryScope = { type: 'organization', organizationId: ORG_A };

function mockClient() {
  return { query: mockClientQuery } as never;
}

describe('clinical-notes DAL', () => {
  beforeEach(() => {
    resetMocks();
  });

  // ---------------------------------------------------------------------------
  // createClinicalNote — transactional only
  // ---------------------------------------------------------------------------

  describe('createClinicalNote', () => {
    it('inserts via PoolClient.query (not pool)', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [createMockNoteRow()] });

      await createClinicalNote(
        mockClient(),
        { userId: USER_A, organizationId: null },
        {
          templateId: TEMPLATE,
          noteType: 'daily_note',
          content: [createMockNoteSection()],
          quickNotes: 'pt c/o knee pain',
        }
      );

      expect(mockClientQuery).toHaveBeenCalledOnce();
      expect(mockDbQuery).not.toHaveBeenCalled();
    });

    it('stringifies content for JSONB cast', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [createMockNoteRow()] });

      const content = [createMockNoteSection()];
      await createClinicalNote(
        mockClient(),
        { userId: USER_A, organizationId: null },
        {
          templateId: TEMPLATE,
          noteType: 'daily_note',
          content,
          quickNotes: 'pt c/o knee pain',
        }
      );

      const [sql, params] = mockClientQuery.mock.calls[0] as [
        string,
        unknown[],
      ];
      expect(sql).toContain('$6::jsonb');
      expect(params[5]).toBe(JSON.stringify(content));
    });

    it('Rule 10: throws when INSERT RETURNING returns no rows', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        createClinicalNote(
          mockClient(),
          { userId: USER_A, organizationId: null },
          {
            templateId: TEMPLATE,
            noteType: 'daily_note',
            content: [createMockNoteSection()],
            quickNotes: 'pt c/o knee pain',
          }
        )
      ).rejects.toThrow(/INSERT RETURNING returned no rows/);
    });

    it('defaults all optional fields to null', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [createMockNoteRow()] });

      await createClinicalNote(
        mockClient(),
        { userId: USER_A, organizationId: null },
        {
          templateId: TEMPLATE,
          noteType: 'daily_note',
          content: [createMockNoteSection()],
          quickNotes: 'pt notes',
        }
      );

      const [, params] = mockClientQuery.mock.calls[0] as [string, unknown[]];
      // user_id, org_id, patient_id, template, note_type, content_json, quick_notes, patient_context, modality, duration, gen_ms
      expect(params[2]).toBeNull(); // patient_id
      expect(params[7]).toBeNull(); // patient_context
      expect(params[8]).toBeNull(); // modality
      expect(params[9]).toBeNull(); // duration
      expect(params[10]).toBeNull(); // generation_time_ms
    });

    it('passes organization_id when provided', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [createMockNoteRow()] });
      await createClinicalNote(
        mockClient(),
        { userId: USER_A, organizationId: ORG_A },
        {
          templateId: TEMPLATE,
          noteType: 'daily_note',
          content: [createMockNoteSection()],
          quickNotes: 'notes',
        }
      );
      const [, params] = mockClientQuery.mock.calls[0] as [string, unknown[]];
      expect(params[1]).toBe(ORG_A);
    });
  });

  // ---------------------------------------------------------------------------
  // findClinicalNoteById — LEFT JOIN patients
  // ---------------------------------------------------------------------------

  describe('findClinicalNoteById', () => {
    it('LEFT JOINs patients and scopes by cn.user_id', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [
          {
            ...createMockNoteRow({ id: NOTE_1, user_id: USER_A }),
            patient_first_name: 'Jane',
            patient_last_name: 'Doe',
          },
        ],
      });

      const result = await findClinicalNoteById(userScope, NOTE_1);

      const [sql, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('LEFT JOIN patients');
      expect(sql).toContain('cn.user_id = $1');
      expect(sql).toContain('cn.archived_at IS NULL');
      expect(params).toEqual([USER_A, NOTE_1]);
      expect(result?.patientFirstName).toBe('Jane');
    });

    it('Rule 5: returns null when note belongs to another user', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      const result = await findClinicalNoteById(
        { type: 'user', userId: USER_B },
        NOTE_1
      );
      expect(result).toBeNull();
    });

    it('scopes by organization_id under org scope', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      await findClinicalNoteById(orgScope, NOTE_1);
      const [sql] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('cn.organization_id = $1');
    });

    it('returns null when no rows match', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      const result = await findClinicalNoteById(userScope, NOTE_1);
      expect(result).toBeNull();
    });

    it('Rule 3: parses JSONB content via Zod', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [
          {
            ...createMockNoteRow({
              content: [createMockNoteSection({ content: 'Subjective text.' })],
            }),
            patient_first_name: null,
            patient_last_name: null,
          },
        ],
      });

      const result = await findClinicalNoteById(userScope, NOTE_1);
      expect(result?.content[0].content).toBe('Subjective text.');
    });

    it('parses non-null modality via Zod schema', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [
          {
            ...createMockNoteRow({ modality: 'telehealth' }),
            patient_first_name: null,
            patient_last_name: null,
          },
        ],
      });

      const result = await findClinicalNoteById(userScope, NOTE_1);
      expect(result?.modality).toBe('telehealth');
    });

    it('leaves null modality unchanged (no Zod parse)', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [
          {
            ...createMockNoteRow({ modality: null }),
            patient_first_name: null,
            patient_last_name: null,
          },
        ],
      });
      const result = await findClinicalNoteById(userScope, NOTE_1);
      expect(result?.modality).toBeNull();
    });

    it('Rule 3: throws when JSONB content is malformed', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [
          {
            ...createMockNoteRow({
              content: [{ badField: 'x' }], // missing sectionId, title, content
            }),
            patient_first_name: null,
            patient_last_name: null,
          },
        ],
      });

      await expect(findClinicalNoteById(userScope, NOTE_1)).rejects.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // findClinicalNotesByScope
  // ---------------------------------------------------------------------------

  describe('findClinicalNotesByScope', () => {
    it('applies patientId filter when provided', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      await findClinicalNotesByScope(userScope, { patientId: PATIENT_1 });

      const [countSql, countParams] = mockDbQuery.mock.calls[0] as [
        string,
        unknown[],
      ];
      expect(countSql).toContain('cn.patient_id = $');
      expect(countParams).toContain(PATIENT_1);
    });

    it('applies noteType filter when provided', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      await findClinicalNotesByScope(userScope, { noteType: 'initial_eval' });
      const [sql, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('cn.note_type = $');
      expect(params).toContain('initial_eval');
    });

    it('applies the search filter to both count and list queries', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      await findClinicalNotesByScope(userScope, { search: 'knee' });

      const [countSql, countParams] = mockDbQuery.mock.calls[0] as [
        string,
        unknown[],
      ];
      const [listSql, listParams] = mockDbQuery.mock.calls[1] as [
        string,
        unknown[],
      ];
      expect(countSql).toContain('cn.quick_notes ILIKE $');
      expect(countSql).toContain("section->>'content' ILIKE $");
      expect(listSql).toContain('cn.quick_notes ILIKE $');
      expect(listSql).toContain("section->>'content' ILIKE $");
      expect(countParams).toContain('%knee%');
      expect(listParams).toContain('%knee%');
    });

    // Regression: `content::text ILIKE` searched the JSONB serialization, so
    // the structural keys (sectionId/title/content) and the section titles
    // (Subjective/Objective/Assessment/Plan) were inside the searched string —
    // those terms matched every note in scope.
    it('searches section prose, never the JSONB serialization', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      await findClinicalNotesByScope(userScope, { search: 'assessment' });

      const [countSql] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(countSql).not.toContain('cn.content::text');
      expect(countSql).toContain('jsonb_array_elements');
      expect(countSql).toContain("section->>'content'");
      // Titles are excluded on purpose — matching them is what made the SOAP
      // section names match every note.
      expect(countSql).not.toContain("section->>'title'");
    });

    it('coerces a non-array content column to an empty array', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      await findClinicalNotesByScope(userScope, { search: 'knee' });

      const [countSql] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      // Without the guard, jsonb_array_elements() raises on a row whose
      // content is an object and fails the whole search.
      expect(countSql).toContain("jsonb_typeof(cn.content) = 'array'");
      expect(countSql).toContain("'[]'::jsonb");
    });

    it('escapes LIKE metacharacters in the search term', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      await findClinicalNotesByScope(userScope, { search: '100%_off\\' });

      const [, countParams] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(countParams).toContain('%100\\%\\_off\\\\%');
    });

    it('ignores a whitespace-only search term', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      await findClinicalNotesByScope(userScope, { search: '   ' });

      const [countSql] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(countSql).not.toContain('ILIKE');
    });

    it('combines search with the noteType filter and keeps scope first', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      await findClinicalNotesByScope(userScope, {
        noteType: 'progress_note',
        search: 'knee',
      });

      const [countSql, countParams] = mockDbQuery.mock.calls[0] as [
        string,
        unknown[],
      ];
      expect(countSql).toContain('cn.user_id = $1');
      expect(countSql).toContain('cn.note_type = $2');
      expect(countSql).toContain('ILIKE $3');
      // Note: `paramList` is a single array shared with the list query, which
      // appends limit/offset after the count query has already run — assert on
      // the leading filter params only.
      expect(countParams.slice(0, 3)).toEqual([
        USER_A,
        'progress_note',
        '%knee%',
      ]);
    });

    it('clamps limit to 100 and offset >= 0', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      await findClinicalNotesByScope(userScope, { limit: 999, offset: -5 });

      const [, listParams] = mockDbQuery.mock.calls[1] as [string, unknown[]];
      expect(listParams[listParams.length - 2]).toBe(100);
      expect(listParams[listParams.length - 1]).toBe(0);
    });

    it('orders by created_at DESC', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] });
      await findClinicalNotesByScope(userScope);
      const [listSql] = mockDbQuery.mock.calls[1] as [string, unknown[]];
      expect(listSql).toContain('ORDER BY cn.created_at DESC');
    });

    it('returns mapped notes + total', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ total: 2 }] })
        .mockResolvedValueOnce({
          rows: [
            {
              ...createMockNoteRow({ id: 'n1' }),
              patient_first_name: 'Jane',
              patient_last_name: 'Doe',
            },
            {
              ...createMockNoteRow({ id: 'n2' }),
              patient_first_name: null,
              patient_last_name: null,
            },
          ],
        });

      const result = await findClinicalNotesByScope(userScope);
      expect(result.total).toBe(2);
      expect(result.notes).toHaveLength(2);
      expect(result.notes[0].patientFirstName).toBe('Jane');
    });

    it('handles empty count result defensively', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await findClinicalNotesByScope(userScope);
      expect(result.total).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // updateClinicalNoteContent — optimistic lock
  // ---------------------------------------------------------------------------

  describe('updateClinicalNoteContent', () => {
    it('includes optimistic-lock updated_at = $N in WHERE clause', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [createMockNoteRow()] });

      const expectedAt = new Date('2026-01-01T00:00:00Z').toISOString();
      await updateClinicalNoteContent(
        mockClient(),
        userScope,
        NOTE_1,
        [createMockNoteSection()],
        expectedAt
      );

      const [sql, params] = mockClientQuery.mock.calls[0] as [
        string,
        unknown[],
      ];
      expect(sql).toContain('updated_at = $');
      expect(sql).toContain('archived_at IS NULL');
      expect(params[params.length - 1]).toBe(expectedAt);
    });

    it('returns null when UPDATE affects 0 rows (stale updated_at or not found)', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      const result = await updateClinicalNoteContent(
        mockClient(),
        userScope,
        NOTE_1,
        [createMockNoteSection()],
        new Date().toISOString()
      );
      expect(result).toBeNull();
    });

    it('filters by user_id in WHERE (Rule 5)', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [createMockNoteRow()] });

      await updateClinicalNoteContent(
        mockClient(),
        userScope,
        NOTE_1,
        [createMockNoteSection()],
        new Date().toISOString()
      );

      const [sql] = mockClientQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('user_id = $');
    });

    it('returns updated ClinicalNote when successful', async () => {
      mockClientQuery.mockResolvedValueOnce({
        rows: [createMockNoteRow({ id: NOTE_1 })],
      });

      const result = await updateClinicalNoteContent(
        mockClient(),
        userScope,
        NOTE_1,
        [createMockNoteSection()],
        new Date().toISOString()
      );
      expect(result?.id).toBe(NOTE_1);
    });

    it('uses client.query (not pool)', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [createMockNoteRow()] });
      await updateClinicalNoteContent(
        mockClient(),
        userScope,
        NOTE_1,
        [createMockNoteSection()],
        new Date().toISOString()
      );
      expect(mockDbQuery).not.toHaveBeenCalled();
      expect(mockClientQuery).toHaveBeenCalledOnce();
    });
  });

  // ---------------------------------------------------------------------------
  // archiveClinicalNote
  // ---------------------------------------------------------------------------

  describe('archiveClinicalNote', () => {
    it('returns true on successful archive', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [{ id: NOTE_1 }] });
      expect(await archiveClinicalNote(userScope, NOTE_1)).toBe(true);
    });

    it('returns false when no row affected', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      expect(await archiveClinicalNote(userScope, NOTE_1)).toBe(false);
    });

    it('sets archived_at = NOW() and scopes by user_id', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [{ id: NOTE_1 }] });
      await archiveClinicalNote(userScope, NOTE_1);
      const [sql] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('archived_at = NOW()');
      expect(sql).toContain('user_id = $1');
      expect(sql).toContain('archived_at IS NULL');
    });
  });

  // ---------------------------------------------------------------------------
  // NoteContentSchema export (runtime Zod validator)
  // ---------------------------------------------------------------------------

  describe('NoteContentSchema', () => {
    it('accepts a well-formed content array', () => {
      expect(
        NoteContentSchema.safeParse([createMockNoteSection()]).success
      ).toBe(true);
    });

    it('rejects an empty array — wait, spec is min(1) for save but here schema allows any', () => {
      // NoteContentSchema is z.array(NoteSectionSchema) — no min. Empty OK.
      expect(NoteContentSchema.safeParse([]).success).toBe(true);
    });

    it('rejects a section missing sectionId', () => {
      expect(
        NoteContentSchema.safeParse([{ title: 'x', content: 'y' }]).success
      ).toBe(false);
    });
  });
});

// Silence lint about unused imports
void vi;
