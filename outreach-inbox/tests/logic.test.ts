import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_SETTINGS, type Lead, type SentMessage, type Settings } from "../lib/types.ts";
import { newLead, nextAction, markReplied, markMessaged, profileUrl } from "../lib/leads.ts";
import { DEFAULT_TEMPLATES, render } from "../lib/templates.ts";
import {
  canSendEmailNow, canSendFollowUp, computeStats, dueFollowUps, effectiveCap, isOptOut, isSuppressed, matchReply, sentToday, verdict,
} from "../lib/rules.ts";
import { importLeads, exportLeads } from "../lib/csv.ts";
import { JsonStore } from "../lib/store.ts";

const S: Settings = { ...DEFAULT_SETTINGS, ownAddress: "me@example.com" };
// 2026-10-14 is in EEST (UTC+3): 10:00 Sofia = 07:00 UTC
const sofia = (d: string, hhmm: string) => new Date(`${d}T${hhmm}:00+03:00`);
let n = 0;
const lead = (p: Partial<Lead> = {}) => newLead({ name: "Maria Petrova", email: "maria@example.com", company: "Studio Lumen", firstLine: "Loved your post on client onboarding.", ...p }, new Date("2026-10-01T00:00:00Z"), `L${++n}`);
const sentEmail = (at: Date, p: Partial<SentMessage> = {}): SentMessage => ({
  id: `S${++n}`, leadId: "L1", channel: "email", kind: "first", templateId: "email-first", to: "x@example.com", subject: "s", body: "b", messageId: `<m${n}@rollcfluence>`, sentAt: at.toISOString(), dryRun: true, ...p,
});

// ---------- next action ----------
test("next action follows the tracker flow", () => {
  const now = sofia("2026-10-14", "10:00");
  assert.equal(nextAction(lead(), now), "Message them");
  const m = lead({ dateMessaged: sofia("2026-10-13", "10:00").toISOString(), channelMessaged: "email" });
  assert.equal(nextAction(m, now), "Wait for reply");
  const old = { ...m, dateMessaged: sofia("2026-10-11", "10:00").toISOString() };
  assert.equal(nextAction(old, now), "Send follow-up");
  assert.equal(nextAction({ ...old, followUpSentAt: now.toISOString() }, now), "Wait for reply");
  const r = markReplied(old, now);
  assert.equal(nextAction(r, now), "Run the 5-question interview");
  assert.equal(nextAction({ ...r, painConfirmed: "Y" }, now), "Run the 5-question interview");
  assert.equal(nextAction({ ...r, painConfirmed: "Y", wouldPay: "Y" }, now), "Offer the free health check");
  assert.equal(nextAction({ ...r, painConfirmed: "Y", wouldPay: "Maybe" }, now), "Ask what would make it a yes");
  assert.equal(nextAction({ ...r, painConfirmed: "N" }, now), "Thank them and close");
  assert.equal(nextAction({ ...r, doNotContact: true }, now), "Do not contact");
});

test("profile links are built without contacting the site", () => {
  assert.equal(profileUrl(lead({ platform: "instagram", handle: "@studio.lumen" })), "https://www.instagram.com/studio.lumen");
  assert.equal(profileUrl(lead({ platform: "linkedin", handle: "https://www.linkedin.com/in/maria" })), "https://www.linkedin.com/in/maria");
  assert.equal(profileUrl(lead()), null);
});

// ---------- templates / placeholder blocking ----------
test("all 7 starter templates are present", () => {
  assert.equal(DEFAULT_TEMPLATES.length, 7);
});

test("render fills variables and adds signature + opt-out to emails", () => {
  const t = DEFAULT_TEMPLATES.find((x) => x.id === "email-first")!;
  const r = render(t, lead(), S, { email: true });
  assert.deepEqual(r.problems, []);
  assert.equal(r.subject, "Quick question about Studio Lumen");
  assert.match(r.body, /^Hi Maria,\n\nLoved your post/);
  assert.match(r.body, /Ilko, Rollcfluence\nReply "no thanks" and I won't email again\.$/);
});

test("blocks when {first_line} is empty", () => {
  const t = DEFAULT_TEMPLATES.find((x) => x.id === "email-first")!;
  const r = render(t, lead({ firstLine: "  " }), S, { email: true });
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0]!, /personal first line/);
});

test("blocks on any leftover {placeholder}, including unknown ones", () => {
  const t = { ...DEFAULT_TEMPLATES[0]!, body: "Hi {name}, about {city} and {company}" };
  const r = render(t, lead({ company: "" }), S, { email: false });
  assert.ok(r.problems.some((p) => p.includes("{city}")));
  assert.ok(r.problems.some((p) => p.includes("{company}")));
});

