/**
 * Test factories for Patient rows and domain objects.
 *
 * Default values are deliberately non-PHI-looking ("Test Patient") so test
 * failures printed to logs/CI don't risk leaking real clinical data patterns.
 */
import type { Patient, Pronoun } from '@/lib/types';
import type { PatientRow } from '@/lib/types/database';

const DEFAULT_USER_ID = '00000000-0000-0000-0000-00000000aaaa';
const DEFAULT_PATIENT_ID = '00000000-0000-0000-0000-0000000abcde';

export function createMockPatientRow(
  overrides: Partial<PatientRow> = {}
): PatientRow {
  return {
    id: DEFAULT_PATIENT_ID,
    user_id: DEFAULT_USER_ID,
    organization_id: null,
    first_name: 'Test',
    last_name: 'Patient',
    date_of_birth: null,
    pronoun: null,
    phone: null,
    email: null,
    context: null,
    archived_at: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function createMockPatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: DEFAULT_PATIENT_ID,
    userId: DEFAULT_USER_ID,
    organizationId: null,
    firstName: 'Test',
    lastName: 'Patient',
    dateOfBirth: null,
    pronoun: null as Pronoun | null,
    phone: null,
    email: null,
    context: null,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}
