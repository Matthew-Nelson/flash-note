-- 002_phi_storage.sql
-- Phase 4: PHI Storage — patients, clinical notes, per-section append-only versioning, templates.
--
-- Adds 6 new tables:
--   1. note_templates              (user/org-owned OR built-in; SOAP seeded below)
--   2. note_template_sections      (ordered per template; carries per-section prompt + style defaults)
--   3. patients                    (PHI: first/last name, DOB, contact, persistent context)
--   4. clinical_notes              (PHI: JSONB content, quick_notes, patient_context snapshot)
--   5. note_versions               (append-only per-section amendment trail; DB-level immutability triggers)
--   6. user_style_preferences      (per-user overlay for section verbosity/styling — Research §6.2 Option A)
--
-- Schema is additive-only (forward-only migration rule from Phase 3).
-- No changes to existing tables.

-- Ensure pgcrypto for gen_random_uuid() (already present from 001, but defensive)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- Shared updated_at trigger function (reused across new tables)
-- ============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- NOTE_TEMPLATES
-- ============================================================================
CREATE TABLE IF NOT EXISTS note_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE RESTRICT,         -- NULL for built-in
  organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
  name            TEXT NOT NULL,
  is_builtin      BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_templates_user_name
  ON note_templates(user_id, name)
  WHERE archived_at IS NULL AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_note_templates_builtin
  ON note_templates(is_builtin)
  WHERE is_builtin = TRUE AND archived_at IS NULL;

CREATE TRIGGER note_templates_updated_at
  BEFORE UPDATE ON note_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- NOTE_TEMPLATE_SECTIONS
