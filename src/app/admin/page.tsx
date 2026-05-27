/**
 * /admin — admin-only page for system setup tasks.
 * Currently: seed the 96 ITGR controls + view user list.
 */
import { requireAdmin } from "@/lib/auth";
import { admin } from "@/lib/supabase/server";
import { seedControls, promoteUser, demoteUser } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const sb = admin();

  const { count: controlCount } = await sb.from("controls").select("*", { count: "exact", head: true });
  const { data: users } = await sb.from("profiles").select("id,email,display_name,role,created_at").order("created_at");

  return (
    <div className="max-w-4xl mx-auto mt-2 space-y-5">
      <div className="glass rounded-3xl p-5">
        <div className="text-[10px] uppercase tracking-widest t-dim">Admin · เฉพาะ role admin เท่านั้น</div>
        <div className="text-xl font-bold mt-1">ตั้งค่าระบบ</div>
        <div className="text-xs t-muted mt-0.5">คุณ ({me.email}) มีสิทธิ์ admin</div>
      </div>

      {sp.ok && <Banner kind="ok">{decodeURIComponent(sp.ok)}</Banner>}
      {sp.error && <Banner kind="err">{decodeURIComponent(sp.error)}</Banner>}

      {/* Seed controls */}
      <div className="glass rounded-3xl p-5 space-y-3">
        <div>
          <div className="text-sm font-semibold">96 ITGR Controls (catalogue seed)</div>
          <div className="text-[11px] t-dim mt-0.5">
            อ่านจาก <code>data/audit_data.json</code> (bundled กับ build) → upsert ลง controls table · safe to re-run (idempotent)
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-3xl font-black tabular-nums"
            style={{ color: controlCount === 96 ? "#10b981" : controlCount && controlCount > 0 ? "#f59e0b" : "#f43f5e" }}>
            {controlCount ?? 0}<span className="text-sm t-dim font-normal"> / 96</span>
          </div>
          <div className="flex-1">
            {controlCount === 96 && <div className="text-xs t-muted">✓ seed ครบแล้ว · กดเพื่อ re-sync ถ้าจำเป็น</div>}
            {(!controlCount || controlCount === 0) && <div className="text-xs" style={{ color: "#f43f5e" }}>⚠ ยังไม่มี controls — กดปุ่มทางขวาเพื่อ seed</div>}
            {controlCount != null && controlCount > 0 && controlCount < 96 && <div className="text-xs" style={{ color: "#f59e0b" }}>มีบางส่วน · กด seed เพื่อเติมให้ครบ</div>}
          </div>
          <form action={seedControls}>
            <button className="px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "#818cf8", color: "#fff" }}>
              Seed 96 controls
            </button>
          </form>
        </div>
      </div>

      {/* User list + role management */}
      <div className="glass rounded-3xl p-5 space-y-3">
        <div>
          <div className="text-sm font-semibold">ผู้ใช้ทั้งหมด ({users?.length ?? 0})</div>
          <div className="text-[11px] t-dim mt-0.5">promote/demote สิทธิ์ admin · คนแรกที่ลงทะเบียนเป็น admin อัตโนมัติ</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest t-dim">
              <tr className="border-b" style={{ borderColor: "var(--glass-border)" }}>
                <th className="text-left py-2 px-3">Email</th>
                <th className="text-left py-2 px-3">ชื่อ</th>
                <th className="text-left py-2 px-3 w-24">Role</th>
                <th className="text-left py-2 px-3 w-32">สมัครเมื่อ</th>
                <th className="text-right py-2 px-3 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map(u => (
                <tr key={u.id} className="border-b" style={{ borderColor: "var(--glass-soft-border)" }}>
                  <td className="py-2 px-3">{u.email}</td>
                  <td className="py-2 px-3 t-muted">{u.display_name || <span className="t-faint">—</span>}</td>
                  <td className="py-2 px-3">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        background: u.role === "admin" ? "#f59e0b22" : "#94a3b822",
                        color: u.role === "admin" ? "#f59e0b" : "#94a3b8",
                        border: `1px solid ${u.role === "admin" ? "#f59e0b55" : "#94a3b855"}`,
                      }}>{u.role}</span>
                  </td>
                  <td className="py-2 px-3 t-dim text-[11px]">{new Date(u.created_at).toLocaleDateString("th-TH")}</td>
                  <td className="py-2 px-3 text-right">
                    {u.id === me.id ? (
                      <span className="text-[10px] t-faint">(คุณ)</span>
                    ) : u.role === "admin" ? (
                      <form action={demoteUser} className="inline">
                        <input type="hidden" name="user_id" value={u.id} />
                        <button className="text-[10px] px-2 py-1 rounded glass-soft hover-bg t-dim">↓ demote</button>
                      </form>
                    ) : (
                      <form action={promoteUser} className="inline">
                        <input type="hidden" name="user_id" value={u.id} />
                        <button className="text-[10px] px-2 py-1 rounded glass-soft hover-bg" style={{ color: "#f59e0b" }}>↑ promote</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Banner({ kind, children }: { kind: "ok" | "err"; children: React.ReactNode }) {
  const color = kind === "ok" ? "#10b981" : "#f43f5e";
  return (
    <div className="text-xs px-3 py-2 rounded-lg"
      style={{ background: color + "18", color, border: `1px solid ${color}55` }}>{children}</div>
  );
}
