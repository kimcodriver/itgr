-- =============================================================
-- 0002_auth — add Supabase Auth integration
--
-- Adds profiles table linked to auth.users with auto-create trigger.
-- Every authenticated user gets a profile row on first sign-in.
-- The BFF still uses service_role for queries; we just need profile
-- metadata (display_name) to attach to audit_log + evidence rows.
-- =============================================================

-- profiles — one row per auth.users
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text unique not null,
  display_name  text,
  role          text not null default 'member'
                check (role in ('admin','member')),
  ui_prefs      jsonb not null default '{"lang":"th","theme":"dark"}'::jsonb,
  created_at    timestamptz not null default now(),
  last_sign_in_at timestamptz
);
comment on table public.profiles is
  'One row per Supabase auth user. role=admin can promote others; defensibility guard is the same for everyone.';

-- Auto-create profile on signup. First user becomes admin.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text;
begin
  -- First registered user becomes admin
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

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Enable RLS on profiles. Auth users can read all + update their own.
alter table public.profiles enable row level security;

create policy profiles_read on public.profiles
  for select using (auth.uid() is not null);

create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Helper: is current user admin?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;
