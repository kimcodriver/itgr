/**
 * /controls/[no] — per-control detail. Open access.
 *   - Verbatim Question + Standard (from controls)
 *   - Evidence link list (legacy + new)
 *   - Submit-new-evidence form (everyone)
 *   - Verdict editor (everyone — gated by "must have verified evidence" guard)
 *
 * Self-audit: per-action defensibility lives in actions.ts (evidence guard).
 * Attribution comes from the "Acting as" cookie (see src/lib/actor.ts).
 */
import { admin } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { submitEvidence, archiveEvidence, verifyEvidence, rejectEvidence, setVerdict, attachEvidenceUrl } from "./actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ControlDetail({ params }: { params: Promise<{ no: string }> }) {
  await requireUser();
  const { no } = await params;
  const n = parseInt(no, 10);
  if (!Number.isFinite(n)) notFound();

  const sb = admin();
  const { data: c } = await sb.from("controls").select("*").eq("no", n).maybeSingle();
  if (!c) notFound();

  const { data: evid } = await sb.from("evidence_links")
    .select("*")
    .eq("control_no", n)
    .is("archived_at", null)
    .order("submitted_at", { ascending: false });

  const { data: history } = await sb.from("v_verdict_history")
    .select("*").eq("control_no", n).order("ts", { ascending: false }).limit(10);

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
          {(evid ?? []).map(e => {
            const isPending = !e.drive_url;
            const isSeeded = e.submitted_by === "system";
            return (
              <div key={e.id} className="glass-soft rounded-xl p-3 flex items-start gap-3"
                style={isPending ? { borderLeft: "3px solid #f59e0b" } : undefined}>
                <span className="marker mt-1.5 shrink-0"
                  style={{ background: e.verified_at ? "#10b981" : e.rejected_at ? "#f43f5e" : isPending ? "#94a3b8" : "#f59e0b" }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold"
                      style={{ background: e.kind === "legacy" ? "#22d3ee22" : "#818cf822",
                               color: e.kind === "legacy" ? "#22d3ee" : "#818cf8",
                               border: `1px solid ${e.kind === "legacy" ? "#22d3ee55" : "#818cf855"}` }}>
                      {e.kind === "legacy" ? "LEGACY" : "FY2026 NEW"}
                    </span>
                    {isSeeded && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold"
                        style={{ background: "#94a3b822", color: "#94a3b8", border: "1px solid #94a3b855" }}>TEMPLATE</span>
                    )}
                    {isPending ? (
                      <span className="font-medium truncate" style={{ color: "#f59e0b" }}>{e.title}</span>
                    ) : (
                      <a href={e.drive_url!} target="_blank" rel="noopener noreferrer" className="font-medium truncate hover:underline">
                        {e.title || e.drive_url}
                      </a>
                    )}
                  </div>
                  {e.note && <div className="text-xs t-muted mt-1 whitespace-pre-wrap">{e.note}</div>}
                  {isPending && (
                    <form action={attachEvidenceUrl} className="mt-2 flex gap-1.5">
                      <input type="hidden" name="id" value={e.id} />
                      <input name="drive_url" type="url" required placeholder="https://drive.google.com/..."
                        pattern="https?://(drive|docs|sheets)\.google\.com/.*"
                        className="flex-1 px-2.5 py-1 rounded-lg glass-soft text-xs" />
                      <button className="text-[10px] px-2.5 py-1 rounded font-semibold" style={{ background: "#22d3ee", color: "#003a4a" }}>📎 แนบ link</button>
                    </form>
                  )}
                  <div className="text-[10px] t-dim mt-1">
                    ส่งโดย {e.submitted_by || "ไม่ระบุ"} · {new Date(e.submitted_at).toLocaleString("th-TH")}
                    {e.verified_at && <> · ✓ ผ่านโดย {e.verified_by || "ไม่ระบุ"} · {new Date(e.verified_at).toLocaleString("th-TH")}</>}
                    {e.rejected_at && <> · ✗ ปฏิเสธ: {e.rejected_reason}</>}
                  </div>
                </div>
                {!e.verified_at && !e.rejected_at && !isPending && (
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
                <form action={archiveEvidence}>
                  <input type="hidden" name="id" value={e.id} />
                  <button className="text-[10px] px-2 py-1 rounded glass-soft hover-bg t-dim">ลบ</button>
                </form>
              </div>
            );
          })}
        </div>

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
      </div>

      {/* Verdict editor */}
      <div className="glass rounded-3xl p-5">
        <div className="text-sm font-semibold mb-2">ผลการตรวจ</div>
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
          <div className="text-[11px] t-dim">
            ⓘ ห้าม set <code>comply</code> หรือ <code>partial</code> ถ้ายังไม่มีหลักฐานที่ verified อย่างน้อย 1 รายการ
          </div>
          <button className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "#10b981", color: "#062a1c" }}>บันทึก</button>
        </form>
      </div>

      {(history ?? []).length > 0 && (
        <div className="glass rounded-3xl p-5">
          <div className="text-sm font-semibold mb-2">ประวัติการเปลี่ยนสถานะ</div>
          <ul className="space-y-1 text-xs t-muted">
            {history!.map(h => (
              <li key={h.id} className="flex items-center gap-2">
                <code className="text-[10px]">{new Date(h.ts).toLocaleString("th-TH")}</code>
                <span>{h.old_verdict || "—"} → <b>{h.new_verdict}</b></span>
                <span className="t-dim">โดย {h.actor_email || "ไม่ระบุ"}</span>
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
