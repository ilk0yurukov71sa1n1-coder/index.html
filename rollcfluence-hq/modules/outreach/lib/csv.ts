import type { Lead, Platform } from "./types.ts";
import { newLead } from "./leads.ts";
import { isSuppressed } from "./rules.ts";

function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, text.indexOf("\n") === -1 ? text.length : text.indexOf("\n"));
  let best = ",";
  let bestCount = 0;
  for (const d of [",", ";", "\t", "|"]) {
    const count = firstLine.split(d).length - 1;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/** RFC 4180 CSV parser: quoted fields, "" escapes, newlines inside quotes, CRLF, BOM. */
export function parseCSV(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const delim = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  const endRow = () => {
    row.push(field);
    field = "";
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
    row = [];
  };

  while (i < len) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      // copy a run of ordinary characters at once (much faster for big files)
      const next = text.indexOf('"', i);
      const stop = next === -1 ? len : next;
      field += text.slice(i, stop);
      i = stop;
      continue;
    }
    if (c === '"' && field === "") {
      inQuotes = true;
      i++;
    } else if (c === delim) {
      row.push(field);
      field = "";
      i++;
    } else if (c === "\n" || c === "\r") {
      endRow();
      i += c === "\r" && text[i + 1] === "\n" ? 2 : 1;
    } else {
      field += c;
      i++;
    }
  }
  if (field !== "" || row.length > 0) endRow();
  return rows;
}


const norm = (h: string) => h.toLowerCase().replace(/[^a-z]/g, "");
const COLS: Record<string, string[]> = {
  name: ["name", "fullname", "contact"],
  email: ["email", "emailaddress", "mail"],
  handle: ["handlelink", "handle", "link", "profile", "url", "username"],
  platform: ["platform", "channel"],
  whatTheyDo: ["whattheydo", "business", "niche", "role"],
  company: ["company", "brand", "businessname"],
  firstLine: ["firstline", "opener", "personalline"],
  notes: ["notes", "note", "comments"],
};

function toPlatform(v: string, hasEmail: boolean): Platform {
  const s = v.toLowerCase();
  if (s.includes("insta") || s === "ig") return "instagram";
  if (s.includes("linked")) return "linkedin";
  if (s === "x" || s.includes("twitter")) return "x";
  if (s.includes("mail")) return "email";
  return hasEmail ? "email" : "instagram";
}

export interface ImportResult {
  leads: Lead[];
  skipped: { row: number; reason: string }[];
}

/**
 * CSV columns: name, email, handle/link, platform, what they do, notes (+ optional company, first line).
 * Rows for people on the do-not-contact list are skipped, so an old file can't bring back someone who opted out or was erased.
 */
export function importLeads(text: string, existing: Lead[], now: Date, makeId: () => string, suppressed: string[] = []): ImportResult {
  const rows = parseCSV(text);
  if (rows.length < 2) return { leads: [], skipped: [{ row: 1, reason: "The file has no data rows." }] };
  const headers = rows[0]!.map(norm);
  const idx = (field: string) => headers.findIndex((h) => COLS[field]!.includes(h));
  const at = Object.fromEntries(Object.keys(COLS).map((f) => [f, idx(f)])) as Record<string, number>;
  if (at.name === -1) return { leads: [], skipped: [{ row: 1, reason: 'No "name" column found.' }] };
  const seenEmails = new Set(existing.map((l) => l.email).filter(Boolean));
  const seenHandles = new Set(existing.map((l) => l.handle?.toLowerCase()).filter(Boolean));
  const leads: Lead[] = [];
  const skipped: ImportResult["skipped"] = [];
  rows.slice(1).forEach((r, i) => {
    const get = (f: string) => (at[f]! >= 0 ? (r[at[f]!] ?? "").trim() : "");
    const name = get("name");
    const email = get("email").toLowerCase();
    const handle = get("handle");
    const row = i + 2;
    if (!name) return skipped.push({ row, reason: "missing name" });
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return skipped.push({ row, reason: `"${email}" is not a valid email` });
    if (!email && !handle) return skipped.push({ row, reason: "needs an email or a handle/link" });
    if (isSuppressed(suppressed, email || null, handle || null)) return skipped.push({ row, reason: "on your do-not-contact list" });
    if ((email && seenEmails.has(email)) || (handle && seenHandles.has(handle.toLowerCase()))) return skipped.push({ row, reason: "already in your leads" });
    if (email) seenEmails.add(email);
    if (handle) seenHandles.add(handle.toLowerCase());
    leads.push(
      newLead(
        { name, email: email || null, handle: handle || null, platform: toPlatform(get("platform"), !!email), whatTheyDo: get("whatTheyDo"), company: get("company"), firstLine: get("firstLine"), notes: get("notes") },
        now,
        makeId(),
      ),
    );
  });
  return { leads, skipped };
}

const esc = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export function exportLeads(leads: Lead[], nextAction: (l: Lead) => string): string {
  const head = ["name", "email", "handle/link", "platform", "company", "what they do", "first line", "date messaged", "follow-up sent", "replied", "pain confirmed", "would pay", "do not contact", "next action", "notes"];
  const rows = leads.map((l) => [
    l.name, l.email ?? "", l.handle ?? "", l.platform, l.company, l.whatTheyDo, l.firstLine, day(l.dateMessaged), day(l.followUpSentAt),
    l.replied ? "Y" : "N", l.painConfirmed ?? "", l.wouldPay ?? "", l.doNotContact ? "Y" : "N", nextAction(l), l.notes,
  ]);
  return [head, ...rows].map((r) => r.map(esc).join(",")).join("\n") + "\n";
}
