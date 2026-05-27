/**
 * /controls — checklist grouped by 8 ITGR categories.
 * Each category card shows status mini-bar + collapsible list of controls.
 */
import { admin } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Row = {
  no: number; name: string; name_th: string | null; verdict: string; risk: string;
  category_short: string; category_short_th: string; category: string; category_th: string;
};

export default async function ControlsList({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const sb = admin();

  const { data: controls } = await sb
    .from("controls")
    .select("no,name,name_th,verdict,risk,category,category_th,category_short,category_short_th")
    .order("no");

  const { data: evid } = await sb.from("evidence_links").select("control_no,verified_at,archived_at");
  const evidMap = new Map<number, { total: number; verified: number }>();
  for (const e of evid ?? []) {
    if (e.archived_at) continue;
    const r = evidMap.get(e.control_no) ?? { total: 0, verified: 0 };
    r.total++; if (e.verified_at) r.verified++;
    evidMap.set(e.control_no, r);
  }

  const filtered = (controls ?? []).filter(c => sp.status ? c.verdict === sp.status : true) as Row[];

  // Group by category, preserve numeric order
  const groups = new Map<string, { catShort: string; catShortTh: string; catFull: string; catFullTh: string; rows: Row[] }>();
  for (const c of filtered) {
    if (!groups.has(c.category_short)) {
      groups.set(c.category_short, {
        catShort: c.category_short, catShortTh: c.category_short_th,
        catFull: c.category, catFullTh: c.category_th, rows: [],
      });
    }
    groups.get(c.category_short)!.rows.push(c);
  }
  const ordered = Array.from(groups.values()).sort((a, b) => a.catShort.localeCompare(b.catShort));

  return (
    <div className="max-w-6xl mx-auto mt-2 space-y-4">
      {/* Filter bar */}
      <div className="glass rounded-3xl p-4 flex flex-wrap gap-2 items-center text-sm">
        <span className="t-dim text-xs uppercase tracking-widest">สถานะ:</span>
        <FilterLink current={sp.status} value={undefined} label="ทั้งหมด" />
        <FilterLink current={sp.status} value="unset" label="ยังไม่ตัดสิน" />
        <FilterLink current={sp.status} value="comply" label="ผ่าน" />
        <FilterLink current={sp.status} value="partial" label="ผ่านบางส่วน" />
        <FilterLink current={sp.status} value="non" label="ไม่ผ่าน" />
        <span className="ml-auto text-xs t-muted">
          <b>{filtered.length}</b> / {controls?.length ?? 0} controls · {ordered.length} หมวด
        </span>
      </div>

      {/* Empty state */}
      {(controls?.length ?? 0) === 0 && (
        <div className="glass rounded-3xl p-12 text-center space-y-3">
          <div className="text-4xl">📋</div>
          <div className="text-lg font-semibold">ยังไม่มี controls — กรุณา seed ที่หน้า Admin</div>
        </div>
      )}

      {/* One card per category */}
      {ordered.map(g => {
        const sc = g.rows.reduce((a, r) => { a[r.verdict] = (a[r.verdict] || 0) + 1; return a; }, {} as Record<string, number>);
        const tot = g.rows.length;
        return (
          <details key={g.catShort} open className="glass rounded-3xl group">
            <summary className="px-5 py-4 cursor-pointer hover-bg rounded-3xl">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-sm font-bold grad-text">{g.catShortTh}</div>
                <span className="text-[11px] t-dim">{g.catFull}</span>
                <span className="ml-auto text-xs t-muted tabular-nums">{tot} controls</span>
                <CategoryMiniBar sc={sc} tot={tot} />
              </div>
            </summary>
            <div className="border-t" style={{ borderColor: "var(--glass-soft-border)" }}>
              <table className="w-full text-sm">
                <tbody>
                  {g.rows.map(c => {
                    const ev = evidMap.get(c.no) ?? { total: 0, verified: 0 };
                    return (
                      <tr key={c.no} className="border-b hover-bg" style={{ borderColor: "var(--glass-soft-border)" }}>
                        <td className="py-2 px-4 font-bold tabular-nums t-dim w-12">{c.no}</td>
                        <td className="py-2 px-3 w-28"><StatusBadge verdict={c.verdict} /></td>
                        <td className="py-2 px-3 w-20"><RiskBadge risk={c.risk} /></td>
                        <td className="py-2 px-3">
                          <div className="font-medium">{c.name_th || c.name}</div>
                          {c.name_th && <div className="text-[10px] t-dim">{c.name}</div>}
                        </td>
                        <td className="py-2 px-3 text-center text-xs w-20">
                          <span style={{ color: ev.verified > 0 ? "#10b981" : ev.total > 0 ? "#f59e0b" : "var(--text-dim)" }}>
                            {ev.verified}<span className="t-dim">/{ev.total}</span>
                          </span>
                          <div className="text-[9px] t-dim uppercase tracking-widest">หลักฐาน</div>
                        </td>
                        <td className="py-2 px-4 text-right w-16">
                          <Link href={`/controls/${c.no}`} className="px-2.5 py-1 rounded-md glass-soft hover-bg text-xs">→</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        );
      })}
    </div>
  );
}

function CategoryMiniBar({ sc, tot }: { sc: Record<string, number>; tot: number }) {
  const pct = (n: number) => tot ? (n / tot) * 100 : 0;
  return (
    <div className="w-44 h-2.5 rounded-full overflow-hidden flex" style={{ background: "var(--track-bg)" }}
      title={`comply ${sc.comply || 0} · partial ${sc.partial || 0} · non ${sc.non || 0} · na ${sc.na || 0} · unset ${sc.unset || 0}`}>
      <div style={{ width: `${pct(sc.comply || 0)}%`, background: "#10b981" }} />
      <div style={{ width: `${pct(sc.partial || 0)}%`, background: "#f59e0b" }} />
      <div style={{ width: `${pct(sc.non || 0)}%`, background: "#f43f5e" }} />
      <div style={{ width: `${pct(sc.na || 0)}%`, background: "#94a3b8" }} />
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
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase whitespace-nowrap"
    style={{ background: v.c + "22", color: v.c, border: `1px solid ${v.c}55` }}>{v.l}</span>;
}
function RiskBadge({ risk }: { risk: string }) {
  const thMap: Record<string, string> = { "Very High": "สูงมาก", "High": "สูง", "Middle": "ปานกลาง", "Low": "ต่ำ" };
  const cMap: Record<string, string> = { "Very High": "#f43f5e", "High": "#f97316", "Middle": "#eab308", "Low": "#3b82f6" };
  const c = cMap[risk] || "#94a3b8";
  return <span className="px-2 py-0.5 rounded-md text-[10px] font-medium border whitespace-nowrap"
    style={{ borderColor: c + "55", color: c, background: c + "18" }}>{thMap[risk] || risk}</span>;
}
