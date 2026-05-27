-- =============================================================
-- Autocorp ITGR Audit Tracker — schema
-- Maps to: spec/audit-tracking-system.md + spec/self-audit.md
--
-- Open-access design:
--   - No Supabase Auth, no profiles table.
--   - BFF uses service_role exclusively; browser never connects.
--   - RLS is disabled on all tables (the BFF is the only client).
--   - Actor attribution is the self-declared "Acting as" cookie name,
--     stored as plain text alongside IP + UA captured from request headers.
-- =============================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- =============================================================
-- controls — 96 ITGR controls (seeded once from data/audit_data.json)
-- =============================================================
create table public.controls (
  no                 int primary key,
  category           text not null,
  category_short     text not null,
  category_th        text not null,
  category_short_th  text not null,
  name               text not null,
  name_th            text,
  question           text not null,
  standards          text not null,
  evidence_req       text,
  article            text,
  risk               text not null check (risk in ('Very High','High','Middle','Low')),
  qtype              text,
  note_file          text,
  owner_name         text,                                  -- optional, self-declared
  verdict            text not null default 'unset'
                     check (verdict in ('unset','comply','partial','non','na')),
  finding            text,
  finding_th         text,
  recommendation     text,
  recommendation_th  text,
  updated_by         text,                                  -- self-declared name
  updated_at         timestamptz not null default now()
);
create index idx_controls_verdict on public.controls(verdict);
comment on table public.controls is
  '96 Marubeni ITGR controls. Verdict updated via BFF; defensibility guard in server action ensures ≥1 verified evidence before comply/partial.';

-- =============================================================
-- evidence_links — Drive URL index, kind=legacy|new
-- =============================================================
create table public.evidence_links (
  id              uuid primary key default gen_random_uuid(),
  control_no      int not null references public.controls(no) on delete cascade,
  kind            text not null check (kind in ('legacy','new')),
  drive_url       text not null,
  title           text,
  note            text check (length(note) <= 500),
  submitted_by    text,                                     -- self-declared
  submitted_at    timestamptz not null default now(),
  verified_by     text,
  verified_at     timestamptz,
  rejected_by     text,
  rejected_at     timestamptz,
  rejected_reason text,
  archived_at     timestamptz,
  constraint evidence_url_format
    check (drive_url ~* '^https?://(drive|docs|sheets)\.google\.com/')
);
create unique index uq_evidence_active
  on public.evidence_links(control_no, drive_url)
  where archived_at is null;
create index idx_evidence_control on public.evidence_links(control_no);
create index idx_evidence_pending on public.evidence_links(control_no)
  where verified_at is null and rejected_at is null and archived_at is null;

-- =============================================================
-- audit_log — append-only event ledger
-- BFF inserts only. No UPDATE/DELETE expected.
-- Self-audit: C7-75 (logs), C8-92 (detection of removal).
-- =============================================================
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  ts          timestamptz not null default now(),
  actor_id    uuid,                                        -- reserved for future auth
  actor_email text,                                        -- self-declared via cookie
  action      text not null,
  target_kind text,
  target_id   text,
  before      jsonb,
  after       jsonb,
  request_ip  inet,
  user_agent  text
);
create index idx_audit_ts on public.audit_log(ts desc);
create index idx_audit_actor on public.audit_log(actor_email);
create index idx_audit_action on public.audit_log(action);
create index idx_audit_target on public.audit_log(target_kind, target_id);
comment on table public.audit_log is
  'Append-only event log. BFF (service_role) inserts only. No update/delete needed (immutable by convention).';

-- =============================================================
-- v_verdict_history — derived view from audit_log
-- =============================================================
create or replace view public.v_verdict_history as
  select id, ts, actor_email, target_id::int as control_no,
         before->>'verdict' as old_verdict,
         after->>'verdict'  as new_verdict,
         after->>'note'     as note
  from public.audit_log
  where action = 'verdict.change';

-- =============================================================
-- snapshots — frozen dashboard state on Refresh
-- =============================================================
create table public.snapshots (
  id            uuid primary key default gen_random_uuid(),
  taken_at      timestamptz not null default now(),
  taken_by      text,
  score         numeric(5,2) not null,
  status_counts jsonb not null,
  risk_status   jsonb not null,
  cat_status    jsonb not null,
  top_findings  jsonb not null,
  root_causes   jsonb not null,
  verdicts      jsonb not null,
  label         text
);
create index idx_snapshots_taken_at on public.snapshots(taken_at desc);

-- =============================================================
-- updated_at trigger
-- =============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_controls_updated
  before update on public.controls
  for each row execute function public.set_updated_at();

-- =============================================================
-- RPC helpers
-- =============================================================
create or replace function public.compute_score()
returns numeric language sql stable as $$
  select round(
    100.0 * sum(
      case verdict
        when 'comply'  then 1.0
        when 'partial' then 0.5
        else 0
      end
    ) / nullif(count(*) filter (where verdict <> 'na'), 0)
  , 1)
  from public.controls
  where verdict <> 'unset'
$$;

create or replace function public.status_counts()
returns table(comply int, partial int, non int, na int, unset int)
language sql stable as $$
  select
    count(*) filter (where verdict='comply')::int,
    count(*) filter (where verdict='partial')::int,
    count(*) filter (where verdict='non')::int,
    count(*) filter (where verdict='na')::int,
    count(*) filter (where verdict='unset')::int
  from public.controls
$$;
