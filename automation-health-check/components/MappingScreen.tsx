"use client";

import { FIELD_LABELS, REQUIRED_FIELDS, type Mapping, type MappingField, type StatusClass } from "@/lib/parse.ts";
import type { LoadedFile, StatusValue } from "@/lib/protocol.ts";
import { formatNumber } from "@/lib/format.ts";
import { PageTitle, PrimaryButton } from "./fx.tsx";

interface Props {
  loaded: LoadedFile;
  mapping: Mapping;
  onMapping: (m: Mapping) => void;
  statusValues: StatusValue[];
  statusMap: Record<string, StatusClass>;
  onStatusMap: (m: Record<string, StatusClass>) => void;
  onAnalyze: () => void;
  onBack: () => void;
  busy: boolean;
  stage: string | null;
  error: string | null;
}

const FIELDS = Object.keys(FIELD_LABELS) as MappingField[];

export function MappingScreen(p: Props) {
  const { loaded, mapping } = p;
  const missing = REQUIRED_FIELDS.filter((f) => !mapping[f]);
  const set = (field: MappingField, value: string) => p.onMapping({ ...mapping, [field]: value === "" ? null : value });

  return (
    <div className="stack">
      <div className="row">
        <PageTitle
          text="Match your columns"
          sub={
            <>
              <strong>{loaded.fileName}</strong>: {formatNumber(loaded.rowCount)} rows. We guessed the columns; check them and press Analyse.
            </>
          }
        />
        <span className="spacer" />
        <button type="button" onClick={p.onBack} disabled={p.busy}>
          Choose another file
        </button>
      </div>

      {p.error && (
        <div className="error" role="alert">
          {p.error}
        </div>
      )}

      <div className="two-col">
        <div className="panel">
          <table className="map-table">
            <thead>
              <tr>
                <th scope="col">What we need</th>
                <th scope="col">Column in your file</th>
              </tr>
            </thead>
            <tbody>
              {FIELDS.map((f) => {
                const info = FIELD_LABELS[f];
                const id = `map-${f}`;
                return (
                  <tr key={f}>
                    <td>
                      <label htmlFor={id}>
                        {info.label} {info.required && <span className="req" aria-label="required">*</span>}
                      </label>
                      <div className="muted small">{info.hint}</div>
                    </td>
                    <td>
                      <select id={id} value={mapping[f] ?? ""} onChange={(e) => set(f, e.target.value)}>
                        <option value="">{info.required ? "Choose a column…" : "Not in my file"}</option>
                        {loaded.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                      {f === "duration" && mapping.duration && (
                        <label className="row small" style={{ marginTop: 6, gap: 6 }}>
                          Unit
                          <select
                            value={mapping.durationUnit}
                            onChange={(e) => p.onMapping({ ...mapping, durationUnit: e.target.value as Mapping["durationUnit"] })}
                          >
                            <option value="ms">milliseconds</option>
                            <option value="s">seconds</option>
                            <option value="min">minutes</option>
                          </select>
                        </label>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted small" style={{ marginTop: 10 }}>
            Dates without a time zone are read as UTC. Rows with a missing workflow name or an unreadable date are skipped and counted.
          </p>
        </div>

        <div className="stack">
          <div className="panel stack">
            <h2>What counts as success?</h2>
            {!mapping.status && <p className="muted">Choose the status column first.</p>}
            {mapping.status && p.statusValues.length === 0 && <p className="muted">Reading status values…</p>}
            <div className="status-list">
              {p.statusValues.map((v) => {
                const id = `status-${v.value}`;
                return (
                  <div className="status-item" key={v.value}>
                    <label htmlFor={id}>
                      <code>{v.value === "" ? "(blank)" : v.value}</code>
                    </label>
                    <span className="muted small num">{formatNumber(v.count)}</span>
                    <select
                      id={id}
                      value={p.statusMap[v.value] ?? v.guess}
                      onChange={(e) => p.onStatusMap({ ...p.statusMap, [v.value]: e.target.value as StatusClass })}
                    >
                      <option value="success">Success</option>
                      <option value="failure">Failure</option>
                      <option value="ignore">Ignore (still running etc.)</option>
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="row">
            <PrimaryButton onClick={p.onAnalyze} disabled={p.busy || missing.length > 0}>
              {p.busy ? p.stage ?? "Analysing…" : "Analyse"}
            </PrimaryButton>
            {missing.length > 0 && (
              <span className="muted small">Still needed: {missing.map((f) => FIELD_LABELS[f].label.toLowerCase()).join(", ")}</span>
            )}
          </div>
        </div>
      </div>

      <div className="panel stack">
        <h2>First rows of your file</h2>
        <div className="preview-wrap">
          <table className="preview">
            <thead>
              <tr>
                {loaded.headers.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loaded.preview.map((row, i) => (
                <tr key={i}>
                  {loaded.headers.map((h, j) => (
                    <td key={h} title={row[j] ?? ""}>
                      {row[j] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
