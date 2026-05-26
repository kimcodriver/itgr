---
title: Deploy Guide — Autocorp ITGR Audit Tracker
audience: IT Audit Lead + IT Manager
estimated_time: 90 นาที (จากศูนย์ถึง first sign-in)
last_updated: 2026-05-26
---

# Deploy Guide — ทำให้ระบบขึ้นจริงได้

> เป้าหมาย: จาก zero ถึงทีม IT เข้าใช้งานได้จริงภายใน ~90 นาที (ถ้า account ทั้งหมดพร้อม)
>
> Stack สุดท้าย: **Supabase** (Postgres + Auth) + **Vercel** (Next.js hosting) + **Google OAuth** (รับทุก Google account โดย default — จะ lock เป็นโดเมนเดียวก็ได้ผ่าน env)
>
> ก่อน start อ่าน [`../spec/self-audit.md`](../../spec/self-audit.md) เพื่อรู้ว่า control ไหนของ ITGR ระบบนี้ต้องผ่าน — และเอกสาร selection memo (control C1-5) ต้องเสร็จก่อน production deploy

---

## Phase 0 — Pre-requisites

ก่อนเริ่ม ตรวจให้ครบ:

- [ ] **Google Workspace admin** ของโดเมน `autocorp.co.th` (ต้องเข้า Google Cloud Console + Workspace Admin Console)
- [ ] **Supabase account** (สมัครฟรีที่ supabase.com — ใช้ `ckawin@autocorp.co.th` สมัคร)
- [ ] **Vercel account** (สมัครที่ vercel.com — login ผ่าน GitHub)
- [ ] **GitHub repo** สำหรับ push โค้ด (private repo)
- [ ] **Node.js ≥ 20** + `pnpm` (`npm i -g pnpm`) บนเครื่อง dev
- [ ] **psql** (สำหรับ run migrations) — มากับ Postgres หรือ `brew install postgresql`
- [ ] **Selection memo** (control C1-5/C1-6) — ให้ MD เซ็นก่อน production deploy ถ้ายังเป็น pilot โดเมน internal ก็ทำงานต่อได้
- [ ] **IP allow-list ของ Marubeni network** (ถ้ามี) — เพื่อรู้ว่าจะ deploy เปิดสาธารณะหรือ require VPN

---

## Phase 1 — Push code ขึ้น GitHub (10 นาที)

```bash
cd "/Users/ckawin/Documents/Claude/Projects/Autocorp IT Gov/webapp"

git init
git add .
git commit -m "feat: initial Autocorp ITGR audit tracker scaffold"

# สร้าง private repo ผ่าน GitHub UI ก่อน เช่น autocorp-itgr-tracker
git remote add origin git@github.com:<your-org>/autocorp-itgr-tracker.git
git branch -M main
git push -u origin main
```

✅ **Checkpoint:** เปิด GitHub แล้วเห็นไฟล์ 27 ไฟล์ใน repo

---

## Phase 2 — Supabase project setup (15 นาที)

### 2.1 สร้าง project

1. ไปที่ https://supabase.com/dashboard → **New project**
2. กรอก:
   - **Name:** `autocorp-itgr-fy2026`
   - **Database password:** สร้างที่ยาวมาก (≥ 24 ตัว) เก็บใน password manager (control C2-23)
   - **Region:** `Southeast Asia (Singapore)` ← สำคัญ! ใกล้ TH ที่สุด ลด latency + data residency
   - **Pricing plan:** Free → จะอัปเกรดเป็น Pro หลัง pilot (Pro = PITR 7 วัน + log retention)
3. กด **Create new project** รอประมาณ 2 นาที

### 2.2 รัน migrations

ขณะรอ project สร้าง เปิด **Project Settings → Database → Connection string**

