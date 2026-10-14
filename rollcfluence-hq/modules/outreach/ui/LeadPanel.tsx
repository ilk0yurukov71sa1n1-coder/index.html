"use client";

import { useState } from "react";
import type { PageProps } from "@/components/HqApp.tsx";
import { PrimaryButton } from "@/components/fx.tsx";
import { nextAction, profileUrl, type NextAction } from "../lib/leads.ts";
import { render } from "../lib/templates.ts";
import { isSuppressed } from "../lib/rules.ts";
import { formatSofia } from "../lib/time.ts";
import { INTERVIEW_QUESTIONS, PROOF_QUESTION } from "../lib/interview.ts";
import type { Lead, PayAnswer, Platform, YesNo } from "../lib/types.ts";
import { NextActionTag, PLATFORM_LABEL, Seg } from "./bits.tsx";

const SUGGEST: Partial<Record<NextAction, string>> = {
  "Send follow-up": "follow-up",
  "Run the 5-question interview": "interview",
  "Offer the free health check": "health-check",
  "Ask what would make it a yes": "price",
  "Thank them and close": "close",
};

const EDITABLE = ["name", "email", "handle", "platform", "company", "whatTheyDo", "firstLine", "notes", "painConfirmed", "wouldPay", "replied"] as const;
const editable = (l: Partial<Lead>) => JSON.stringify(EDITABLE.map((k) => l[k] ?? null));
const blank = (): Partial<Lead> & { name: string } => ({ name: "", email: "", handle: "", platform: "email", company: "", whatTheyDo: "", firstLine: "", notes: "" });

interface Props {
  lead: Lead | null;
  props: PageProps;
  onCreated: (name: string) => void;
  onDeleted: () => void;
}

export function LeadPanel({ lead, props, onCreated, onDeleted }: Props) {
  const { snap, outreach, busy } = props;
  const store = snap.outreach;
  const now = new Date(snap.core.now);
  const [form, setForm] = useState<Partial<Lead> & { name: string }>(lead ? { ...lead } : blank());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof Lead>(k: K, v: Lead[K]) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = !lead || editable(form) !== editable(lead);
  const na = lead ? nextAction(lead, now, store.settings.followUpDays) : null;

  const save = async () => {
    const fields = Object.fromEntries(EDITABLE.map((k) => [k, form[k]]));
    const r = await outreach({ type: "saveLead", lead: lead ? { ...lead, ...fields, name: form.name } : form });
    if (r.ok && !lead) onCreated(form.name.trim());
  };

  return (
    <>
      <section className="panel stack" aria-label="Lead details">
        <div className="row">
          <h2>{lead ? lead.name : "New lead"}</h2>
          <span className="spacer" />
          {na && <NextActionTag action={na} />}
        </div>
        <div className="grid-2">
          <label className="field">Name<input id="f-name" value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus={!lead} /></label>
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
        <label className="field">Personal first line (required to send)<input id="f-firstline" value={form.firstLine ?? ""} onChange={(e) => set("firstLine", e.target.value)} placeholder="Something specific you noticed about them" /></label>
        <label className="field">Notes<textarea id="f-notes" value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></label>
        {lead && (
          <div className="row small">
            <span className="muted">Pain</span>
            <Seg<YesNo> label="Pain confirmed" value={form.painConfirmed ?? null} onChange={(v) => set("painConfirmed", v)} options={[{ value: null, label: "–" }, { value: "Y", label: "Y" }, { value: "N", label: "N" }]} />
            <span className="muted">Would pay</span>
            <Seg<PayAnswer> label="Would pay" value={form.wouldPay ?? null} onChange={(v) => set("wouldPay", v)} options={[{ value: null, label: "–" }, { value: "Y", label: "Y" }, { value: "Maybe", label: "Maybe" }, { value: "N", label: "N" }]} />
            <label className="row" style={{ gap: 6 }}><input id="f-replied" type="checkbox" checked={!!form.replied} onChange={(e) => set("replied", e.target.checked)} style={{ width: "auto" }} /> Replied</label>
          </div>
        )}
        <div className="row">
          <PrimaryButton disabled={busy || !dirty || !form.name.trim()} onClick={() => void save()}>{lead ? "Save changes" : "Add lead"}</PrimaryButton>
          {lead && (
            <button type="button" onClick={() => void outreach({ type: "setDoNotContact", leadId: lead.id, value: !lead.doNotContact })}>
              {lead.doNotContact ? "Allow contact again" : "Do not contact"}
            </button>
          )}
          <span className="spacer" />
          {lead && !confirmDelete && <button type="button" className="danger" onClick={() => setConfirmDelete(true)}>Delete</button>}
          {lead && confirmDelete && (
            <>
              <span className="small">Delete {lead.name}? You can restore them from Recently deleted.</span>
              <button type="button" className="danger" onClick={async () => { const r = await outreach({ type: "deleteLead", id: lead.id }); if (r.ok) onDeleted(); }}>Yes, delete</button>
              <button type="button" onClick={() => setConfirmDelete(false)}>Keep</button>
            </>
          )}
        </div>
        {lead && dirty && <p className="muted small">Save your changes before writing a message.</p>}
      </section>
      {lead && !dirty && <Compose lead={lead} props={props} />}
      {lead && !dirty && (lead.replied || na === "Run the 5-question interview" || lead.interview) && <Interview lead={lead} props={props} />}
      {lead && <History lead={lead} props={props} />}
    </>
  );
}

