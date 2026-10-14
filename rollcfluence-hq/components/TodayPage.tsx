"use client";

import type { PageProps } from "./HqApp.tsx";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/Sofia", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Module 0 version of Today: system status and recent activity. Module 6 fills in the rest. */
export function TodayPage({ snap, go }: PageProps) {
  const attention = snap.checks.filter((c) => c.level === "red" || c.level === "amber");
  const hello = snap.settings.yourName ? `Hi ${snap.settings.yourName}` : "Hi";
  return (
    <div className="stack">
      <h1>{hello}. Here&rsquo;s today.</h1>
      <section className="panel stack" aria-labelledby="sys-h">
        <div className="row">
          <span className={`dot ${snap.overall}`} />
          <h2 id="sys-h">{attention.length === 0 ? "System: all good" : `System: ${attention.length} ${attention.length === 1 ? "thing needs" : "things need"} attention`}</h2>
          <span className="spacer" />
          <button type="button" onClick={() => go("system")}>Open System</button>
        </div>
        {attention.map((c) => (
          <button key={c.id} type="button" onClick={() => go("system")} style={{ justifyContent: "flex-start", textAlign: "left" }}>
            <span className={`dot ${c.level}`} /> {c.label}: {c.fix}
          </button>
        ))}
      </section>
      <section className="panel stack" aria-labelledby="next-h">
        <h2 id="next-h">Coming to this screen</h2>
        <p className="muted small">
          As each module is built, Today fills with what needs you: follow-ups due, replies to answer, interviews to run, reports due, your validation day and verdict, and
          emails sent today.
        </p>
      </section>
      <section className="panel stack" aria-labelledby="act-h">
        <h2 id="act-h">Recent activity</h2>
        <div className="events">
          {snap.events.slice(0, 8).map((e) => (
            <div className="event" key={e.id}>
              <span className="muted num">{when(e.at)}</span>
              <span>{e.summary}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
