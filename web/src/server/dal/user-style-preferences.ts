import 'server-only';

import { db } from '@/server/db';
import type { Styling, UserStylePreference, Verbosity } from '@/lib/types';
import type { UserStylePreferenceRow } from '@/lib/types/database';

/**
 * Data Access Layer for user_style_preferences (overlay table).
 *
 * Per Research §6.2 Option A: the built-in SOAP template seed is never
 * mutated. Per-user preferences for section verbosity/styling live in this
 * overlay and are LEFT JOINed into note-template queries via
 * findTemplateWithUserStyle().
 *
 * Upsert merges partial input with existing values — COALESCE in ON CONFLICT
 * keeps previously-set values untouched if the caller only updates one axis.
 */

const PREF_COLUMNS = `user_id, section_id, verbosity, styling, updated_at`;

function rowToUserStylePreference(
  row: UserStylePreferenceRow
): UserStylePreference {
  return {
    userId: row.user_id,
    sectionId: row.section_id,
    verbosity: row.verbosity,
    styling: row.styling,
    updatedAt: row.updated_at,
  };
}

export interface UpsertUserSectionStyleInput {
  verbosity?: Verbosity;
  styling?: Styling;
}

/**
 * Insert or update a single (userId, sectionId) row. When only one of
 * verbosity/styling is provided, the other column keeps its existing value
 * (if a row exists) or uses the section's template default on first write.
 *
 * NOTE: The table schema requires both verbosity and styling NOT NULL. On
 * first-time insert for this (user, section) pair, we fill missing axes with
 * the SECTION's defaults via a subquery on note_template_sections. Subsequent
 * updates use COALESCE to keep existing values.
 */
export async function upsertUserSectionStyle(
  userId: string,
  sectionId: string,
  input: UpsertUserSectionStyleInput
): Promise<UserStylePreference> {
  if (input.verbosity === undefined && input.styling === undefined) {
    throw new Error(
      'upsertUserSectionStyle: at least one of verbosity or styling is required'
    );
  }

  const result = await db.query<UserStylePreferenceRow>(
    `INSERT INTO user_style_preferences (user_id, section_id, verbosity, styling)
     SELECT $1,
            $2,
            COALESCE($3::text, nts.verbosity),
            COALESCE($4::text, nts.styling)
     FROM note_template_sections nts
     WHERE nts.id = $2
     ON CONFLICT (user_id, section_id) DO UPDATE
       SET verbosity = COALESCE(EXCLUDED.verbosity, user_style_preferences.verbosity),
           styling   = COALESCE(EXCLUDED.styling,   user_style_preferences.styling),
           updated_at = NOW()
     RETURNING ${PREF_COLUMNS}`,
    [userId, sectionId, input.verbosity ?? null, input.styling ?? null]
  );

  if (result.rows.length === 0) {
    // Zero rows usually means the section_id did not match note_template_sections —
    // the INSERT's SELECT subquery returned no rows, so no INSERT fired.
    throw new Error(
      'upsertUserSectionStyle: section not found — cannot resolve template defaults'
    );
  }
  return rowToUserStylePreference(result.rows[0]);
}

/**
 * All style preferences for a user, across all sections.
 */
export async function findUserStylePreferences(
  userId: string
): Promise<UserStylePreference[]> {
  const result = await db.query<UserStylePreferenceRow>(
    `SELECT ${PREF_COLUMNS} FROM user_style_preferences
     WHERE user_id = $1`,
    [userId]
  );
  return result.rows.map((r) => rowToUserStylePreference(r));
}
