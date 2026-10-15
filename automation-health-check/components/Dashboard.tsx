"use client";

import type { AnalysisResult } from "@/lib/protocol.ts";
import type { Settings, WorkflowStats } from "@/lib/types.ts";
import { riskLevel } from "@/lib/analyze.ts";
import { formatDate, formatDateTime, formatDuration, formatHours, formatMoney, formatNumber, formatPercent } from "@/lib/format.ts";
import { SettingsFields } from "./SettingsFields.tsx";
import { TrendChart } from "./TrendChart.tsx";
import { HowCalculated } from "./HowCalculated.tsx";
import { Decrypt, GlowCard, Num, PageTitle, PrimaryButton } from "./fx.tsx";

interface Props {
  result: AnalysisResult;
  fileName: string;
  settings: Settings;
  onSettings: (s: Settings) => void;
  busy: boolean;
  error: string | null;
  onReport: () => void;
  onRemap: () => void;
  onNewFile: () => void;
}

function Badges({ w }: { w: WorkflowStats }) {
  return (
    <div className="badges">
      {w.emptyOutput > 0 && <span className="badge badge-warn">{w.emptyOutput} empty “success”</span>}
      {w.slow + w.tooFast > 0 && <span className="badge badge-warn">{w.slow + w.tooFast} odd duration</span>}
      {w.missedRuns > 0 && <span className="badge badge-warn">~{w.missedRuns} missed runs</span>}
      {w.limitedHistory && <span className="badge badge-muted">too little history</span>}
    </div>
  );
}