function Compose({ lead, props }: { lead: Lead; props: PageProps }) {
  const { snap, outreach, busy } = props;
  const store = snap.outreach;
  const now = new Date(snap.core.now);
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
  const url = isEmail
    ? lead.email
      ? `mailto:${lead.email}?subject=${encodeURIComponent(r.subject)}&body=${encodeURIComponent(r.body)}`
      : null
    : profileUrl(lead);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(isEmail ? `${r.subject}\n\n${r.body}` : r.body);
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
        {isEmail && <div className="subj">{r.subject || "(no subject)"}</div>}
        {r.body}
      </div>
      {r.problems.length > 0 && (
        <div className="problems" role="alert">
          <strong>Can&rsquo;t send yet</strong>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>{r.problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}
      <p className="muted small">
        {isEmail
          ? "Copy it into Gmail (or open your mail app), send it, then click Mark sent. Sending straight from HQ comes with the Email module."
          : `Assisted send: copy the message and open the ${PLATFORM_LABEL[lead.platform]} profile, send it yourself, then click Mark sent. HQ never logs into or automates ${PLATFORM_LABEL[lead.platform]}.`}
      </p>
      <div className="row">
        {url ? (
          <a className="btn" href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (r.problems.length) { e.preventDefault(); return; } void copy(); }} aria-disabled={r.problems.length > 0}>
            {isEmail ? "Copy & open mail app" : copied ? "Copied. Open profile again" : "Copy & open profile"}
          </a>
        ) : (
          <button type="button" disabled={r.problems.length > 0} onClick={() => void copy()}>Copy message</button>
        )}
        <PrimaryButton disabled={busy || r.problems.length > 0} onClick={() => void outreach({ type: "markSent", leadId: lead.id, templateId })}>Mark sent</PrimaryButton>
        {copied && <span className="muted small">Copied to your clipboard.</span>}
      </div>
    </section>
  );
}

function Interview({ lead, props }: { lead: Lead; props: PageProps }) {
  const { outreach, busy } = props;
  const [answers, setAnswers] = useState<string[]>(lead.interview?.answers ?? INTERVIEW_QUESTIONS.map(() => ""));
  const [proof, setProof] = useState(lead.interview?.proofAnswer ?? "");
  const [pain, setPain] = useState<YesNo | null>(lead.painConfirmed);
  const [pay, setPay] = useState<PayAnswer | null>(lead.wouldPay);
  return (
    <section className="panel stack" aria-label="Interview">
      <div className="row">
        <h2>5-question interview</h2>
        <span className="spacer" />
        {lead.interview && <span className="muted small">Saved {formatSofia(lead.interview.at)}</span>}
      </div>
      <p className="muted small">Ask about real past events, not opinions about your idea. Write their words, not your interpretation.</p>
      {INTERVIEW_QUESTIONS.map((q, i) => (
        <label key={q} className="field q">
          <span><span className="n">{i + 1}</span>{q}</span>
          <textarea id={`iv-${i}`} value={answers[i] ?? ""} onChange={(e) => setAnswers((a) => a.map((x, k) => (k === i ? e.target.value : x)))} />
        </label>
      ))}
      <label className="field q">
        <span><span className="n">+</span>{PROOF_QUESTION} <span className="muted">(optional)</span></span>
        <textarea id="iv-proof" value={proof} onChange={(e) => setProof(e.target.value)} />
      </label>
      <div className="row small">
        <span>Pain confirmed?</span>
        <Seg<YesNo> label="Pain confirmed" value={pain} onChange={setPain} options={[{ value: "Y", label: "Yes" }, { value: "N", label: "No" }]} />
        <span>Would pay?</span>
        <Seg<PayAnswer> label="Would pay" value={pay} onChange={setPay} options={[{ value: "Y", label: "Yes" }, { value: "Maybe", label: "Maybe" }, { value: "N", label: "No" }]} />
      </div>
      <div className="row">
        <PrimaryButton disabled={busy} onClick={() => void outreach({ type: "saveInterview", leadId: lead.id, interview: { answers, proofAnswer: proof, pain, pay } })}>
          Save to {lead.name.split(" ")[0]}
        </PrimaryButton>
        <span className="muted small">Sets Replied, Pain confirmed and Would pay on the lead.</span>
      </div>
    </section>
  );
}

function History({ lead, props }: { lead: Lead; props: PageProps }) {
  const items = [
    ...props.snap.outreach.sent.filter((m) => m.leadId === lead.id).map((m) => ({ at: m.sentAt, in: false, text: `${m.kind === "followup" ? "Follow-up" : "Sent"} via ${PLATFORM_LABEL[m.channel]}${m.subject ? `: ${m.subject}` : ""}` })),
    ...(lead.interview ? [{ at: lead.interview.at, in: true, text: "Interview saved" }] : []),
    ...(lead.repliedAt ? [{ at: lead.repliedAt, in: true, text: "Replied" }] : []),
  ].sort((a, b) => b.at.localeCompare(a.at));
  if (!items.length) return null;
  return (
    <section className="panel stack" aria-label="History">
      <h3>History</h3>
      <div className="history stagger">
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
