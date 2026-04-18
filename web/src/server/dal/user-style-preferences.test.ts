import { describe, it, expect, beforeEach } from 'vitest';
import { mockDbQuery, resetMocks } from '@/test/dal-helpers';
import { createMockUserStylePreferenceRow } from '@/test/factories/user-style-preference-factory';
import {
  upsertUserSectionStyle,
  findUserStylePreferences,
} from './user-style-preferences';

const USER_A = '00000000-0000-0000-0000-0000000000a1';
const SECTION_1 = '00000000-0000-0000-0000-000000000011';

describe('user-style-preferences DAL', () => {
  beforeEach(() => {
    resetMocks();
  });

  // ---------------------------------------------------------------------------
  // upsertUserSectionStyle
  // ---------------------------------------------------------------------------

  describe('upsertUserSectionStyle', () => {
    it('uses ON CONFLICT (user_id, section_id) DO UPDATE', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [createMockUserStylePreferenceRow()],
      });
      await upsertUserSectionStyle(USER_A, SECTION_1, { verbosity: 'detailed' });

      const [sql] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('ON CONFLICT (user_id, section_id) DO UPDATE');
    });

    it('uses COALESCE to preserve existing values on partial update', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [createMockUserStylePreferenceRow()],
      });
      await upsertUserSectionStyle(USER_A, SECTION_1, { verbosity: 'detailed' });

      const [sql] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain(
        'COALESCE(EXCLUDED.verbosity, user_style_preferences.verbosity)'
      );
      expect(sql).toContain(
        'COALESCE(EXCLUDED.styling,   user_style_preferences.styling)'
      );
    });

    it('passes null for missing axis so COALESCE against template defaults works', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [createMockUserStylePreferenceRow()],
      });
      await upsertUserSectionStyle(USER_A, SECTION_1, { verbosity: 'detailed' });

      const [, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(params[2]).toBe('detailed'); // verbosity
      expect(params[3]).toBeNull(); // styling null -> COALESCE to nts.styling
    });

    it('rejects when neither verbosity nor styling is provided', async () => {
      await expect(
        upsertUserSectionStyle(USER_A, SECTION_1, {})
      ).rejects.toThrow(/at least one of verbosity or styling/i);
    });

    it('Rule 10: throws when section_id is invalid (no rows returned)', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      await expect(
        upsertUserSectionStyle(USER_A, SECTION_1, { verbosity: 'concise' })
      ).rejects.toThrow(/section not found/i);
    });

    it('returns mapped UserStylePreference on success', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [
          createMockUserStylePreferenceRow({
            user_id: USER_A,
            section_id: SECTION_1,
            verbosity: 'detailed',
            styling: 'bullets',
          }),
        ],
      });
      const result = await upsertUserSectionStyle(USER_A, SECTION_1, {
        verbosity: 'detailed',
        styling: 'bullets',
      });
      expect(result.verbosity).toBe('detailed');
      expect(result.styling).toBe('bullets');
      expect(result.userId).toBe(USER_A);
      expect(result.sectionId).toBe(SECTION_1);
    });

    it('resolves missing axes from note_template_sections on first insert', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [createMockUserStylePreferenceRow()],
      });
      await upsertUserSectionStyle(USER_A, SECTION_1, { styling: 'bullets' });

      const [sql] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('FROM note_template_sections nts');
      expect(sql).toContain('WHERE nts.id = $2');
      expect(sql).toContain('COALESCE($3::text, nts.verbosity)');
      expect(sql).toContain('COALESCE($4::text, nts.styling)');
    });
  });

  // ---------------------------------------------------------------------------
  // findUserStylePreferences
  // ---------------------------------------------------------------------------

  describe('findUserStylePreferences', () => {
    it('returns all preferences for a user', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [
          createMockUserStylePreferenceRow({ section_id: SECTION_1 }),
          createMockUserStylePreferenceRow({
            section_id: '00000000-0000-0000-0000-000000000012',
            verbosity: 'detailed',
          }),
        ],
      });

      const result = await findUserStylePreferences(USER_A);
      expect(result).toHaveLength(2);
      expect(result[0].sectionId).toBe(SECTION_1);
      expect(result[1].verbosity).toBe('detailed');
    });

    it('filters by user_id', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      await findUserStylePreferences(USER_A);
      const [sql, params] = mockDbQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('WHERE user_id = $1');
      expect(params).toEqual([USER_A]);
    });

    it('returns empty array when user has no preferences', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] });
      const result = await findUserStylePreferences(USER_A);
      expect(result).toEqual([]);
    });
  });
});
