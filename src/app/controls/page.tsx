/**
 * /controls — list all 96 controls with current status + evidence count.
 * Open access (no login).
 */
import { admin } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ControlsList({ searchParams }: { searchParams: Promise<{ status?: string; cat?: string }> }) {
  const sp = await searchParams;
  const sb = admin();

  let q = sb.from("controls").select("no,name,name_th,verdict,risk,category_short,category_short_th").order("no");
  if (sp.status) q = q.eq("verdict", sp.status);
  if (sp.cat) q = q.eq("category_short", sp.cat);
  const { data: controls } = await q;

  const { data: evid } = await sb.from("evidence_links").select("control_no,verified_at,archived_at");
  const evidMap = new Map<number, { total: number; verified: number }>();
  for (const e of evid ?? []) {
    if (e.archived_at) continue;
    const r = evidMap.get(e.control_no) ?? { total: 0, verified: 0 };
    r.total++; if (e.verified_at) r.verified++;
    evidMap.set(e.control_no, r);
  }

  return (
    <div className="max-w-7xl mx-auto mt-2 space-y-4">
      <div className="glass rounded-3xl p-4 flex flex-wrap gap-2 items-center text-sm">
        <span className="t-dim text-xs uppercase tracking-widest">สถานะ:</span>
        <FilterLink current={sp.status} value={undefined} label="ทั้งหมด" />
        <FilterLink current={sp.status} value="unset" label="ยังไม่ตัดสิน" />
        <FilterLink current={sp.status} value="comply" label="ผ่าน" />
        <FilterLink current={sp.status} value="partial" label="ผ่านบางส่วน" />
        <FilterLink current={sp.status} value="non" label="ไม่ผ่าน" />
        <span className="ml-auto text-xs t-muted">{controls?.length ?? 0} controls</span>
      </div>

      <div className="glass rounded-3xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-widest t-dim">
            <tr className="border-b" style={{ borderColor: "var(--glass-border)" }}>
              <th className="text-left py-2 px-3 w-10">#</th>
              <th className="text-left py-2 px-3">หมวด</th>
              <th className="text-left py-2 px-3">Control</th>
              <th className="text-center py-2 px-3 w-24">ความเสี่ยง</th>
              <th className="text-center py-2 px-3 w-28">สถานะ</th>
              <th className="text-center py-2 px-3 w-24">หลักฐาน</th>
              <th className="text-right py-2 px-3 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {(controls ?? []).map(c => {
              const ev = evidMap.get(c.no) ?? { total: 0, verified: 0 };
              return (
                <tr key={c.no} className="border-b hover-bg" style={{ borderColor: "var(--glass-soft-border)" }}>
                  <td className="py-2 px-3 font-bold tabular-nums">{c.no}</td>
                  <td className="py-2 px-3 text-[11px] t-muted">{c.category_short_th}</td>
                  <td className="py-2 px-3">
                    <div className="font-medium">{c.name_th || c.name}</div>
                    <div className="text-[10px] t-dim">{c.name}</div>
                  </td>
                  <td className="py-2 px-3 text-center"><RiskBadge risk={c.risk} /></td>
                  <td className="py-2 px-3 text-center"><StatusBadge verdict={c.verdict} /></td>
                  <td className="py-2 px-3 text-center text-xs">
                    <span style={{ color: ev.verified > 0 ? "#10b981" : ev.total > 0 ? "#f59e0b" : "var(--text-dim)" }}>
                      {ev.verified}/{ev.total}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <Link href={`/controls/${c.no}`} className="px-2 py-1 rounded-md glass-soft hover-bg text-xs">→</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterLink({ current, value, label }: { current?: string; value?: string; label: string }) {
  const active = current === value;
  const href = value ? `?status=${value}` : "?";
  return (
    <Link href={href} className={`px-2.5 py-1 text-xs rounded-lg ${active ? "ring-1 ring-white/30" : "hover-bg"}`}
      style={active ? { background: "var(--hover-bg)" } : undefined}>{label}</Link>
  );
}

function StatusBadge({ verdict }: { verdict: string }) {
  const map: Record<string, { c: string; l: string }> = {
    unset:   { c: "#94a3b8", l: "ยังไม่ตัดสิน" },
    comply:  { c: "#10b981", l: "ผ่าน" },
    partial: { c: "#f59e0b", l: "ผ่านบางส่วน" },
    non:     { c: "#f43f5e", l: "ไม่ผ่าน" },
    na:      { c: "#94a3b8", l: "N/A" },
  };
  const v = map[verdict] || map.unset;
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase"
    style={{ background: v.c + "22", color: v.c, border: `1px solid ${v.c}55` }}>{v.l}</span>;
}
function RiskBadge({ risk }: { risk: string }) {
  const map: Record<string, string> = { "Very High": "#f43f5e", "High": "#f97316", "Middle": "#eab308", "Low": "#3b82f6" };
  const c = map[risk] || "#94a3b8";
  return <span className="px-2 py-0.5 rounded-md text-[10px] font-medium border"
    style={{ borderColor: c + "55", color: c, background: c + "18" }}>{risk}</span>;
}
