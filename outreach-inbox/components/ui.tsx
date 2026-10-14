"use client";

import type { NextAction } from "@/lib/leads.ts";
import type { Platform } from "@/lib/types.ts";

export const PLATFORM_LABEL: Record<Platform, string> = { email: "Email", instagram: "Instagram", linkedin: "LinkedIn", x: "X" };

export function NextActionTag({ action }: { action: NextAction }) {
  const cls =
    action === "Do not contact" || action === "Thank them and close"
      ? "na-stop"
      : action === "Wait for reply"
        ? "na-wait"
        : action === "Send follow-up"
          ? "na-follow"
          : "na-todo";
  return <span className={`na ${cls}`}>{action}</span>;
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T | null; options: { value: T | null; label: string }[]; onChange: (v: T | null) => void; label: string }) {
  return (
    <span className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.label} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </span>
  );
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/Sofia" }) : "–";
