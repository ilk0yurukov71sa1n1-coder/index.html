"use client";

import { useState } from "react";
import type { AnalysisResult } from "@/lib/protocol.ts";
import { riskLevel, RULES } from "@/lib/analyze.ts";
import { formatDate, formatDuration, formatHours, formatMoney, formatNumber, formatPercent } from "@/lib/format.ts";

const MAX_ROWS = 8;
/** The hosted preview cannot open the print dialog; the installed app can. */
const CAN_PRINT = process.env.NEXT_PUBLIC_PREVIEW !== "1";

/** One-page printable client report. "Save as PDF" uses the browser's own print dialog. */
export function Report({ result, fileName, onBack }: { result: AnalysisResult; fileName: string; onBack: () => void }) {
  const [client, setClient] = useState("");
  const a = result.analysis;
  const t = a.totals;
  const s = a.settings;
  const rows = a.workflows.slice(0, MAX_ROWS);
  const hidden = a.workflows.length - rows.length;

  return (
    <div className="stack">
      <div className="row no-print">
        <button type="button" onClick={onBack}>
          ← Back to dashboard
        </button>
        <label className="field" style={{ gridAutoFlow: "column", alignItems: "center", gap: 8 }}>
          Client name (optional)
          <input
            type="text"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="e.g. Acme Ltd"
            style={{ font: "inherit", padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
          />
        </label>
        <span className="spacer" />
        {CAN_PRINT && (
          <button type="button" className="btn-primary" onClick={() => window.print()}>
            Save as PDF
          </button>
        )}
      </div>
      <p className="muted small no-print" style={{ margin: 0 }}>
        {CAN_PRINT
          ? "In the print dialog choose “Save as PDF”. Turn off “Headers and footers” for the cleanest result."
          : "This is the online preview. Saving the report as a PDF works in the installed app on your Mac."}
      </p>

      <article className="report-page" aria-label="Client report">
        <header className="report-head">
          <div>
            <h1>Automation Health Check</h1>
            <div className="r-muted">
              {client ? `Prepared for ${client} · ` : ""}
              Period: {formatDate(t.firstRun)} – {formatDate(t.lastRun)} · {formatNumber(t.runs)} runs across {a.workflows.length} workflows
            </div>
          </div>
          <div className="r-muted" style={{ textAlign: "right" }}>
            Report date
            <br />
            <strong style={{ color: "#111" }}>{formatDate(Date.now())}</strong>
          </div>
        </header>

        <div className="r-scores">
          <div className="r-score">
            <div className="l">Risk score (0–100)</div>
            <div className="v">
              {t.risk} <span style={{ fontSize: 12, fontWeight: 600 }}>{riskLevel(t.risk)}</span>
            </div>
          </div>
          <div className="r-score">
            <div className="l">Success rate</div>
            <div className="v">{formatPercent(t.successRate)}</div>
            <div className="l">{formatPercent(t.trueSuccessRate)} excl. silent failures</div>
          </div>
          <div className="r-score">
            <div className="l">Failed / silent</div>
            <div className="v">
              {formatNumber(t.failed)} / {formatNumber(t.silentTotal)}
            </div>
          </div>
          <div className="r-score">
            <div className="l">Est. money wasted</div>
            <div className="v">{formatMoney(t.wastedMoney, s.currency)}</div>
          </div>
          <div className="r-score">
            <div className="l">Est. hours lost</div>
            <div className="v">{formatHours(t.hoursLost)}</div>
          </div>
        </div>

        <h2>Top problems</h2>
        {a.problems.length === 0 ? (
          <p>No failures or silent failures were found in this period.</p>
        ) : (
          <ol>
            {a.problems.map((p) => (
              <li key={`${p.workflow}-${p.kind}`}>{p.text}</li>
            ))}
          </ol>
        )}

        <h2>What we recommend</h2>
        <ul>
          {a.recommendations.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>

        <h2>Workflows</h2>
        <table className="r-table">
          <thead>
            <tr>
              <th>Workflow</th>
              <th>Risk</th>
              <th>Runs</th>
              <th>Success</th>
              <th>Failed</th>
              <th>Silent</th>
              <th>p95 duration</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.workflow}>
                <td>{w.workflow}</td>
                <td>
                  {w.risk} {riskLevel(w.risk)}
                </td>
                <td>{formatNumber(w.runs)}</td>
                <td>{formatPercent(w.successRate)}</td>
                <td>{formatNumber(w.failed)}</td>
                <td>{w.limitedHistory ? "n/a" : formatNumber(w.silentTotal)}</td>
                <td>{formatDuration(w.p95DurationMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {hidden > 0 && <p className="r-muted" style={{ marginTop: 4 }}>+ {hidden} lower-risk workflows not shown.</p>}

        <h2>How these numbers are calculated</h2>
        <p className="r-muted" style={{ margin: 0 }}>
          Silent failures are runs marked “success” that returned no data when the workflow normally does, took over {RULES.slowFactor}× or under{" "}
          {RULES.fastFactor}× the usual time, or scheduled runs that never happened (estimated from gaps over {RULES.gapFactor}× the usual interval).
          Money and hours are estimates: (failed + silent) × {formatMoney(s.costPerFailure, s.currency)} and × {s.minutesPerFailure} minutes. Risk score
          = min(50, 200 × failure rate) + min(35, 300 × silent rate) + min(15, 150 × missed share). Times are UTC.
        </p>

        <footer className="r-foot">
          <span>Analysed by Rollcfluence</span>
          <span>Source: {fileName}</span>
        </footer>
      </article>
    </div>
  );
}