test("DMs get no email signature", () => {
  const r = render(DEFAULT_TEMPLATES[0]!, lead(), S, { email: false });
  assert.doesNotMatch(r.body, /no thanks/);
});

// ---------- daily cap and quiet hours ----------
test("quiet hours: only 09:00–19:00 Sofia time", () => {
  assert.equal(canSendEmailNow([], S, sofia("2026-10-14", "08:59")).ok, false);
  assert.equal(canSendEmailNow([], S, sofia("2026-10-14", "09:00")).ok, true);
  assert.equal(canSendEmailNow([], S, sofia("2026-10-14", "18:59")).ok, true);
  const late = canSendEmailNow([], S, sofia("2026-10-14", "19:00"));
  assert.equal(late.ok, false);
  assert.match((late as { reason: string }).reason, /Outside sending hours/);
  // winter time (EET, UTC+2): 09:30 Sofia = 07:30 UTC
  assert.equal(canSendEmailNow([], S, new Date("2026-12-01T07:30:00Z")).ok, true);
  assert.equal(canSendEmailNow([], S, new Date("2026-12-01T06:30:00Z")).ok, false);
});

test("daily cap counts today's emails (Sofia day) and is never above 30", () => {
  const now = sofia("2026-10-14", "15:00");
  const today = Array.from({ length: 10 }, (_, i) => sentEmail(new Date(now.getTime() - (i + 1) * 10 * 60_000)));
  const yesterday = sentEmail(sofia("2026-10-13", "23:30"));
  const dm = sentEmail(now, { channel: "instagram", sentAt: sofia("2026-10-14", "11:00").toISOString() });
  assert.equal(sentToday([...today, yesterday, dm], now), 10);
  const r = canSendEmailNow([...today, yesterday], S, now);
  assert.equal(r.ok, false);
  assert.match((r as { reason: string }).reason, /10 \/ 10/);
  assert.equal(canSendEmailNow(today.slice(0, 9), S, now).ok, true);
  assert.equal(effectiveCap({ ...S, dailyCap: 500 }), 30);
});

test("at least 3 minutes between emails", () => {
  const now = sofia("2026-10-14", "12:00");
  const r = canSendEmailNow([sentEmail(new Date(now.getTime() - 60_000))], S, now);
  assert.equal(r.ok, false);
  assert.match((r as { reason: string }).reason, /Wait 2m 0s/);
  assert.equal(canSendEmailNow([sentEmail(new Date(now.getTime() - 3 * 60_000))], S, now).ok, true);
});

// ---------- follow-ups ----------
test("follow-up becomes due after 3 days with no reply, once only", () => {
  const first = sofia("2026-10-10", "10:00");
  const l = lead({ dateMessaged: first.toISOString(), channelMessaged: "email" });
  assert.equal(dueFollowUps([l], [], S, sofia("2026-10-13", "09:59")).length, 0);
  assert.equal(dueFollowUps([l], [], S, sofia("2026-10-13", "10:00")).length, 1);
  const after = markMessaged(l, "email", "followup", sofia("2026-10-13", "11:00"));
  assert.equal(dueFollowUps([after], [], S, sofia("2026-10-20", "10:00")).length, 0);
  assert.equal(canSendFollowUp(after).ok, false);
});

test("a reply cancels the pending follow-up", () => {
  const l = lead({ dateMessaged: sofia("2026-10-10", "10:00").toISOString(), channelMessaged: "email" });
  const r = markReplied(l, sofia("2026-10-11", "10:00"));
  assert.equal(r.replied, true);
  assert.equal(r.followUpCancelled, true);
  assert.equal(dueFollowUps([r], [], S, sofia("2026-10-20", "10:00")).length, 0);
  assert.equal(canSendFollowUp(r).ok, false);
});

test("suppressed or do-not-contact leads never get a follow-up", () => {
  const l = lead({ dateMessaged: sofia("2026-10-01", "10:00").toISOString(), channelMessaged: "email" });
  assert.equal(dueFollowUps([l], ["maria@example.com"], S, sofia("2026-10-14", "10:00")).length, 0);
  assert.equal(dueFollowUps([{ ...l, doNotContact: true }], [], S, sofia("2026-10-14", "10:00")).length, 0);
});

// ---------- suppression ----------
test("opt-out phrases are detected in the new text only", () => {
  assert.equal(isOptOut("No thanks, not interested."), true);
  assert.equal(isOptOut("please UNSUBSCRIBE me"), true);
  assert.equal(isOptOut("Stop."), true);
  assert.equal(isOptOut("Sounds interesting, tell me more"), false);
  assert.equal(isOptOut("Sure, happy to chat!\n\n> Reply \"no thanks\" and I won't email again."), false);
  assert.equal(isOptOut("Yes please\n\nOn Tue, Ilko <me@example.com> wrote:\nReply no thanks to stop"), false);
  assert.equal(isOptOut("We stopped using Zapier"), false);
});

