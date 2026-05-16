-- Remove unique constraint from drawingNumber.
-- Uniqueness among active drawings is now enforced at the application layer
-- (only blocks if isDeleted = false), so deleted drawings do not prevent reuse.
DROP INDEX IF EXISTS "Drawing_drawingNumber_key";
