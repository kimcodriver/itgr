-- =============================================================
-- 0002_auth — add Supabase Auth integration
--
-- Idempotent: safe to re-run. If you have a leftover `profiles` table from
-- an earlier setup with a different schema (e.g. role check constraint with
-- different values), the migration drops + recreates it. **Existing rows are
-- deleted.** If you have real user data to keep, comment out the DROP block
-- and reconcile manually before running.
-- =============================================================

-- ---- Clean slate for profiles (safe on fresh project; destructive if existing) ----
drop trigger  if exists trg_on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.is_admin()        cascade;
drop function if exists public.is_lead()         cascade;       -- leftover from earlier setup
drop function if exists public.is_engineer()     cascade;
drop function if exists public.is_active()       cascade;
drop function if exists public.current_role()    cascade;
drop policy   if exists profiles_read         on public.profiles;
drop policy   if exists profiles_self_update  on public.profiles;
drop table    if exists public.profiles cascade;

-- ---- profiles — one row per auth.users ----
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text unique not null,
  display_name    text,
  role            text not null default 'member'
                  check (role in ('admin','member')),
  ui_prefs        jsonb not null default '{"lang":"th","theme":"dark"}'::jsonb,
  created_at      timestamptz not null default now(),
  last_sign_in_at timestamptz
);
comment on table public.profiles is
  'One row per Supabase auth user. role=admin can promote others; defensibility guard is the same for everyone.';

-- ---- Auto-create profile on signup. First user becomes admin. ----
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text;
begin
  select case when count(*) = 0 then 'admin' else 'member' end
    into v_role
    from public.profiles;

  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    v_role
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---- RLS on profiles ----
alter table public.profiles enable row level security;

create policy profiles_read on public.profiles
  for select using (auth.uid() is not null);

create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---- Helper: is current user admin? ----
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

-- ---- Backfill profiles for any auth.users already created before this migration ----
insert into public.profiles (id, email, display_name, role)
select u.id,
       u.email,
       coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1)),
       case when row_number() over (order by u.created_at) = 1 then 'admin' else 'member' end
  from auth.users u
  on conflict (id) do nothing;
