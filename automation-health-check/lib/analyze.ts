import type {
  Analysis,
  DayPoint,
  Problem,
  ProblemKind,
  RiskParts,
  Run,
  Settings,
  SilentFinding,
  WorkflowStats,
} from "./types.ts";
import { formatDuration, formatPercent } from "./format.ts";

/**
 * Thresholds. They are shown to users in the "How we calculate this" panel,
 * so change them there too if you change them here.
 */
export const RULES = {
  /** Successful runs needed before a workflow is judged for silent failures. */
  minHistory: 10,
  /** "Normally returns data": at least this share of successful runs had output > 0. */
  normalOutputShare: 0.8,
  /** Slow if duration > slowFactor x median successful duration. */
  slowFactor: 3,
  /** Too fast if duration < fastFactor x median successful duration. */
  fastFactor: 0.1,
  /** Scheduled if this share of gaps is within 0.5x–1.5x the median gap. */
  regularShare: 0.7,
  /** A gap longer than gapFactor x usual interval means runs were missed. */
  gapFactor: 3,
  trendDays: 30,
  maxFindings: 200,
} as const;

const DAY = 86_400_000;

// ---------- small statistics helpers ----------

export function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Nearest-rank percentile (the value at rank ceil(p/100 * n)). */
export function percentile(xs: readonly number[], p: number): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * s.length));
  return s[rank - 1]!;
}

