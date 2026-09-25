-- Candidate only: apply manually after explicit DDL approval, BEFORE deploying
-- the supplier API that reads this column. Existing suppliers remain NULL.
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS rfc text;