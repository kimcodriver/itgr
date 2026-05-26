/**
 * /controls/[no] — per-control detail.
 *   - Verbatim Question + Standard (from controls)
 *   - Evidence link list (legacy + new)
 *   - Submit-new-evidence form (it_engineer, audit_lead)
 *   - Verdict editor (audit_lead only)
 */
import { requireUser } from "@/lib/auth";
import { rsc, admin } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { submitEvidence, archiveEvidence, verifyEvidence, rejectEvidence, setVerdict } from "./actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ControlDetail({ params }: { params: Promise<{ no: string }> }) {
  const user = await requireUser();
  const { no } = await params;
  const n = parseInt(no, 10);
  if (!Number.isFinite(n)) notFound();

  const sb = await rsc();
  const { data: c } = await sb.from("controls").select("*").eq("no", n).maybeSingle();
  if (!c) notFound();

  // Evidence + submitter info
  const { data: evid } = await admin().from("evidence_links")
    .select("*, submitter:profiles!evidence_links_submitted_by_fkey(display_name,email), verifier:profiles!evidence_links_verified_by_fkey(display_name,email)")
    .eq("control_no", n)
    .is("archived_at", null)
    .order("submitted_at", { ascending: false });

  // Verdict history
  const { data: history } = await sb.from("v_verdict_history").select("*").eq("control_no", n).order("ts", { ascending: false }).limit(10);

  const canVerdict = user.role === "audit_lead";
  const canVerify  = user.role === "audit_lead";
  const canSubmit  = user.role === "audit_lead" || user.role === "it_engineer";

  return (
    <div className="max-w-5xl mx-auto mt-2 space-y-4">
      <div className="glass rounded-3xl p-5">
        <Link href="/controls" className="text-xs t-muted hover-bg px-2 py-1 rounded-md">← Controls</Link>
        <div className="flex items-baseline gap-3 mt-2 flex-wrap">
          <div className="text-3xl font-black tabular-nums t-dim">#{c.no}</div>
          <div className="text-xl font-bold">{c.name_th || c.name}</div>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
          <span className="t-dim">{c.name}</span>
          <span className="t-dim">· {c.category_short_th}</span>
          {c.article && <span className="t-dim">· §{c.article}</span>}
          <span className="t-dim">· ความเสี่ยง: {c.risk}</span>
        </div>
      </div>

      <Section title="คำถาม (verbatim จาก Marubeni ITGR)">{c.question}</Section>
      <Section title="มาตรฐานที่ใช้ตัดสินว่าได้ดำเนินการแล้ว">{c.standards}</Section>
      {c.evidence_req && <Section title="หลักฐานยืนยันที่กำหนดโดย ITGR">{c.evidence_req}</Section>}

      {/* Evidence list */}
      <div className="glass rounded-3xl p-5">
        <div className="text-sm font-semibold mb-3">หลักฐาน ({(evid ?? []).length})</div>
        {(evid ?? []).length === 0 && (
          <div className="text-sm t-dim">ยังไม่มีหลักฐานสำหรับ control นี้ — กดเพิ่ม link Google Drive ด้านล่าง</div>
        )}
        <div className="space-y-2">
          {(evid ?? []).map(e => (
            <div key={e.id} className="glass-soft rounded-xl p-3 flex items-start gap-3">
              <span className="marker mt-1.5 shrink-0"
                style={{ background: e.verified_at ? "#10b981" : e.rejected_at ? "#f43f5e" : "#f59e0b" }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold"
                    style={{ background: e.kind === "legacy" ? "#22d3ee22" : "#818cf822",
                             color: e.kind === "legacy" ? "#22d3ee" : "#818cf8",
                             border: `1px solid ${e.kind === "legacy" ? "#22d3ee55" : "#818cf855"}` }}>
                    {e.kind === "legacy" ? "LEGACY" : "FY2026 NEW"}
                  </span>
                  <a href={e.drive_url} target="_blank" rel="noopener noreferrer" className="font-medium truncate hover:underline">
                    {e.title || e.drive_url}
                  </a>
                </div>
                {e.note && <div className="text-xs t-muted mt-1 whitespace-pre-wrap">{e.note}</div>}
                <div className="text-[10px] t-dim mt-1">
                  ส่งโดย {e.submitter?.display_name || e.submitter?.email || "?"} · {new Date(e.submitted_at).toLocaleString("th-TH")}
                  {e.verified_at && <> · ✓ ผ่านโดย {e.verifier?.display_name || e.verifier?.email} · {new Date(e.verified_at).toLocaleString("th-TH")}</>}
                  {e.rejected_at && <> · ✗ ปฏิเสธ: {e.rejected_reason}</>}
                </div>
              </div>
              {canVerify && !e.verified_at && !e.rejected_at && (
                <div className="flex flex-col gap-1 shrink-0">
                  <form action={verifyEvidence}>
                    <input type="hidden" name="id" value={e.id} />
                    <button className="text-[10px] px-2 py-1 rounded glass-soft hover-bg" style={{ color: "#10b981" }}>✓ ผ่าน</button>
                  </form>
                  <form action={rejectEvidence}>
                    <input type="hidden" name="id" value={e.id} />
                    <button className="text-[10px] px-2 py-1 rounded glass-soft hover-bg" style={{ color: "#f43f5e" }}>✗ ปฏิเสธ</button>
                  </form>
                </div>
              )}
              {(e.submitted_by === user.id && !e.verified_at) && (
                <form action={archiveEvidence}>
                  <input type="hidden" name="id" value={e.id} />
                  <button className="text-[10px] px-2 py-1 rounded glass-soft hover-bg t-dim">ลบ</button>
                </form>
              )}
            </div>
          ))}
        </div>

        {canSubmit && (
          <form action={submitEvidence} className="glass-soft rounded-xl p-4 mt-4 space-y-3">
            <input type="hidden" name="control_no" value={c.no} />
            <div className="text-xs font-semibold">เพิ่ม link หลักฐาน</div>
            <div className="flex gap-2 text-xs">
              <label className="flex items-center gap-1.5"><input type="radio" name="kind" value="legacy" /> Legacy</label>
              <label className="flex items-center gap-1.5"><input type="radio" name="kind" value="new" defaultChecked /> FY2026 New</label>
            </div>
            <input name="drive_url" type="url" required placeholder="https://drive.google.com/..."
              pattern="https?://(drive|docs|sheets)\.google\.com/.*"
              className="w-full px-3 py-2 rounded-lg glass-soft text-sm" />
            <input name="title" type="text" placeholder="ชื่อย่อหลักฐาน (เช่น 'IT Security Policy v2.1')"
              className="w-full px-3 py-2 rounded-lg glass-soft text-sm" />
            <textarea name="note" maxLength={500} rows={2} placeholder="คำอธิบาย (≤ 500 ตัวอักษร) — บอกว่าหลักฐานนี้แสดงอะไร"
              className="w-full px-3 py-2 rounded-lg glass-soft text-sm" />
            <button className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "#818cf8", color: "#fff" }}>เพิ่ม</button>
          </form>
        )}
      </div>

      {/* Verdict editor */}
      <div className="glass rounded-3xl p-5">
        <div className="text-sm font-semibold mb-2">ผลการตรวจ (Audit Lead)</div>
        {canVerdict ? (
          <form action={setVerdict} className="space-y-3">
            <input type="hidden" name="control_no" value={c.no} />
            <div className="flex gap-2 flex-wrap">
              {(["comply", "partial", "non", "na"] as const).map(v => (
                <label key={v} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg glass-soft cursor-pointer">
                  <input type="radio" name="verdict" value={v} defaultChecked={c.verdict === v} />
                  {v}
                </label>
              ))}
            </div>
            <textarea name="finding_th" rows={3} defaultValue={c.finding_th || ""}
              placeholder="ข้อตรวจพบ (ภาษาไทย)" className="w-full px-3 py-2 rounded-lg glass-soft text-sm" />
            <textarea name="recommendation_th" rows={2} defaultValue={c.recommendation_th || ""}
              placeholder="คำแนะนำ (ภาษาไทย)" className="w-full px-3 py-2 rounded-lg glass-soft text-sm" />
            <button className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "#10b981", color: "#062a1c" }}>บันทึก</button>
          </form>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="t-dim text-xs">สถานะปัจจุบัน:</div>
            <div className="font-semibold">{c.verdict}</div>
            {c.finding_th && <div className="t-muted whitespace-pre-wrap text-xs">{c.finding_th}</div>}
            {c.recommendation_th && <div className="t-muted whitespace-pre-wrap text-xs"><span className="t-dim">คำแนะนำ:</span> {c.recommendation_th}</div>}
          </div>
        )}
      </div>

      {(history ?? []).length > 0 && (
        <div className="glass rounded-3xl p-5">
          <div className="text-sm font-semibold mb-2">ประวัติการเปลี่ยนสถานะ</div>
          <ul className="space-y-1 text-xs t-muted">
            {history!.map(h => (
              <li key={h.id} className="flex items-center gap-2">
                <code className="text-[10px]">{new Date(h.ts).toLocaleString("th-TH")}</code>
                <span>{h.old_verdict || "—"} → <b>{h.new_verdict}</b></span>
                <span className="t-dim">โดย {h.actor_email}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-soft rounded-2xl p-4">
      <div className="text-[10px] uppercase tracking-widest t-dim mb-1">{title}</div>
      <div className="text-sm whitespace-pre-wrap leading-relaxed">{children}</div>
    </div>
  );
}
