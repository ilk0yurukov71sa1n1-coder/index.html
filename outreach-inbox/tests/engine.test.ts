import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyStore } from "../lib/store.ts";
import { followUpQueue, markDmSent, processIncoming, sendEmail, upsertLead, type Mailer, type OutgoingEmail } from "../lib/engine.ts";
import type { Store } from "../lib/types.ts";

let n = 0;
const id = () => `id${++n}`;
const at = (iso: string) => new Date(iso);

function setup(): { store: Store; outbox: OutgoingEmail[]; mailer: Mailer } {
  const store = emptyStore();
  store.settings.ownAddress = "ilko@example.com";
  const outbox: OutgoingEmail[] = [];
  const mailer: Mailer = { send: async (m) => (outbox.push(m), { messageId: `<msg${outbox.length}@test>` }) };
  upsertLead(store, { name: "Maria Petrova", email: "maria@example.com", platform: "email", company: "Studio Lumen", firstLine: "Loved your onboarding post." }, at("2026-10-01T00:00:00Z"), id);
  return { store, outbox, mailer };
}

test("dry-run sends only to my own address with [TEST] and the opt-out line", async () => {
  const { store, outbox, mailer } = setup();
  const r = await sendEmail(store, store.leads[0]!.id, "email-first", at("2026-10-14T08:00:00Z"), mailer, id);
  assert.equal(r.ok, true);
  assert.equal(outbox[0]!.to, "ilko@example.com");
  assert.match(outbox[0]!.subject, /^\[TEST\] Quick question about Studio Lumen$/);
  assert.match(outbox[0]!.text, /Reply "no thanks" and I won't email again\./);
  assert.ok(store.leads[0]!.dateMessaged);
});

test("live mode sends to the lead; sending is blocked outside hours and for suppressed leads", async () => {
  const { store, outbox, mailer } = setup();
  store.settings.dryRun = false;
  const night = await sendEmail(store, store.leads[0]!.id, "email-first", at("2026-10-14T20:00:00Z"), mailer, id);
  assert.equal(night.ok, false);
  assert.equal(outbox.length, 0);
  store.suppressed.push("maria@example.com");
  const s = await sendEmail(store, store.leads[0]!.id, "email-first", at("2026-10-14T08:00:00Z"), mailer, id);
  assert.equal(s.ok, false);
  store.suppressed = [];
  await sendEmail(store, store.leads[0]!.id, "email-first", at("2026-10-14T08:00:00Z"), mailer, id);
  assert.equal(outbox[0]!.to, "maria@example.com");
});

test("full loop: send, follow-up due after 3 days, reply arrives, follow-up stops, lead Replied", async () => {
  const { store, outbox, mailer } = setup();
  const lead = store.leads[0]!;
  await sendEmail(store, lead.id, "email-first", at("2026-10-14T08:00:00Z"), mailer, id);
  assert.equal(followUpQueue(store, at("2026-10-16T08:00:00Z")).length, 0);
  assert.equal(followUpQueue(store, at("2026-10-17T08:00:00Z")).length, 1);
  // our own dry-run copy lands in the inbox: ignored
  assert.equal(processIncoming(store, { from: "ilko@example.com", subject: "[TEST] Quick question", text: "...", date: "2026-10-14T08:00:05Z", messageId: "<msg1@test>", inReplyTo: null, references: [] }, at("2026-10-14T08:01:00Z"), id), null);
  // the reply (from my own address in dry-run) matches by In-Reply-To
  const reply = processIncoming(store, { from: "Ilko <ilko@example.com>", subject: "Re: [TEST] Quick question", text: "Yes, this happens to us!\n\n> quoted", date: "2026-10-15T09:00:00Z", messageId: "<r1@gmail>", inReplyTo: "<msg1@test>", references: ["<msg1@test>"] }, at("2026-10-15T09:02:00Z"), id);
  assert.ok(reply);
  assert.equal(reply.leadId, lead.id);
  assert.equal(store.leads[0]!.replied, true);
  assert.equal(followUpQueue(store, at("2026-10-20T08:00:00Z")).length, 0);
  // same email seen again on the next poll: not duplicated
  assert.equal(processIncoming(store, { from: "ilko@example.com", subject: "x", text: "x", date: "", messageId: "<r1@gmail>", inReplyTo: "<msg1@test>", references: [] }, at("2026-10-15T09:04:00Z"), id), null);
  assert.equal(store.replies.length, 1);
  assert.equal(outbox.length, 1);
});

test("follow-up threads under the first email and can only happen once", async () => {
  const { store, outbox, mailer } = setup();
  const lead = store.leads[0]!;
  await sendEmail(store, lead.id, "email-first", at("2026-10-14T08:00:00Z"), mailer, id);
  const f1 = await sendEmail(store, lead.id, "follow-up", at("2026-10-17T08:00:00Z"), mailer, id);
  assert.equal(f1.ok, true);
  assert.equal(outbox[1]!.inReplyTo, "<msg1@test>");
  const f2 = await sendEmail(store, lead.id, "follow-up", at("2026-10-20T08:00:00Z"), mailer, id);
  assert.equal(f2.ok, false);
  assert.match((f2 as { error: string }).error, /already had its one follow-up/);
});

test("'no thanks' reply suppresses the address forever", async () => {
  const { store, mailer } = setup();
  store.settings.dryRun = false;
  const lead = store.leads[0]!;
  await sendEmail(store, lead.id, "email-first", at("2026-10-14T08:00:00Z"), mailer, id);
  processIncoming(store, { from: "maria@example.com", subject: "Re", text: "No thanks.", date: "2026-10-14T10:00:00Z", messageId: "<x@y>", inReplyTo: "<msg1@test>", references: [] }, at("2026-10-14T10:00:00Z"), id);
  assert.deepEqual(store.suppressed, ["maria@example.com"]);
  assert.equal(store.leads[0]!.doNotContact, true);
  const again = await sendEmail(store, lead.id, "interview", at("2026-10-15T08:00:00Z"), mailer, id);
  assert.equal(again.ok, false);
});

test("emails from strangers are ignored", () => {
  const { store } = setup();
  assert.equal(processIncoming(store, { from: "news@shop.com", subject: "Sale", text: "Buy", date: "", messageId: "<n@s>", inReplyTo: null, references: [] }, new Date(), id), null);
});

test("assisted DM: logs the send, blocks un-personalised messages", () => {
  const { store } = setup();
  const ig = upsertLead(store, { name: "Bo Ivanov", handle: "@bo.studio", platform: "instagram", company: "Bo Studio", firstLine: "" }, new Date(), id);
  const bad = markDmSent(store, ig.id, "first-dm", at("2026-10-14T08:00:00Z"), id);
  assert.equal(bad.ok, false);
  upsertLead(store, { ...ig, firstLine: "Your reels on studio lighting are great." }, new Date(), id);
  assert.equal(markDmSent(store, ig.id, "first-dm", at("2026-10-14T08:00:00Z"), id).ok, true);
  const l = store.leads.find((x) => x.id === ig.id)!;
  assert.equal(l.channelMessaged, "instagram");
  assert.equal(store.sent.at(-1)!.channel, "instagram");
});
