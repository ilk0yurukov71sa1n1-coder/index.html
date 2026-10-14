"use client";

import { useState, type DragEvent } from "react";
import type { Settings } from "@/lib/types.ts";
import { SettingsFields } from "./SettingsFields.tsx";

interface Props {
  busy: boolean;
  stage: string | null;
  error: string | null;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onFile: (file: File) => void;
  onSample: () => void;
}

export function ImportScreen({ busy, stage, error, settings, onSettings, onFile, onSample }: Props) {
  const [over, setOver] = useState(false);

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files[0];
    if (file && !busy) onFile(file);
  };

  return (
    <div className="stack">
      <div>
        <h1>How healthy are your automations?</h1>
        <p className="muted">
          Drop in a run-history export from n8n, Make, Zapier or any tool. See what fails, what fails silently and what it costs.
        </p>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="import-grid">
        <div className="stack">
          <label
            className={`drop${over ? " over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
          >
            <input
              type="file"
              accept=".csv,.json,.txt,.tsv,text/csv,application/json"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />
            <span className="big">{busy ? stage ?? "Working…" : "Drop a CSV or JSON file here"}</span>
            <span className="muted">or click to choose a file</span>
            <span className="lock">
              <strong>Your file never leaves this computer.</strong> It is read and analysed inside this browser tab.
            </span>
          </label>
          <div className="row">
            <button type="button" onClick={onSample} disabled={busy}>
              Load sample data
            </button>
            <span className="muted small">About 3,000 fictional runs across 8 workflows, with planted problems.</span>
          </div>
        </div>
        <div className="panel stack">
          <h2>Settings</h2>
          <SettingsFields settings={settings} onChange={onSettings} />
          <p className="muted small">
            Used to estimate wasted money and time. You can change these later on the dashboard.
          </p>
          <h3>Private by design</h3>
          <ul className="muted small" style={{ margin: 0, paddingLeft: "1.1rem" }}>
            <li>No uploads, no accounts, no analytics.</li>
            <li>Nothing is stored. Close the tab and it is gone.</li>
            <li>The browser blocks this page from sending data to any other server.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
