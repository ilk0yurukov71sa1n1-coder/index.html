"use client";

import { outreachSummary } from "@/modules/outreach/lib/state.ts";
import type { PageProps } from "./HqApp.tsx";
import { AuroraBackdrop, GlowCard, Num, PageTitle } from "./fx.tsx";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/Sofia", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const pct = (x: number) => `${Math.round(Math.min(1, x) * 100)}%`;

const NEXT: { action: string; label: string }[] = [
  { action: "Send follow-up", label: "Follow-ups due" },
  { action: "Message them", label: "People to message" },
  { action: "Run the 5-question interview", label: "Interviews to run" },
  { action: "Offer the free health check", label: "Health checks to offer" },
  { action: "Ask what would make it a yes", label: "Ask what makes it a yes" },
  { action: "Thank them and close", label: "Thank and close" },
];

export function TodayPage({ snap, go }: PageProps) {
  const now = new Date(snap.core.now);
  const sum = outreachSummary(snap.outreach, now);
  const t = snap.outreach.settings.targets;
  const attention = snap.core.checks.filter((c) => c.level === "red" || c.level === "amber");
  const name = snap.core.settings.yourName;

  return (
    <div className="stack">
      <section className="hero">
        <AuroraBackdrop />
        <PageTitle
          text={`Hi ${name || "there"}. Here’s today.`}
          sub={new Date(snap.core.now).toLocaleDateString("en-GB", { timeZone: "Europe/Sofia", weekday: "long", day: "numeric", month: "long" })}
        />
        <div className="row" style={{ marginTop: 14 }}>
          <span className={`verdict-badge v-${sum.verdict.kind.split(" ")[0]}`}>{sum.verdict.kind}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <strong>{sum.day > 0 ? `Validation day ${sum.day} of ${t.days}` : "Validation starts with your first message"}</strong>
            <p className="muted small">{sum.verdict.text}</p>
          </div>
          <button type="button" onClick={() => go("outreach", { tab: "verdict" })}>How it&rsquo;s decided</button>
        </div>
      </section>

      <section className="stat-grid" aria-label="Validation numbers">
        <GlowCard onClick={() => go("outreach", { tab: "leads" })} label="Open leads">
          <div className="stat">
            <div className="label">People messaged</div>
            <div className="value"><Num value={sum.stats.messagedLeads} /> <small>/ {t.minSent}</small></div>
            <div className="meter"><i style={{ width: pct(sum.stats.messagedLeads / t.minSent) }} /></div>
          </div>
        </GlowCard>
        <GlowCard onClick={() => go("outreach", { tab: "leads", filter: "Run the 5-question interview" })} label="Leads who replied">
          <div className="stat">
            <div className="label">Replies</div>
            <div className="value"><Num value={sum.stats.replies} /></div>
            <div className="sub">{pct(sum.stats.replyRate)} reply rate</div>
          </div>
        </GlowCard>
        <GlowCard onClick={() => go("outreach", { tab: "verdict" })} label="Pain confirmed">
          <div className="stat">
            <div className="label">Pain confirmed</div>
            <div className="value"><Num value={sum.stats.painConfirmed} /> <small>/ {t.painConfirmed}</small></div>
            <div className="meter"><i style={{ width: pct(sum.stats.painConfirmed / t.painConfirmed) }} /></div>
          </div>
        </GlowCard>
        <GlowCard onClick={() => go("outreach", { tab: "verdict" })} label="Would pay">
          <div className="stat">
            <div className="label">Would pay</div>
            <div className="value"><Num value={sum.stats.wouldPay} /> <small>/ {t.wouldPay}</small></div>
            <div className="meter"><i style={{ width: pct(sum.stats.wouldPay / t.wouldPay) }} /></div>
          </div>
        </GlowCard>
      </section>

      <div className="grid-2">
        <section className="panel stack" aria-labelledby="todo-h">
          <h2 id="todo-h">What needs you</h2>
          <div className="stack stagger" style={{ gap: 6 }}>
            {NEXT.filter((n) => (sum.counts[n.action] ?? 0) > 0).map((n) => (
              <button key={n.action} type="button" onClick={() => go("outreach", { tab: "leads", filter: n.action })} style={{ justifyContent: "space-between" }}>
                <span>{n.label}</span>
                <strong className="num">{sum.counts[n.action]}</strong>
              </button>
            ))}
            {NEXT.every((n) => !(sum.counts[n.action] ?? 0)) && (
              <p className="muted">
                Nothing waiting. {sum.total === 0 ? "Add your first lead to start." : `${sum.counts["Wait for reply"] ?? 0} waiting for a reply.`}
              </p>
            )}
          </div>
          {sum.total === 0 && (
            <div className="row">
              <button type="button" className="primary" onClick={() => go("outreach", { tab: "leads", newLead: true })}>Add your first lead</button>
              <span className="muted small">or press <kbd>n</kbd></span>
            </div>
          )}
        </section>

        <section className="panel stack" aria-labelledby="sys-h">
          <div className="row">
            <span className={`dot ${snap.core.overall}`} />
            <h2 id="sys-h">{attention.length === 0 ? "System: all good" : `System: ${attention.length} ${attention.length === 1 ? "thing needs" : "things need"} attention`}</h2>
            <span className="spacer" />
            <button type="button" onClick={() => go("system")}>Open</button>
          </div>
          {attention.map((c) => (
            <button key={c.id} type="button" onClick={() => go("system")} style={{ justifyContent: "flex-start", textAlign: "left" }}>
              <span className={`dot ${c.level}`} /> {c.label}: {c.fix}
            </button>
          ))}
          <h3 style={{ marginTop: 4 }}>Recent activity</h3>
          <div className="events stagger">
            {snap.core.events.slice(0, 6).map((e) => (
              <div className="event" key={e.id}>
                <span className="muted num">{when(e.at)}</span>
                <span>{e.summary}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
