/**
 * Test factory for UserStylePreference rows and domain objects.
 */
import type { UserStylePreference } from '@/lib/types';
import type { UserStylePreferenceRow } from '@/lib/types/database';

const DEFAULT_USER_ID = '00000000-0000-0000-0000-00000000aaaa';
const DEFAULT_SECTION_ID = '00000000-0000-0000-0000-000000000011';

export function createMockUserStylePreferenceRow(
  overrides: Partial<UserStylePreferenceRow> = {}
): UserStylePreferenceRow {
  return {
    user_id: DEFAULT_USER_ID,
    section_id: DEFAULT_SECTION_ID,
    verbosity: 'concise',
    styling: 'paragraph',
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function createMockUserStylePreference(
  overrides: Partial<UserStylePreference> = {}
): UserStylePreference {
  return {
    userId: DEFAULT_USER_ID,
    sectionId: DEFAULT_SECTION_ID,
    verbosity: 'concise',
    styling: 'paragraph',
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}
