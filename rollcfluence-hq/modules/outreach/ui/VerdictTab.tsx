"use client";

import { useState } from "react";
import type { PageProps } from "@/components/HqApp.tsx";
import { GlowCard, Num, PrimaryButton } from "@/components/fx.tsx";
import { outreachSummary } from "../lib/state.ts";
import type { Platform, Settings } from "../lib/types.ts";
import { PLATFORM_LABEL } from "./bits.tsx";

const pct = (x: number) => `${Math.round(Math.min(1, x) * 100)}%`;

export function VerdictTab({ snap, outreach, busy }: PageProps) {
  const store = snap.outreach;
  const sum = outreachSummary(store, new Date(snap.core.now));
  const [targets, setTargets] = useState<Settings["targets"]>(store.settings.targets);
  const [followUpDays, setFollowUpDays] = useState(store.settings.followUpDays);
  const dirty = JSON.stringify(targets) !== JSON.stringify(store.settings.targets) || followUpDays !== store.settings.followUpDays;
  const t = store.settings.targets;
  const maxCh = Math.max(1, ...Object.values(sum.stats.sentByChannel));
  const num = (k: keyof Settings["targets"]) => (e: React.ChangeEvent<HTMLInputElement>) => setTargets({ ...targets, [k]: Number(e.target.value) });

  return (
    <div className="stack">
      <GlowCard>
        <div className="row">
          <span className={`verdict-badge v-${sum.verdict.kind.split(" ")[0]}`}>{sum.verdict.kind}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong>{sum.day > 0 ? `Day ${sum.day} of ${t.days}` : "Starts with your first message"}</strong>
            <p>{sum.verdict.text}</p>
          </div>
        </div>
      </GlowCard>
      <section className="panel stack" aria-labelledby="how-h">
        <h2 id="how-h">How the verdict is calculated</h2>
        <ul className="small" style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: 4 }}>
          <li><strong>PASS</strong> when pain confirmed ≥ {t.painConfirmed} <em>and</em> would pay ≥ {t.wouldPay}. Now: <Num value={sum.stats.painConfirmed} /> and <Num value={sum.stats.wouldPay} />.</li>
          <li><strong>KEEP GOING</strong> while fewer than {t.minSent} people are messaged. Now: <Num value={sum.stats.messagedLeads} /> ({pct(sum.stats.messagedLeads / t.minSent)}).</li>
          <li><strong>FAIL</strong> otherwise: change the angle, don&rsquo;t build more.</li>
          <li>&ldquo;Would pay&rdquo; counts only clear Yes answers. &ldquo;Maybe&rdquo; doesn&rsquo;t count.</li>
          <li>Reply rate = people who replied ÷ people messaged = {pct(sum.stats.replyRate)}.</li>
        </ul>
      </section>
      <div className="grid-2">
        <section className="panel stack" aria-labelledby="ch-h">
          <h2 id="ch-h">Messaged by channel</h2>
          <div className="bars">
            {(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => (
              <div className="bar-row" key={p}>
                <span>{PLATFORM_LABEL[p]}</span>
                <span className="bar-track" aria-hidden="true"><i style={{ width: pct((sum.stats.sentByChannel[p] ?? 0) / maxCh) }} /></span>
                <span className="num">{sum.stats.sentByChannel[p] ?? 0}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="panel stack" aria-labelledby="tg-h">
          <h2 id="tg-h">Targets</h2>
          <div className="grid-2">
            <label className="field">Pain confirmed needed<input id="t-pain" type="number" min={1} value={targets.painConfirmed} onChange={num("painConfirmed")} /></label>
            <label className="field">Would pay needed<input id="t-pay" type="number" min={1} value={targets.wouldPay} onChange={num("wouldPay")} /></label>
            <label className="field">People to message before judging<input id="t-min" type="number" min={1} value={targets.minSent} onChange={num("minSent")} /></label>
            <label className="field">Test length (days)<input id="t-days" type="number" min={1} value={targets.days} onChange={num("days")} /></label>
            <label className="field">Follow-up after (days)<input id="t-fu" type="number" min={1} max={30} value={followUpDays} onChange={(e) => setFollowUpDays(Number(e.target.value))} /></label>
          </div>
          <div className="row">
            <PrimaryButton disabled={busy || !dirty} onClick={() => void outreach({ type: "saveTargets", targets, followUpDays })}>Save targets</PrimaryButton>
          </div>
        </section>
      </div>
    </div>
  );
}
