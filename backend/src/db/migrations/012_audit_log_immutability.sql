-- Migration 012: Audit log immutability protections
-- Part of Phase 0 HIPAA Infrastructure
--
-- Adds database-level triggers to prevent modification or deletion of audit log rows.
-- Required by 45 CFR § 164.312(c)(1) (integrity controls) — audit logs must be
-- protected from improper alteration or destruction.
--
-- Approach: Triggers (not REVOKE) because:
--   - Triggers fire regardless of which role executes the statement (including superusers)
--   - No dependency on knowing the application's database role name
--   - Can be selectively disabled for future controlled archival
--
-- See docs/compliance/AUDIT_LOGGING_REQUIREMENTS.md for full requirements.

-- Prevent UPDATE on audit_logs
CREATE OR REPLACE FUNCTION prevent_audit_log_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs rows cannot be modified';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_update();

-- Prevent DELETE on audit_logs
CREATE OR REPLACE FUNCTION prevent_audit_log_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs rows cannot be deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_delete();

-- Prevent TRUNCATE on audit_logs
-- Note: TRUNCATE triggers must be FOR EACH STATEMENT (FOR EACH ROW is invalid)
CREATE OR REPLACE FUNCTION prevent_audit_log_truncate()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs table cannot be truncated';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_truncate
BEFORE TRUNCATE ON audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_log_truncate();

-- ROLLBACK (emergency use only — disabling immutability should require explicit justification):
-- DROP TRIGGER audit_logs_no_update ON audit_logs;
-- DROP TRIGGER audit_logs_no_delete ON audit_logs;
-- DROP TRIGGER audit_logs_no_truncate ON audit_logs;
-- DROP FUNCTION prevent_audit_log_update();
-- DROP FUNCTION prevent_audit_log_delete();
-- DROP FUNCTION prevent_audit_log_truncate();