```bash
# 1. คัดลอก "Direct connection" URI (เริ่มต้นด้วย postgresql://postgres.[ref]:...@aws-...)
export SUPABASE_DB_URL="postgresql://postgres.xxxxxxxx:<password>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

# 2. รัน migrations ทีละไฟล์ (ตามลำดับ)
cd "/Users/ckawin/Documents/Claude/Projects/Autocorp IT Gov/webapp"
psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_init.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/0002_rls.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/0003_helpers.sql
```

ถ้าเห็น `CREATE TABLE`, `CREATE POLICY`, `CREATE FUNCTION` ทุกบรรทัด = สำเร็จ

ถ้า error `permission denied for schema auth` ใน `0003_helpers.sql` — เป็นเพราะ trigger ต้องสร้างใน schema auth ของ Supabase ซึ่งบางครั้ง pooler ทำไม่ได้ ใช้วิธี **SQL Editor ใน Supabase Dashboard** แทน:

1. Supabase Dashboard → **SQL Editor** → **New query**
2. paste เนื้อหา `0003_helpers.sql` ทั้งไฟล์
3. กด **Run**

### 2.3 (Optional) จำกัดโดเมน

ระบบนี้ **default รับทุก Google account** ผู้ใช้ใหม่จะถูกสร้างเป็น `observer` (อ่านอย่างเดียว) โดยอัตโนมัติ audit_lead เลือก promote คนที่ใช่เป็น `it_engineer` หรือ `audit_lead` เอง

ถ้าอยาก **lock เฉพาะโดเมนเดียว** (เช่น hardening เพิ่ม) ทำ 2 อย่าง:

```sql
-- ใน Supabase SQL Editor
alter database postgres set app.allowed_domain = 'autocorp.co.th';
```

แล้วใน Phase 5 ตอนตั้ง Vercel env ใส่ `ALLOWED_EMAIL_DOMAIN=autocorp.co.th` ด้วย (ใช้ทั้ง DB trigger + app check 2 ชั้น)

ปลดล็อกภายหลังด้วย `alter database postgres reset app.allowed_domain;`

### 2.4 เก็บ keys

ไปที่ **Project Settings → API** เก็บ 3 ค่าใส่ note (ใช้ใน Phase 4 + 5):

| Key | ใช้กับ | ความลับ |
|---|---|---|
| `Project URL`             | `NEXT_PUBLIC_SUPABASE_URL`         | สาธารณะได้ |
| `anon public` key         | `NEXT_PUBLIC_SUPABASE_ANON_KEY`    | สาธารณะได้ |
| `service_role secret` key | `SUPABASE_SERVICE_ROLE_KEY`        | **ห้ามขึ้นเว็บ** — server-only |

✅ **Checkpoint:**
- SQL Editor → `select count(*) from public.controls;` → return `0` (table มีแต่ยังว่าง)
- `select * from pg_policies where schemaname='public';` → return ≥ 6 rows

---

## Phase 3 — Google OAuth setup (20 นาที)

### 3.1 Google Cloud Console — สร้าง OAuth Client

1. ไป https://console.cloud.google.com → เลือก project ของ Autocorp (หรือสร้างใหม่ `autocorp-itgr-fy2026`)
2. ซ้ายมือ **APIs & Services → OAuth consent screen**
3. กรอก:
   - **User type:** เลือกตาม policy ที่ต้องการ
     - `Internal` = ต้องมี Google Workspace; เข้าเฉพาะคนในองค์กรเท่านั้น
     - `External` = รับ Google account ทุกประเภท (default ของระบบนี้) ผู้ใช้ใหม่เป็น observer
   - **App name:** `ITGR Audit Tracker`
   - **User support email:** อีเมลของ audit lead
   - **App logo:** อัปโหลด logo (optional)
   - **Authorized domains:** ใส่โดเมนของ webapp (เช่น `vercel.app` หรือ `autocorp.co.th` ถ้าใช้ custom)
   - **Developer contact:** อีเมลของผู้ดูแลระบบ
