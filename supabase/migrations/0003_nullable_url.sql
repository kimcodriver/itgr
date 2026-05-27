-- =============================================================
-- 0003_nullable_url — allow evidence rows without a Drive link yet
--
-- Some evidence is pre-seeded from the ITGR Appendix F (the
-- evidence_req template) with only a title. The Drive URL is attached
-- later when the auditor locates the actual file.
-- =============================================================

alter table public.evidence_links alter column drive_url drop not null;

alter table public.evidence_links drop constraint if exists evidence_url_format;
alter table public.evidence_links add constraint evidence_url_format
  check (drive_url is null or drive_url ~* '^https?://(drive|docs|sheets)\.google\.com/');

-- The existing partial unique index on (control_no, drive_url) is fine —
-- Postgres treats NULL as distinct, so multiple URL-less rows for the
-- same control are allowed (we dedupe in app code by submitted_by + title).
