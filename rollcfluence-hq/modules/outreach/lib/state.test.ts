import { test } from "node:test";
import assert from "node:assert/strict";
import { applyOutreach, emptyOutreach, activeLeads, deletedLeads, outreachSummary } from "./state.ts";
import { applyInterview, interviewProblems, INTERVIEW_QUESTIONS } from "./interview.ts";
import { nextAction } from "./leads.ts";

let n = 0;
const id = () => `x${++n}`;
const now = new Date("2026-10-14T08:00:00Z");

function withLead() {
  const s = emptyOutreach();
  applyOutreach(s, { type: "saveLead", lead: { name: "Maria Petrova", email: "maria@example.com", company: "Lumen", firstLine: "Loved your post.", platform: "email" } }, now, id);
  return s;
}

test("add lead logs an event; duplicate email is refused", () => {
  const s = withLead();
  assert.equal(s.leads.length, 1);
  const dup = applyOutreach(s, { type: "saveLead", lead: { name: "Other", email: "MARIA@example.com" } }, now, id);
  assert.equal(dup.ok, false);
  assert.match(dup.message, /already has/);
});

test("delete is soft and can be undone", () => {
  const s = withLead();
  const leadId = s.leads[0]!.id;
  const del = applyOutreach(s, { type: "deleteLead", id: leadId }, now, id);
  assert.equal(del.ok, true);
  assert.equal(activeLeads(s).length, 0);
  assert.equal(deletedLeads(s).length, 1);
  assert.equal(del.events[0]!.type, "lead.deleted");
  assert.equal(applyOutreach(s, { type: "restoreLead", id: leadId }, now, id).ok, true);
  assert.equal(activeLeads(s).length, 1);
});

test("mark sent: personalisation required, first message sets date, follow-up only once", () => {
  const s = emptyOutreach();
  applyOutreach(s, { type: "saveLead", lead: { name: "Bo", handle: "@bo", platform: "instagram", company: "Bo Co", firstLine: "" } }, now, id);
  const l = s.leads[0]!;
  assert.equal(applyOutreach(s, { type: "markSent", leadId: l.id, templateId: "first-dm" }, now, id).ok, false);
  applyOutreach(s, { type: "saveLead", lead: { ...l, firstLine: "Great reels." } }, now, id);
  assert.equal(applyOutreach(s, { type: "markSent", leadId: l.id, templateId: "first-dm" }, now, id).ok, true);
  assert.equal(s.leads[0]!.channelMessaged, "instagram");
  const later = new Date("2026-10-17T09:00:00Z");
  assert.equal(nextAction(s.leads[0]!, later), "Send follow-up");
  assert.equal(applyOutreach(s, { type: "markSent", leadId: l.id, templateId: "follow-up" }, later, id).ok, true);
  const again = applyOutreach(s, { type: "markSent", leadId: l.id, templateId: "follow-up" }, later, id);
  assert.equal(again.ok, false);
  assert.match(again.message, /one follow-up/);
});

test("do not contact blocks sending and adds the email to the suppression list", () => {
  const s = withLead();
  const l = s.leads[0]!;
  applyOutreach(s, { type: "setDoNotContact", leadId: l.id, value: true }, now, id);
  assert.deepEqual(s.suppressed, ["maria@example.com"]);
  assert.equal(applyOutreach(s, { type: "markSent", leadId: l.id, templateId: "email-first" }, now, id).ok, false);
});

test("interview: needs an answer and a pain decision; writes results back to the lead", () => {
  assert.equal(INTERVIEW_QUESTIONS.length, 5);
  assert.ok(interviewProblems({ answers: [], proofAnswer: "", pain: null, pay: null }).length >= 2);
  const s = withLead();
  const l = s.leads[0]!;
  const r = applyOutreach(s, { type: "saveInterview", leadId: l.id, interview: { answers: ["We run 12 Zaps", "Last week invoices stopped"], proofAnswer: "Yes, often", pain: "Y", pay: "Maybe" } }, now, id);
  assert.equal(r.ok, true);
  const after = s.leads[0]!;
  assert.equal(after.replied, true);
  assert.equal(after.painConfirmed, "Y");
  assert.equal(after.wouldPay, "Maybe");
  assert.equal(after.interview!.answers.length, 5);
  assert.equal(after.interview!.proofAnswer, "Yes, often");
  assert.equal(nextAction(after, now), "Ask what would make it a yes");
  assert.equal(applyInterview(l, { answers: ["a"], proofAnswer: "", pain: "N", pay: null }, now).painConfirmed, "N");
});

test("targets are clamped; summary gives verdict and day count", () => {
  const s = withLead();
  applyOutreach(s, { type: "saveTargets", targets: { painConfirmed: 0, wouldPay: 3, minSent: 20, days: 14 }, followUpDays: 99 }, now, id);
  assert.equal(s.settings.targets.painConfirmed, 1);
  assert.equal(s.settings.followUpDays, 30);
  applyOutreach(s, { type: "markSent", leadId: s.leads[0]!.id, templateId: "email-first" }, now, id);
  const sum = outreachSummary(s, new Date("2026-10-16T08:00:00Z"));
  assert.equal(sum.day, 3);
  assert.equal(sum.verdict.kind, "KEEP GOING");
  assert.equal(sum.stats.messagedLeads, 1);
});

test("import CSV skips duplicates of existing leads", () => {
  const s = withLead();
  const r = applyOutreach(s, { type: "importCsv", text: "name,email\nMaria,maria@example.com\nNew Person,new@example.com\n" }, now, id);
  assert.equal(r.ok, true);
  assert.match(r.message, /Imported 1 leads\. Skipped 1/);
});

test("a lead who replied without a logged send moves to the interview, not 'Message them'", () => {
  const s = withLead();
  const l = { ...s.leads[0]!, replied: true };
  assert.equal(nextAction(l, now), "Run the 5-question interview");
});
