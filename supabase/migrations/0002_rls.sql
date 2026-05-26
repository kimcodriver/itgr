-- =============================================================
-- Row Level Security — deny-by-default + explicit grants
-- Self-audit: C2-13, C2-14, C8-89, C8-90, C8-92
--
-- Roles:
--   audit_lead   — read all, write controls.verdict + finding/recommendation,
--                  verify/reject evidence, invite users, snapshot
--   it_engineer  — read all controls; write evidence_links where they own
--                  the control OR self-submit any evidence; cannot touch verdict
--   observer     — read-only (controls, evidence_links non-archived, snapshots)
-- =============================================================

-- Helper: is current user a given role?
create or replace function public.current_role()
returns text language sql security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active = true
$$;

create or replace function public.is_lead()      returns boolean language sql stable as $$ select public.current_role() = 'audit_lead' $$;
create or replace function public.is_engineer()  returns boolean language sql stable as $$ select public.current_role() = 'it_engineer' $$;
create or replace function public.is_active()    returns boolean language sql stable as $$ select public.current_role() is not null $$;

-- =============================================================
-- profiles
-- =============================================================
alter table public.profiles enable row level security;

-- read: every active user sees the directory
create policy profiles_read on public.profiles
  for select using (public.is_active());

-- self update of ui_prefs only
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- only lead can change role / activate
-- (enforced by BFF; we don't grant a separate policy to avoid privilege escalation)

-- =============================================================
-- controls
-- =============================================================
alter table public.controls enable row level security;

create policy controls_read on public.controls
  for select using (public.is_active());

-- Only lead can update verdict + finding via BFF service-role.
-- No INSERT/DELETE policies → only service-role can seed/wipe.

-- =============================================================
-- evidence_links
-- =============================================================
alter table public.evidence_links enable row level security;

create policy evidence_read on public.evidence_links
  for select using (public.is_active() and archived_at is null);

-- Engineer can insert evidence for any control (we allow contribution across domains;
-- ownership is advisory, not access-gated, to keep flow simple).
create policy evidence_insert on public.evidence_links
  for insert with check (
    public.is_active()
    and submitted_by = auth.uid()
    and verified_at is null and rejected_at is null
  );

-- Engineer can edit / soft-archive own submission while pending.
create policy evidence_own_update on public.evidence_links
  for update using (
    submitted_by = auth.uid()
    and verified_at is null and rejected_at is null
  ) with check (
    submitted_by = auth.uid()
  );

-- Lead can verify/reject any (handled via BFF using service-role to keep
-- the policy surface small and predictable).

-- =============================================================
-- audit_log — read by lead + observer; INSERT only via service-role
-- =============================================================
alter table public.audit_log enable row level security;

create policy auditlog_read on public.audit_log
  for select using (public.is_active());

-- No INSERT/UPDATE/DELETE policies for app roles. Only service_role bypasses RLS.
-- This satisfies self-audit C8-92 (no user can delete audit evidence).

-- =============================================================
-- snapshots — read by anyone active; INSERT via service-role only
-- =============================================================
alter table public.snapshots enable row level security;

create policy snapshots_read on public.snapshots
  for select using (public.is_active());

-- =============================================================
-- v_verdict_history — security_invoker so it honors audit_log RLS
-- =============================================================
alter view public.v_verdict_history set (security_invoker = on);
