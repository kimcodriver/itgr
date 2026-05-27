"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import Link from "next/link";
import type { Lang } from "@/lib/prefs";
import { useT, t as tFn } from "@/lib/i18n";

export type Control = {
  no: number;
  name: string;
  name_th: string | null;
  article: string | null;
  verdict: string;
  risk: string;
  category_short: string;
  category_short_th: string;
  question: string;
  standards: string;
  evidence_req: string | null;
  finding: string | null;
  finding_th: string | null;
  recommendation: string | null;
  recommendation_th: string | null;
  evidence_count: number;
  verified_count: number;
  evidence_samples: { title: string | null; drive_url: string | null; verified: boolean; kind: string }[];
};
export type MindmapData = { controls: Control[] };

type NodeBase = { id: string; name: string; group: "root" | "category" | "control"; r: number };
type ControlNode = NodeBase & { group: "control"; record: Control };
type Node = NodeBase | ControlNode;
type Link = { source: string; target: string; type: "taxonomy" | "control" };

const STATUS_COLOR: Record<string, string> = {
  unset:   "#94a3b8",
  comply:  "#10b981",
  partial: "#f59e0b",
  non:     "#f43f5e",
  na:      "#94a3b8",
};

export default function MindmapClient({ data, lang }: { data: MindmapData; lang: Lang }) {
  const t = useT(lang);
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Control | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [catFilter, setCatFilter] = useState<string>("all");

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    data.controls.forEach(c => { if (!seen.has(c.category_short)) seen.set(c.category_short, c.category_short_th); });
    return Array.from(seen.entries());
  }, [data.controls]);

  // ESC to close popup
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setSelected(null); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";

    const nodes: Node[] = [];
    const links: Link[] = [];
    nodes.push({ id: "root", name: "Marubeni ITGR FY2025", group: "root", r: 32 });

    const catKeys = Array.from(new Set(data.controls.map(c => c.category_short))).sort();
    catKeys.forEach(k => {
      if (catFilter !== "all" && k !== catFilter) return;
      const sample = data.controls.find(c => c.category_short === k);
      const label = lang === "th" && sample ? sample.category_short_th : k;
      nodes.push({ id: "cat:" + k, name: label, group: "category", r: 20 });
      links.push({ source: "root", target: "cat:" + k, type: "taxonomy" });
    });

    data.controls.forEach(c => {
      if (statusFilter !== "all" && c.verdict !== statusFilter) return;
      if (catFilter !== "all" && c.category_short !== catFilter) return;
      const id = "c:" + c.no;
      const label = lang === "th" && c.name_th ? `#${c.no} ${c.name_th}` : `#${c.no} ${c.name}`;
      nodes.push({ id, name: label, group: "control", r: 13, record: c } as ControlNode);
      links.push({ source: "cat:" + c.category_short, target: id, type: "control" });
    });

    const width = el.clientWidth || 1400;
    const height = el.clientHeight || 700;

    const svg = d3.select(el).append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%").attr("height", "100%")
      .style("display", "block");

    // Glow defs
    const defs = svg.append("defs");
    const glowFilter = defs.append("filter").attr("id", "node-glow").attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
    glowFilter.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "blur");
    glowFilter.append("feMerge").selectAll("feMergeNode").data(["blur", "SourceGraphic"]).enter().append("feMergeNode").attr("in", d => d);

    const styles = getComputedStyle(document.documentElement);
    const taxonomyStroke = styles.getPropertyValue("--text-dim").trim() || "rgba(255,255,255,0.32)";
    const linkStroke = styles.getPropertyValue("--text-faint").trim() || "rgba(255,255,255,0.22)";
    const labelFill = styles.getPropertyValue("--text").trim() || "#e6e8f5";

    const g = svg.append("g");
    svg.call(d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.25, 5]).on("zoom", (e) => g.attr("transform", e.transform)) as never);

    const colorOf = (n: Node) =>
      n.group === "root" ? "#818cf8" :
      n.group === "category" ? "#c4b5fd" :
      STATUS_COLOR[(n as ControlNode).record.verdict] || "#cbd5ff";

    const link = g.append("g").selectAll("line")
      .data(links).enter().append("line")
      .attr("stroke", l => l.type === "taxonomy" ? taxonomyStroke : linkStroke)
      .attr("stroke-width", l => l.type === "taxonomy" ? 1.6 : 1)
      .attr("stroke-opacity", 0.7);

    type SimNode = Node & d3.SimulationNodeDatum;
    const node = g.append("g").selectAll<SVGGElement, SimNode>("g")
      .data(nodes as SimNode[]).enter().append("g");

    node.append("circle")
      .attr("r", n => n.r)
      .attr("fill", n => colorOf(n))
      .attr("fill-opacity", n => n.group === "root" ? 1 : n.group === "control" ? 0.92 : 0.7)
      .attr("stroke", n => colorOf(n))
      .attr("stroke-opacity", 0.9).attr("stroke-width", 2)
      .style("filter", n => n.group !== "control" ? "url(#node-glow)" : null)
      .style("cursor", n => n.group === "control" ? "pointer" : "grab")
      .on("click", (_e, n) => {
        if (n.group === "control") setSelected((n as ControlNode).record);
      });

    node.append("title").text(n => n.name);

    // Labels above root + category nodes (outside circle)
    node.filter(n => n.group === "root" || n.group === "category")
      .append("text")
      .attr("text-anchor", "middle").attr("dy", n => -(n.r + 8))
      .style("font-weight", "700").style("pointer-events", "none")
      .style("font-size", n => n.group === "root" ? "14px" : "11px")
      .style("fill", labelFill)
      .style("text-shadow", "0 1px 4px rgba(0,0,0,0.5)")
      .text(n => n.name.length > 36 ? n.name.slice(0, 34) + "…" : n.name);

    // Number inside control nodes — visible at-a-glance overview
    node.filter(n => n.group === "control")
      .append("text")
      .attr("text-anchor", "middle").attr("dy", "0.35em")
      .style("font-weight", "800").style("pointer-events", "none")
      .style("font-size", "10px")
      .style("fill", "#fff")
      .style("text-shadow", "0 1px 2px rgba(0,0,0,0.45), 0 0 1px rgba(0,0,0,0.7)")
      .style("letter-spacing", "-0.02em")
      .text(n => (n as ControlNode).record.no);

    type SimLink = d3.SimulationLinkDatum<SimNode> & Link;
    const sim = d3.forceSimulation<SimNode>(nodes as SimNode[])
      .force("link", d3.forceLink<SimNode, SimLink>(links as never)
        .id(d => (d as Node).id)
        .distance(l => l.type === "taxonomy" ? 220 : 90))
      .force("charge", d3.forceManyBody<SimNode>().strength((n) => (n as Node).group === "root" ? -1000 : (n as Node).group === "category" ? -380 : -110))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide<SimNode>(d => (d as Node).r + 6));

    sim.on("tick", () => {
      link
        .attr("x1", d => (d.source as unknown as SimNode).x ?? 0).attr("y1", d => (d.source as unknown as SimNode).y ?? 0)
        .attr("x2", d => (d.target as unknown as SimNode).x ?? 0).attr("y2", d => (d.target as unknown as SimNode).y ?? 0);
      node.attr("transform", d => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    const drag = d3.drag<SVGGElement, SimNode>()
      .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag",  (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on("end",   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; });
    node.call(drag);
  }, [data, statusFilter, catFilter, lang]);

  // Re-tag selected node when selection changes
  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current).select("svg");
    svg.selectAll("g g g").select("circle").classed("node-selected", false).attr("stroke-width", 2);
    if (selected) {
      svg.selectAll("g g g")
        .filter(function () {
          const txt = d3.select(this).select("title").text();
          return txt.startsWith(`#${selected.no} `);
        })
        .select("circle").classed("node-selected", true);
    }
  }, [selected]);

  return (
    <div className="mm-container" style={{ height: "calc(100vh - 96px)" }}>
      <div className="mm-blob b1" />
      <div className="mm-blob b2" />
      <div className="mm-blob b3" />
      <div className="mm-blob b4" />

      {/* SVG fills the entire container */}
      <div ref={ref} className="absolute inset-0" style={{ zIndex: 1 }} />

      {/* Floating filter bar — top center */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 mm-glass rounded-2xl px-3 py-2 flex items-center gap-2 flex-wrap text-xs">
        <FilterChips label={t("label.status")} value={statusFilter} setValue={setStatusFilter}
          opts={[["all", t("label.all")], ["comply", t("status.comply")], ["partial", t("status.partial")], ["non", t("status.non")], ["unset", t("status.unset")]]}
          colorize={(v) => STATUS_COLOR[v] || undefined} />
        <span className="t-faint">·</span>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="rounded-lg px-2.5 py-1 text-xs">
          <option value="all">{t("label.allcats")}</option>
          {categories.map(([k, th]) => (<option key={k} value={k}>{lang === "th" ? th : k}</option>))}
        </select>
        <span className="t-dim ml-1">{data.controls.length} {t("label.controls")}</span>
      </div>

      {/* Floating legend — bottom-left */}
      <div className="absolute bottom-4 left-4 z-10 mm-glass rounded-2xl p-3 text-[11px] space-y-1.5">
        <div className="t-dim uppercase text-[9px] tracking-widest mb-1">Legend</div>
        <Lg c="#818cf8" l="Root ITGR" />
        <Lg c="#c4b5fd" l={lang === "th" ? "หมวด (8)" : "category"} />
        <Lg c={STATUS_COLOR.comply}  l={`control · ${tFn(lang, "status.comply")}`} />
        <Lg c={STATUS_COLOR.partial} l={`control · ${tFn(lang, "status.partial")}`} />
        <Lg c={STATUS_COLOR.non}     l={`control · ${tFn(lang, "status.non")}`} />
        <Lg c={STATUS_COLOR.unset}   l={`control · ${tFn(lang, "status.unset")}`} />
      </div>

      {/* Helper tip — bottom-right */}
      {!selected && (
        <div className="absolute bottom-4 right-4 z-10 text-[11px] t-dim mm-glass rounded-xl px-3 py-2">
          {lang === "th" ? "💡 คลิก node ของ control เพื่อดูรายละเอียด" : "💡 click any control node to open detail"}
        </div>
      )}

      {/* Floating popup detail */}
      {selected && (
        <DetailPopup control={selected} lang={lang} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function FilterChips({ label, value, setValue, opts, colorize }: {
  label: string; value: string; setValue: (v: string) => void;
  opts: [string, string][]; colorize?: (v: string) => string | undefined;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-widest t-dim mr-0.5">{label}</span>
      <div className="flex gap-0.5 rounded-lg p-0.5" style={{ background: "var(--track-bg)" }}>
        {opts.map(([v, l]) => {
          const active = value === v;
          const c = colorize?.(v);
          return (
            <button key={v} onClick={() => setValue(v)}
              className={`px-2 py-1 text-[11px] rounded-md transition ${active ? "ring-1 ring-white/25" : "hover-bg t-muted"}`}
              style={active ? { background: c ? c + "22" : "var(--hover-bg)", color: c || undefined } : undefined}>
              {l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Lg({ c, l }: { c: string; l: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="marker" style={{ background: c, boxShadow: `0 0 8px ${c}88` }} />{l}
    </div>
  );
}

function DetailPopup({ control, lang, onClose }: { control: Control; lang: Lang; onClose: () => void }) {
  const t = useT(lang);
  const sc = STATUS_COLOR[control.verdict];
  const nameDisplay = lang === "th" && control.name_th ? control.name_th : control.name;
  const findingText = lang === "th" && control.finding_th ? control.finding_th : control.finding;
  const recText = lang === "th" && control.recommendation_th ? control.recommendation_th : control.recommendation;
  const riskColors: Record<string, string> = { "Very High": "#f43f5e", "High": "#f97316", "Middle": "#eab308", "Low": "#3b82f6" };
  const rc = riskColors[control.risk] || "#94a3b8";

  return (
    <div className="mm-popup absolute top-20 right-4 lg:right-6 z-20 mm-glass rounded-3xl flex flex-col"
      style={{ width: "min(440px, calc(100vw - 32px))", maxHeight: "calc(100vh - 140px)" }}>
      {/* Header — sticky */}
      <div className="p-5 pb-3 flex-shrink-0">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest t-dim">control detail</div>
            <div className="flex items-baseline gap-2 mt-1">
              <div className="text-3xl font-black tabular-nums" style={{ color: sc, textShadow: `0 0 16px ${sc}55` }}>#{control.no}</div>
            </div>
            <div className="font-bold text-base mt-1 leading-snug">{nameDisplay}</div>
            {lang === "th" && control.name_th && (
              <div className="text-[11px] t-dim mt-0.5">{control.name}</div>
            )}
          </div>
          <button onClick={onClose} className="px-2 py-1 rounded-lg hover-bg text-sm shrink-0" aria-label="close">✕</button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
            style={{ background: sc + "22", color: sc, border: `1px solid ${sc}66`, boxShadow: `0 0 12px ${sc}33` }}>
            {t("status." + control.verdict)}
          </span>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium border"
            style={{ borderColor: rc + "55", color: rc, background: rc + "18" }}>
            {t("risk." + control.risk)}
          </span>
          <span className="text-[11px] t-muted truncate">{lang === "th" ? control.category_short_th : control.category_short}</span>
          {control.article && <span className="text-[10px] t-faint">§{control.article}</span>}
        </div>
      </div>

      {/* Body — scrollable */}
      <div className="px-5 pb-5 space-y-2.5 overflow-y-auto text-sm">
        <PopupSection title={t("block.finding")} accent={sc}>
          {findingText || <span className="t-dim italic">{t("block.no_finding")}</span>}
        </PopupSection>

        <PopupSection title={t("block.rec")} accent="#a5b4fc">
          {recText || <span className="t-dim italic">{t("block.no_rec")}</span>}
        </PopupSection>

        <PopupSection title={`${t("label.evidence")} (${control.evidence_count})`}>
          <div className="text-[11px] mb-1.5">
            <span style={{ color: "#10b981" }}>{control.verified_count} {t("label.verified")}</span>
            <span className="t-dim mx-2">·</span>
            <span style={{ color: "#f59e0b" }}>{control.evidence_count - control.verified_count} {t("label.pending")}</span>
          </div>
          {control.evidence_samples.length === 0 ? (
            <div className="text-xs t-dim italic">{lang === "th" ? "ยังไม่มีหลักฐาน — ไปหน้า detail เพื่อเพิ่ม" : "no evidence yet — open detail to add"}</div>
          ) : (
            <ul className="space-y-1.5">
              {control.evidence_samples.map((s, i) => (
                <li key={i} className="flex items-center gap-2 text-xs">
                  <span className="marker" style={{ background: s.verified ? "#10b981" : "#f59e0b", boxShadow: `0 0 6px ${s.verified ? "#10b98155" : "#f59e0b55"}` }} />
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0"
                    style={{
                      color: s.kind === "legacy" ? "#22d3ee" : "#818cf8",
                      background: (s.kind === "legacy" ? "#22d3ee" : "#818cf8") + "22",
                    }}>{s.kind}</span>
                  {s.drive_url ? (
                    <a href={s.drive_url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                      {s.title || s.drive_url}
                    </a>
                  ) : (
                    <span className="truncate" style={{ color: "#f59e0b" }}>{s.title || "(no title)"} <span className="t-dim">· ⏳ no link</span></span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </PopupSection>

        <details>
          <summary className="text-[10px] uppercase tracking-widest t-dim cursor-pointer hover-bg rounded px-1 py-1">
            ▸ {t("block.question")} / {t("block.standard")}
          </summary>
          <div className="space-y-2 mt-2">
            <PopupSection title={t("block.question")}>{control.question}</PopupSection>
            <PopupSection title={t("block.standard")}>{control.standards}</PopupSection>
            {control.evidence_req && <PopupSection title={t("block.evidence_req")}>{control.evidence_req}</PopupSection>}
          </div>
        </details>

        <div className="pt-2">
          <Link href={`/controls/${control.no}`} className="block w-full text-center px-3 py-2 rounded-xl text-xs font-semibold"
            style={{ background: "linear-gradient(135deg, #818cf8, #6366f1)", color: "#fff", boxShadow: "0 6px 20px rgba(99,102,241,0.4)" }}>
            {t("checklist.open")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function PopupSection({ title, children, accent }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-xl p-2.5"
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
        border: "1px solid var(--glass-soft-border)",
        borderLeft: accent ? `3px solid ${accent}` : undefined,
      }}>
      <div className="text-[10px] uppercase tracking-widest t-dim mb-1">{title}</div>
      <div className="text-[13px] leading-relaxed whitespace-pre-wrap">{children}</div>
    </div>
  );
}