4. **Scopes:** เพิ่ม `email`, `profile`, `openid` ← แค่นี้พอ
5. กด **Save and continue**

### 3.2 สร้าง OAuth Client ID

1. ซ้ายมือ **APIs & Services → Credentials → + Create Credentials → OAuth client ID**
2. กรอก:
   - **Application type:** `Web application`
   - **Name:** `ITGR Tracker - Web`
   - **Authorized JavaScript origins:**
     - `http://localhost:4040` (สำหรับ dev)
     - `https://<your-vercel-domain>.vercel.app` (เติมหลัง Phase 5)
     - `https://itgr.autocorp.co.th` (custom domain ถ้ามี)
   - **Authorized redirect URIs:**
     - `https://<supabase-project-ref>.supabase.co/auth/v1/callback` ← มาจาก Supabase!
3. กด **Create** → เก็บ **Client ID** + **Client secret**

> 💡 ถ้ายังไม่ deploy ขึ้น Vercel ใส่แค่ `localhost:4040` กับ Supabase callback ไปก่อน เพิ่มทีหลังได้

### 3.3 เชื่อม Google → Supabase

1. Supabase Dashboard → **Authentication → Providers → Google**
2. **Enable Sign in with Google:** เปิด
3. กรอก:
   - **Client ID (for OAuth):** จาก step 3.2
   - **Client Secret (for OAuth):** จาก step 3.2
   - **Skip nonce check:** ปล่อยเป็น OFF
4. กด **Save**

### 3.4 Site URL + Redirect URLs ของ Supabase

1. Supabase → **Authentication → URL Configuration**
2. **Site URL:** `http://localhost:4040` (จะแก้เป็น production URL หลัง Phase 5)
3. **Redirect URLs (allow list):** เพิ่ม:
   ```
   http://localhost:4040/api/auth/callback
   https://<vercel-domain>.vercel.app/api/auth/callback
   https://itgr.autocorp.co.th/api/auth/callback
   ```
4. กด **Save**

✅ **Checkpoint:**
- Google Cloud Console → Credentials → เห็น OAuth client `ITGR Tracker - Web`
- Supabase → Authentication → Providers → Google → ✓ Enabled

---

## Phase 4 — Local dev test (15 นาที)

ก่อน deploy production ทดสอบในเครื่องก่อน

```bash
cd "/Users/ckawin/Documents/Claude/Projects/Autocorp IT Gov/webapp"

# 1. ติดตั้ง deps
pnpm i

# 2. สร้าง .env.local จาก template
cp .env.example .env.local

# 3. แก้ .env.local ใส่ keys จาก Phase 2.4
#    NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
#    NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
#    SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
#    APP_ENV=development
#    # ALLOWED_EMAIL_DOMAIN=autocorp.co.th   ← optional: uncomment เพื่อ lock โดเมน

# 4. Seed 96 controls
pnpm db:seed
# ✓ ควรเห็น "Seeded controls. Row count: 96"

# 5. Run dev server
pnpm dev
# ✓ http://localhost:4040
```

### 4.1 First sign-in flow

1. เปิด http://localhost:4040 → จะ redirect ไป `/sign-in`
2. กด **เข้าสู่ระบบด้วย Google**
3. Google popup → เลือก account ใดก็ได้
4. กลับมาที่ `/` (dashboard ที่ยังว่าง — role `observer` โดย default)
5. ถ้าตั้ง `ALLOWED_EMAIL_DOMAIN` ไว้ + login ด้วย email โดเมนอื่น → ถูกปฏิเสธที่ callback (`domain-not-allowed`)

### 4.2 Promote ตัวเองเป็น audit_lead

Supabase Dashboard → **SQL Editor**:
```sql
update public.profiles
set role = 'audit_lead'
where email = 'ckawin@autocorp.co.th';
```

Refresh `/` → header ขวาบนจะเห็น role pill เปลี่ยนเป็น `audit lead`

