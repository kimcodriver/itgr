"use client";
/**
 * Error boundary for /controls/[no] route — catches anything that slips past
 * the safeRun() wrapper in actions.ts and shows a friendly message + retry.
 */
import { useEffect } from "react";

export default function ControlError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[/controls/[no]] runtime error:", error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto mt-12">
      <div className="glass rounded-3xl p-8 space-y-4 text-center">
        <div className="text-4xl">⚠️</div>
        <div className="text-lg font-bold">หน้านี้โหลดไม่ได้</div>
        <div className="text-sm t-muted whitespace-pre-wrap break-words">{error.message || "Unknown error"}</div>
        {error.digest && (
          <div className="text-[10px] t-dim font-mono">digest: {error.digest}</div>
        )}
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={reset}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "#818cf8", color: "#fff" }}>
            ลองอีกครั้ง
          </button>
          <a href="/controls" className="px-4 py-2 rounded-xl text-sm glass-soft hover-bg">← Controls</a>
        </div>
      </div>
    </div>
  );
}