export function Dashboard({ result, fileName, settings, onSettings, busy, error, onReport, onRemap, onNewFile }: Props) {
  const { analysis: a, report, runsUsed } = result;
  const t = a.totals;
  const level = riskLevel(t.risk);
  const skipped = report.skipped.badDate + report.skipped.missingWorkflow + report.skipped.ignoredStatus;

  return (
    <div className="stack">
      <div className="row">
        <PageTitle
          eyebrow="Health check"
          text="Automation health"
          sub={`${fileName} · ${formatNumber(runsUsed)} runs · ${formatDate(t.firstRun)} – ${formatDate(t.lastRun)}`}
        />
        <span className="spacer" />
        <button type="button" onClick={onNewFile}>
          New file
        </button>
        <button type="button" onClick={onRemap}>
          Edit columns
        </button>
        <PrimaryButton onClick={onReport}>Client report</PrimaryButton>
      </div>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {skipped > 0 && (
        <div className="notice small">
          {formatNumber(skipped)} of {formatNumber(report.totalRows)} rows were not used:{" "}
          {[
            report.skipped.badDate && `${formatNumber(report.skipped.badDate)} with an unreadable start time`,
            report.skipped.missingWorkflow && `${formatNumber(report.skipped.missingWorkflow)} without a workflow name`,
            report.skipped.ignoredStatus && `${formatNumber(report.skipped.ignoredStatus)} with an ignored status (e.g. still running)`,
          ]
            .filter(Boolean)
            .join(", ")}
          .
        </div>
      )}

      <section className="dash-head" aria-label="Summary">
        <GlowCard className="score">
          <span className="label">Overall risk score</span>
          <span className={`value level-${level}`}>
            <Num value={t.risk} />
          </span>
          <span className={`verdict-badge level-${level}`}>
            <Decrypt text={`${level} risk`} />
          </span>
          <span className="sub">0 = no problems found · 100 = worst</span>
        </GlowCard>
        <div className="cards">
          <GlowCard>
            <span className="label">Success rate</span>
            <span className="value num">{formatPercent(t.successRate)}</span>
            <span className="sub">{formatPercent(t.trueSuccessRate)} after removing silent failures</span>
          </GlowCard>
          <GlowCard>
            <span className="label">Silent failures</span>
            <span className="value">
              <Num value={t.silentTotal} />
            </span>
            <span className="sub">
              {formatNumber(t.silentRuns)} runs said “success” wrongly
              {t.missedRuns > 0 && ` · ~${formatNumber(t.missedRuns)} missed runs`}
            </span>
          </GlowCard>
          <GlowCard>
            <span className="label">Estimated money wasted</span>
            <span className="value num">{formatMoney(t.wastedMoney, settings.currency)}</span>
            <span className="sub">
              {formatNumber(t.problemCount)} problems × {formatMoney(settings.costPerFailure, settings.currency)}
              {t.recordedCostOfProblems !== null && ` · platform cost of these runs: ${formatMoney(t.recordedCostOfProblems, settings.currency)}`}
            </span>
          </GlowCard>
          <GlowCard>
            <span className="label">Estimated hours lost</span>
            <span className="value num">{formatHours(t.hoursLost)}</span>
            <span className="sub">
              {formatNumber(t.failed)} failed + {formatNumber(t.silentTotal)} silent × {settings.minutesPerFailure} min
            </span>
          </GlowCard>
        </div>
      </section>

      <div className="two-col">
        <section className="panel stack" aria-labelledby="trend-h">
          <h2 id="trend-h">Daily problem rate, last 30 days</h2>
          <TrendChart trend={a.trend} />
        </section>
        <section className="panel stack" aria-labelledby="top-h">
          <h2 id="top-h">Top problems</h2>
          {a.problems.length === 0 ? (
            <p className="muted">No failures or silent failures found.</p>
          ) : (
            <ol className="problems">
              {a.problems.map((p) => (
                <li key={`${p.workflow}-${p.kind}`}>{p.text}</li>
              ))}
            </ol>
          )}
          <h3>What we recommend</h3>
          <ul className="problems small">
            {a.recommendations.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel stack" aria-labelledby="wf-h">
        <h2 id="wf-h">Workflows</h2>
        <div className="wf-table-wrap">
          <table className="wf-table">
            <thead>
              <tr>
                <th scope="col">Workflow</th>
                <th scope="col">Risk</th>
                <th scope="col">Runs</th>
                <th scope="col">Success rate</th>
                <th scope="col">Failed</th>
                <th scope="col">Silent</th>
                <th scope="col">Avg duration</th>
                <th scope="col">p95 duration</th>
                <th scope="col">Schedule</th>
              </tr>
            </thead>
            <tbody>
              {a.workflows.map((w) => (
                <tr key={w.workflow}>
                  <td>
                    {w.workflow}
                    <Badges w={w} />
                  </td>
                  <td>
                    <span className={`risk-chip num level-${riskLevel(w.risk)}`} title={`${riskLevel(w.risk)} risk: failures ${w.riskParts.failures} + silent ${w.riskParts.silent} + missed ${w.riskParts.missed}`}>
                      {w.risk}
                    </span>
                  </td>
                  <td className="num">{formatNumber(w.runs)}</td>
                  <td className="num">{formatPercent(w.successRate)}</td>
                  <td className="num">{formatNumber(w.failed)}</td>
                  <td className="num">{formatNumber(w.silentTotal)}</td>
                  <td className="num">{formatDuration(w.avgDurationMs)}</td>
                  <td className="num">{formatDuration(w.p95DurationMs)}</td>
                  <td className="muted">{w.scheduleIntervalMs ? `every ${formatDuration(w.scheduleIntervalMs)}` : "irregular"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {a.findings.length > 0 && (
        <section className="panel stack" aria-labelledby="find-h">
          <h2 id="find-h">Silent failures, newest first</h2>
          <ul className="findings small">
            {a.findings.slice(0, 100).map((f, i) => (
              <li key={i}>
                <strong>{f.workflow}</strong> <span className="muted">{formatDateTime(f.at)}</span>: {f.reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel stack no-print" aria-labelledby="set-h">
        <h2 id="set-h">Settings {busy && <span className="muted small">updating…</span>}</h2>
        <SettingsFields settings={settings} onChange={onSettings} />
      </section>

      <HowCalculated settings={settings} />
    </div>
  );
}
