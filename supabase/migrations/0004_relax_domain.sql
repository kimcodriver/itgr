-- =============================================================
-- 0004_relax_domain — make email domain check optional.
--
-- For databases that already ran 0003_helpers.sql with the hardcoded
-- fallback to 'autocorp.co.th'. Re-installs handle_new_user() so the
-- trigger only enforces when app.allowed_domain is explicitly set.
--
-- Safe to run multiple times.
-- =============================================================

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

-- If you previously set the parameter, you can unset it to disable enforcement:
--   alter database postgres reset app.allowed_domain;
