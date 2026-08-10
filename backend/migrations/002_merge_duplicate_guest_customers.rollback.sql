-- Guest merge rollback cannot be automatic: deleted duplicate profiles and their
-- original customer_id relationships must be restored from the pre-migration backup.
-- This file intentionally fails fast instead of pretending it can restore data.
DO $$
BEGIN
  RAISE EXCEPTION 'Guest merge is irreversible without restoring the pre-migration backup';
END $$;