### 4.3 ทดสอบ flow ครบลูป

1. ไป **/controls/1** (control แรก — IT security rules)
2. ในส่วน "เพิ่ม link หลักฐาน" — paste link Google Drive ทดสอบ เช่น `https://drive.google.com/file/d/test123/view` พร้อม note สั้น ๆ
3. กด **เพิ่ม** → เห็น row ใหม่ (สีส้ม = pending)
4. กด **✓ ผ่าน** ที่ row → เปลี่ยนเป็นสีเขียว
5. ใน "ผลการตรวจ" — เลือก `comply` → กด **บันทึก** → ระบบให้ผ่าน (เพราะมี evidence verified แล้ว ≥ 1)
6. ไป **/audit-log** → เห็น 3 events: `evidence.submit` + `evidence.verify` + `verdict.change`
7. กลับ **/** → score เปลี่ยนเป็น `1.0%` (1 ผ่านใน 96 controls)

ลองทดสอบ defensibility guard:
- ไป control อื่นที่ยังไม่มี evidence → เลือก `comply` → ระบบควรขึ้น error: *"ต้องมีหลักฐานที่ verified อย่างน้อย 1 รายการ..."*

✅ **Checkpoint:** ทำ flow ครบโดยไม่ error → local พร้อม deploy

---

## Phase 5 — Vercel deployment (15 นาที)

### 5.1 Import project

1. ไป https://vercel.com/new
2. **Import Git Repository** → เลือก `autocorp-itgr-tracker`
3. **Framework Preset:** Next.js (auto-detect)
4. **Root Directory:** เลือกเป็น `webapp` ถ้า repo ของคุณมี webapp/ เป็น subfolder
   - ถ้า push เฉพาะ `webapp/` ขึ้น repo → root ก็ `.` ปกติ
5. **Build & Output Settings:** ใช้ default
6. **Environment Variables:** เพิ่ม:

| Name | Value | Environment |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`        | `https://<ref>.supabase.co` | Production + Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | `eyJhbGci...` (anon)        | Production + Preview |
| `SUPABASE_SERVICE_ROLE_KEY`       | `eyJhbGci...` (service)     | Production + Preview |
| `APP_ENV`                         | `production`                | Production |
| `NEXT_PUBLIC_APP_URL`             | `https://<your>.vercel.app` | Production |
| `ALLOWED_EMAIL_DOMAIN`            | `autocorp.co.th` *(optional)* | Production + Preview |

> ⚠️ **service_role key เป็น secret** — Vercel เก็บแบบ encrypted แต่ห้ามใส่ตรง `NEXT_PUBLIC_` ผิดข้าง

7. กด **Deploy** → รอ ~2 นาที

### 5.2 อัปเดต OAuth allowed origins

1. หลัง deploy สำเร็จ Vercel จะให้ URL เช่น `https://autocorp-itgr-tracker-xyz.vercel.app`
2. กลับไป **Google Cloud Console → Credentials → ITGR Tracker - Web → Edit**
3. เพิ่มลงใน **Authorized JavaScript origins:** `https://autocorp-itgr-tracker-xyz.vercel.app`
4. กด **Save**
5. กลับไป **Supabase → Authentication → URL Configuration**
6. แก้ **Site URL** เป็น `https://autocorp-itgr-tracker-xyz.vercel.app`
7. เพิ่มใน **Redirect URLs:** `https://autocorp-itgr-tracker-xyz.vercel.app/api/auth/callback`
8. กด **Save**

### 5.3 Custom domain (optional แต่แนะนำ)

ถ้าอยากใช้ `https://itgr.autocorp.co.th`:

1. Vercel project → **Settings → Domains → Add Domain** → `itgr.autocorp.co.th`
2. Vercel จะให้ DNS records — ส่งให้ IT infra เพิ่มที่ DNS ของ `autocorp.co.th`:
   - **CNAME** `itgr` → `cname.vercel-dns.com`
3. รอ DNS propagate (~10 นาที) → Vercel จะออก SSL cert ให้อัตโนมัติ
4. กลับไปอัปเดต Google OAuth + Supabase URLs ให้ใช้ `itgr.autocorp.co.th` แทน

✅ **Checkpoint:**
- เปิด `https://<your>.vercel.app` → redirect ไป /sign-in
- Sign in → กลับมาที่ dashboard
- Dashboard แสดง 96 controls (เพราะ seed แล้วใน Phase 4)

> ถ้า dashboard ว่างเปล่า แสดงว่ายังไม่ได้ seed ใน production DB (ปกติเรา seed ครั้งเดียวเฉพาะใน Phase 4 ก็พอเพราะ DB ตัวเดียวกัน) ตรวจ env ว่าชี้ไป Supabase project เดียวกันหรือไม่

---

## Phase 6 — Onboard ทีม IT (15 นาที)

### 6.1 Promote audit_lead

ทำครั้งเดียวใน SQL Editor ของ Supabase:
```sql
update public.profiles set role='audit_lead' where email='ckawin@autocorp.co.th';
```

### 6.2 เชิญทีม

ส่ง URL `https://itgr.autocorp.co.th` ให้ทีม IT 5 คน → ขอให้ sign in ครั้งแรกเพื่อสร้าง profile

หลังจากแต่ละคน sign in → audit_lead รันใน SQL Editor:
```sql
-- ดูใครเข้ามาแล้วบ้าง
select email, role, last_sign_in_at from public.profiles order by created_at desc;

-- ตั้งคนที่ใช่ให้เป็น it_engineer
update public.profiles set role='it_engineer'
where email in (
  'engineer1@autocorp.co.th',
  'engineer2@autocorp.co.th',
  'engineer3@autocorp.co.th',
  'engineer4@autocorp.co.th',
  'engineer5@autocorp.co.th'
);

-- คนที่อยากให้ดูอย่างเดียว (MD, HQ liaison) ปล่อยเป็น observer ตามค่า default
```

### 6.3 Assign controls (ไม่บังคับ — UI v1 ยังไม่มี bulk-assign แต่ใช้ SQL ได้)

ตัวอย่าง: ให้ network engineer ดูแล Cat 5
```sql
update public.controls
set owner_id = (select id from public.profiles where email='network-eng@autocorp.co.th')
where category_short = 'Cat 5 — Network';
```

### 6.4 Train ทีม (30 นาที session)

หัวข้อที่ต้องสอน:
1. **เข้าระบบยังไง** — Google account ของบริษัทเท่านั้น
2. **กรอก evidence ยังไง** — paste Drive link + เลือก legacy/new + เขียน note สั้น
3. **legacy vs new** — legacy = ของเดิมก่อน FY2026 / new = upload ใหม่เข้า FY2026 Drive
4. **ทำไมต้องผ่าน Audit Lead** — เพื่อ defensibility (control C8-92)
5. **Drive permission** — ต้องแชร์ไฟล์ให้ audit-team@ Group เห็นได้ก่อน paste link

✅ **Checkpoint:**
- ทีม IT 5 คน sign in สำเร็จ + role ถูกต้อง
- มี evidence ทดสอบอย่างน้อย 1 รายการต่อคน

---

## Phase 7 — Verification (15 นาที)

### 7.1 ทดสอบความปลอดภัย

```sh
# 1. (เฉพาะถ้าตั้ง ALLOWED_EMAIL_DOMAIN) ทดสอบโดเมนอื่น sign in ไม่ได้
# → เปิด incognito → sign in ด้วย gmail.com → ควรเห็น error "domain-not-allowed"
# → ถ้าไม่ได้ตั้ง env นี้ → user ใหม่จะกลายเป็น observer (อ่านอย่างเดียว) ปกติ

# 2. ทดสอบ engineer แก้ verdict ไม่ได้
# → sign in ด้วย account it_engineer → ไป /controls/1
# → ไม่ควรเห็นปุ่ม "บันทึก" ใน verdict editor (เห็นเฉพาะ read-only view)

# 3. ทดสอบ audit_log แก้ไม่ได้
# → SQL editor ของ Supabase (เป็น service_role)
update public.audit_log set action='hacked' where id=(select id from public.audit_log limit 1);
# → ควรพังด้วย: no policy / no UPDATE allowed
# (service_role bypasses RLS แต่ table ไม่ได้ deny update — แก้ได้ถ้า service_role
# ใช้ตรง ๆ; ป้องกัน application-level โดยไม่เคยเรียกใน BFF — ดู spec/self-audit.md)
```

### 7.2 Security headers

ทดสอบจาก curl:
```sh
curl -I https://<your>.vercel.app/ | grep -i 'strict-transport\|x-content\|x-frame\|referrer'
# ควรเห็น Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options, Referrer-Policy
```

### 7.3 Audit log coverage

ใน Supabase SQL editor:
```sql
-- ทุก action ที่ทำใน UI ควรปรากฏ
select action, count(*) from public.audit_log group by action order by 1;

-- evidence ทุก row ต้องมี audit_log ตามมา
select e.id, e.control_no, l.id is null as missing_log
from public.evidence_links e
left join public.audit_log l on l.target_id = e.id::text and l.action like 'evidence.%'
where l.id is null;
-- ควร return 0 rows
```

### 7.4 Backup verification

Supabase Pro tier มี PITR 7 วันอัตโนมัติ แต่ทำ manual backup เป็น runbook (control C7-77):

```sh
# จากเครื่อง dev
pg_dump "$SUPABASE_DB_URL" --schema=public --no-owner --no-privileges \
  > "backup-$(date +%Y%m%d).sql"
# upload ไปไว้ที่ Google Drive folder backup ภายใต้ FY2026 audit drive
```

ทำสัปดาห์ละครั้งระหว่างก่อน Marubeni audit window

✅ **Checkpoint:**
- ผ่าน security tests ทุกข้อ
- audit_log มี row จากทุก action type
- มี backup file ใน Drive

---

## Phase 8 — เตรียมส่ง Marubeni HQ (ตอนใกล้ ก.ค. 2026)

### 8.1 อัปเกรด Supabase เป็น Pro

ก่อนเข้า audit window จริง:

- Supabase Dashboard → **Settings → Subscription → Upgrade to Pro** ($25/เดือน)
- ได้ PITR 7 วัน + log retention 7 วัน + ลบ 1GB DB cap → 8GB

### 8.2 Cloud Selection Memo

สร้างเอกสาร `spec/cloud-selection-memo.md`:
- เลือก Supabase + Vercel เพราะอะไร (ISO 27001 cert + SOC 2 Type II)
- DPA review ของ Supabase Inc. และ Vercel Inc. (ดาวน์โหลดจากแต่ละ vendor)
- ข้อมูลที่เก็บ: เฉพาะ email + Drive URL + metadata — ไม่มี file content
- Region: Singapore (ใกล้ TH ที่สุดในขณะนี้)
- MD เซ็นรับรอง

ไฟล์นี้คือหลักฐานของ control **C1-5** + **C1-6** สำหรับ self-audit ของระบบเอง

### 8.3 Export snapshot สำหรับ HQ

เมื่อใกล้วัน audit:
1. Dashboard → กด **Refresh audit** (P1 ใน roadmap — ถ้ายังไม่มี ให้ใช้ snapshot SQL ด้านล่าง)
2. รอ snapshot table มี row ใหม่
3. ใช้ HTML report เดิม (`audit-report/audit-report.html`) เป็น template — load JSON จาก snapshot แทน

หรือ SQL fallback:
```sql
select * from public.snapshots order by taken_at desc limit 1;
```
copy column `verdicts` ไป save เป็น JSON file ส่ง HQ พร้อม PDF report

---

## Troubleshooting

### "domain-not-allowed" แม้ sign in ด้วยโดเมนที่คิดว่าถูก
- ตรวจ Supabase param: `select current_setting('app.allowed_domain', true);` → ถ้าตั้งไว้ ต้องตรงกับโดเมนที่ login
- ถ้าอยาก **ปลด** restriction ทั้งหมด: รัน `alter database postgres reset app.allowed_domain;` และลบ env `ALLOWED_EMAIL_DOMAIN` ใน Vercel
- ถ้าอยาก **เปลี่ยน** โดเมน: รัน `alter database postgres set app.allowed_domain = 'other.com';` และอัปเดต Vercel env ตามด้วย

### Sign in เด้งกลับ /sign-in?error=...
- ตรวจ Vercel logs (Project → Logs → Runtime) — ปกติเป็น redirect URL mismatch
- ตรวจ Supabase → Authentication → URL Configuration ว่า redirect URLs ตรงกับ Vercel domain ปัจจุบัน

### `pnpm db:seed` พัง "permission denied"
- ใช้ service_role key ไม่ใช่ anon key
- ตรวจ env: `echo $SUPABASE_SERVICE_ROLE_KEY | wc -c` ต้อง ≥ 200 (anon key สั้นกว่า)

### Dashboard ขึ้นว่างทั้งที่ seed แล้ว
- ตรวจ user role: ใน SQL editor `select role, active from profiles where email='you@autocorp.co.th';`
- ถ้า `active=false` → `update profiles set active=true where email='...';`

### audit_log ไม่เห็น event
- ตรวจว่า BFF เรียก `logEvent()` หลังทุก mutation — ดู `src/app/controls/[no]/actions.ts`
- ตรวจ Vercel logs ดูว่า audit insert พังหรือไม่ (ดู prefix `[audit-log insert failed]`)

### Drive link verify แสดงผิด
- v1 ไม่ verify Drive API → ระบบ trust URL ตามที่ user paste
- ป้องกันด้วย regex `^https?://(drive|docs|sheets)\.google\.com/` ใน zod schema เท่านั้น
- การ verify ของจริงเป็น P1 (manual ทีม IT แชร์ในที่ประชุม weekly แทน)

---

## Summary checklist (ทำตามขั้นได้)

- [ ] Phase 0 — accounts + selection memo พร้อม
- [ ] Phase 1 — push code ขึ้น private GitHub repo
- [ ] Phase 2 — Supabase project + 3 migrations + keys
- [ ] Phase 3 — Google OAuth client + Internal user type + Supabase provider เชื่อม
- [ ] Phase 4 — local dev test ผ่าน (sign in + submit + verify + verdict + audit log)
- [ ] Phase 5 — Vercel deploy + env vars + อัปเดต OAuth allowed origins
- [ ] Phase 6 — promote audit_lead + เชิญทีม + assign controls
- [ ] Phase 7 — verification (security headers + audit log coverage + backup)
- [ ] Phase 8 — Pro upgrade + selection memo MD sign-off (ก่อน production-grade use)

ระยะเวลารวมถ้าทำขนาน + cool head: **~90 นาที** (ไม่รวมรอ DNS propagate ถ้าใช้ custom domain)

---

## เอกสารที่เกี่ยวข้อง

- [`../README.md`](../README.md) — overview สถาปัตยกรรม + page map
- [`../../spec/audit-tracking-system.md`](../../spec/audit-tracking-system.md) — PRD เต็ม
- [`../../spec/self-audit.md`](../../spec/self-audit.md) — ระบบนี้ผ่าน ITGR ของตัวเองยังไง (35/35 in-scope controls)
- [`../../spec/cloud-selection-memo.md`](../../spec/cloud-selection-memo.md) — **TODO** ก่อน production
