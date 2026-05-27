/**
 * /mindmap — D3 force-directed graph of the audit.
 * Root → 8 categories → 96 controls, color-coded by verdict.
 * Click a control node to see its detail in the side panel.
 */
import { admin } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import MindmapClient, { type MindmapData } from "./mindmap-client";

export const dynamic = "force-dynamic";

export default async function MindmapPage() {
  await requireUser();
  const sb = admin();

  const { data: controls } = await sb
    .from("controls")
    .select("no,name,name_th,verdict,risk,category_short,category_short_th,finding_th,recommendation_th,article")
    .order("no");

  const { data: evid } = await sb.from("evidence_links")
    .select("control_no,verified_at,archived_at,kind,title,drive_url");

  const evidByControl = new Map<number, { total: number; verified: number; samples: { title: string | null; drive_url: string; verified: boolean; kind: string }[] }>();
  for (const e of evid ?? []) {
    if (e.archived_at) continue;
    const r = evidByControl.get(e.control_no) ?? { total: 0, verified: 0, samples: [] };
    r.total++;
    if (e.verified_at) r.verified++;
    if (r.samples.length < 5) r.samples.push({ title: e.title, drive_url: e.drive_url, verified: !!e.verified_at, kind: e.kind });
    evidByControl.set(e.control_no, r);
  }

  const data: MindmapData = {
    controls: (controls ?? []).map(c => ({
      no: c.no,
      name: c.name, name_th: c.name_th, article: c.article,
      verdict: c.verdict, risk: c.risk,
      category_short: c.category_short, category_short_th: c.category_short_th,
      finding_th: c.finding_th, recommendation_th: c.recommendation_th,
      evidence_count: evidByControl.get(c.no)?.total ?? 0,
      verified_count: evidByControl.get(c.no)?.verified ?? 0,
      evidence_samples: evidByControl.get(c.no)?.samples ?? [],
    })),
  };

  return <MindmapClient data={data} />;
}
