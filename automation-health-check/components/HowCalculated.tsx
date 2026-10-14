import { RULES } from "@/lib/analyze.ts";
import type { Settings } from "@/lib/types.ts";
import { formatMoney } from "@/lib/format.ts";

/** Plain-language explanation of every number on the dashboard. */
export function HowCalculated({ settings }: { settings: Settings }) {
  return (
    <details className="panel how">
      <summary>How we calculate this</summary>
      <ul className="small">
        <li>
          <strong>Success rate</strong> = runs your tool marked as success ÷ all runs. The &ldquo;real&rdquo; rate also removes runs we flagged as silent failures.
        </li>
        <li>
          <strong>Silent failures</strong> are runs that said &ldquo;success&rdquo; but probably did not do their job. We only judge workflows with at least {RULES.minHistory} successful runs. Each run is counted once:
          <ul>
            <li>
              <em>Empty output:</em> returned 0 items, while at least {RULES.normalOutputShare * 100}% of that workflow&rsquo;s successful runs return data.
            </li>
            <li>
              <em>Abnormal duration:</em> took more than {RULES.slowFactor}× the workflow&rsquo;s median successful duration, or less than {RULES.fastFactor}× of it.
            </li>
            <li>
              <em>Missed runs:</em> if at least {RULES.regularShare * 100}% of the gaps between runs are within 0.5×–1.5× of the usual gap, the workflow is treated as scheduled. A gap longer than {RULES.gapFactor}× the usual gap counts as (gap ÷ usual gap − 1) missed runs, rounded. This is an estimate.
            </li>
          </ul>
        </li>
        <li>
          <strong>Wasted money</strong> = (failed runs + silent failures) × {formatMoney(settings.costPerFailure, settings.currency)} (your setting).
        </li>
        <li>
          <strong>Hours lost</strong> = (failed runs + silent failures) × {settings.minutesPerFailure} minutes (your setting) ÷ 60.
        </li>
        <li>
          <strong>Risk score</strong> (0–100, higher is worse), per workflow and overall:
          <code className="formula">
            {"min(50, 200 × failure rate)\n+ min(35, 300 × silent-failure rate)\n+ min(15, 150 × missed runs ÷ (runs + missed runs))"}
          </code>
          0–19 is Low, 20–49 Elevated, 50+ High. Example: 10% failures and 5% silent failures give 20 + 15 = 35.
        </li>
        <li>
          <strong>Trend</strong> shows, for each of the last {RULES.trendDays} days up to the last run in your file (UTC), (failed + silent) ÷ runs that day.
        </li>
        <li>
          <strong>p95 duration</strong>: 95% of runs finished within this time.
        </li>
      </ul>
    </details>
  );
}
