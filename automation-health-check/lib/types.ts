/** One normalised automation run. Times are epoch milliseconds (UTC). */
export interface Run {
  workflow: string;
  start: number;
  ok: boolean;
  durationMs: number | null;
  cost: number | null;
  /** Items or bytes produced. null = unknown (column not mapped or blank). */
  output: number | null;
  error: string | null;
}

export interface Settings {
  costPerFailure: number;
  minutesPerFailure: number;
  currency: string;
}

export const DEFAULT_SETTINGS: Settings = {
  costPerFailure: 5,
  minutesPerFailure: 15,
  currency: "€",
};

export type SilentKind = "empty-output" | "slow" | "too-fast" | "missed-runs";
export type ProblemKind = "failures" | "empty-output" | "duration" | "missed-runs";

export interface SilentFinding {
  workflow: string;
  kind: SilentKind;
  /** Run start time, or for missed runs the start of the gap. */
  at: number;
  reason: string;
}

export interface WorkflowStats {
  workflow: string;
  runs: number;
  ok: number;
  failed: number;
  successRate: number;
  avgDurationMs: number | null;
  p95DurationMs: number | null;
  medianDurationMs: number | null;
  /** Usual gap between runs, if the workflow runs on a regular schedule. */
  scheduleIntervalMs: number | null;
  emptyOutput: number;
  slow: number;
  tooFast: number;
  /** Runs that said "success" but were flagged as silent failures. */
  silentRuns: number;
  /** Estimated scheduled runs that never happened. */
  missedRuns: number;
  /** silentRuns + missedRuns */
  silentTotal: number;
  /** Fewer than MIN_HISTORY successful runs: silent checks were skipped. */
  limitedHistory: boolean;
  topError: { message: string; count: number } | null;
  risk: number;
  riskParts: RiskParts;
  firstRun: number;
  lastRun: number;
}

export interface RiskParts {
  failures: number;
  silent: number;
  missed: number;
}

export interface DayPoint {
  /** UTC day, YYYY-MM-DD */
  day: string;
  runs: number;
  failed: number;
  silent: number;
  /** (failed + silent) / runs, null when there were no runs that day */
  rate: number | null;
}

export interface Problem {
  workflow: string;
  kind: ProblemKind;
  count: number;
  text: string;
}

export interface Analysis {
  totals: {
    runs: number;
    ok: number;
    failed: number;
    silentRuns: number;
    missedRuns: number;
    silentTotal: number;
    /** failed + silentTotal */
    problemCount: number;
    successRate: number;
    /** Success rate after removing runs flagged as silent failures. */
    trueSuccessRate: number;
    avgDurationMs: number | null;
    p95DurationMs: number | null;
    wastedMoney: number;
    hoursLost: number;
    /** Sum of the cost column on failed + silent runs, if a cost column exists. */
    recordedCostOfProblems: number | null;
    risk: number;
    riskParts: RiskParts;
    firstRun: number;
    lastRun: number;
  };
  workflows: WorkflowStats[];
  trend: DayPoint[];
  problems: Problem[];
  recommendations: string[];
  /** Up to MAX_FINDINGS examples, newest first. */
  findings: SilentFinding[];
  settings: Settings;
}
