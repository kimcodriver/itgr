/**
 * Seed the 96 ITGR controls into Supabase from the bundled audit_data.json.
 * Idempotent: upsert on `no` — re-run safe.
 *
 * Usage:
 *   pnpm db:seed
 *   # ↳ runs: tsx --env-file=.env.local scripts/seed-controls.ts
 *
 * Env required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  console.error("→ ensure .env.local exists and run via `pnpm db:seed` (loads --env-file automatically)");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const here = dirname(fileURLToPath(import.meta.url));
const dataPath = resolve(here, "../data/audit_data.json");
const data = JSON.parse(readFileSync(dataPath, "utf-8")) as {
  records: Array<{
    no: number;
    cat: string;
    cat_th: string;
    cat_short: string;
    cat_short_th: string;
    name: string;
    name_th?: string;
    question: string;
    standards: string;
    evidence_req?: string;
    article?: string;
    risk: string;
    qtype?: string;
    note_file?: string;
  }>;
};

(async () => {
  const rows = data.records.map((r) => ({
    no: r.no,
    category: r.cat,
    category_short: r.cat_short,
    category_th: r.cat_th,
    category_short_th: r.cat_short_th,
    name: r.name,
    name_th: r.name_th ?? null,
    question: r.question,
    standards: r.standards,
    evidence_req: r.evidence_req ?? null,
    article: r.article ?? null,
    risk: r.risk,
    qtype: r.qtype ?? null,
    note_file: r.note_file ?? null,
  }));

  const { error } = await sb.from("controls").upsert(rows, { onConflict: "no", ignoreDuplicates: false });
  if (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
  const { count } = await sb.from("controls").select("*", { count: "exact", head: true });
  console.log(`Seeded controls. Row count: ${count}`);
})();
