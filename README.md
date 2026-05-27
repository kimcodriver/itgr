# ITGR Audit Tracker

> Marubeni Group ITGR FY2025 — Autocorp FY2026 audit cycle.
> Open-access tracker for the 96 controls. Anyone with the URL pastes Google Drive evidence links and sets verdicts; every mutation is logged with self-declared actor name + IP + UA.
>
> See [`../spec/audit-tracking-system.md`](../spec/audit-tracking-system.md) for the PRD and [`../spec/self-audit.md`](../spec/self-audit.md) for the system's own ITGR compliance trail.

## Architecture (BFF pattern)

```
Browser (React Server Components)
  │
  ▼  Server Actions   ← BFF
Next.js 16 (App Router) on Vercel
  │
  ▼  service-role key (server-only)
Supabase Postgres
  ├── controls         (96 rows, seeded)
  ├── evidence_links   (Drive URL index, kind=legacy|new)
  ├── audit_log        (append-only event ledger)
  └── snapshots        (refresh-on-demand frozen state)
```

The browser **never** talks to Supabase directly. The only Supabase client is server-side, using the `service_role` key. RLS is disabled because the BFF is the only client — the security boundary lives at the server-action layer (defensibility guard, attribution from cookie, audit log on every mutation).

## Open access — no login

- No sign-in flow. Anyone with the URL can view + submit + verify + set verdicts.
- Attribution comes from the **"Acting as" cookie** — a small input in the header lets users self-declare their name. Optional.
- Every mutation writes a row to `audit_log` with the cookie name + IP + User-Agent.
- Defensibility guard still applies: you cannot set a `comply` or `partial` verdict unless ≥ 1 evidence link is marked verified.
- Trade-off: actor identity is unverified. See [`../spec/self-audit.md`](../spec/self-audit.md) CR5 for the documented compensating-control note.

If you ever need to re-introduce login, the framework is already structured for it — drop in Supabase Auth + middleware and the `audit.ts` actor source switches from cookie to `auth.uid()`.

## Set-up

```sh
pnpm i        # Node ≥ 20

# 1. Provision Supabase
#    a. Create a project (Singapore region recommended)
#    b. SQL Editor → paste supabase/migrations/0001_init.sql and Run

# 2. Copy env
cp .env.example .env.local
#    fill: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

# 3. Seed 96 controls
pnpm db:seed

# 4. Run
pnpm dev      # http://localhost:4040
```

## Pages

| Path | Purpose |
|---|---|
| `/`               | Dashboard — KPI + category bars + legacy/new evidence summary |
| `/controls`       | List all 96 controls with status/risk/evidence count |
| `/controls/[no]`  | Per-control: verbatim Q+S, evidence list, submit form, verdict editor |
| `/audit-log`      | Append-only event ledger (500 latest) |

## How this webapp passes its own audit

See [`../spec/self-audit.md`](../spec/self-audit.md). Key controls:

- **C1-1 / C1-5 / C1-6** — selection memo for Supabase + Vercel.
- **C2-23** — only credential is the service-role key, kept in server env, never sent to client.
- **C5-55** — HTTPS only, security headers in `next.config.ts`.
- **C7-75 / C8-92** — every mutation calls `logEvent()`; audit_log is append-only by convention.
- **C8-86 / C8-87** — files stay in Drive; only links + metadata in Postgres.

Open access lowers the bar on C2-13 (access control), C2-19 (account sharing), C5-59 (2FA) — documented as CR5/CR6 compensating controls.

## Defensibility guard (built-in)

`setVerdict` server action throws if you try to set `comply` or `partial` on a control with zero verified evidence rows. The Thai error message is shown to the user. To override, add evidence first and verify it.

## What's intentionally NOT in v1

- Drive link verification via Drive API (kept dead simple — user pastes URL, system trusts it).
- File-content storage in Supabase Storage (Drive permissions already exist).
- Authentication (removed — open access).
- Email digests, Slack/LINE webhooks (P1 — see PRD).
- AI-assisted finding draft (P2 — FY2027).
