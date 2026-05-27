---
title: Deploy Guide — ITGR Audit Tracker (with auth)
audience: IT Audit Lead + IT Manager
estimated_time: ~60 นาที
last_updated: 2026-05-27
---

# Deploy Guide — ขึ้น Vercel + Supabase Auth

> Stack: **Supabase** (Postgres + Auth) + **Vercel** (Next.js hosting)
>
> Auth: email + password ผ่าน Supabase Auth — ไม่ต้องตั้ง Google OAuth · เริ่มเร็ว · เพิ่มใส่ Google ภายหลังก็ทำได้

---

## Phase 0 — Pre-requisites

- [ ] **Supabase account** (สมัครฟรี supabase.com)
- [ ] **Vercel account** (สมัครผ่าน GitHub)
- [ ] **GitHub repo** (เช่น `kimcodriver/itgr`)
- [ ] **Node.js ≥ 20** + `pnpm`

---

## Phase 1 — Supabase project (15 นาที)

### 1.1 สร้าง project

1. https://supabase.com/dashboard → **New project**
2. กรอก:
   - **Name:** `itgr-fy2026`
   - **Database password:** ยาว ≥ 24 ตัว · เก็บใน password manager
   - **Region:** `Southeast Asia (Singapore)`
   - **Plan:** Free (อัปเกรด Pro ก่อน production)
3. กด **Create new project** รอ 2 นาที

### 1.2 รัน migrations

Supabase Dashboard → **SQL Editor** → **New query** → paste `supabase/migrations/0001_init.sql` ทั้งไฟล์ → **Run**

ซ้ำกับ `supabase/migrations/0002_auth.sql` (จะสร้าง profiles + trigger + RLS)

### 1.3 ตั้ง Auth URL Configuration

**Authentication → URL Configuration:**
- **Site URL:** `http://localhost:4040` (dev — เปลี่ยนทีหลังเป็น Vercel URL)
- **Redirect URLs (allow list):** เพิ่ม:
  ```
  http://localhost:4040/api/auth/callback
  https://<your-vercel-domain>.vercel.app/api/auth/callback
  ```

### 1.4 (แนะนำ) ปิด email confirmation

สำหรับ internal tool ที่ต้องการให้ลงทะเบียนแล้วใช้ได้ทันที:

**Authentication → Providers → Email:**
- ✗ ปิด **"Confirm email"**
- กด **Save**

ถ้าเปิดไว้ — user ที่ลงทะเบียนต้องคลิกลิงก์ในอีเมลก่อนถึงจะ sign in ได้ (ระบบรองรับทั้ง 2 แบบ)

### 1.5 เก็บ 3 keys

**Project Settings → API:**

| Key | env var | ความลับ |
|---|---|---|
| `Project URL`             | `NEXT_PUBLIC_SUPABASE_URL`         | สาธารณะได้ |
| `anon public` key         | `NEXT_PUBLIC_SUPABASE_ANON_KEY`    | สาธารณะได้ |
| `service_role secret` key | `SUPABASE_SERVICE_ROLE_KEY`        | **ห้าม** ขึ้นเว็บ |

✅ **Checkpoint:** SQL Editor → `select count(*) from public.profiles;` → return `0`

---

## Phase 2 — Local dev test (15 นาที)

```sh
git clone https://github.com/kimcodriver/itgr.git
cd itgr
pnpm i

cp .env.example .env.local
# กรอก 3 keys จาก Phase 1.5

pnpm db:seed       # ควรเห็น "Seeded controls. Row count: 96"
pnpm dev           # http://localhost:4040
```

### 2.1 ทดสอบลงทะเบียน + sign in

1. เปิด http://localhost:4040 → redirect ไป `/sign-in`
2. กด **ยังไม่มี account? ลงทะเบียน** → `/sign-up`
3. กรอก email + password (≥ 8 ตัว) + ชื่อแสดง → กด **ลงทะเบียน**
4. ถ้า email confirmation **ปิด** (แนะนำใน 1.4) → redirect เข้าหน้า dashboard ทันที
5. ถ้า **เปิด** → ข้อความ "เช็คอีเมล" — เปิดอีเมล → คลิกลิงก์ → กลับมาที่ /
6. Header แสดงชื่อ + email + role badge `ADMIN` (เพราะเป็นคนแรก)

### 2.2 ทดสอบ flow ครบ

1. ไป `/controls/1` → paste link Drive ทดสอบ → กดเพิ่ม → เห็น evidence สีส้ม
2. กด ✓ ผ่าน → เป็นสีเขียว
3. ใน "ผลการตรวจ" — เลือก `comply` → กดบันทึก → ผ่าน
4. ไป `/audit-log` → เห็น 3-4 events พร้อมชื่อ + IP + UA

### 2.3 ทดสอบ defensibility guard

- ไป control อื่นที่ยังไม่มี evidence → set `comply` → ขึ้น error: *"ต้องมีหลักฐานที่ verified อย่างน้อย 1 รายการ..."*

