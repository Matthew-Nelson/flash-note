/**
 * Shared type definitions used by both client and server code.
 *
 * Re-exports client types for backwards compatibility with @/lib/types imports.
 * Server-only types (with passwordHash, lockout fields, etc.) live in server/types.ts.
 */

// Shared types used by both client and server
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'canceled'
  | 'past_due'
  | 'unpaid';

export type OrgRole = 'owner' | 'admin' | 'member';

export type NoteType =
  | 'daily_note'
  | 'initial_eval'
  | 'progress_note'
  | 'discharge';

// Client-side types (re-exported for @/lib/types compatibility)
export type {
  User,
  StoredAuth,
  AuthResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiResponse,
  SessionEndReason,
} from './client';

// ============================================================================
// Phase 4 (04-01) — PHI Storage domain types
// ============================================================================

export type Verbosity = 'concise' | 'detailed';
export type Styling = 'paragraph' | 'bullets';
export type NoteVersionSource = 'generated' | 'manual' | 'magic_edit';
export type Pronoun = 'he/him' | 'she/her' | 'they/them' | 'other';

/**
 * A single section of a generated clinical note.
 * `sectionId` references `note_template_sections.id` (UUID).
 * `title` is a denormalized snapshot captured at generation time — it stays
 * stable even if the template's section title is later renamed.
 */
export interface NoteSection {
  sectionId: string;
  title: string;
  content: string;
}

export interface NoteTemplate {
  id: string;
  userId: string | null;
  organizationId: string | null;
  name: string;
  isBuiltin: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NoteTemplateSection {
  id: string;
  templateId: string;
  title: string;
  sortOrder: number;
  verbosity: Verbosity;
  styling: Styling;
  promptInstructions: string;
  includeInCopyAll: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NoteTemplateWithSections extends NoteTemplate {
  sections: NoteTemplateSection[];
}

export interface Patient {
  id: string;
  userId: string;
  organizationId: string | null;
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
  pronoun: Pronoun | null;
  phone: string | null;
  email: string | null;
  context: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClinicalNote {
  id: string;
  userId: string;
  organizationId: string | null;
  patientId: string | null;
  templateId: string;
  noteType: NoteType;
  content: NoteSection[];
  quickNotes: string;
  patientContext: string | null;
  modality: 'in_person' | 'telehealth' | null;
  durationMinutes: number | null;
  generationTimeMs: number | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClinicalNoteWithPatient extends ClinicalNote {
  patientFirstName: string | null;
  patientLastName: string | null;
}

export interface NoteVersion {
  id: string;
  noteId: string;
  sectionId: string;
  version: number;
  content: string;
  source: NoteVersionSource;
  createdBy: string;
  createdAt: Date;
}

export interface NoteVersionWithSection extends NoteVersion {
  sectionTitle: string;
}

export interface UserStylePreference {
  userId: string;
  sectionId: string;
  verbosity: Verbosity;
  styling: Styling;
  updatedAt: Date;
}

/**
 * Authorization scope for DAL queries (Rule 5 boundary).
 *
 * DAL functions that return user-owned PHI take a QueryScope and filter
 * SQL by either `user_id` or `organization_id` depending on the discriminant.
 * Callers construct the scope from the authenticated session — org scope is
 * chosen when the user is acting in an org admin/owner capacity.
 */
export type QueryScope =
  | { type: 'user'; userId: string }
  | { type: 'organization'; organizationId: string };