function mean(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  let sum = 0;
  for (const x of xs) sum += x;
  return sum / xs.length;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Risk score 0–100 (higher = riskier):
 *   failures: 200 x failure rate,       capped at 50
 *   silent:   300 x silent-failure rate, capped at 35
 *   missed:   150 x missed-run share,    capped at 15
 */
export function riskScore(
  failureRate: number,
  silentRate: number,
  missedShare: number,
): { score: number; parts: RiskParts } {
  const failures = Math.min(50, 200 * failureRate);
  const silent = Math.min(35, 300 * silentRate);
  const missed = Math.min(15, 150 * missedShare);
  return {
    score: Math.round(failures + silent + missed),
    parts: { failures: round1(failures), silent: round1(silent), missed: round1(missed) },
  };
}

export type RiskLevel = "Low" | "Elevated" | "High";
export function riskLevel(score: number): RiskLevel {
  if (score < 20) return "Low";
  if (score < 50) return "Elevated";
  return "High";
}

const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Deterministic order so the same data always gives the same answer. */
function compareRuns(a: Run, b: Run): number {
  return (
    a.start - b.start ||
    Number(a.ok) - Number(b.ok) ||
    (a.durationMs ?? -1) - (b.durationMs ?? -1) ||
    (a.output ?? -1) - (b.output ?? -1) ||
    (a.error ?? "").localeCompare(b.error ?? "")
  );
}

interface WorkflowResult {
  stats: WorkflowStats;
  /** indexes (into the sorted run list) of runs flagged as silent failures */
  silentIdx: Set<number>;
  findings: SilentFinding[];
  longestGapMs: number;
}

function analyzeWorkflow(name: string, runs: Run[]): WorkflowResult {
  const findings: SilentFinding[] = [];
  const silentIdx = new Set<number>();
  const okRuns = runs.filter((r) => r.ok);
  const failed = runs.length - okRuns.length;
  const limitedHistory = okRuns.length < RULES.minHistory;

  const durations = runs.flatMap((r) => (r.durationMs === null ? [] : [r.durationMs]));
  const okDurations = okRuns.flatMap((r) => (r.durationMs === null ? [] : [r.durationMs]));
  const medianOk = median(okDurations);

  // a. empty output on "success"
  const knownOutput = okRuns.filter((r) => r.output !== null);
  const withData = knownOutput.filter((r) => (r.output ?? 0) > 0).length;
  const normallyReturnsData =
    knownOutput.length >= RULES.minHistory && withData / knownOutput.length >= RULES.normalOutputShare;

  let emptyOutput = 0;
  let slow = 0;
  let tooFast = 0;

  if (!limitedHistory) {
    runs.forEach((r, i) => {
      if (!r.ok) return;
      if (normallyReturnsData && r.output === 0) {
        emptyOutput++;
        silentIdx.add(i);
        findings.push({
          workflow: name,
          kind: "empty-output",
          at: r.start,
          reason: `Said "success" but returned nothing (0 items); ${formatPercent(withData / knownOutput.length)} of its successful runs return data.`,
        });
        return;
      }
      // b. duration far outside the normal range
      if (medianOk !== null && medianOk > 0 && r.durationMs !== null && okDurations.length >= RULES.minHistory) {
        if (r.durationMs > RULES.slowFactor * medianOk) {
          slow++;
          silentIdx.add(i);
          findings.push({
            workflow: name,
            kind: "slow",
            at: r.start,
            reason: `Took ${formatDuration(r.durationMs)}, more than ${RULES.slowFactor}x its usual ${formatDuration(medianOk)}.`,
          });
        } else if (r.durationMs < RULES.fastFactor * medianOk) {
          tooFast++;
          silentIdx.add(i);
          findings.push({
            workflow: name,
            kind: "too-fast",
            at: r.start,
            reason: `Finished in ${formatDuration(r.durationMs)}, suspiciously fast compared with its usual ${formatDuration(medianOk)}.`,
          });
        }
      }
    });
  }

  // c. missed runs on a regular schedule
  let scheduleIntervalMs: number | null = null;
  let missedRuns = 0;
  let longestGapMs = 0;
  const gaps: number[] = [];
  for (let i = 1; i < runs.length; i++) gaps.push(runs[i]!.start - runs[i - 1]!.start);
  const usual = median(gaps);
  if (gaps.length >= RULES.minHistory && usual !== null && usual > 0) {
    const regular = gaps.filter((g) => g >= 0.5 * usual && g <= 1.5 * usual).length / gaps.length;
    if (regular >= RULES.regularShare) {
      scheduleIntervalMs = usual;
      gaps.forEach((g, i) => {
        if (g > RULES.gapFactor * usual) {
          const missed = Math.round(g / usual) - 1;
          missedRuns += missed;
          longestGapMs = Math.max(longestGapMs, g);
          findings.push({
            workflow: name,
            kind: "missed-runs",
            at: runs[i]!.start,
            reason: `No run for ${formatDuration(g)} (usually every ${formatDuration(usual)}): about ${missed} run${missed === 1 ? "" : "s"} missed.`,
          });
        }
      });
    }
  }

  const errorCounts = new Map<string, number>();
  for (const r of runs) {
    if (!r.ok && r.error) errorCounts.set(r.error, (errorCounts.get(r.error) ?? 0) + 1);
  }
  let topError: WorkflowStats["topError"] = null;
  for (const [message, count] of errorCounts) {
    if (!topError || count > topError.count || (count === topError.count && message < topError.message)) {
      topError = { message, count };
    }
  }

  const silentRuns = silentIdx.size;
  const n = runs.length;
  const { score, parts } = riskScore(failed / n, silentRuns / n, missedRuns / (n + missedRuns));

  return {
    stats: {
      workflow: name,
      runs: n,
      ok: okRuns.length,
      failed,
      successRate: okRuns.length / n,
      avgDurationMs: mean(durations),
      p95DurationMs: percentile(durations, 95),
      medianDurationMs: medianOk,
      scheduleIntervalMs,
      emptyOutput,
      slow,
      tooFast,
      silentRuns,
      missedRuns,
      silentTotal: silentRuns + missedRuns,
      limitedHistory,
      topError,
      risk: score,
      riskParts: parts,
      firstRun: runs[0]!.start,
      lastRun: runs[n - 1]!.start,
    },
    silentIdx,
    findings,
    longestGapMs,
  };
}

function problemsFor(w: WorkflowStats, longestGapMs: number): Problem[] {
  const out: Problem[] = [];
  const name = w.workflow;
  if (w.failed > 0) {
    const err = w.topError ? ` Most common error: "${w.topError.message}" (${w.topError.count}×).` : "";
    out.push({
      workflow: name,
      kind: "failures",
      count: w.failed,
      text: `${name} failed ${w.failed} of ${w.runs} runs (${formatPercent(w.failed / w.runs)}).${err}`,
    });
  }
  if (w.emptyOutput > 0) {
    out.push({
      workflow: name,
      kind: "empty-output",
      count: w.emptyOutput,
      text: `${name} ran ${w.runs} times, ${w.emptyOutput} returned nothing but said "success".`,
    });
  }
  const odd = w.slow + w.tooFast;
  if (odd > 0) {
    const parts = [w.slow ? `${w.slow} took over ${RULES.slowFactor}x longer than usual` : "", w.tooFast ? `${w.tooFast} finished suspiciously fast` : ""]
      .filter(Boolean)
      .join(" and ");
    out.push({
      workflow: name,
      kind: "duration",
      count: odd,
      text: `${name} reported "success" on ${odd} runs with abnormal timing: ${parts} (usual: ${formatDuration(w.medianDurationMs)}).`,
    });
  }
  if (w.missedRuns > 0) {
    out.push({
      workflow: name,
      kind: "missed-runs",
      count: w.missedRuns,
      text: `${name} usually runs every ${formatDuration(w.scheduleIntervalMs)}, but about ${w.missedRuns} expected runs never happened (longest gap: ${formatDuration(longestGapMs)}).`,
    });
  }
  return out;
}

const KIND_ORDER: Record<ProblemKind, number> = { "empty-output": 0, "missed-runs": 1, failures: 2, duration: 3 };

function recommend(p: Problem, w: WorkflowStats): string {
  switch (p.kind) {
    case "empty-output":
      return `Add an output check to ${w.workflow}: when it returns zero items, stop the run and alert someone instead of reporting success.`;
    case "missed-runs":
      return `Add a missed-run alert to ${w.workflow}: notify someone if no run has started ${formatDuration(2 * (w.scheduleIntervalMs ?? 0))} after the last one.`;
    case "duration":
      return `Set a timeout on ${w.workflow} and alert when a run takes more than ${RULES.slowFactor}x its usual ${formatDuration(w.medianDurationMs)}, or ends almost instantly.`;
    case "failures": {
      const err = w.topError;
      let fix = "Send failures to an alert channel so they are seen the same day.";
      if (err && /429|rate.?limit|too many requests/i.test(err.message)) fix = "This looks like rate limiting: add retries with back-off and spread requests out.";
      else if (err && /time.?out|timed out/i.test(err.message)) fix = "This looks like a timeout: raise the timeout or add retries with back-off.";
      else if (err && /auth|401|403|token|credential|unauthori[sz]ed/i.test(err.message)) fix = "This looks like an expired credential: re-connect the account and add an alert for auth errors.";
      return err
        ? `Fix the most common error in ${w.workflow} ("${err.message}", ${err.count}×). ${fix}`
        : `Review the ${w.failed} failed runs of ${w.workflow}. ${fix}`;
    }
  }
}

export function analyze(input: readonly Run[], settings: Settings): Analysis {
  const runs = [...input].sort(compareRuns);
  const byWorkflow = new Map<string, Run[]>();
  for (const r of runs) {
    const list = byWorkflow.get(r.workflow);
    if (list) list.push(r);
    else byWorkflow.set(r.workflow, [r]);
  }

  const results = [...byWorkflow.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, list]) => ({ list, ...analyzeWorkflow(name, list) }));

  // ---------- totals ----------
  const n = runs.length;
  const failed = results.reduce((s, r) => s + r.stats.failed, 0);
  const silentRuns = results.reduce((s, r) => s + r.stats.silentRuns, 0);
  const missedRuns = results.reduce((s, r) => s + r.stats.missedRuns, 0);
  const silentTotal = silentRuns + missedRuns;
  const problemCount = failed + silentTotal;
  const durations = runs.flatMap((r) => (r.durationMs === null ? [] : [r.durationMs]));
  const hasCost = runs.some((r) => r.cost !== null);
  let recordedCost = 0;
  for (const r of results) {
    r.list.forEach((run, i) => {
      if ((!run.ok || r.silentIdx.has(i)) && run.cost !== null) recordedCost += run.cost;
    });
  }
  const risk = n === 0 ? riskScore(0, 0, 0) : riskScore(failed / n, silentRuns / n, missedRuns / (n + missedRuns));

  // ---------- trend: last 30 UTC days ending on the last run's day ----------
  const trend: DayPoint[] = [];
  if (n > 0) {
    const lastDay = Date.parse(utcDay(runs[n - 1]!.start) + "T00:00:00Z");
    const index = new Map<string, DayPoint>();
    for (let d = RULES.trendDays - 1; d >= 0; d--) {
      const day = utcDay(lastDay - d * DAY);
      const point: DayPoint = { day, runs: 0, failed: 0, silent: 0, rate: null };
      trend.push(point);
      index.set(day, point);
    }
    for (const r of results) {
      r.list.forEach((run, i) => {
        const p = index.get(utcDay(run.start));
        if (!p) return;
        p.runs++;
        if (!run.ok) p.failed++;
        else if (r.silentIdx.has(i)) p.silent++;
      });
    }
    for (const p of trend) if (p.runs > 0) p.rate = (p.failed + p.silent) / p.runs;
  }

  // ---------- problems & recommendations ----------
  const allProblems = results.flatMap((r) => problemsFor(r.stats, r.longestGapMs));
  allProblems.sort(
    (a, b) => b.count - a.count || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (a.workflow < b.workflow ? -1 : 1),
  );
  const problems = allProblems.slice(0, 3);
  const statsByName = new Map(results.map((r) => [r.stats.workflow, r.stats]));
  const recommendations = problems.map((p) => recommend(p, statsByName.get(p.workflow)!));
  if (n > 0 && problems.length === 0) {
    recommendations.push("No failures or silent failures were found in this period. Keep exporting run history and re-run this check monthly.");
  }
  const limited = results.filter((r) => r.stats.limitedHistory).length;
  if (limited > 0) {
    recommendations.push(
      `${limited} workflow${limited === 1 ? " has" : "s have"} fewer than ${RULES.minHistory} successful runs, so ${limited === 1 ? "it was" : "they were"} not checked for silent failures. Re-run this check when more history is available.`,
    );
  }

  const findings = results
    .flatMap((r) => r.findings)
    .sort((a, b) => b.at - a.at || (a.workflow < b.workflow ? -1 : 1))
    .slice(0, RULES.maxFindings);

  const workflows = results
    .map((r) => r.stats)
    .sort((a, b) => b.risk - a.risk || (a.workflow < b.workflow ? -1 : 1));

  return {
    totals: {
      runs: n,
      ok: n - failed,
      failed,
      silentRuns,
      missedRuns,
      silentTotal,
      problemCount,
      successRate: n === 0 ? 0 : (n - failed) / n,
      trueSuccessRate: n === 0 ? 0 : (n - failed - silentRuns) / n,
      avgDurationMs: mean(durations),
      p95DurationMs: percentile(durations, 95),
      wastedMoney: problemCount * settings.costPerFailure,
      hoursLost: (problemCount * settings.minutesPerFailure) / 60,
      recordedCostOfProblems: hasCost ? recordedCost : null,
      risk: risk.score,
      riskParts: risk.parts,
      firstRun: n ? runs[0]!.start : 0,
      lastRun: n ? runs[n - 1]!.start : 0,
    },
    workflows,
    trend,
    problems,
    recommendations,
    findings,
    settings,
  };
}
