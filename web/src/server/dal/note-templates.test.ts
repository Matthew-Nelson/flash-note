import { describe, it, expect, beforeEach } from 'vitest';
import { mockDbQuery, resetMocks } from '@/test/dal-helpers';
import {
  createMockTemplateRow,
  createMockTemplateSectionRow,
} from '@/test/factories/note-template-factory';
import type { QueryScope } from '@/lib/types';
import {
  findBuiltinTemplates,
  findTemplateById,
  findTemplatesByScope,
  findTemplateWithUserStyle,
} from './note-templates';

const USER_A = '00000000-0000-0000-0000-0000000000a1';
const ORG_A = '00000000-0000-0000-0000-00000000c0a1';
const TEMPLATE = '00000000-0000-0000-0000-000000000001';
const SUBJECTIVE = '00000000-0000-0000-0000-000000000011';
const OBJECTIVE = '00000000-0000-0000-0000-000000000012';

const userScope: QueryScope = { type: 'user', userId: USER_A };
const orgScope: QueryScope = { type: 'organization', organizationId: ORG_A };

describe('note-templates DAL', () => {
  beforeEach(() => {
    resetMocks();
  });

  // ---------------------------------------------------------------------------
  // findBuiltinTemplates
  // ---------------------------------------------------------------------------

  describe('findBuiltinTemplates', () => {
    it('filters by is_builtin = TRUE and archived_at IS NULL', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [createMockTemplateRow()] })
        .mockResolvedValueOnce({ rows: [createMockTemplateSectionRow()] });

      await findBuiltinTemplates();

      const [sql] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('is_builtin = TRUE');
      expect(sql).toContain('archived_at IS NULL');
    });

    it('returns empty array when no built-in templates exist', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      const result = await findBuiltinTemplates();
      expect(result).toEqual([]);
    });

    it('hydrates sections sorted by sort_order', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [createMockTemplateRow()] })
        .mockResolvedValueOnce({
          rows: [
            createMockTemplateSectionRow({
              id: SUBJECTIVE,
              sort_order: 1,
              title: 'Subjective',
            }),
            createMockTemplateSectionRow({
              id: OBJECTIVE,
              sort_order: 2,
              title: 'Objective',
            }),
          ],
        });

      const result = await findBuiltinTemplates();
      expect(result).toHaveLength(1);
      expect(result[0].sections).toHaveLength(2);
      expect(result[0].sections[0].title).toBe('Subjective');
      expect(result[0].sections[1].title).toBe('Objective');

      const [, params] = mockDbQuery.mock.calls[1] as [string, unknown[]];
      expect(params[0]).toEqual([TEMPLATE]);
    });

    it('groups sections by template_id across multiple templates', async () => {
      const t1 = createMockTemplateRow({ id: 't1' });
      const t2 = createMockTemplateRow({ id: 't2' });
      mockDbQuery
        .mockResolvedValueOnce({ rows: [t1, t2] })
        .mockResolvedValueOnce({
          rows: [
            createMockTemplateSectionRow({
              id: 's1',
              template_id: 't1',
              title: 'S1',
            }),
            createMockTemplateSectionRow({
              id: 's2',
              template_id: 't2',
              title: 'S2',
            }),
          ],
        });

      const result = await findBuiltinTemplates();
      expect(result[0].sections.map((s) => s.id)).toEqual(['s1']);
      expect(result[1].sections.map((s) => s.id)).toEqual(['s2']);
    });

    it('returns templates with empty sections array when no sections match', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [createMockTemplateRow()] })
        .mockResolvedValueOnce({ rows: [] });
      const result = await findBuiltinTemplates();
      expect(result[0].sections).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // findTemplateById
  // ---------------------------------------------------------------------------

  describe('findTemplateById', () => {
    it('returns template with sections when found', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [createMockTemplateRow()] })
        .mockResolvedValueOnce({ rows: [createMockTemplateSectionRow()] });

      const result = await findTemplateById(TEMPLATE);
      expect(result?.id).toBe(TEMPLATE);
      expect(result?.sections).toHaveLength(1);
    });

    it('returns null when template not found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      const result = await findTemplateById(TEMPLATE);
      expect(result).toBeNull();
    });

    it('filters archived_at IS NULL', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [createMockTemplateRow()] })
        .mockResolvedValueOnce({ rows: [] });
      await findTemplateById(TEMPLATE);
      const [sql] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('archived_at IS NULL');
    });
  });

  // ---------------------------------------------------------------------------
  // findTemplatesByScope
  // ---------------------------------------------------------------------------

  describe('findTemplatesByScope', () => {
    it('returns built-in templates + user-owned templates under user scope', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [
          createMockTemplateRow({
            id: 'builtin',
            is_builtin: true,
            name: 'SOAP Note',
          }),
          createMockTemplateRow({
            id: 'custom',
            is_builtin: false,
            user_id: USER_A,
            name: 'My Eval Template',
          }),
        ],
      });

      const result = await findTemplatesByScope(userScope);
      expect(result).toHaveLength(2);
      const [sql, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('is_builtin = TRUE OR user_id = $1');
      expect(params).toEqual([USER_A]);
    });

    it('scopes by organization_id under org scope', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      await findTemplatesByScope(orgScope);
      const [sql, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('is_builtin = TRUE OR organization_id = $1');
      expect(params).toEqual([ORG_A]);
    });

    it('filters archived_at IS NULL', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      await findTemplatesByScope(userScope);
      const [sql] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('archived_at IS NULL');
    });

    it('orders built-ins first, then by name', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      await findTemplatesByScope(userScope);
      const [sql] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('ORDER BY is_builtin DESC, name');
    });
  });

  // ---------------------------------------------------------------------------
  // findTemplateWithUserStyle — overlay via LEFT JOIN + COALESCE
  // ---------------------------------------------------------------------------

  describe('findTemplateWithUserStyle', () => {
    it('uses LEFT JOIN user_style_preferences + COALESCE for overlay', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [createMockTemplateRow()] })
        .mockResolvedValueOnce({ rows: [createMockTemplateSectionRow()] });

      await findTemplateWithUserStyle(TEMPLATE, USER_A);

      const [sectionSql, sectionParams] = mockDbQuery.mock.calls[1] as [
        string,
        unknown[],
      ];
      expect(sectionSql).toContain('LEFT JOIN user_style_preferences usp');
      expect(sectionSql).toContain(
        'COALESCE(usp.verbosity, nts.verbosity) AS verbosity'
      );
      expect(sectionSql).toContain(
        'COALESCE(usp.styling, nts.styling) AS styling'
      );
      expect(sectionSql).toContain('usp.user_id = $2');
      expect(sectionParams).toEqual([TEMPLATE, USER_A]);
    });

    it('returns null when template not found', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      const result = await findTemplateWithUserStyle(TEMPLATE, USER_A);
      expect(result).toBeNull();
    });

    it('orders sections by sort_order', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [createMockTemplateRow()] })
        .mockResolvedValueOnce({ rows: [] });
      await findTemplateWithUserStyle(TEMPLATE, USER_A);
      const [sectionSql] = mockDbQuery.mock.calls[1] as [string, unknown[]];
      expect(sectionSql).toContain('ORDER BY nts.sort_order');
    });

    it('returns mapped template with overlaid sections', async () => {
      mockDbQuery
        .mockResolvedValueOnce({
          rows: [createMockTemplateRow({ id: TEMPLATE })],
        })
        .mockResolvedValueOnce({
          rows: [
            createMockTemplateSectionRow({
              id: SUBJECTIVE,
              verbosity: 'detailed', // user override applied by COALESCE in SQL
              styling: 'bullets',
            }),
          ],
        });

      const result = await findTemplateWithUserStyle(TEMPLATE, USER_A);
      expect(result?.id).toBe(TEMPLATE);
      expect(result?.sections[0].verbosity).toBe('detailed');
      expect(result?.sections[0].styling).toBe('bullets');
    });
  });
});
