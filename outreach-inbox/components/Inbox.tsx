"use client";

import { useState } from "react";
import { followUpQueue } from "@/lib/engine.ts";
import { canSendEmailNow, newTextOnly } from "@/lib/rules.ts";
import { daysBetween, formatSofia } from "@/lib/time.ts";
import type { ViewProps } from "./App.tsx";

export function Inbox({ snap, act, busy, openLead }: ViewProps) {
  const { store } = snap;
  const now = new Date(snap.now);
  const queue = followUpQueue(store, now);
  const limit = canSendEmailNow(store.sent, store.settings, now);
  const replies = [...store.replies].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const leadName = (id: string | null) => store.leads.find((l) => l.id === id)?.name ?? "Unknown";

  return (
    <div className="stack">
      <div className="row">
        <h1>Inbox</h1>
        <span className="spacer" />
        <span className="muted small">
          {snap.email.lastCheck ? `Last checked ${formatSofia(snap.email.lastCheck)}` : "Not checked yet"} · every {store.settings.pollMinutes} min while the app is open
        </span>
        <button type="button" disabled={busy} onClick={() => void act({ type: "checkReplies" })}>
          Check now
        </button>
      </div>
      {snap.email.lastCheckError && <div className="problems">Last inbox check failed: {snap.email.lastCheckError}</div>}

      <section className="panel stack" aria-labelledby="fu-h">
        <div className="row">
          <h2 id="fu-h">Follow-ups waiting for your approval</h2>
          <span className="muted small">One follow-up per lead, {store.settings.followUpDays} days after the first email, only if they haven't replied.</span>
        </div>
        {queue.length === 0 ? (
          <p className="muted">Nothing due right now.</p>
        ) : (
          <>
            {!limit.ok && <div className="note">{limit.reason}</div>}
            <div className="table-wrap">
            <table className="list">
              <thead>
                <tr>
                  <th scope="col">Lead</th>
                  <th scope="col">First email</th>
                  <th scope="col">Waiting</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {queue.map((l) => (
                  <tr key={l.id} style={{ cursor: "default" }}>
                    <td>
                      <button type="button" className="link" onClick={() => openLead(l.id)}>{l.name}</button>
                      <div className="muted small">{l.email}</div>
                    </td>
                    <td>{formatSofia(l.dateMessaged!)}</td>
                    <td className="num">{Math.floor(daysBetween(l.dateMessaged!, now))} days</td>
                    <td>
                      <div className="row" style={{ justifyContent: "flex-end" }}>
                        <button type="button" className="primary" disabled={busy || !limit.ok} onClick={() => void act({ type: "sendEmail", leadId: l.id, templateId: "follow-up" })}>
                          Approve & send
                        </button>
                        <button type="button" disabled={busy} onClick={() => void act({ type: "cancelFollowUp", leadId: l.id })}>
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
      </section>

      <section className="panel" aria-labelledby="rep-h">
        <h2 id="rep-h">Replies</h2>
        {replies.length === 0 && <p className="muted" style={{ marginTop: 8 }}>No replies yet. Replies to emails sent from this app appear here automatically.</p>}
        {replies.map((r) => (
          <article key={r.id} className="reply">
            <div className="row">
              <button type="button" className="link" onClick={() => r.leadId && openLead(r.leadId)}><strong>{leadName(r.leadId)}</strong></button>
              <span className="muted small">{r.from}</span>
              {r.optOut && <span className="na na-stop">Opted out: will never be emailed again</span>}
              <span className="spacer" />
              <span className="muted small">{formatSofia(r.receivedAt)}</span>
            </div>
            <div className="small muted">{r.subject}</div>
            <div className="text">{newTextOnly(r.text).trim()}</div>
          </article>
        ))}
      </section>

      {snap.preview && <SimulateReply snap={snap} act={act} busy={busy} />}
    </div>
  );
}

function SimulateReply({ snap, act, busy }: Pick<ViewProps, "snap" | "act" | "busy">) {
  const emailed = snap.store.leads.filter((l) => snap.store.sent.some((m) => m.leadId === l.id && m.channel === "email"));
  const [leadId, setLeadId] = useState(emailed[0]?.id ?? "");
  return (
    <section className="panel stack" aria-labelledby="sim-h">
      <h2 id="sim-h">Simulate a reply (preview only)</h2>
      <p className="muted small">In the Mac app, replies arrive from your real inbox. Here you can pretend a lead answered to see what happens.</p>
      <div className="row">
        <select id="sim-lead" style={{ width: "auto" }} value={leadId} onChange={(e) => setLeadId(e.target.value)}>
          {emailed.map((l) => <option key={l.id} value={l.id}>{l.name}{l.replied ? " (already replied)" : ""}</option>)}
        </select>
        <button type="button" disabled={busy || !leadId} onClick={() => void act({ type: "demoReply", leadId, optOut: false })}>Interested reply</button>
        <button type="button" disabled={busy || !leadId} onClick={() => void act({ type: "demoReply", leadId, optOut: true })}>&ldquo;No thanks&rdquo; reply</button>
      </div>
    </section>
  );
}
