"use client";

import { computeStats, verdict } from "@/lib/rules.ts";
import { nextAction, type NextAction } from "@/lib/leads.ts";
import { daysBetween } from "@/lib/time.ts";
import type { ViewProps } from "./App.tsx";
import { PLATFORM_LABEL, pct } from "./ui.tsx";
import type { Platform } from "@/lib/types.ts";

const TODO: NextAction[] = ["Message them", "Send follow-up", "Run the 5-question interview", "Offer the free health check", "Ask what would make it a yes", "Thank them and close"];

export function Dashboard({ snap, openLead }: ViewProps) {
  const { store } = snap;
  const now = new Date(snap.now);
  const t = store.settings.targets;
  const st = computeStats(store.leads);
  const v = verdict(st, t);
  const day = st.firstMessageAt ? Math.min(t.days, Math.floor(daysBetween(st.firstMessageAt, now)) + 1) : 0;
  const maxCh = Math.max(1, ...Object.values(st.sentByChannel));
  const actions = new Map<NextAction, number>();
  for (const l of store.leads) {
    const a = nextAction(l, now, store.settings.followUpDays);
    actions.set(a, (actions.get(a) ?? 0) + 1);
  }

  return (
    <div className="stack">
      {!snap.preview && store.leads.length === 0 && (
        <section className="panel stack" aria-labelledby="start-h">
          <h2 id="start-h">Get started in 3 steps</h2>
          <ol className="small" style={{ margin: 0, paddingLeft: "1.2rem", display: "grid", gap: 4 }}>
            <li>Settings: enter your own email address (test emails go there) and press <strong>Test connection</strong>.</li>
            <li>Leads: <strong>Add lead</strong>, or <strong>Import CSV</strong> from your tracker (name, email, handle/link, platform, what they do, notes).</li>
            <li>Open a lead, write their personal first line, and <strong>Send test to my inbox</strong>. Reply to it in Gmail and watch it appear in Inbox.</li>
          </ol>
          <p className="muted small">Dry-run is on: nothing reaches a real lead until you switch it off in Settings.</p>
        </section>
      )}
      <section className="panel verdict" aria-label="Validation verdict">
        <span className={`badge v-${v.kind.split(" ")[0]}`}>{v.kind}</span>
        <div className="stack" style={{ gap: 4 }}>
          <h1>{t.days}-day verdict{day > 0 && <span className="muted small"> · day {day} of {t.days}</span>}</h1>
          <p>{v.text}</p>
          <p className="muted small">
            PASS when pain confirmed ≥ {t.painConfirmed} and would pay ≥ {t.wouldPay}. KEEP GOING while fewer than {t.minSent} people are messaged. Otherwise FAIL. Targets are in Settings.
          </p>
        </div>
      </section>

      <section className="cards" aria-label="Numbers">
        <div className="card">
          <span className="label">People messaged</span>
          <span className="value num">{st.messagedLeads}</span>
          <span className="sub">target {t.minSent} before judging</span>
          <div className="meter"><i style={{ width: pct(Math.min(1, st.messagedLeads / t.minSent)) }} /></div>
        </div>
        <div className="card">
          <span className="label">Replies</span>
          <span className="value num">{st.replies}</span>
          <span className="sub">{store.replies.length} reply emails in Inbox</span>
        </div>
        <div className="card">
          <span className="label">Reply rate</span>
          <span className="value num">{pct(st.replyRate)}</span>
          <span className="sub">replies ÷ people messaged</span>
        </div>
        <div className="card">
          <span className="label">Pain confirmed</span>
          <span className="value num">
            {st.painConfirmed}
            <span className="muted small"> / {t.painConfirmed}</span>
          </span>
          <div className="meter"><i style={{ width: pct(Math.min(1, st.painConfirmed / t.painConfirmed)) }} /></div>
        </div>
        <div className="card">
          <span className="label">Would pay</span>
          <span className="value num">
            {st.wouldPay}
            <span className="muted small"> / {t.wouldPay}</span>
          </span>
          <div className="meter"><i style={{ width: pct(Math.min(1, st.wouldPay / t.wouldPay)) }} /></div>
        </div>
      </section>

      <div className="grid-2">
        <section className="panel stack" aria-labelledby="ch-h">
          <h2 id="ch-h">Messaged by channel</h2>
          <div className="bars">
            {(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => (
              <div className="bar-row" key={p}>
                <span>{PLATFORM_LABEL[p]}</span>
                <span className="bar-track" aria-hidden="true">
                  <i style={{ width: pct((st.sentByChannel[p] ?? 0) / maxCh) }} />
                </span>
                <span className="num">{st.sentByChannel[p] ?? 0}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="panel stack" aria-labelledby="todo-h">
          <h2 id="todo-h">What to do next</h2>
          <div className="todo">
            {TODO.map((a) => (
              <button key={a} type="button" disabled={!actions.get(a)} onClick={() => openLead("", a)}>
                <span>{a}</span>
                <strong className="num">{actions.get(a) ?? 0}</strong>
              </button>
            ))}
          </div>
          <p className="muted small">{actions.get("Wait for reply") ?? 0} waiting for a reply.</p>
        </section>
      </div>
    </div>
  );
}
