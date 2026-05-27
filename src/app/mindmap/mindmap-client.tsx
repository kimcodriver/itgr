"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import Link from "next/link";

export type Control = {
  no: number;
  name: string;
  name_th: string | null;
  article: string | null;
  verdict: string;
  risk: string;
  category_short: string;
  category_short_th: string;
  finding_th: string | null;
  recommendation_th: string | null;
  evidence_count: number;
  verified_count: number;
  evidence_samples: { title: string | null; drive_url: string; verified: boolean; kind: string }[];
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
const STATUS_LABEL: Record<string, string> = {
  unset: "ยังไม่ตัดสิน", comply: "ผ่าน", partial: "ผ่านบางส่วน", non: "ไม่ผ่าน", na: "N/A",
};
const RISK_LABEL: Record<string, string> = { "Very High": "สูงมาก", "High": "สูง", "Middle": "ปานกลาง", "Low": "ต่ำ" };

export default function MindmapClient({ data }: { data: MindmapData }) {
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Control | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [catFilter, setCatFilter] = useState<string>("all");

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    data.controls.forEach(c => { if (!seen.has(c.category_short)) seen.set(c.category_short, c.category_short_th); });
    return Array.from(seen.entries());
  }, [data.controls]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";

    const nodes: Node[] = [];
    const links: Link[] = [];

    nodes.push({ id: "root", name: "Marubeni ITGR FY2025", group: "root", r: 28 });

    const catKeys = Array.from(new Set(data.controls.map(c => c.category_short))).sort();
    catKeys.forEach(k => {
      if (catFilter !== "all" && k !== catFilter) return;
      const sample = data.controls.find(c => c.category_short === k);
      nodes.push({ id: "cat:" + k, name: sample?.category_short_th ?? k, group: "category", r: 18 });
      links.push({ source: "root", target: "cat:" + k, type: "taxonomy" });
    });

    data.controls.forEach(c => {
      if (statusFilter !== "all" && c.verdict !== statusFilter) return;
      if (catFilter !== "all" && c.category_short !== catFilter) return;
      const id = "c:" + c.no;
      nodes.push({ id, name: `#${c.no} ${c.name_th || c.name}`, group: "control", r: 6, record: c } as ControlNode);
      links.push({ source: "cat:" + c.category_short, target: id, type: "control" });
    });

    const width = el.clientWidth || 1200;
    const height = 680;
    const svg = d3.select(el).append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%").attr("height", height);

    const styles = getComputedStyle(document.documentElement);
    const taxonomyStroke = styles.getPropertyValue("--text-dim").trim() || "rgba(255,255,255,0.32)";
    const linkStroke = styles.getPropertyValue("--text-faint").trim() || "rgba(255,255,255,0.22)";
    const labelFill = styles.getPropertyValue("--text").trim() || "#e6e8f5";

    const g = svg.append("g");
    svg.call(d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.3, 4]).on("zoom", (e) => g.attr("transform", e.transform)) as never);

    const colorOf = (n: Node) =>
      n.group === "root" ? "#818cf8" :
      n.group === "category" ? "#c4b5fd" :
      STATUS_COLOR[(n as ControlNode).record.verdict] || "#cbd5ff";

    const link = g.append("g").selectAll("line")
      .data(links).enter().append("line")
      .attr("stroke", l => l.type === "taxonomy" ? taxonomyStroke : linkStroke)
      .attr("stroke-width", l => l.type === "taxonomy" ? 1.6 : 1);

    type SimNode = Node & d3.SimulationNodeDatum;
    const node = g.append("g").selectAll<SVGGElement, SimNode>("g")
      .data(nodes as SimNode[]).enter().append("g");

    node.append("circle")
      .attr("r", n => n.r)
      .attr("fill", n => colorOf(n))
      .attr("fill-opacity", n => n.group === "root" ? 1 : n.group === "control" ? 0.88 : 0.65)
      .attr("stroke", n => colorOf(n))
      .attr("stroke-opacity", 0.85).attr("stroke-width", 1.5)
      .style("cursor", "pointer")
      .on("click", (_e, n) => { if (n.group === "control") setSelected((n as ControlNode).record); })
      .on("mouseover", function () { d3.select(this).attr("stroke-width", 3); })
      .on("mouseout", function () { d3.select(this).attr("stroke-width", 1.5); });

    node.append("title").text(n => n.name);

    node.filter(n => n.group === "root" || n.group === "category")
      .append("text")
      .attr("text-anchor", "middle").attr("dy", n => -(n.r + 6))
      .style("font-weight", "600").style("pointer-events", "none")
      .style("font-size", n => n.group === "root" ? "13px" : "11px")
      .style("fill", labelFill)
      .text(n => n.name.length > 32 ? n.name.slice(0, 30) + "…" : n.name);

    type SimLink = d3.SimulationLinkDatum<SimNode> & Link;
    const sim = d3.forceSimulation<SimNode>(nodes as SimNode[])
      .force("link", d3.forceLink<SimNode, SimLink>(links as never)
        .id(d => (d as Node).id)
        .distance(l => l.type === "taxonomy" ? 170 : 70))
      .force("charge", d3.forceManyBody<SimNode>().strength((n) => (n as Node).group === "root" ? -700 : (n as Node).group === "category" ? -280 : -55))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide<SimNode>(d => (d as Node).r + 4));

    sim.on("tick", () => {
      link
        .attr("x1", d => (d.source as unknown as SimNode).x ?? 0).attr("y1", d => (d.source as unknown as SimNode).y ?? 0)
        .attr("x2", d => (d.target as unknown as SimNode).x ?? 0).attr("y2", d => (d.target as unknown as SimNode).y ?? 0);
      node.attr("transform", d => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    const drag = d3.drag<SVGGElement, SimNode>()
      .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on("end", (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; });
    node.call(drag);
  }, [data, statusFilter, catFilter]);

  return (
    <div className="max-w-7xl mx-auto mt-2 space-y-4">
      <div className="glass rounded-3xl p-5">
        <div className="flex flex-col xl:flex-row items-start xl:items-center gap-3 mb-3">
          <div>
            <div className="text-base font-bold grad-text">Audit Mindmap</div>
            <div className="text-[11px] t-dim">force-directed · ลากเพื่อจัดตำแหน่ง · scroll เพื่อ zoom · คลิก control เพื่อดูรายละเอียด</div>
          </div>
          <div className="xl:ml-auto flex items-center gap-2 flex-wrap">
            <FilterGroup label="สถานะ" value={statusFilter} setValue={setStatusFilter}
              opts={[["all", "ทั้งหมด"], ["comply", "ผ่าน"], ["partial", "ผ่านบางส่วน"], ["non", "ไม่ผ่าน"], ["unset", "ยังไม่ตัดสิน"]]} />
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
              className="rounded-xl px-3 py-1.5 text-xs glass-soft">
              <option value="all">ทุกหมวด</option>
              {categories.map(([k, th]) => (<option key={k} value={k}>{th}</option>))}
            </select>
          </div>
        </div>
        <div className="glass-soft rounded-2xl p-1 relative overflow-hidden">
          <div ref={ref} className="w-full" style={{ height: 680 }} />
          <div className="absolute left-3 top-3 glass-soft rounded-2xl p-3 text-[11px] space-y-1.5">
            <div className="t-dim uppercase text-[9px] tracking-widest mb-1">Legend</div>
            <Lg c="#818cf8" l="Root (ITGR)" />
            <Lg c="#c4b5fd" l="หมวด (8)" />
            <Lg c={STATUS_COLOR.comply}  l="control · ผ่าน" />
            <Lg c={STATUS_COLOR.partial} l="control · ผ่านบางส่วน" />
            <Lg c={STATUS_COLOR.non}     l="control · ไม่ผ่าน" />
            <Lg c={STATUS_COLOR.unset}   l="control · ยังไม่ตัดสิน" />
          </div>
        </div>
      </div>

      <DetailDrawer control={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function FilterGroup({ label, value, setValue, opts }: { label: string; value: string; setValue: (v: string) => void; opts: [string, string][] }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="text-[10px] uppercase tracking-widest t-dim mr-1">{label}</div>
      <div className="glass-soft rounded-xl p-1 flex gap-0.5">
        {opts.map(([v, l]) => (
          <button key={v} onClick={() => setValue(v)}
            className={`px-2.5 py-1 text-[11px] rounded-lg ${value === v ? "ring-1 ring-white/20" : "hover-bg t-muted"}`}
            style={value === v ? { background: "var(--hover-bg)" } : undefined}>{l}</button>
        ))}
      </div>
    </div>
  );
}

function Lg({ c, l }: { c: string; l: string }) {
  return (<div className="flex items-center gap-2"><span className="marker" style={{ background: c }} />{l}</div>);
}

function DetailDrawer({ control, onClose }: { control: Control | null; onClose: () => void }) {
  if (!control) {
    return (
      <div className="glass rounded-3xl p-5">
        <div className="text-[10px] uppercase tracking-widest t-dim">รายละเอียด control</div>
        <div className="text-sm t-muted mt-1">คลิก control node ใน graph เพื่อดูรายละเอียดที่นี่</div>
      </div>
    );
  }
  const sc = STATUS_COLOR[control.verdict];
  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest t-dim">รายละเอียด control</div>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <div className="text-2xl font-black tabular-nums t-dim">#{control.no}</div>
            <div className="text-lg font-bold grad-text">{control.name_th || control.name}</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-1.5">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
              style={{ background: sc + "22", color: sc, border: `1px solid ${sc}55` }}>{STATUS_LABEL[control.verdict]}</span>
            <span className="text-[11px] t-muted">{control.category_short_th}</span>
            <span className="text-[11px] t-dim">· ความเสี่ยง: {RISK_LABEL[control.risk] || control.risk}</span>
            {control.article && <span className="text-[10px] t-faint">· §{control.article}</span>}
          </div>
        </div>
        <button onClick={onClose} className="px-2.5 py-1 text-xs rounded-lg glass-soft hover-bg shrink-0">✕</button>
      </div>
      <div className="grid md:grid-cols-2 gap-3 text-sm">
        <div className="glass-soft rounded-xl p-3">
          <div className="text-[10px] uppercase tracking-widest t-dim mb-1">ข้อตรวจพบ</div>
          <div className="whitespace-pre-wrap leading-relaxed">{control.finding_th || <span className="t-dim">ยังไม่มี finding · audit lead ยังไม่ได้บันทึก</span>}</div>
        </div>
        <div className="glass-soft rounded-xl p-3">
          <div className="text-[10px] uppercase tracking-widest t-dim mb-1">คำแนะนำ</div>
          <div className="whitespace-pre-wrap leading-relaxed">{control.recommendation_th || <span className="t-dim">ยังไม่มี recommendation</span>}</div>
        </div>
      </div>
      <div className="glass-soft rounded-xl p-3 mt-3">
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-[10px] uppercase tracking-widest t-dim">หลักฐาน ({control.evidence_count})</div>
          <div className="text-[11px]">
            <span style={{ color: "#10b981" }}>{control.verified_count} verified</span>
            <span className="t-dim"> · </span>
            <span style={{ color: "#f59e0b" }}>{control.evidence_count - control.verified_count} pending</span>
          </div>
        </div>
        {control.evidence_samples.length === 0 ? (
          <div className="text-xs t-dim">ยังไม่มีหลักฐาน — ไปหน้า detail เพื่อเพิ่ม link Drive</div>
        ) : (
          <ul className="space-y-1">
            {control.evidence_samples.map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <span className="marker" style={{ background: s.verified ? "#10b981" : "#f59e0b" }} />
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                  style={{
                    color: s.kind === "legacy" ? "#22d3ee" : "#818cf8",
                    background: (s.kind === "legacy" ? "#22d3ee" : "#818cf8") + "22",
                  }}>{s.kind}</span>
                <a href={s.drive_url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                  {s.title || s.drive_url}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-3 text-right">
        <Link href={`/controls/${control.no}`} className="text-xs px-3 py-1.5 rounded-lg glass-soft hover-bg inline-block">
          เปิดหน้า detail แบบเต็ม →
        </Link>
      </div>
    </div>
  );
}