-- ============================================================================
-- CASCADE rationale: deleting a template deletes its section definitions.
-- Safe because clinical_notes.template_id uses ON DELETE RESTRICT — a template
-- with notes cannot be deleted (only archived).
CREATE TABLE IF NOT EXISTS note_template_sections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id         UUID NOT NULL REFERENCES note_templates(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  sort_order          INT NOT NULL,
  verbosity           TEXT NOT NULL DEFAULT 'concise'
    CHECK (verbosity IN ('concise', 'detailed')),
  styling             TEXT NOT NULL DEFAULT 'paragraph'
    CHECK (styling IN ('paragraph', 'bullets')),
  prompt_instructions TEXT NOT NULL,
  include_in_copy_all BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_template_sections_template_sort
  ON note_template_sections(template_id, sort_order);

CREATE TRIGGER note_template_sections_updated_at
  BEFORE UPDATE ON note_template_sections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- PATIENTS (PHI)
-- ============================================================================
CREATE TABLE IF NOT EXISTS patients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  date_of_birth   DATE,
  pronoun         TEXT,  -- validated by Zod (app layer), not CHECK — allows future pronoun values without migration
  phone           TEXT,
  email           TEXT,
  context         TEXT,  -- persistent per-patient free-text context (PHI-04)
  archived_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patients_user_name
  ON patients(user_id, last_name, first_name)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_patients_user_created
  ON patients(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patients_org_name
  ON patients(organization_id, last_name, first_name)
  WHERE archived_at IS NULL AND organization_id IS NOT NULL;

CREATE TRIGGER patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- CLINICAL_NOTES (PHI)
-- ============================================================================
-- modality and duration_minutes are first-class columns (not buried in JSONB metadata)
-- so they can be indexed/filtered and CHECK-constrained at the DB level.
CREATE TABLE IF NOT EXISTS clinical_notes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  organization_id     UUID REFERENCES organizations(id) ON DELETE RESTRICT,
  patient_id          UUID REFERENCES patients(id) ON DELETE RESTRICT,
  template_id         UUID NOT NULL REFERENCES note_templates(id) ON DELETE RESTRICT,
  note_type           TEXT NOT NULL
    CHECK (note_type IN ('daily_note', 'initial_eval', 'progress_note', 'discharge')),
  content             JSONB NOT NULL,  -- ordered NoteSection[] array — Zod-parsed in DAL on read
  quick_notes         TEXT NOT NULL,   -- PHI: original shorthand input
  patient_context     TEXT,            -- PHI: patients.context snapshot at generation time
  modality            TEXT
    CHECK (modality IN ('in_person', 'telehealth')),
  duration_minutes    INT,
  generation_time_ms  INT,
  archived_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinical_notes_user_created
  ON clinical_notes(user_id, created_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clinical_notes_user_patient
  ON clinical_notes(user_id, patient_id, created_at DESC)
  WHERE archived_at IS NULL AND patient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clinical_notes_org_created
  ON clinical_notes(organization_id, created_at DESC)
  WHERE archived_at IS NULL AND organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clinical_notes_org_patient
  ON clinical_notes(organization_id, patient_id, created_at DESC)
  WHERE archived_at IS NULL AND organization_id IS NOT NULL AND patient_id IS NOT NULL;

CREATE TRIGGER clinical_notes_updated_at
  BEFORE UPDATE ON clinical_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- NOTE_VERSIONS (append-only, DB-enforced immutability)
-- ============================================================================
-- Mirrors audit_logs immutability pattern (001_initial_schema.sql:95-127).
-- PHI-05 requires "original never deleted" and "immutable amendment trail";
-- DB triggers are the defense-in-depth layer on top of the DAL "no UPDATE/DELETE"
-- convention. A developer cannot accidentally UPDATE a version row even via raw SQL.
CREATE TABLE IF NOT EXISTS note_versions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id    UUID NOT NULL REFERENCES clinical_notes(id) ON DELETE RESTRICT,
  section_id UUID NOT NULL REFERENCES note_template_sections(id) ON DELETE RESTRICT,
  version    INT NOT NULL,
  content    TEXT NOT NULL,
  source     TEXT NOT NULL
    CHECK (source IN ('generated', 'manual', 'magic_edit')),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_note_versions_note_section_version
  ON note_versions(note_id, section_id, version);

CREATE INDEX IF NOT EXISTS idx_note_versions_note_section_desc
  ON note_versions(note_id, section_id, version DESC);

-- Immutability triggers — prevent any UPDATE/DELETE of note_versions rows
CREATE OR REPLACE FUNCTION prevent_note_version_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'note_versions rows cannot be modified';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER note_versions_no_update
  BEFORE UPDATE ON note_versions
  FOR EACH ROW EXECUTE FUNCTION prevent_note_version_update();

CREATE OR REPLACE FUNCTION prevent_note_version_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'note_versions rows cannot be deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER note_versions_no_delete
  BEFORE DELETE ON note_versions
  FOR EACH ROW EXECUTE FUNCTION prevent_note_version_delete();

-- ============================================================================
-- USER_STYLE_PREFERENCES (per-user overlay for built-in template sections)
-- ============================================================================
-- Research §6.2 Option A: users never mutate the built-in template seed row.
-- Instead, per-user overrides for (verbosity, styling) live in this overlay table.
-- Generation DAL does LEFT JOIN and COALESCEs user values over template defaults.
CREATE TABLE IF NOT EXISTS user_style_preferences (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES note_template_sections(id) ON DELETE CASCADE,
  verbosity  TEXT NOT NULL CHECK (verbosity IN ('concise', 'detailed')),
  styling    TEXT NOT NULL CHECK (styling IN ('paragraph', 'bullets')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, section_id)
);

CREATE INDEX IF NOT EXISTS idx_user_style_preferences_user
  ON user_style_preferences(user_id);

CREATE TRIGGER user_style_preferences_updated_at
  BEFORE UPDATE ON user_style_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- SEED: Built-in SOAP template
-- ============================================================================
-- Hard-coded UUIDs are stable across environments (dev, CI, staging, prod) —
-- clinical_notes.content[].sectionId references them, so they must not drift.
-- prompt_instructions use placeholder strings that Plan 04-03 replaces during
-- the prompt-system cutover (clean cutover per D-06). Placeholder strings are
-- valid SQL so the seed applies cleanly even before the cutover.
INSERT INTO note_templates (id, user_id, organization_id, name, is_builtin)
VALUES ('00000000-0000-0000-0000-000000000001', NULL, NULL, 'SOAP Note', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO note_template_sections
  (id, template_id, title, sort_order, verbosity, styling, prompt_instructions, include_in_copy_all)
VALUES
  ('00000000-0000-0000-0000-000000000011',
   '00000000-0000-0000-0000-000000000001',
   'Subjective', 1, 'concise', 'paragraph',
   $PROMPT$<Subjective section — prompt content ported in Plan 04-03>$PROMPT$,
   TRUE),
  ('00000000-0000-0000-0000-000000000012',
   '00000000-0000-0000-0000-000000000001',
   'Objective', 2, 'detailed', 'paragraph',
   $PROMPT$<Objective section — prompt content ported in Plan 04-03>$PROMPT$,
   TRUE),
  ('00000000-0000-0000-0000-000000000013',
   '00000000-0000-0000-0000-000000000001',
   'Assessment', 3, 'concise', 'paragraph',
   $PROMPT$<Assessment section — prompt content ported in Plan 04-03>$PROMPT$,
   TRUE),
  ('00000000-0000-0000-0000-000000000014',
   '00000000-0000-0000-0000-000000000001',
   'Plan', 4, 'concise', 'bullets',
   $PROMPT$<Plan section — prompt content ported in Plan 04-03>$PROMPT$,
   TRUE)
ON CONFLICT (id) DO NOTHING;
