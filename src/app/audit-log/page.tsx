/**
 * /audit-log — immutable event ledger viewer. Open access.
 */
import { admin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  "evidence.submit":      "เพิ่มหลักฐาน",
  "evidence.edit":        "แก้ไขหลักฐาน",
  "evidence.archive":     "ลบหลักฐาน",
  "evidence.verify":      "✓ ผ่านหลักฐาน",
  "evidence.reject":      "✗ ปฏิเสธหลักฐาน",
  "verdict.change":       "เปลี่ยนสถานะ control",
  "control.assign":       "มอบหมาย control",
  "snapshot.create":      "ทำ snapshot",
  "self.review":          "ทบทวน (รายไตรมาส)",
};

export default async function AuditLog({ searchParams }: { searchParams: Promise<{ action?: string; actor?: string }> }) {
  const sp = await searchParams;
  let q = admin().from("audit_log").select("*").order("ts", { ascending: false }).limit(500);
  if (sp.action) q = q.eq("action", sp.action);
  if (sp.actor)  q = q.eq("actor_email", sp.actor);
  const { data } = await q;

  return (
    <div className="max-w-7xl mx-auto mt-2 space-y-4">
      <div className="glass rounded-3xl p-5">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-base font-bold">Audit Log</div>
            <div className="text-[11px] t-dim">บันทึกเหตุการณ์แบบ append-only — 500 รายการล่าสุด · ผู้กระทำมาจาก cookie "Acting as" + IP/UA</div>
          </div>
          <div className="text-xs t-muted">{data?.length ?? 0} events</div>
        </div>
      </div>

      <div className="glass rounded-3xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-widest t-dim">
            <tr className="border-b" style={{ borderColor: "var(--glass-border)" }}>
              <th className="text-left py-2 px-3 w-40">เวลา</th>
              <th className="text-left py-2 px-3">ผู้ทำ</th>
              <th className="text-left py-2 px-3">เหตุการณ์</th>
              <th className="text-left py-2 px-3">เป้าหมาย</th>
              <th className="text-left py-2 px-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map(r => (
              <tr key={r.id} className="border-b" style={{ borderColor: "var(--glass-soft-border)" }}>
                <td className="py-1.5 px-3 tabular-nums t-muted">{new Date(r.ts).toLocaleString("th-TH")}</td>
                <td className="py-1.5 px-3">{r.actor_email || <span className="t-faint">ไม่ระบุ</span>}</td>
                <td className="py-1.5 px-3">
                  <span className="font-medium">{ACTION_LABEL[r.action] || r.action}</span>
                  <span className="t-dim ml-1 text-[10px]">{r.action}</span>
                </td>
                <td className="py-1.5 px-3 t-muted">
                  {r.target_kind && <span>{r.target_kind}#{r.target_id}</span>}
                </td>
                <td className="py-1.5 px-3 t-dim text-[10px]">{r.request_ip || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(data ?? []).length === 0 && <div className="p-8 text-center t-dim text-sm">ยังไม่มีเหตุการณ์</div>}
      </div>
    </div>
  );
}
