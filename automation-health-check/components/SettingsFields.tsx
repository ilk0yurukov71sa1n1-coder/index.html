"use client";

import type { Settings } from "@/lib/types.ts";

const CURRENCIES = ["€", "$", "£"];

export function SettingsFields({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const num = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  return (
    <div className="row" style={{ alignItems: "end" }}>
      <label className="field">
        Cost per failed run
        <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
          <select
            aria-label="Currency"
            value={settings.currency}
            onChange={(e) => onChange({ ...settings, currency: e.target.value })}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            step="0.5"
            value={settings.costPerFailure}
            onChange={(e) => onChange({ ...settings, costPerFailure: num(e.target.value) })}
          />
        </span>
      </label>
      <label className="field">
        Minutes of human time per failure
        <input
          type="number"
          min={0}
          step="1"
          value={settings.minutesPerFailure}
          onChange={(e) => onChange({ ...settings, minutesPerFailure: num(e.target.value) })}
        />
      </label>
    </div>
  );
}
