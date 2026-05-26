# Autocorp ITGR Audit Tracker

> Marubeni Group ITGR FY2025 — Autocorp FY2026 audit cycle.
> Multi-user tracker for 96 controls. Engineers paste Google Drive evidence links; Audit Lead reviews; everything is logged.
> See [`../spec/audit-tracking-system.md`](../spec/audit-tracking-system.md) for the PRD and [`../spec/self-audit.md`](../spec/self-audit.md) for the system's own ITGR compliance trail.

## Architecture (BFF pattern)

```
Browser (React Server Components)
  │
  ▼  Server Actions / Route Handlers   ← this is the BFF
Next.js 16 (App Router) on Vercel
  │
  ▼  service-role key (server-only)
Supabase
  ├── Postgres (controls, evidence_links, audit_log, snapshots, profiles)
  ├── Auth     (Google OAuth · domain allow-list is optional, see ALLOWED_EMAIL_DOMAIN)
  └── (no Storage — evidence files live in Google Drive)
```

The browser **never** talks to Supabase with the service-role key. All mutations flow through Server Actions, which write to `audit_log` before / after the change.

## Tables (see `supabase/migrations/`)

| Table | Purpose | Self-audit control |
|---|---|---|
| `profiles`        | role + active flag per user                          | C2-13 / C2-20 |
| `controls`        | 96 ITGR controls + current verdict                   | C7-75 |
| `evidence_links`  | Drive URL index (kind=`legacy` \| `new`)             | C8-86 / C8-87 |
| `audit_log`       | immutable event ledger                               | C7-75 / C8-92 |
| `snapshots`       | refresh-on-demand frozen dashboard state             | — |
| `v_verdict_history` | derived view from audit_log                        | C7-75 |

RLS: deny-by-default. App roles get SELECT + scoped INSERT/UPDATE; **no DELETE policy** anywhere — only service-role bypasses, and only for archive flags. `audit_log` has zero UPDATE/DELETE policies (control C8-92).

## Set-up

```sh
# 0. Install deps (Node ≥ 20)
pnpm i        # or npm i

# 1. Provision Supabase
#    a. Create a project (Singapore region)
#    b. Enable Google OAuth provider in Supabase Auth → Providers → Google.
#       (To restrict to a hosted domain, set ALLOWED_EMAIL_DOMAIN env later. Optional.)
#    c. Run the migrations in order:
psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_init.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/0002_rls.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/0003_helpers.sql

# 2. Copy env
cp .env.example .env.local
#  fill: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# 3. Seed 96 controls from the existing audit_data.json
pnpm db:seed

# 4. Run
pnpm dev          # http://localhost:4040
```

First user to sign in becomes `observer` by default. Promote yourself to `audit_lead` directly in the DB:
```sql
update public.profiles set role='audit_lead' where email='ckawin@autocorp.co.th';
```

After that, all role changes go through the UI (and are logged).

## Pages

| Path | Role | Purpose |
|---|---|---|
| `/`               | all                    | Dashboard — KPI + category bars + legacy/new evidence summary |
| `/controls`       | all                    | List all 96 controls with status/risk/evidence count |
| `/controls/[no]`  | engineer or lead       | Per-control: verbatim Q+S, evidence list, submit form, verdict editor (lead only) |
| `/audit-log`      | all                    | Immutable event ledger (500 latest) |
| `/sign-in`        | public                 | Google OAuth (domain-restricted) |

## How this webapp passes its own audit

See [`../spec/self-audit.md`](../spec/self-audit.md). Quick map:

- **C1-1 / C1-5 / C1-6** — selection memo + this README track Supabase + Vercel.
- **C2-13 / C2-15 / C2-20** — Google domain-restricted OAuth, role table, nightly deactivate.
- **C2-19** — no shared accounts (Google domain blocks anonymous sign-up).
- **C2-23** — only credential is the service-role key, kept in encrypted env, never sent to client.
- **C5-55 / C5-59** — HTTPS-only, security headers in `next.config.ts`, MFA via Google Workspace.
- **C7-75 / C8-92** — every mutation calls `logEvent()`; `audit_log` has no UPDATE/DELETE policy.
- **C8-86 / C8-87** — files stay in Drive; only links + metadata in Postgres.
- **C8-89** — RLS default deny.

## Defensibility guard (built-in)

`setVerdict` server action throws if you try to set `comply` or `partial` on a control with zero verified evidence rows. The error message is in Thai. To override, the Audit Lead has to first add evidence (which is the point).

## Compensating controls

Three documented exceptions (see self-audit `CR1–CR3`). The most important: **#80 (24/7 incident monitoring)** — accepted risk for a one-off FY2026 system. Vercel + Supabase have their own 24/7 SOC.

## What's intentionally NOT in v1

- Drive link verification via Drive API (kept dead simple — user pastes URL, system trusts it for FY2026; the link rot check is a manual job).
- File-content storage in Supabase Storage (Drive permissions already exist).
- Email digests, Slack/LINE webhooks (P1 — see PRD).
- AI-assisted finding draft (P2 — FY2027).

## Build status

This is a code scaffold. To take it to production:

1. `pnpm i` to install
2. Apply migrations to a real Supabase project
3. Configure Google OAuth client with hosted-domain restriction
4. Deploy to Vercel; set env vars from `.env.example`
5. Run `pnpm db:seed` once (uses `audit_data.json` already present in the repo)
6. Promote yourself to `audit_lead` (SQL one-liner above)
7. Invite IT engineers — they sign in once, lead promotes them to `it_engineer`

## Files map

```
webapp/
├── package.json
├── next.config.ts            ← security headers (control C5-55)
├── postcss.config.mjs        ← Tailwind v4
├── tsconfig.json
├── .env.example              ← all keys + domain allow-list
├── README.md                 ← this file
├── scripts/
│   └── seed-controls.ts      ← idempotent seed from ../audit-report/audit_data.json
├── supabase/
│   └── migrations/
│       ├── 0001_init.sql     ← schema (5 tables + 1 view)
│       ├── 0002_rls.sql      ← RLS default-deny + helpers (is_lead/is_engineer/is_active)
│       └── 0003_helpers.sql  ← compute_score, status_counts, handle_new_user trigger
└── src/
    ├── middleware.ts         ← session refresh
    ├── lib/
    │   ├── auth.ts           ← getUser / requireUser / requireRole
    │   ├── audit.ts          ← logEvent() — used by every mutation
    │   └── supabase/
    │       └── server.ts     ← rsc() (user) + admin() (service-role)
    └── app/
        ├── layout.tsx        ← root layout with header + sign-out
        ├── page.tsx          ← Dashboard (Server Component)
        ├── globals.css       ← Tailwind v4 + theme tokens (dark default + light variant)
        ├── sign-in/
        │   ├── page.tsx
        │   └── actions.ts    ← signInWithGoogle (hosted-domain locked)
        ├── controls/
        │   ├── page.tsx      ← list + status filter
        │   └── [no]/
        │       ├── page.tsx  ← per-control: verbatim + evidence + verdict editor
        │       └── actions.ts ← submitEvidence / archiveEvidence / verifyEvidence
        │                       /rejectEvidence / setVerdict (all logged)
        ├── audit-log/
        │   └── page.tsx      ← immutable ledger view
        └── api/auth/
            ├── callback/route.ts  ← OAuth code exchange + domain check + log
            └── signout/route.ts   ← POST signout + log
```
