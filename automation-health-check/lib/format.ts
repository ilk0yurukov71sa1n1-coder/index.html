/** Human-friendly formatting shared by the analysis text and the UI. */

const trim = (s: string) => s.replace(/\.0$/, "");

export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "–";
  const abs = Math.abs(ms);
  if (abs < 1000) return `${Math.round(ms)} ms`;
  if (abs < 60_000) return `${trim((ms / 1000).toFixed(1))} s`;
  if (abs < 3_600_000) return `${trim((ms / 60_000).toFixed(1))} min`;
  if (abs < 48 * 3_600_000) return `${trim((ms / 3_600_000).toFixed(1))} h`;
  return `${trim((ms / 86_400_000).toFixed(1))} days`;
}

/** 0.2 -> "20%", 0.123 -> "12.3%", 0.99996 -> "99.99%" (never rounds up to 100%) */
export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return "–";
  const pct = ratio * 100;
  if (Number.isInteger(pct)) return `${pct}%`;
  for (const digits of [1, 2]) {
    const s = pct.toFixed(digits);
    if (Number(s) !== 100 && Number(s) !== 0) return `${trim(s)}%`;
  }
  return `${pct < 50 ? "<0.01" : ">99.99"}%`;
}

export function formatMoney(amount: number, currency: string): string {
  const rounded = Math.round(amount * 100) / 100;
  const text = rounded.toLocaleString("en-GB", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${currency}${text}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-GB");
}

export function formatHours(h: number): string {
  if (h < 10) return `${trim(h.toFixed(1))} h`;
  return `${formatNumber(Math.round(h))} h`;
}

/** Epoch ms -> "14 Oct 2026" (UTC) */
export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }) + " UTC";
}
