"use client";

import { useState } from "react";
import { nextAction, profileUrl, type NextAction } from "@/lib/leads.ts";
import { render } from "@/lib/templates.ts";
import { canSendEmailNow, isSuppressed } from "@/lib/rules.ts";
import { formatSofia } from "@/lib/time.ts";
import type { Lead, PayAnswer, Platform, YesNo } from "@/lib/types.ts";
import type { ViewProps } from "./App.tsx";
import { NextActionTag, PLATFORM_LABEL, Seg } from "./ui.tsx";

const SUGGEST: Partial<Record<NextAction, string>> = {
  "Send follow-up": "follow-up",
  "Run the 5-question interview": "interview",
  "Offer the free health check": "health-check",
  "Ask what would make it a yes": "price",
  "Thank them and close": "close",
};

const EDITABLE = ["name", "email", "handle", "platform", "company", "whatTheyDo", "firstLine", "notes", "painConfirmed", "wouldPay", "replied"] as const;
export const editable = (l: Partial<Lead>) => JSON.stringify(EDITABLE.map((k) => l[k] ?? null));

const blank = (): Partial<Lead> & { name: string } => ({ name: "", email: "", handle: "", platform: "email", company: "", whatTheyDo: "", firstLine: "", notes: "" });

interface Props extends ViewProps {
  lead: Lead | null;
  onCreated: (id: string) => void;
  onDeleted: () => void;
}

export function LeadPanel({ lead, snap, act, busy, onCreated, onDeleted }: Props) {
  const { store } = snap;
  const now = new Date(snap.now);
  const [form, setForm] = useState<Partial<Lead> & { name: string }>(lead ? { ...lead } : blank());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof Lead>(k: K, v: Lead[K]) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = !lead || editable(form) !== editable(lead);

  const save = async () => {
    // only the editable fields; send dates and follow-up state come from the latest saved lead
    const fields = Object.fromEntries(EDITABLE.map((k) => [k, form[k]]));
    const r = await act({ type: "saveLead", lead: lead ? { ...lead, ...fields, name: form.name } : form });
    // the list selects the newest lead with this name
    if (r.ok && !lead) onCreated(`name:${form.name.trim()}`);
  };

  return (
    <div className="stack">
      <section className="panel stack" aria-label="Lead details">
        <div className="row">
          <h2>{lead ? lead.name : "New lead"}</h2>
          <span className="spacer" />
          {lead && <NextActionTag action={nextAction(lead, now, store.settings.followUpDays)} />}
        </div>
        <div className="grid-2">
          <label className="field">Name<input id="f-name" value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label className="field">
            Channel
            <select id="f-platform" value={form.platform} onChange={(e) => set("platform", e.target.value as Platform)}>
              {(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}
            </select>
          </label>
          <label className="field">Email<input id="f-email" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} /></label>
          <label className="field">Handle or profile link<input id="f-handle" value={form.handle ?? ""} onChange={(e) => set("handle", e.target.value)} placeholder="@studio or https://…" /></label>
          <label className="field">Company<input id="f-company" value={form.company ?? ""} onChange={(e) => set("company", e.target.value)} /></label>
          <label className="field">What they do<input id="f-what" value={form.whatTheyDo ?? ""} onChange={(e) => set("whatTheyDo", e.target.value)} /></label>
        </div>
        <label className="field">
          Personal first line (required to send)
          <input id="f-firstline" value={form.firstLine ?? ""} onChange={(e) => set("firstLine", e.target.value)} placeholder="Something specific you noticed about them" />
        </label>
        <label className="field">Notes<textarea id="f-notes" style={{ minHeight: 60 }} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></label>
        {lead && (
          <div className="row small">
            <span className="muted">Pain confirmed</span>
            <Seg<YesNo> label="Pain confirmed" value={form.painConfirmed ?? null} onChange={(v) => set("painConfirmed", v)} options={[{ value: null, label: "–" }, { value: "Y", label: "Y" }, { value: "N", label: "N" }]} />
            <span className="muted">Would pay</span>
            <Seg<PayAnswer> label="Would pay" value={form.wouldPay ?? null} onChange={(v) => set("wouldPay", v)} options={[{ value: null, label: "–" }, { value: "Y", label: "Y" }, { value: "Maybe", label: "Maybe" }, { value: "N", label: "N" }]} />
            <label className="row" style={{ gap: 6 }}>
              <input id="f-replied" type="checkbox" checked={!!form.replied} onChange={(e) => set("replied", e.target.checked)} />
              Replied
            </label>
          </div>
        )}
        <div className="row">
          <button type="button" className="primary" disabled={busy || !dirty || !form.name.trim()} onClick={() => void save()}>
            {lead ? "Save changes" : "Add lead"}
          </button>
          {lead && (
            <button type="button" onClick={() => void act({ type: "setDoNotContact", leadId: lead.id, value: !lead.doNotContact })}>
              {lead.doNotContact ? "Allow contact again" : "Do not contact"}
            </button>
          )}
          <span className="spacer" />
          {lead && !confirmDelete && <button type="button" className="danger" onClick={() => setConfirmDelete(true)}>Delete</button>}
          {lead && confirmDelete && (
            <>
              <span className="small">Delete {lead.name} and their history?</span>
              <button type="button" className="danger" onClick={async () => { const r = await act({ type: "deleteLead", id: lead.id }); if (r.ok) onDeleted(); }}>Yes, delete</button>
              <button type="button" onClick={() => setConfirmDelete(false)}>Keep</button>
            </>
          )}
        </div>
        {lead && dirty && <p className="muted small">Save your changes before writing a message.</p>}
      </section>

      {lead && !dirty && <Compose lead={lead} snap={snap} act={act} busy={busy} />}
      {lead && <History lead={lead} snap={snap} />}
    </div>
  );
}

