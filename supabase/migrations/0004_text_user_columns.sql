-- =============================================================
-- 0004_text_user_columns
--
-- Some Supabase projects were set up with an earlier version of
-- 0001_init.sql where person-columns (submitted_by, verified_by,
-- rejected_by, owner_id, updated_by, taken_by) were uuid FKs to
-- a profiles table, plus RLS policies that referenced submitted_by.
-- The current code passes plain text (the user's display_name or
-- email), which fails on the uuid columns with:
--
--   invalid input syntax for type uuid: "kimcodriver"
--
-- This migration:
--   1. Drops the legacy RLS policies that reference the columns
--      (otherwise ALTER TYPE fails with "cannot alter type of a
--      column used in a policy definition").
--   2. Drops any FK constraints to profiles.
--   3. Converts the columns to text.
--   4. Leaves RLS enabled but with NO policies on tables other than
--      `profiles` — the BFF uses service_role exclusively, which
--      bypasses RLS. Default-deny for anon = belt and braces.
--
-- Idempotent: each step is wrapped in a DO block with EXCEPTION
-- handling. Safe to re-run on any DB state (fresh, partial, fully
-- migrated).
-- =============================================================

-- ---- Step 1: drop legacy policies that reference these columns ----
DO $$ BEGIN
  DROP POLICY IF EXISTS evidence_own_update ON public.evidence_links;
  DROP POLICY IF EXISTS evidence_insert     ON public.evidence_links;
  DROP POLICY IF EXISTS evidence_read       ON public.evidence_links;
  DROP POLICY IF EXISTS controls_read       ON public.controls;
  DROP POLICY IF EXISTS auditlog_read       ON public.audit_log;
  DROP POLICY IF EXISTS snapshots_read      ON public.snapshots;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ---- Step 2: drop FK constraints ----
DO $$ BEGIN
  ALTER TABLE public.evidence_links DROP CONSTRAINT IF EXISTS evidence_links_submitted_by_fkey;
  ALTER TABLE public.evidence_links DROP CONSTRAINT IF EXISTS evidence_links_verified_by_fkey;
  ALTER TABLE public.evidence_links DROP CONSTRAINT IF EXISTS evidence_links_rejected_by_fkey;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.evidence_links ALTER COLUMN submitted_by TYPE text USING submitted_by::text;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.evidence_links ALTER COLUMN submitted_by DROP NOT NULL;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.evidence_links ALTER COLUMN verified_by TYPE text USING verified_by::text;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.evidence_links ALTER COLUMN rejected_by TYPE text USING rejected_by::text;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;

-- ---- controls ----
DO $$ BEGIN
  ALTER TABLE public.controls DROP CONSTRAINT IF EXISTS controls_owner_id_fkey;
  ALTER TABLE public.controls DROP CONSTRAINT IF EXISTS controls_updated_by_fkey;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Convert legacy owner_id (uuid) to text, then rename to owner_name.
-- If column is already owner_name (text), both inner steps no-op.
DO $$ BEGIN
  ALTER TABLE public.controls ALTER COLUMN owner_id TYPE text USING owner_id::text;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.controls RENAME COLUMN owner_id TO owner_name;
EXCEPTION WHEN undefined_column OR duplicate_column OR undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.controls ALTER COLUMN updated_by TYPE text USING updated_by::text;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;

-- ---- snapshots ----
DO $$ BEGIN
  ALTER TABLE public.snapshots DROP CONSTRAINT IF EXISTS snapshots_taken_by_fkey;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.snapshots ALTER COLUMN taken_by TYPE text USING taken_by::text;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.snapshots ALTER COLUMN taken_by DROP NOT NULL;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;

-- ---- audit_log ----
-- actor_id stays uuid (reserved column) but should be nullable + no FK.
DO $$ BEGIN
  ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_id_fkey;
EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.audit_log ALTER COLUMN actor_id DROP NOT NULL;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;

-- ---- Optional: keep RLS on but default-deny (defense-in-depth) ----
-- Since the BFF uses service_role exclusively (bypasses RLS), keeping
-- RLS enabled with zero policies on these tables means anon key can
-- never read them — useful if a key ever leaks.
DO $$ BEGIN
  ALTER TABLE public.evidence_links ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.controls       ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.audit_log      ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.snapshots      ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL; END $$;
