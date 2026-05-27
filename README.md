# ITGR Audit Tracker

> Marubeni Group ITGR FY2025 — Autocorp FY2026 audit cycle.
> Multi-user tracker for the 96 controls. Register + login via Supabase Auth (email + password). Engineers paste Google Drive evidence links; admin reviews; every mutation is logged with the authenticated user's identity + IP + UA.

## Architecture (BFF pattern)

```
Browser
  │
  ▼  Server Actions   ← BFF (Next.js App Router)
Next.js 16 on Vercel
  │
  ├──► Supabase Auth (cookie-bound rsc client)
  └──► Supabase Postgres (admin client / service-role)

Tables: profiles · controls · evidence_links · audit_log · snapshots
```

The browser **never** holds the service-role key. The cookie-bound `rsc()` client handles auth (uses anon key + JWT in cookie). All DB writes happen server-side via the `admin()` client. Every mutation writes to `audit_log` with the authenticated user's id + email + IP + UA.

## Roles

- **admin** — first registered user becomes admin automatically. Admins can promote other users via SQL (UI in a future P1).
- **member** — every subsequent registered user. Can do everything except change roles.

Both roles can submit/verify evidence and set verdicts. Defensibility guard applies to all: cannot set `comply` or `partial` without ≥ 1 verified evidence.

## Set-up

```sh
pnpm i        # Node ≥ 20

# 1. Supabase project
#    a. Create at supabase.com (Singapore region recommended)
#    b. SQL Editor → run supabase/migrations/0001_init.sql
#    c. SQL Editor → run supabase/migrations/0002_auth.sql
#    d. Authentication → URL Configuration:
#       Site URL = http://localhost:4040 (dev) / https://<your>.vercel.app (prod)
#       Redirect URLs = same + /api/auth/callback
#    e. (Recommended) Authentication → Providers → Email → disable "Confirm email"
#       for an internal tool where instant sign-in is preferred

# 2. Copy env
cp .env.example .env.local
# fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# 3. Seed 96 controls
pnpm db:seed

# 4. Run
pnpm dev      # http://localhost:4040
```

## Pages

| Path | Public? | Purpose |
|---|---|---|
| `/sign-up`              | public  | Register (email + password ≥ 8). First user becomes admin. |
| `/sign-in`              | public  | Login |
| `/forgot-password`      | public  | Request password reset email |
| `/reset-password`       | session | Set new password (after clicking reset link) |
| `/`                     | auth    | Dashboard — KPI + category bars + legacy/new evidence summary |
| `/controls`             | auth    | List all 96 controls |
| `/controls/[no]`        | auth    | Per-control detail: verbatim Q+S, evidence list, submit form, verdict editor |
| `/audit-log`            | auth    | Append-only event ledger |
| `/api/auth/callback`    | public  | OAuth/email-link callback |
| `/api/auth/signout`     | session | POST → sign out |

Middleware redirects unauthenticated users to `/sign-in?next=<original-path>`.

## Defensibility guard

`setVerdict` server action throws if you try to set `comply` or `partial` on a control with zero verified evidence. The Thai error message surfaces to the user.

## Promoting a user to admin

```sql
-- Run in Supabase SQL Editor
update public.profiles set role = 'admin' where email = 'user@example.com';
```

The first user to register automatically becomes admin (handled by `handle_new_user` trigger).

## Self-audit

See [`../spec/self-audit.md`](../spec/self-audit.md). With auth re-enabled:

- **C2-13 / C2-15** — 🟢 Supabase Auth + middleware enforces sign-in everywhere.
- **C2-19** — 🟢 every action attributed to an individual `auth.users.id`.
- **C2-22** — 🟡 Supabase default min length is 6; we enforce 8 via zod (still under ITGR's 12). Stretch target: bump to 12 + 2FA.
- **C5-59** — 🟡 password-only auth. Roadmap: add Supabase 2FA in a P1 cycle.
- **C7-75 / C8-92** — 🟢 every mutation calls `logEvent()` with the authenticated user.
- **C8-86 / C8-87** — 🟢 files stay in Drive; only links + metadata in Postgres.

## What's intentionally NOT in v1

- Drive link verification via Drive API (kept simple — user pastes URL, system trusts it).
- Role-management UI (use SQL for now).
- 2FA / TOTP (P1 — Supabase Auth supports it).
- AI-assisted finding draft (P2 — FY2027).
