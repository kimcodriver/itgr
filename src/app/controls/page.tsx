/**
 * /controls — Checklist grouped by 8 ITGR categories.
 * Each control row is independently expandable to reveal verbatim Q+S+evidence_req
 * + current finding/recommendation without leaving the list view.
 */
import { admin } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getPrefs } from "@/lib/prefs";
import { useT } from "@/lib/i18n";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Row = {
  no: number;
  name: string; name_th: string | null;
  verdict: string; risk: string;
  category_short: string; category_short_th: string;
  category: string; category_th: string;
  question: string; standards: string; evidence_req: string | null;
  article: string | null;
  finding: string | null; finding_th: string | null;
  recommendation: string | null; recommendation_th: string | null;
};

export default async function ControlsList({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const { lang } = await getPrefs();
  const t = useT(lang);
  const sb = admin();

  const { data: controls } = await sb
    .from("controls")
    .select("no,name,name_th,verdict,risk,category,category_th,category_short,category_short_th,question,standards,evidence_req,article,finding,finding_th,recommendation,recommendation_th")
    .order("no");

  const { data: evid } = await sb.from("evidence_links").select("control_no,verified_at,archived_at,drive_url");
  const evidMap = new Map<number, { total: number; verified: number; pendingLink: number }>();
  for (const e of evid ?? []) {
    if (e.archived_at) continue;
    const r = evidMap.get(e.control_no) ?? { total: 0, verified: 0, pendingLink: 0 };
    r.total++;
    if (e.verified_at) r.verified++;
    if (!e.drive_url) r.pendingLink++;
    evidMap.set(e.control_no, r);
  }

  const filtered = (controls ?? []).filter(c => sp.status ? c.verdict === sp.status : true) as Row[];

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
      <div className="glass rounded-3xl p-4 flex flex-wrap gap-2 items-center text-sm">
        <span className="t-dim text-xs uppercase tracking-widest">{t("label.status")}:</span>
        <FilterLink current={sp.status} value={undefined} label={t("label.all")} />
        <FilterLink current={sp.status} value="unset" label={t("status.unset")} />
        <FilterLink current={sp.status} value="comply" label={t("status.comply")} />
        <FilterLink current={sp.status} value="partial" label={t("status.partial")} />
        <FilterLink current={sp.status} value="non" label={t("status.non")} />
        <span className="ml-auto text-xs t-muted">
          <b>{filtered.length}</b> / {controls?.length ?? 0} {t("label.controls")} · {ordered.length} {t("label.cat")}
        </span>
      </div>

      {(controls?.length ?? 0) === 0 && (
        <div className="glass rounded-3xl p-12 text-center space-y-3">
          <div className="text-4xl">📋</div>
          <div className="text-lg font-semibold">{t("checklist.empty")}</div>
        </div>
      )}

      {ordered.map(g => {
        const sc = g.rows.reduce((a, r) => { a[r.verdict] = (a[r.verdict] || 0) + 1; return a; }, {} as Record<string, number>);
        const tot = g.rows.length;
        return (
          <details key={g.catShort} open className="glass rounded-3xl group">
            <summary className="px-5 py-4 cursor-pointer hover-bg rounded-3xl">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-sm font-bold grad-text">{lang === "th" ? g.catShortTh : g.catShort}</div>
                <span className="text-[11px] t-dim">{lang === "th" ? g.catFull : g.catFullTh}</span>
                <span className="ml-auto text-xs t-muted tabular-nums">{tot} {t("label.controls")}</span>
                <CategoryMiniBar sc={sc} tot={tot} />
              </div>
            </summary>
            <div className="border-t" style={{ borderColor: "var(--glass-soft-border)" }}>
              {g.rows.map(c => {
                const ev = evidMap.get(c.no) ?? { total: 0, verified: 0, pendingLink: 0 };
                const findingText = lang === "th" && c.finding_th ? c.finding_th : (c.finding ?? "");
                const recText = lang === "th" && c.recommendation_th ? c.recommendation_th : (c.recommendation ?? "");
                const nameDisplay = lang === "th" && c.name_th ? c.name_th : c.name;
                return (
                  <details key={c.no} className="border-b group" style={{ borderColor: "var(--glass-soft-border)" }}>
                    <summary className="px-4 py-2.5 cursor-pointer hover-bg">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="font-bold tabular-nums t-dim w-8">{c.no}</div>
                        <div className="w-28"><StatusBadge verdict={c.verdict} lang={lang} t={t} /></div>
                        <div className="w-20"><RiskBadge risk={c.risk} lang={lang} t={t} /></div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{nameDisplay}</div>
                          {lang === "th" && c.name_th && c.name_th !== c.name && (
                            <div className="text-[10px] t-dim truncate">{c.name}</div>
                          )}
                        </div>
                        <div className="text-xs text-right w-24 shrink-0">
                          <div style={{ color: ev.verified > 0 ? "#10b981" : ev.total > 0 ? "#f59e0b" : "var(--text-dim)" }}>
                            {ev.verified}<span className="t-dim">/{ev.total}</span>
                          </div>
                          <div className="text-[9px] t-dim uppercase tracking-widest">{t("label.evidence")}</div>
                        </div>
                        <span className="text-[10px] uppercase tracking-widest t-faint w-16 text-right group-open:hidden">{t("checklist.expand")}</span>
                        <span className="text-[10px] uppercase tracking-widest t-faint w-16 text-right hidden group-open:inline">{t("checklist.collapse")}</span>
                      </div>
                    </summary>
                    {/* Expanded body */}
                    <div className="px-5 pb-4 pt-1 space-y-2.5 bg-[color:var(--hover-bg)]/30">
                      {c.article && (
                        <div className="text-[11px] t-dim">§{c.article}</div>
                      )}
                      <Block title={t("block.question")}>{c.question}</Block>
                      <Block title={t("block.standard")}>{c.standards}</Block>
                      {c.evidence_req && <Block title={t("block.evidence_req")}>{c.evidence_req}</Block>}
                      {findingText ? (
                        <Block title={t("block.finding")} highlight="#f59e0b">{findingText}</Block>
                      ) : (
                        <Block title={t("block.finding")} muted>{t("block.no_finding")}</Block>
                      )}
                      {recText && <Block title={t("block.rec")} highlight="#818cf8">{recText}</Block>}
                      <div className="flex items-center gap-3 pt-1 text-[11px] t-dim">
                        <span>หลักฐาน: {ev.verified}✓ / {ev.total - ev.verified}⏳ · {ev.pendingLink} {t("label.pending")} link</span>
                        <Link href={`/controls/${c.no}`} className="ml-auto px-2.5 py-1 rounded-md glass-soft hover-bg t-base text-[11px]">
                          {t("checklist.open")}
                        </Link>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function Block({ title, children, highlight, muted }: { title: string; children: React.ReactNode; highlight?: string; muted?: boolean }) {
  return (
    <div className="glass-soft rounded-xl p-3"
      style={highlight ? { borderLeft: `2px solid ${highlight}` } : undefined}>
      <div className="text-[10px] uppercase tracking-widest t-dim mb-1">{title}</div>
      <div className={`text-sm whitespace-pre-wrap leading-relaxed ${muted ? "t-dim" : ""}`}>{children}</div>
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

function StatusBadge({ verdict, t }: { verdict: string; lang: string; t: (k: string) => string }) {
  const colors: Record<string, string> = { unset: "#94a3b8", comply: "#10b981", partial: "#f59e0b", non: "#f43f5e", na: "#94a3b8" };
  const c = colors[verdict] || "#94a3b8";
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase whitespace-nowrap"
    style={{ background: c + "22", color: c, border: `1px solid ${c}55` }}>{t("status." + verdict)}</span>;
}
function RiskBadge({ risk, t }: { risk: string; lang: string; t: (k: string) => string }) {
  const colors: Record<string, string> = { "Very High": "#f43f5e", "High": "#f97316", "Middle": "#eab308", "Low": "#3b82f6" };
  const c = colors[risk] || "#94a3b8";
  return <span className="px-2 py-0.5 rounded-md text-[10px] font-medium border whitespace-nowrap"
    style={{ borderColor: c + "55", color: c, background: c + "18" }}>{t("risk." + risk)}</span>;
}
