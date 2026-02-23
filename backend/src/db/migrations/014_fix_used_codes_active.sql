-- H-13: Backfill — used invite codes should be inactive.
-- markCodeAsUsed() was setting used_by/used_at but leaving is_active = TRUE.

UPDATE invite_codes SET is_active = FALSE
WHERE used_by IS NOT NULL AND is_active = TRUE;
