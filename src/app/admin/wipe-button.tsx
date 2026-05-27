"use client";
import { useTransition } from "react";

export default function WipeReseedButton({ action }: { action: () => void | Promise<void> }) {
  const [pending, start] = useTransition();
  return (
    <form action={() => start(() => action())}
      onSubmit={(e) => {
        if (!confirm("⚠ ยืนยัน — ลบ controls + evidence ทั้งหมด แล้ว seed ใหม่?")) {
          e.preventDefault();
        }
      }}>
      <button type="submit" disabled={pending}
        className="px-3 py-2.5 rounded-xl text-xs font-medium glass-soft hover-bg disabled:opacity-50"
        style={{ color: "#f43f5e" }}
        title="ลบ controls ทั้งหมด + evidence ทั้งหมด (cascade) แล้ว seed ใหม่จาก data/audit_data.json">
        {pending ? "กำลังลบ + seed…" : "🗑 Wipe + reseed"}
      </button>
    </form>
  );
}
