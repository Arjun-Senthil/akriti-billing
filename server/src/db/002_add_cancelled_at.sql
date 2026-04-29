-- =============================================================
-- Migration 002: Add cancelled_at to orders
-- Run: docker exec -i akriti-db psql -U akriti_admin -d akriti_billing < server/src/db/002_add_cancelled_at.sql
--
-- Why a separate column instead of relying on updated_at?
--   updated_at changes on every edit (status, notes, delivery date).
--   cancelled_at records exactly when the cancellation happened,
--   so the 24-hour undo window is precise regardless of other edits.
--
-- Safe to re-run: IF NOT EXISTS prevents duplicate column error.
-- =============================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
