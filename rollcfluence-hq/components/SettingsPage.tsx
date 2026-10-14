"use client";

import { useState } from "react";
import { CURRENCIES, type CoreSettings } from "@/core/settings.ts";
import type { PageProps } from "./HqApp.tsx";
import { PageTitle, PrimaryButton } from "./fx.tsx";

export function SettingsPage({ snap: hq, core: act, busy }: PageProps) {
  const snap = hq.core;
  const [s, setS] = useState<CoreSettings>(snap.settings);
  const dirty = JSON.stringify(s) !== JSON.stringify(snap.settings);
  const set = <K extends keyof CoreSettings>(k: K, v: CoreSettings[K]) => setS({ ...s, [k]: v });

  return (
    <div className="stack">
      <PageTitle text="Settings" />
      <section className="panel stack" aria-labelledby="you-h">
        <h2 id="you-h">You and your business</h2>
        <div className="grid-2">
          <label className="field">Your name (used in email signatures)<input id="s-name" value={s.yourName} onChange={(e) => set("yourName", e.target.value)} /></label>
          <label className="field">Business name<input id="s-biz" value={s.businessName} onChange={(e) => set("businessName", e.target.value)} /></label>
          <label className="field">Your own email (test emails go here)<input id="s-email" type="email" value={s.ownEmail} onChange={(e) => set("ownEmail", e.target.value)} /></label>
          <label className="field">
            Currency
            <select id="s-cur" value={s.currency} onChange={(e) => set("currency", e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <p className="muted small">Times and sending hours use Europe/Sofia. Email account settings come with the Email module and live in <code>.env.local</code>, never here.</p>
        <div className="row">
          <PrimaryButton disabled={busy || !dirty} onClick={() => void act({ type: "saveSettings", settings: s })}>Save settings</PrimaryButton>
          {dirty && <button type="button" onClick={() => setS(snap.settings)}>Undo changes</button>}
        </div>
      </section>
    </div>
  );
}
