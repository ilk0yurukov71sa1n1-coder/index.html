import { TIME_ZONE } from "./types.ts";

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Wall-clock parts in Europe/Sofia for an instant. */
export function sofiaParts(d: Date): { date: string; hour: number; minute: number } {
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) };
}

export const sofiaDate = (d: Date) => sofiaParts(d).date;

export const DAY_MS = 86_400_000;

export function daysBetween(fromIso: string, to: Date): number {
  return (to.getTime() - Date.parse(fromIso)) / DAY_MS;
}

export function formatSofia(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
