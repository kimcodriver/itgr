-- =============================================================
-- Autocorp ITGR Audit Tracker — initial schema (FY2026 one-off)
-- Maps to: spec/audit-tracking-system.md + spec/self-audit.md
-- =============================================================

-- ----- Extensions -----
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- =============================================================
-- profiles — one row per Supabase auth user
-- Self-audit: C2-13 access control, C2-19 no shared accounts, C2-20 disable unused
-- =============================================================
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text unique not null,
  display_name    text,
  role            text not null default 'observer'
                  check (role in ('audit_lead','it_engineer','observer')),
  active          boolean not null default true,
  last_sign_in_at timestamptz,
  ui_prefs        jsonb not null default '{"lang":"th","theme":"system"}'::jsonb,
  created_at      timestamptz not null default now()
);
comment on table public.profiles is
  'One row per app user. role drives RLS. active=false blocks sign-in (control C2-20).';

-- =============================================================
-- controls — 96 ITGR controls catalogue (seeded once)
-- Self-audit: source-of-truth, treat as immutable framework data
-- =============================================================
create table public.controls (
  no               int primary key,
  category         text not null,
  category_short   text not null,
  category_th      text not null,
  category_short_th text not null,
  name             text not null,
  name_th          text,
  question         text not null,
  standards        text not null,
  evidence_req     text,
  article          text,
  risk             text not null check (risk in ('Very High','High','Middle','Low')),
  qtype            text,
  note_file        text,
  owner_id         uuid references public.profiles(id),
  verdict          text not null default 'unset'
                   check (verdict in ('unset','comply','partial','non','na')),
  finding          text,
  finding_th       text,
  recommendation   text,
  recommendation_th text,
  updated_by       uuid references public.profiles(id),
  updated_at       timestamptz not null default now()
);
create index idx_controls_owner on public.controls(owner_id);
create index idx_controls_verdict on public.controls(verdict);
comment on table public.controls is
  '96 Marubeni ITGR controls. Owner = IT engineer assigned. Verdict set by audit_lead only.';

-- =============================================================
-- evidence_links — paste-a-Drive-link records
-- Self-audit: C8-86 file storage (links not files), C8-87 designation, C8-92 detection of removal
-- =============================================================
create table public.evidence_links (
  id              uuid primary key default gen_random_uuid(),
  control_no      int not null references public.controls(no) on delete cascade,
  kind            text not null check (kind in ('legacy','new')),
  drive_url       text not null,
  title           text,
  note            text check (length(note) <= 500),
  submitted_by    uuid not null references public.profiles(id),
  submitted_at    timestamptz not null default now(),
  verified_by     uuid references public.profiles(id),
  verified_at     timestamptz,
  rejected_by     uuid references public.profiles(id),
  rejected_at     timestamptz,
  rejected_reason text,
  archived_at     timestamptz,
  -- Soft uniqueness on URL per control (lets re-submit after delete)
  constraint evidence_url_format
    check (drive_url ~* '^https?://(drive|docs|sheets)\.google\.com/')
);
create unique index uq_evidence_active
  on public.evidence_links(control_no, drive_url)
  where archived_at is null;
create index idx_evidence_control on public.evidence_links(control_no);
create index idx_evidence_pending on public.evidence_links(control_no)
  where verified_at is null and rejected_at is null and archived_at is null;
comment on table public.evidence_links is
  'Drive URL index. kind=legacy points to pre-existing audit drive; kind=new = FY2026 drive.';

-- =============================================================
-- audit_log — immutable event ledger
-- Self-audit: C7-75 important-system logs, C8-92 detection of removal,
--             C8-94 leakage prevention (immutability)
-- Inserts only — no UPDATE / DELETE granted to any role except service_role.
-- =============================================================
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  ts          timestamptz not null default now(),
  actor_id    uuid references public.profiles(id),
  actor_email text,
  action      text not null,        -- e.g. 'evidence.submit','verdict.change','user.invite','user.role.change','session.signin'
  target_kind text,                 -- e.g. 'control','evidence','profile'
  target_id   text,                 -- string form (control no, evidence uuid, etc.)
  before      jsonb,
  after       jsonb,
  request_ip  inet,
  user_agent  text
);
create index idx_audit_ts on public.audit_log(ts desc);
create index idx_audit_actor on public.audit_log(actor_id);
create index idx_audit_action on public.audit_log(action);
create index idx_audit_target on public.audit_log(target_kind, target_id);
comment on table public.audit_log is
  'Immutable event log. No UPDATE/DELETE policies granted — only inserts from BFF service-role.';

-- =============================================================
-- verdict_history — derived from audit_log but indexed for fast UI display
-- =============================================================
create view public.v_verdict_history as
  select id, ts, actor_id, actor_email, target_id::int as control_no,
         before->>'verdict' as old_verdict,
         after->>'verdict'  as new_verdict,
         after->>'note'     as note
  from public.audit_log
  where action = 'verdict.change';

-- =============================================================
-- snapshots — refresh-on-demand frozen dashboard state
-- =============================================================
create table public.snapshots (
  id            uuid primary key default gen_random_uuid(),
  taken_at      timestamptz not null default now(),
  taken_by      uuid not null references public.profiles(id),
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
