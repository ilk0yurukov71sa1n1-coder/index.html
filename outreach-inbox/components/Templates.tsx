"use client";

import { useState } from "react";
import type { Template } from "@/lib/types.ts";
import type { ViewProps } from "./App.tsx";

export function Templates({ snap, act, busy }: ViewProps) {
  const { templates } = snap.store;
  const [id, setId] = useState(templates[0]?.id ?? "");
  const current = templates.find((t) => t.id === id);
  const [draft, setDraft] = useState<Template | null>(current ?? null);
  const [confirmReset, setConfirmReset] = useState(false);
  const pick = (t: Template) => { setId(t.id); setDraft({ ...t }); };
  const dirty = draft && current && JSON.stringify(draft) !== JSON.stringify(current);

  return (
    <div className="stack">
      <div className="row">
        <h1>Templates</h1>
        <span className="spacer" />
        {!confirmReset ? (
          <button type="button" onClick={() => setConfirmReset(true)}>Reset to starter messages</button>
        ) : (
          <>
            <span className="small">Replace all templates with the 7 starter messages?</span>
            <button type="button" className="danger" onClick={async () => { await act({ type: "resetTemplates" }); setConfirmReset(false); setDraft(null); }}>Yes, reset</button>
            <button type="button" onClick={() => setConfirmReset(false)}>Keep mine</button>
          </>
        )}
      </div>
      <p className="muted small">
        Variables: <code>{"{name}"}</code> (first name), <code>{"{first_line}"}</code> (your personal line for that lead), <code>{"{company}"}</code>. A message can't be sent while any <code>{"{placeholder}"}</code> is unfilled or the first line is empty. Emails get your signature and the opt-out line added automatically.
      </p>
      <div className="leads-layout">
        <section className="panel" aria-label="Template list">
          <table className="list">
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} aria-selected={t.id === id} tabIndex={0} onClick={() => pick(t)} onKeyDown={(e) => e.key === "Enter" && pick(t)}>
                  <td><strong>{t.name}</strong><div className="muted small">{t.channel === "dm" ? "Direct message" : "Email"} · {t.purpose}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        {draft && (
          <section className="panel stack" aria-label="Edit template">
            <label className="field">Name<input id="t-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
            <label className="field">Email subject (ignored for DMs)<input id="t-subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></label>
            <label className="field">Message<textarea id="t-body" style={{ minHeight: 200 }} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></label>
            <div className="row">
              <button type="button" className="primary" disabled={busy || !dirty} onClick={() => void act({ type: "saveTemplate", template: draft })}>Save template</button>
              {dirty && <button type="button" onClick={() => current && setDraft({ ...current })}>Undo changes</button>}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