✅ **Checkpoint:** flow ครบ + audit log มีชื่อจริง → พร้อม deploy

---

## Phase 3 — Vercel deploy (15 นาที)

### 3.1 Import project

1. https://vercel.com/new → **Import Git Repository** → เลือก `kimcodriver/itgr`
2. **Framework:** Next.js (auto-detect)
3. **Environment Variables:**

| Name | Value | Environment |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`        | `https://<ref>.supabase.co` | Production + Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | `eyJhbGci...` (anon)        | Production + Preview |
| `SUPABASE_SERVICE_ROLE_KEY`       | `eyJhbGci...` (service)     | Production + Preview |
| `APP_ENV`                         | `production`                | Production |

4. กด **Deploy** → รอ ~2 นาที

### 3.2 อัปเดต Supabase Site URL

หลัง deploy ได้ URL เช่น `https://itgr.vercel.app`:

1. **Supabase → Authentication → URL Configuration**
2. แก้ **Site URL** เป็น `https://itgr.vercel.app`
3. เพิ่ม `https://itgr.vercel.app/api/auth/callback` ใน **Redirect URLs**
4. **Save**

### 3.3 (Optional) Custom domain

Vercel project → **Settings → Domains → Add Domain** → ใส่ domain + อัปเดต DNS + แก้ Supabase URLs อีกครั้ง

✅ **Checkpoint:** เปิด `https://<your>.vercel.app/` → redirect ไป `/sign-in` → ลงทะเบียน + ใช้งานได้

---

## Phase 4 — Onboard ทีม (10 นาที)

ส่ง URL `https://<your>.vercel.app` ให้ทีม ขอให้ลงทะเบียนเอง

หลังจากทุกคน sign up → audit lead ดูรายชื่อ:
```sql
select email, display_name, role, created_at from public.profiles order by created_at;
```

ถ้าใครต้องเป็น admin เพิ่ม:
```sql
update public.profiles set role='admin' where email='user@example.com';
```

ทุกคนใช้ระบบได้เท่ากัน (submit + verify + verdict) ต่างกันแค่ admin เปลี่ยน role คนอื่นได้ + เห็นปุ่ม admin (P1)

---

## Phase 5 — Verification (10 นาที)

### 5.1 Security headers
```sh
curl -I https://<your>.vercel.app/ | grep -i 'strict-transport\|x-content\|x-frame\|referrer'
```

### 5.2 Audit log coverage
```sql
select action, count(*) from public.audit_log group by action order by 1;
```
ควรเห็น `session.signup`, `session.signin`, `evidence.submit`, `evidence.verify`, `verdict.change` ฯลฯ

### 5.3 RLS verification
```sql
-- profile of an unauthenticated query should return 0 rows
set role anon;
select count(*) from public.profiles;  -- → 0 (RLS deny)
reset role;
```

### 5.4 Backup
- Supabase Pro มี PITR 7 วัน
- หรือ `pg_dump` รายสัปดาห์ลง Google Drive

---

## Troubleshooting

### Sign-up ค้าง "เช็คอีเมล" แต่ไม่ได้รับ
- ตรวจ Supabase → Authentication → Email Templates ว่าตั้งไว้
- หรือปิด email confirmation ตาม 1.4 — แนะนำสำหรับ internal tool

### Sign-in ขึ้น "Invalid login credentials"
- ตรวจ password (case-sensitive)
- ถ้า email confirmation เปิด — user ต้อง verify ก่อน

### "ลิงก์ reset หมดอายุ"
- Supabase link หมดอายุใน 1 ชม. — ขอใหม่
- หรือตรวจ Redirect URLs ใน Supabase ว่ามี `/api/auth/callback` ทั้ง localhost + production

### Vercel build fail
- ตรวจ `pnpm-lock.yaml` ถูก commit แล้ว
- ตรวจ 3 env vars ครบทั้ง Production + Preview

### Dashboard ขึ้นว่างทั้งที่ migration ผ่าน
- ลืม `pnpm db:seed` — รัน seed script

---

## Summary checklist

- [ ] Phase 1 — Supabase project + 2 migrations + URL config + (ปิด email confirm) + 3 keys
- [ ] Phase 2 — local dev: ลงทะเบียน + sign in + flow ครบ + audit log
- [ ] Phase 3 — Vercel deploy + 3 env vars + อัปเดต Supabase Site URL
- [ ] Phase 4 — ส่ง URL · ทีมลงทะเบียน · promote admin ตามต้องการ
- [ ] Phase 5 — security headers + audit log + RLS + backup

ระยะเวลารวม ~**60 นาที**

---

## เอกสารที่เกี่ยวข้อง

- [`../README.md`](../README.md)
- [`../../spec/audit-tracking-system.md`](../../spec/audit-tracking-system.md)
- [`../../spec/self-audit.md`](../../spec/self-audit.md) — control mapping
