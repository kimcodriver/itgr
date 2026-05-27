---
title: Deploy Guide — ITGR Audit Tracker (open access)
audience: IT Audit Lead
estimated_time: ~45 นาที (เพราะไม่มี OAuth setup)
last_updated: 2026-05-27
---

# Deploy Guide — ขึ้น Vercel ได้ใน ~45 นาที

> Stack: **Supabase** (Postgres only) + **Vercel** (Next.js hosting)
>
> ไม่มี login — ใครก็ใช้ได้ ใส่ชื่อตัวเองในช่อง "Acting as" ก็พอ (cookie-based) ระบบยังจดทุก action ไว้ใน audit_log พร้อม IP + UA
>
> ก่อน start อ่าน [`../../spec/self-audit.md`](../../spec/self-audit.md) เพื่อเข้าใจ trade-off ของ open-access mode

---

## Phase 0 — Pre-requisites

- [ ] **Supabase account** (สมัครฟรีที่ supabase.com)
- [ ] **Vercel account** (สมัครที่ vercel.com — login ผ่าน GitHub)
- [ ] **GitHub repo** (เช่น `kimcodriver/itgr` ที่ push ขึ้นไปแล้ว)
- [ ] **Node.js ≥ 20** + `pnpm` (`npm i -g pnpm`) บนเครื่อง dev

---

## Phase 1 — Supabase project (10 นาที)

### 1.1 สร้าง project

1. https://supabase.com/dashboard → **New project**
2. กรอก:
   - **Name:** `itgr-fy2026`
   - **Database password:** สร้างที่ยาวมาก (≥ 24 ตัว) เก็บใน password manager
   - **Region:** `Southeast Asia (Singapore)`
   - **Plan:** Free → อัปเกรดเป็น Pro ก่อน production
3. กด **Create new project** รอ 2 นาที

### 1.2 รัน migration

Supabase Dashboard → **SQL Editor** → **New query** → paste เนื้อหา `supabase/migrations/0001_init.sql` ทั้งไฟล์ → กด **Run**

ควรเห็น:
- `CREATE TABLE` 4 ครั้ง (controls, evidence_links, audit_log, snapshots)
- `CREATE VIEW v_verdict_history`
- `CREATE FUNCTION` 3 ครั้ง (set_updated_at, compute_score, status_counts)

### 1.3 เก็บ keys

**Project Settings → API** เก็บ 2 ค่าใส่ note:

| Key | ใช้กับ | ความลับ |
|---|---|---|
| `Project URL`             | `NEXT_PUBLIC_SUPABASE_URL`   | สาธารณะได้ |
| `service_role secret` key | `SUPABASE_SERVICE_ROLE_KEY`  | **ห้าม** ขึ้นเว็บ — server-only |

✅ **Checkpoint:** ใน SQL Editor — `select count(*) from public.controls;` → return `0` (table ว่าง)

---

## Phase 2 — Local dev test (10 นาที)

```sh
git clone https://github.com/kimcodriver/itgr.git
cd itgr
pnpm i

cp .env.example .env.local
# แก้ .env.local ใส่ keys จาก Phase 1.3
#   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
#   APP_ENV=development

pnpm db:seed        # ควรเห็น "Seeded controls. Row count: 96"
pnpm dev            # http://localhost:4040
```

### ทดสอบ flow

1. เปิด http://localhost:4040 → dashboard แสดง 96 controls (verdict ทั้งหมด unset)
2. กรอกชื่อใน "Acting as" → กดบันทึก (cookie set)
3. ไป **/controls/1** → paste link Drive ทดสอบ → กดเพิ่ม
4. กด **✓ ผ่าน** ที่ evidence → กลายเป็นเขียว
5. ใน "ผลการตรวจ" — เลือก `comply` → กดบันทึก (ผ่านเพราะมี verified evidence)
6. ไป **/audit-log** → เห็น 3 events (submit, verify, verdict.change)

ทดสอบ defensibility guard:
- ไป control ที่ยังไม่มี evidence → set `comply` → ระบบขึ้น error: *"ต้องมีหลักฐานที่ verified อย่างน้อย 1 รายการ..."*

✅ **Checkpoint:** flow ครบไม่ error → พร้อม deploy

---

## Phase 3 — Vercel deploy (15 นาที)

### 3.1 Import project

1. https://vercel.com/new → **Import Git Repository** → เลือก `kimcodriver/itgr`
2. **Framework Preset:** Next.js (auto-detect)
3. **Root Directory:** `.` (default)
4. **Environment Variables:**

