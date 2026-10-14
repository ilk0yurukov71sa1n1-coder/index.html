"use client";

import { useState } from "react";
import { HARD_MAX_DAILY_CAP, type Settings } from "@/lib/types.ts";
import type { ViewProps } from "./App.tsx";

export function SettingsView({ snap, act, busy }: ViewProps) {
  const saved = snap.store.settings;
  const [s, setS] = useState<Settings>(saved);
  const [confirmLive, setConfirmLive] = useState(false);
  const dirty = JSON.stringify(s) !== JSON.stringify(saved);
  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: Number(e.target.value) });
  const tnum = (k: keyof Settings["targets"]) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, targets: { ...s.targets, [k]: Number(e.target.value) } });

  return (
    <div className="stack">
      <h1>Settings</h1>

      <section className="panel stack" aria-labelledby="dry-h">
        <h2 id="dry-h">Dry-run</h2>
        <p>
          {saved.dryRun ? (
            <>Dry-run is <strong>on</strong>. Every email goes only to your own address with &ldquo;[TEST]&rdquo; in the subject.</>
          ) : (
            <>Dry-run is <strong className="danger">off</strong>. Emails go to your real leads.</>
          )}
        </p>
        <label className="field" style={{ maxWidth: 420 }}>
          Your own email address (dry-run emails go here)
          <input id="s-own" type="email" value={s.ownAddress} onChange={(e) => setS({ ...s, ownAddress: e.target.value })} />
        </label>
        <div className="row">
          {saved.dryRun ? (
            !confirmLive ? (
              <button type="button" onClick={() => setConfirmLive(true)}>Turn off dry-run…</button>
            ) : (
              <>
                <span className="small">Real emails will go to real people. Send at least one test first.</span>
                <button type="button" className="danger" onClick={async () => { await act({ type: "saveSettings", settings: { ...saved, dryRun: false } }); setS({ ...s, dryRun: false }); setConfirmLive(false); }}>
                  Yes, send for real
                </button>
                <button type="button" onClick={() => setConfirmLive(false)}>Stay in dry-run</button>
              </>
            )
          ) : (
            <button type="button" className="primary" onClick={async () => { await act({ type: "saveSettings", settings: { ...saved, dryRun: true } }); setS({ ...s, dryRun: true }); }}>
              Turn dry-run back on
            </button>
          )}
        </div>
      </section>

      <section className="panel stack" aria-labelledby="conn-h">
        <h2 id="conn-h">Email connection</h2>
        {snap.email.configured ? (
          <p>Connected account: <strong>{snap.email.user}</strong>. Your password stays in <code>.env.local</code> on your Mac and is never shown here.</p>
        ) : (
          <p className="problems">No email account set up yet. Close the app, double-click the launcher and choose &ldquo;Set up email&rdquo;, or follow the README.</p>
        )}
        <div className="row">
          <button type="button" disabled={busy} onClick={() => void act({ type: "testConnection" })}>Test connection</button>
          <span className="muted small">Checks sending (SMTP) and reading replies (IMAP), and explains any error.</span>
        </div>
      </section>

      <section className="panel stack" aria-labelledby="lim-h">
        <h2 id="lim-h">Sending limits</h2>
        <div className="grid-3">
          <label className="field">Daily cap (max {HARD_MAX_DAILY_CAP})<input id="s-cap" type="number" min={1} max={HARD_MAX_DAILY_CAP} value={s.dailyCap} onChange={num("dailyCap")} /></label>
          <label className="field">Send from (hour, Sofia)<input id="s-start" type="number" min={0} max={23} value={s.startHour} onChange={num("startHour")} /></label>
          <label className="field">Send until (hour, Sofia)<input id="s-end" type="number" min={1} max={24} value={s.endHour} onChange={num("endHour")} /></label>
          <label className="field">Minutes between emails (min 3)<input id="s-gap" type="number" min={3} value={s.minGapMinutes} onChange={num("minGapMinutes")} /></label>
          <label className="field">Follow-up after (days)<input id="s-fu" type="number" min={1} value={s.followUpDays} onChange={num("followUpDays")} /></label>
          <label className="field">Check inbox every (minutes)<input id="s-poll" type="number" min={1} value={s.pollMinutes} onChange={num("pollMinutes")} /></label>
        </div>
      </section>

      <section className="panel stack" aria-labelledby="sig-h">
        <h2 id="sig-h">Signature</h2>
        <div className="grid-2">
          <label className="field">Your name<input id="s-name" value={s.senderName} onChange={(e) => setS({ ...s, senderName: e.target.value })} /></label>
          <label className="field">Business<input id="s-biz" value={s.businessName} onChange={(e) => setS({ ...s, businessName: e.target.value })} /></label>
        </div>
        <p className="muted small">Every email ends with: {s.senderName}, {s.businessName} · Reply &ldquo;no thanks&rdquo; and I won&rsquo;t email again.</p>
      </section>

      <section className="panel stack" aria-labelledby="tgt-h">
        <h2 id="tgt-h">Verdict targets</h2>
        <div className="grid-3">
          <label className="field">Pain confirmed needed<input id="s-pain" type="number" min={1} value={s.targets.painConfirmed} onChange={tnum("painConfirmed")} /></label>
          <label className="field">Would pay needed<input id="s-pay" type="number" min={1} value={s.targets.wouldPay} onChange={tnum("wouldPay")} /></label>
          <label className="field">People to message before judging<input id="s-min" type="number" min={1} value={s.targets.minSent} onChange={tnum("minSent")} /></label>
          <label className="field">Test length (days)<input id="s-days" type="number" min={1} value={s.targets.days} onChange={tnum("days")} /></label>
        </div>
      </section>

      <div className="row">
        <button type="button" className="primary" disabled={busy || !dirty} onClick={() => void act({ type: "saveSettings", settings: { ...s, dryRun: saved.dryRun } })}>Save settings</button>
        {dirty && <button type="button" onClick={() => setS(saved)}>Undo changes</button>}
      </div>

      <section className="panel stack" aria-labelledby="sup-h">
        <h2 id="sup-h">Suppression list ({snap.store.suppressed.length})</h2>
        <p className="muted small">Addresses that said &ldquo;no thanks&rdquo;, &ldquo;unsubscribe&rdquo; or &ldquo;stop&rdquo;, or that you marked Do not contact. They are never emailed again.</p>
        {snap.store.suppressed.length > 0 && <p className="small">{snap.store.suppressed.join(", ")}</p>}
      </section>
    </div>
  );
}
