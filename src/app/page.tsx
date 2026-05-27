/**
 * Dashboard — overall status. Requires sign-in (enforced by middleware + requireUser).
 */
import { admin } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

type StatusCounts = { comply: number; partial: number; non: number; na: number; unset: number };

export default async function Dashboard() {
  await requireUser();
  const sb = admin();

  const [scoreRes, countsRes, ctrlRes, evidRes] = await Promise.all([
    sb.rpc("compute_score"),
    sb.rpc("status_counts"),
    sb.from("controls").select("no,name,name_th,verdict,risk,category_short,category_short_th", { count: "exact" }),
    sb.from("evidence_links").select("control_no,verified_at,kind,archived_at"),
  ]);

  const score = (scoreRes.data as number | null) ?? 0;
  const counts: StatusCounts = (countsRes.data as unknown as StatusCounts[])?.[0] ?? { comply: 0, partial: 0, non: 0, na: 0, unset: 96 };
  const controls = ctrlRes.data ?? [];
  const evid = (evidRes.data ?? []).filter(e => !e.archived_at);

  const total = controls.length;
  const evidByControl = new Map<number, { total: number; verified: number; legacy: number; new_: number }>();
  for (const e of evid) {
    const r = evidByControl.get(e.control_no) ?? { total: 0, verified: 0, legacy: 0, new_: 0 };
    r.total++;
    if (e.verified_at) r.verified++;
    if (e.kind === "legacy") r.legacy++;
    if (e.kind === "new") r.new_++;
    evidByControl.set(e.control_no, r);
  }
  const evidenceCoverage = controls.filter(c => (evidByControl.get(c.no)?.verified ?? 0) > 0).length;

  return (
    <div className="max-w-7xl mx-auto space-y-5 mt-2">
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="คะแนนการปฏิบัติตาม" value={`${score}%`} sub={`${total} controls`} color="#818cf8" />
        <Kpi label="ผ่านมาตรฐาน" value={counts.comply} sub={`${pct(counts.comply, total)}%`} color="#10b981" />
        <Kpi label="ผ่านบางส่วน" value={counts.partial} sub={`${pct(counts.partial, total)}%`} color="#f59e0b" />
        <Kpi label="ไม่ผ่าน" value={counts.non} sub={`${pct(counts.non, total)}%`} color="#f43f5e" />
        <Kpi label="มีหลักฐานยืนยัน" value={`${evidenceCoverage}/${total}`} sub={`${pct(evidenceCoverage, total)}% ของ controls`} color="#22d3ee" />
      </section>

      <section className="glass rounded-3xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold">สถานะรายหมวด</div>
            <div className="text-[11px] t-dim">8 หมวด ITGR — กดที่หมวดเพื่อดู controls</div>
          </div>
          <Link href="/controls" className="text-xs px-3 py-1.5 rounded-lg glass-soft hover-bg">ดู controls ทั้งหมด →</Link>
        </div>
        <CategoryBars controls={controls as ControlRow[]} />
      </section>

      <section className="glass rounded-3xl p-5">
        <div className="text-sm font-semibold mb-2">หลักฐาน FY2026 — สถานะรวม</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <EvidenceSummary
            title="Legacy evidence (Drive เดิม)"
            sub="หลักฐานจากการ audit ก่อนหน้า"
            count={evid.filter(e => e.kind === "legacy").length}
            verified={evid.filter(e => e.kind === "legacy" && e.verified_at).length}
            color="#22d3ee"
          />
          <EvidenceSummary
            title="New evidence (Drive ใหม่ FY2026)"
            sub="หลักฐานที่ทีม IT upload ใหม่ในรอบนี้"
            count={evid.filter(e => e.kind === "new").length}
            verified={evid.filter(e => e.kind === "new" && e.verified_at).length}
            color="#818cf8"
          />
        </div>
      </section>
    </div>
  );
}

function pct(v: number, t: number) { return t ? Math.round((v / t) * 100) : 0; }

function Kpi({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  return (
    <div className="glass rounded-2xl px-4 py-4 relative overflow-hidden">
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-25" style={{ background: color }} />
      <div className="text-[10px] uppercase tracking-widest t-dim">{label}</div>
      <div className="mt-1 text-3xl font-black tabular-nums" style={{ color }}>{value}</div>
      <div className="text-[11px] t-muted mt-1">{sub}</div>
    </div>
  );
}

type ControlRow = { no: number; name: string; name_th: string | null; verdict: string; risk: string; category_short: string; category_short_th: string };
function CategoryBars({ controls }: { controls: ControlRow[] }) {
  const by = new Map<string, { en: string; th: string; rows: ControlRow[] }>();
  for (const c of controls) {
    const k = c.category_short;
    if (!by.has(k)) by.set(k, { en: c.category_short, th: c.category_short_th, rows: [] });
    by.get(k)!.rows.push(c);
  }
  const ordered = Array.from(by.values()).sort((a, b) => a.en.localeCompare(b.en));
  const max = Math.max(...ordered.map(o => o.rows.length), 1);
  return (
    <div className="space-y-2 pt-1">
      {ordered.map(({ en, th, rows }) => {
        const sc = rows.reduce((a, r) => { a[r.verdict] = (a[r.verdict] || 0) + 1; return a; }, {} as Record<string, number>);
        return (
          <div key={en}>
            <div className="flex items-baseline justify-between text-xs mb-1">
              <span className="font-semibold">{th}</span>
              <span className="t-dim">{rows.length}</span>
            </div>
            <div className="h-4 rounded-md overflow-hidden flex" style={{ background: "var(--track-bg)" }}>
              {seg(sc.comply, max, "#10b981")}
              {seg(sc.partial, max, "#f59e0b")}
              {seg(sc.non, max, "#f43f5e")}
              {seg(sc.na, max, "#94a3b8")}
              {seg(sc.unset, max, "rgba(255,255,255,0.15)")}
            </div>
          </div>
        );
      })}
    </div>
  );
}
function seg(n: number | undefined, max: number, bg: string) {
  if (!n) return null;
  return <div style={{ width: `${(n / max) * 100}%`, background: bg }} className="flex items-center justify-center text-[10px] font-bold text-black/70">{n >= 2 ? n : ""}</div>;
}

function EvidenceSummary({ title, sub, count, verified, color }: { title: string; sub: string; count: number; verified: number; color: string }) {
  return (
    <div className="glass-soft rounded-xl p-4">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-[11px] t-dim">{sub}</div>
        </div>
        <div className="text-2xl font-black tabular-nums" style={{ color }}>{count}</div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] t-muted">
        <span>ผ่าน review: <span className="font-bold" style={{ color: "#10b981" }}>{verified}</span></span>
        <span className="t-dim">·</span>
        <span>รอ review: <span className="font-bold" style={{ color: "#f59e0b" }}>{count - verified}</span></span>
      </div>
    </div>
  );
}
