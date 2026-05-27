import type { Lang } from "@/lib/prefs";

type Dict = Record<string, string>;

const TH: Dict = {
  "nav.dashboard": "แดชบอร์ด",
  "nav.checklist": "Checklist",
  "nav.mindmap":   "Mindmap",
  "nav.auditlog":  "Audit Log",
  "nav.admin":     "Admin",
  "nav.signin":    "เข้าสู่ระบบ",
  "nav.signup":    "ลงทะเบียน",
  "nav.signout":   "ออก",
  "theme.label":   "ธีม",
  "theme.light":   "สว่าง",
  "theme.dark":    "มืด",
  "theme.system":  "ตามระบบ",
  "lang.label":    "ภาษา",
  "footer":        "Internal use only · Confidential",

  "status.unset":   "ยังไม่ตัดสิน",
  "status.comply":  "ผ่าน",
  "status.partial": "ผ่านบางส่วน",
  "status.non":     "ไม่ผ่าน",
  "status.na":      "N/A",
  "risk.Very High": "สูงมาก",
  "risk.High":      "สูง",
  "risk.Middle":    "ปานกลาง",
  "risk.Low":       "ต่ำ",

  "label.all":         "ทั้งหมด",
  "label.allcats":     "ทุกหมวด",
  "label.status":      "สถานะ",
  "label.risk":        "ความเสี่ยง",
  "label.category":    "หมวด",
  "label.evidence":    "หลักฐาน",
  "label.controls":    "controls",
  "label.cat":         "หมวด",
  "label.verified":    "verified",
  "label.pending":     "pending",

  "checklist.title":   "Checklist รายหมวด",
  "checklist.expand":  "ดูรายละเอียด ▾",
  "checklist.collapse":"ย่อ ▴",
  "checklist.open":    "เปิดหน้า detail แบบเต็ม →",
  "checklist.in_view": "ในมุมมอง",
  "checklist.empty":   "ยังไม่มี controls — กรุณา seed ที่หน้า Admin",

  "block.question":    "คำถาม (verbatim จาก Marubeni ITGR)",
  "block.standard":    "มาตรฐานที่ใช้ตัดสินว่าได้ดำเนินการแล้ว",
  "block.evidence_req":"หลักฐานยืนยันที่กำหนดโดย ITGR",
  "block.finding":     "ข้อตรวจพบ",
  "block.rec":         "คำแนะนำ",
  "block.no_finding":  "ยังไม่มี finding — audit lead ยังไม่ได้บันทึก",
  "block.no_rec":      "ยังไม่มี recommendation",

  "kpi.score":         "คะแนนการปฏิบัติตาม",
  "kpi.comply":        "ผ่านมาตรฐาน",
  "kpi.partial":       "ผ่านบางส่วน",
  "kpi.non":           "ไม่ผ่าน",
  "kpi.covered":       "มีหลักฐานยืนยัน",
  "kpi.of_controls":   "% ของ controls",

  "ev.legacy":         "LEGACY",
  "ev.new":            "FY2026 NEW",
  "ev.template":       "TEMPLATE",
};

const EN: Dict = {
  "nav.dashboard": "Dashboard",
  "nav.checklist": "Checklist",
  "nav.mindmap":   "Mindmap",
  "nav.auditlog":  "Audit Log",
  "nav.admin":     "Admin",
  "nav.signin":    "Sign in",
  "nav.signup":    "Register",
  "nav.signout":   "Sign out",
  "theme.label":   "Theme",
  "theme.light":   "Light",
  "theme.dark":    "Dark",
  "theme.system":  "System",
  "lang.label":    "Language",
  "footer":        "Internal use only · Confidential",

  "status.unset":   "Unset",
  "status.comply":  "Comply",
  "status.partial": "Partial",
  "status.non":     "Non-Comply",
  "status.na":      "N/A",
  "risk.Very High": "Very High",
  "risk.High":      "High",
  "risk.Middle":    "Middle",
  "risk.Low":       "Low",

  "label.all":         "All",
  "label.allcats":     "All categories",
  "label.status":      "Status",
  "label.risk":        "Risk",
  "label.category":    "Category",
  "label.evidence":    "Evidence",
  "label.controls":    "controls",
  "label.cat":         "Cat.",
  "label.verified":    "verified",
  "label.pending":     "pending",

  "checklist.title":   "Checklist by category",
  "checklist.expand":  "Expand ▾",
  "checklist.collapse":"Collapse ▴",
  "checklist.open":    "Open full detail →",
  "checklist.in_view": "in view",
  "checklist.empty":   "No controls yet — please seed via Admin page",

  "block.question":    "Question (verbatim from Marubeni ITGR)",
  "block.standard":    "Standard to determine implementation",
  "block.evidence_req":"Confirmation evidence (required by ITGR)",
  "block.finding":     "Auditor Finding",
  "block.rec":         "Recommendation",
  "block.no_finding":  "No finding yet — audit lead has not recorded one",
  "block.no_rec":      "No recommendation yet",

  "kpi.score":         "Compliance score",
  "kpi.comply":        "Comply",
  "kpi.partial":       "Partial",
  "kpi.non":           "Non-Comply",
  "kpi.covered":       "Verified evidence",
  "kpi.of_controls":   "% of controls",

  "ev.legacy":         "LEGACY",
  "ev.new":            "FY2026 NEW",
  "ev.template":       "TEMPLATE",
};

const DICTS: Record<Lang, Dict> = { th: TH, en: EN };

export function t(lang: Lang, key: string): string {
  return DICTS[lang][key] ?? DICTS.th[key] ?? key;
}
export const useT = (lang: Lang) => (key: string) => t(lang, key);

/** Pick the language-appropriate variant of a row that has both _th and a default. */
export function langPick<T extends { name?: string | null; name_th?: string | null }>(
  row: T, lang: Lang, base: keyof T, suffix: keyof T,
): string {
  const v = lang === "th" ? (row[suffix] as unknown as string | null) : (row[base] as unknown as string | null);
  const fallback = (row[base] as unknown as string | null) || "";
  return (v && v.length > 0 ? v : fallback) as string;
}
