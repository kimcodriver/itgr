-- =============================================================
-- RPC helpers + score function
-- =============================================================

-- Compute weighted compliance score: comply=1, partial=0.5, non=0, na excluded
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

-- Auto-create a profile row on first sign-in.
-- New users always land at role=observer (read-only). audit_lead must promote
-- them to it_engineer (or audit_lead) via SQL or admin UI.
--
-- Optional domain allow-list: set the Postgres parameter to enable.
--   alter database postgres set app.allowed_domain = 'autocorp.co.th';
-- Leave it unset to accept any email/Google account (default for open invite).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_domain  text := lower(split_part(new.email, '@', 2));
  v_allowed text := nullif(trim(coalesce(current_setting('app.allowed_domain', true), '')), '');
begin
  if v_allowed is not null and v_domain <> v_allowed then
    raise exception 'email domain % not allowed', v_domain;
  end if;
  insert into public.profiles (id, email, display_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', new.email), 'observer')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
