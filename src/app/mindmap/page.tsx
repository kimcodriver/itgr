/**
 * /mindmap — D3 force-directed graph, full-screen with floating detail popup.
 */
import { admin } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { getPrefs } from "@/lib/prefs";
import MindmapClient, { type MindmapData } from "./mindmap-client";

export const dynamic = "force-dynamic";

export default async function MindmapPage() {
  await requireUser();
  const { lang } = await getPrefs();
  const sb = admin();

  const { data: controls } = await sb
    .from("controls")
    .select("no,name,name_th,verdict,risk,category_short,category_short_th,question,standards,evidence_req,finding,finding_th,recommendation,recommendation_th,article")
    .order("no");

  const { data: evid } = await sb.from("evidence_links")
    .select("control_no,verified_at,archived_at,kind,title,drive_url");

  const evidByControl = new Map<number, {
    total: number; verified: number;
    samples: { title: string | null; drive_url: string | null; verified: boolean; kind: string }[];
  }>();
  for (const e of evid ?? []) {
    if (e.archived_at) continue;
    const r = evidByControl.get(e.control_no) ?? { total: 0, verified: 0, samples: [] };
    r.total++;
    if (e.verified_at) r.verified++;
    if (r.samples.length < 8) r.samples.push({ title: e.title, drive_url: e.drive_url, verified: !!e.verified_at, kind: e.kind });
    evidByControl.set(e.control_no, r);
  }

  const data: MindmapData = {
    controls: (controls ?? []).map(c => ({
      no: c.no,
      name: c.name, name_th: c.name_th, article: c.article,
      verdict: c.verdict, risk: c.risk,
      category_short: c.category_short, category_short_th: c.category_short_th,
      question: c.question, standards: c.standards, evidence_req: c.evidence_req,
      finding: c.finding, finding_th: c.finding_th,
      recommendation: c.recommendation, recommendation_th: c.recommendation_th,
      evidence_count: evidByControl.get(c.no)?.total ?? 0,
      verified_count: evidByControl.get(c.no)?.verified ?? 0,
      evidence_samples: evidByControl.get(c.no)?.samples ?? [],
    })),
  };

  // Break out of the parent <main className="px-4 pb-12"> so we get full bleed
  return (
    <div style={{ marginLeft: "-1rem", marginRight: "-1rem", marginTop: "-0.5rem", marginBottom: "-3rem" }}>
      <MindmapClient data={data} lang={lang} />
    </div>
  );
}