test("suppression list matches addresses case-insensitively, with display names", () => {
  assert.equal(isSuppressed(["maria@example.com"], "Maria <MARIA@example.com>"), true);
  assert.equal(isSuppressed(["maria@example.com"], "other@example.com"), false);
  assert.equal(isSuppressed([], null), false);
});

// ---------- reply matching ----------
test("replies match by In-Reply-To / References, then by sender", () => {
  const a = lead({ email: "a@example.com" });
  const b = lead({ email: "b@example.com" });
  const sent = [sentEmail(new Date(), { leadId: a.id, messageId: "<abc123@rollcfluence.local>" })];
  assert.equal(matchReply({ from: "someone@else.com", inReplyTo: "<ABC123@rollcfluence.local>", references: [] }, sent, [a, b]), a.id);
  assert.equal(matchReply({ from: "x@y.com", inReplyTo: null, references: ["<zzz@q>", "<abc123@rollcfluence.local>"] }, sent, [a, b]), a.id);
  assert.equal(matchReply({ from: "B <B@example.com>", inReplyTo: null, references: [] }, sent, [a, b]), b.id);
  assert.equal(matchReply({ from: "stranger@example.com", inReplyTo: "<nope@x>", references: [] }, sent, [a, b]), null);
});

// ---------- verdict ----------
test("verdict: PASS, KEEP GOING, FAIL", () => {
  const t = S.targets;
  const base = { sentByChannel: {}, replies: 0, replyRate: 0, firstMessageAt: null };
  assert.equal(verdict({ ...base, messagedLeads: 12, painConfirmed: 5, wouldPay: 2 }, t).kind, "PASS");
  assert.equal(verdict({ ...base, messagedLeads: 39, painConfirmed: 5, wouldPay: 1 }, t).kind, "KEEP GOING");
  assert.equal(verdict({ ...base, messagedLeads: 40, painConfirmed: 4, wouldPay: 9 }, t).kind, "FAIL");
  assert.match(verdict({ ...base, messagedLeads: 40, painConfirmed: 0, wouldPay: 0 }, t).text, /change the angle, don't build more/);
  assert.equal(verdict({ ...base, messagedLeads: 10, painConfirmed: 2, wouldPay: 1 }, { ...t, painConfirmed: 2, wouldPay: 1 }).kind, "PASS");
});

test("stats count channels, replies, pain and would-pay", () => {
  const now = new Date();
  const leads = [
    lead({ dateMessaged: now.toISOString(), channelMessaged: "email", replied: true, painConfirmed: "Y", wouldPay: "Y" }),
    lead({ dateMessaged: now.toISOString(), channelMessaged: "instagram", platform: "instagram", handle: "@x" }),
    lead(),
  ];
  const s = computeStats(leads);
  assert.equal(s.messagedLeads, 2);
  assert.equal(s.sentByChannel.email, 1);
  assert.equal(s.sentByChannel.instagram, 1);
  assert.equal(s.replyRate, 0.5);
  assert.equal(s.painConfirmed, 1);
  assert.equal(s.wouldPay, 1);
});

// ---------- CSV ----------
test("CSV import maps tracker columns, skips bad and duplicate rows", () => {
  const csv = 'name,email,handle/link,platform,what they do,notes\nAna,ana@example.com,,email,Dentist,"likes ""fast"" replies"\nBo,,@bo.studio,Instagram,Photographer,\n,c@example.com,,,,\nDee,not-an-email,,,,\nAna again,ANA@example.com,,,,\n';
  const r = importLeads(csv, [], new Date(), () => `I${++n}`);
  assert.equal(r.leads.length, 2);
  assert.equal(r.leads[0]!.notes, 'likes "fast" replies');
  assert.equal(r.leads[1]!.platform, "instagram");
  assert.deepEqual(r.skipped.map((s) => s.row), [4, 5, 6]);
  const out = exportLeads(r.leads, () => "Message them");
  assert.match(out, /^name,email,handle\/link,platform/);
  assert.match(out, /"likes ""fast"" replies"/);
});

// ---------- store ----------
test("store writes atomically and serialises concurrent updates", async () => {
  const dir = await mkdtemp(join(tmpdir(), "outreach-"));
  const store = new JsonStore(join(dir, "data", "outreach.json"));
  assert.equal((await store.read()).templates.length, 7);
  await Promise.all(Array.from({ length: 20 }, (_, i) => store.update((s) => { s.suppressed.push(`u${i}@x.com`); })));
  const final = await store.read();
  assert.equal(final.suppressed.length, 20);
  assert.equal(final.settings.dryRun, true);
  JSON.parse(await readFile(join(dir, "data", "outreach.json"), "utf8"));
});