| Name | Value | Environment |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`        | `https://<ref>.supabase.co` | Production + Preview |
| `SUPABASE_SERVICE_ROLE_KEY`       | `eyJhbGci...` (service)     | Production + Preview |
| `APP_ENV`                         | `production`                | Production |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` ต้องไม่มีคำว่า `NEXT_PUBLIC_` นำหน้า (มิฉะนั้นจะรั่วไป browser)

5. กด **Deploy** → รอ ~2 นาที

### 3.2 Custom domain (optional)

Vercel project → **Settings → Domains → Add Domain** → ใส่ domain ของคุณ + อัปเดต DNS records

✅ **Checkpoint:** เปิด `https://<your>.vercel.app/` → เห็น dashboard ทันที (ไม่มี sign-in)

---

## Phase 4 — Onboard ทีม (5 นาที)

ไม่มีอะไรต้องทำใน DB — แค่ส่ง URL ให้ทีม

ขอให้แต่ละคน:
1. เปิด URL ครั้งแรก
2. ใส่ชื่อตัวเองในช่อง "Acting as" ที่ header → กดบันทึก
3. เริ่มกรอกหลักฐานได้ทันที

**คำแนะนำการใช้งาน:**
- **Legacy evidence** = หลักฐานจาก Drive เดิม (audit ก่อนหน้า)
- **FY2026 New** = หลักฐาน upload ใหม่ใน Drive รอบนี้
- การ paste link ต้องเป็น URL ของ `drive.google.com` / `docs.google.com` / `sheets.google.com`
- ใส่ note สั้น (≤ 500 ตัวอักษร) บอกว่าหลักฐานนี้แสดงอะไร
- audit lead กด ✓ ผ่าน หรือ ✗ ปฏิเสธ
- audit lead set verdict (comply / partial / non / na) พร้อม finding + recommendation

---

## Phase 5 — Verification (10 นาที)

### 5.1 Security headers

```sh
curl -I https://<your>.vercel.app/ | grep -i 'strict-transport\|x-content\|x-frame\|referrer'
```
ควรเห็น `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`

### 5.2 Audit log coverage

Supabase SQL editor:
```sql
select action, count(*) from public.audit_log group by action order by 1;
```
ทุก action type ควรปรากฏหลังจากทดสอบเสร็จ

### 5.3 Backup

Supabase Pro มี PITR 7 วันอัตโนมัติ ถ้าอยู่ Free tier ทำ manual backup:
```sh
pg_dump "$SUPABASE_DB_URL" --schema=public --no-owner --no-privileges > "backup-$(date +%Y%m%d).sql"
```
upload เก็บใน Google Drive

---

## Troubleshooting

### Vercel build fail "Cannot find module @supabase/supabase-js"
ตรวจ `pnpm-lock.yaml` ถูก commit ใน repo หรือไม่ (อยู่แล้วใน main)

### Dashboard ว่างทั้งที่ migration ผ่าน
ลืม `pnpm db:seed` — รัน seed script ก่อน

### Audit log ไม่บันทึก actor
ใส่ชื่อใน "Acting as" header ก่อน → กดบันทึก → cookie จะถูก set แล้ว action ถัดไปจะมีชื่อ

### Anyone can change verdict — กังวลเรื่องความปลอดภัย
- Defensibility guard ป้องกัน verdict comply/partial โดยไม่มี evidence ที่ verified
- ทุก action ลง audit_log พร้อม IP + UA + cookie name
- ถ้าต้องการ stricter access ดูใน `spec/self-audit.md` CR5 / CR6 — มีแนวทาง re-enable login

---

## Summary checklist

- [ ] Phase 1 — Supabase project + 0001_init.sql + keys
- [ ] Phase 2 — local dev test (seed + flow ครบ)
- [ ] Phase 3 — Vercel deploy + env vars (3 ตัว)
- [ ] Phase 4 — ส่ง URL ให้ทีม
- [ ] Phase 5 — verification (headers + audit log + backup)

ระยะเวลารวม **~45 นาที** (ลดจาก 90 นาทีของ version ที่มี OAuth)

---

## เอกสารที่เกี่ยวข้อง

- [`../README.md`](../README.md) — overview + page map
- [`../../spec/audit-tracking-system.md`](../../spec/audit-tracking-system.md) — PRD เต็ม
- [`../../spec/self-audit.md`](../../spec/self-audit.md) — ระบบนี้ผ่าน ITGR ของตัวเองยังไง (open-access trade-offs)
