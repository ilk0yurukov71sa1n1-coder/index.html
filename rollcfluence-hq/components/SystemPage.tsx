"use client";

import { useState } from "react";
import { RESTORE_CONFIRM_WORD } from "@/core/api.ts";
import type { PageProps } from "./HqApp.tsx";
import { Decrypt, PageTitle, PrimaryButton } from "./fx.tsx";

const LEVEL_TEXT = { green: "All good", amber: "Needs attention soon", red: "Needs attention now", info: "Info" } as const;
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/Sofia", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

export function SystemPage({ snap: hq, core: act, busy, backend }: PageProps) {
  const snap = hq.core;
  const [restoring, setRestoring] = useState<string | null>(null);
  const [word, setWord] = useState("");
  const jsonUrl = backend.exportUrl("json");

  return (
    <div className="stack">
      <PageTitle text="System" sub="Is HQ healthy, are backups fresh, and how to fix anything that isn’t." />
      <section className="panel status-banner" aria-label="Overall status">
        <span className={`dot ${snap.overall}`} style={{ width: 14, height: 14 }} />
        <span className="big"><Decrypt text={LEVEL_TEXT[snap.overall]} /></span>
        <span className="muted small">Checked {when(snap.now)} · rechecks every minute</span>
      </section>

      <section className="panel" aria-labelledby="checks-h">
        <h2 id="checks-h">Checks</h2>
        <div className="checks">
          {snap.checks.map((c) => (
            <div className="check" key={c.id}>
              <span className={`dot ${c.level}`} />
              <div>
                <strong>{c.label}</strong>
                <div className={`lvl ${c.level}`}>{c.level === "info" ? "info" : c.level}</div>
              </div>
              <div>
                <div>{c.detail}</div>
                {c.fix && <div className="fix"><strong>Fix:</strong> {c.fix}</div>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel stack" aria-labelledby="bk-h">
        <div className="row">
          <h2 id="bk-h">Backups</h2>
          <span className="spacer" />
          <PrimaryButton disabled={busy} onClick={() => void act({ type: "backupNow" })}>
            Back up now
          </PrimaryButton>
        </div>
        <p className="muted small">
          HQ backs up every time it starts and once a day while it&rsquo;s open, and keeps the newest 14. Restoring first saves your current data as a
          &ldquo;pre-restore&rdquo; backup, so you can always undo it.
        </p>
        <div className="table-wrap">
          <table className="list">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Why</th>
                <th scope="col">Size</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {snap.backups.map((b) => (
                <tr key={b.name}>
                  <td className="num">{when(b.at)}</td>
                  <td>{b.reason === "start" ? "HQ started" : b.reason === "daily" ? "Daily" : b.reason === "manual" ? "By hand" : "Before a restore"}</td>
                  <td className="num">{size(b.sizeBytes)}</td>
                  <td style={{ textAlign: "right" }}>
                    <button type="button" disabled={busy || snap.preview} onClick={() => { setRestoring(b.name); setWord(""); }}>
                      Restore…
                    </button>
                  </td>
                </tr>
              ))}
              {snap.backups.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">No backups yet. Press &ldquo;Back up now&rdquo;.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {restoring && (
          <div className="confirm" role="dialog" aria-label="Confirm restore">
            <strong>Restore the backup from {when(snap.backups.find((b) => b.name === restoring)?.at ?? snap.now)}?</strong>
            <span className="small">Everything will go back to how it was then. Your current data is saved first as a &ldquo;pre-restore&rdquo; backup.</span>
            <label className="field" style={{ maxWidth: 280 }}>
              Type {RESTORE_CONFIRM_WORD} to confirm
              <input id="restore-word" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" />
            </label>
            <div className="row">
              <button type="button" className="danger" disabled={busy || word !== RESTORE_CONFIRM_WORD}
                onClick={async () => { const r = await act({ type: "restore", name: restoring, confirm: word }); if (r.ok) setRestoring(null); }}>
                Restore this backup
              </button>
              <button type="button" onClick={() => setRestoring(null)}>Cancel</button>
            </div>
          </div>
        )}
      </section>

      <section className="panel stack" aria-labelledby="ex-h">
        <h2 id="ex-h">Export everything</h2>
        <p className="muted small">A full copy you can open anywhere: one JSON file with all data and the activity log, plus a spreadsheet (CSV) per kind of data.</p>
        {jsonUrl ? (
          <div className="row">
            <a className="btn primary" href={jsonUrl}>Download all (JSON)</a>
            {snap.exportFiles.map((f) => (
              <a key={f} className="btn" href={backend.exportUrl(f) ?? "#"}>{f}</a>
            ))}
          </div>
        ) : (
          <p className="muted small">Export works in the HQ app on your Mac.</p>
        )}
        <p className="muted small">Your data folder: <code>{snap.dataFolder}</code></p>
      </section>

      <section className="panel stack" aria-labelledby="log-h">
        <h2 id="log-h">Activity log</h2>
        <p className="muted small">Every important action is recorded here with its time. It&rsquo;s also your audit trail.</p>
        <div className="events stagger">
          {snap.events.map((e) => (
            <div className="event" key={e.id}>
              <span className="muted num">{when(e.at)}</span>
              <span>{e.summary}</span>
            </div>
          ))}
          {snap.events.length === 0 && <p className="muted">Nothing yet.</p>}
        </div>
      </section>
    </div>
  );
}