function Compose({ lead, snap, act, busy }: { lead: Lead } & Pick<ViewProps, "snap" | "act" | "busy">) {
  const { store } = snap;
  const now = new Date(snap.now);
  const na = nextAction(lead, now, store.settings.followUpDays);
  const isEmail = lead.platform === "email";
  const suggested = SUGGEST[na] ?? (isEmail ? "email-first" : "first-dm");
  const [templateId, setTemplateId] = useState(store.templates.some((t) => t.id === suggested) ? suggested : store.templates[0]?.id ?? "");
  const [copied, setCopied] = useState(false);
  const t = store.templates.find((x) => x.id === templateId);
  if (lead.doNotContact || (isEmail && isSuppressed(store.suppressed, lead.email))) {
    return <section className="panel note">{lead.name} asked not to be contacted. No messages can be sent.</section>;
  }
  if (!t) return null;
  const r = render(t, lead, store.settings, { email: isEmail });
  const limit = isEmail ? canSendEmailNow(store.sent, store.settings, now) : { ok: true as const };
  const url = profileUrl(lead);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(r.body);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="panel stack" aria-label="Write a message">
      <div className="row">
        <h2>Message</h2>
        <span className="spacer" />
        <label className="row small" style={{ gap: 6 }}>
          Template
          <select id="compose-template" style={{ width: "auto" }} value={templateId} onChange={(e) => { setTemplateId(e.target.value); setCopied(false); }}>
            {store.templates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
      </div>
      <div className="preview-box" aria-label="Preview">
        {isEmail && <div className="subj">{(store.settings.dryRun ? "[TEST] " : "") + (r.subject || "(no subject)")}</div>}
        {r.body}
      </div>
      {r.problems.length > 0 && (
        <div className="problems" role="alert">
          <strong>Can't send yet</strong>
          <ul>{r.problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}
      {isEmail ? (
        <>
          {!limit.ok && <div className="note">{limit.reason}</div>}
          <div className="row">
            <button type="button" className="primary" disabled={busy || r.problems.length > 0 || !limit.ok} onClick={() => void act({ type: "sendEmail", leadId: lead.id, templateId })}>
              {store.settings.dryRun ? "Send test to my inbox" : `Send to ${lead.email}`}
            </button>
            {store.settings.dryRun && <span className="muted small">Dry-run: goes to {store.settings.ownAddress || "your address (set it in Settings)"} with [TEST] in the subject.</span>}
          </div>
        </>
      ) : (
        <>
          <p className="muted small">
            Assisted send: we copy the message and open the {PLATFORM_LABEL[lead.platform]} profile. You paste and send it yourself, then click Mark sent. This app never logs into or automates {PLATFORM_LABEL[lead.platform]}.
          </p>
          <div className="row">
            {url ? (
              <a className={`btn${r.problems.length ? "" : " primary"}`} href={url} target="_blank" rel="noopener noreferrer" aria-disabled={r.problems.length > 0}
                onClick={(e) => { if (r.problems.length) { e.preventDefault(); return; } void copy(); }}>
                {copied ? "Copied. Open profile again" : "Copy & open profile"}
              </a>
            ) : (
              <span className="muted small">Add a handle or profile link to open their profile.</span>
            )}
            <button type="button" disabled={busy || r.problems.length > 0} onClick={() => void act({ type: "markDmSent", leadId: lead.id, templateId })}>
              Mark sent
            </button>
            {copied && <span className="muted small">Message copied to your clipboard.</span>}
          </div>
        </>
      )}
    </section>
  );
}

function History({ lead, snap }: { lead: Lead; snap: ViewProps["snap"] }) {
  const items = [
    ...snap.store.sent.filter((m) => m.leadId === lead.id).map((m) => ({ at: m.sentAt, in: false, text: `${m.kind === "followup" ? "Follow-up" : "Sent"} via ${PLATFORM_LABEL[m.channel]}${m.dryRun ? " (test to you)" : ""}${m.subject ? `: ${m.subject}` : ""}` })),
    ...snap.store.replies.filter((r) => r.leadId === lead.id).map((r) => ({ at: r.receivedAt, in: true, text: `Reply${r.optOut ? " (opted out)" : ""}: ${r.text.split("\n")[0]}` })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  if (!items.length) return null;
  return (
    <section className="panel stack" aria-label="History">
      <h3>History</h3>
      <div className="history">
        {items.map((i, k) => (
          <div key={k} className={`item${i.in ? " in" : ""}`}>
            <div className="muted small">{formatSofia(i.at)}</div>
            <div>{i.text}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
