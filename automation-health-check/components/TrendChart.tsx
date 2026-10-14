"use client";

import { useState } from "react";
import type { DayPoint } from "@/lib/types.ts";
import { formatPercent } from "@/lib/format.ts";

const W = 640;
const H = 200;
const PAD = { top: 12, right: 8, bottom: 26, left: 40 };
const FAILED = "#e66767";
const SILENT = "#fab219";

function niceMax(v: number): number {
  if (v <= 0) return 0.05;
  for (const step of [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1]) if (v <= step) return step;
  return 1;
}

/** Bar whose top corners are rounded (data end) and whose base is square (baseline). */
function barPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/** Daily failure rate, last 30 days: failed (bottom) and silent (top) stacked. Plain SVG. */
export function TrendChart({ trend }: { trend: DayPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (trend.length === 0) return null;
  const max = niceMax(Math.max(...trend.map((d) => d.rate ?? 0)));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / trend.length;
  const barW = Math.max(4, slot - 4);
  const y = (rate: number) => PAD.top + plotH - (rate / max) * plotH;
  const ticks = [0, max / 2, max];
  const hd = hover === null ? null : trend[hover]!;

  return (
    <div className="chart" style={{ position: "relative" }}>
      <div className="legend" aria-hidden="true">
        <span>
          <i style={{ background: FAILED }} />
          Failed
        </span>
        <span>
          <i style={{ background: SILENT }} />
          Silent failure
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Daily failure rate over the last 30 days" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#2b3542" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#a3b0bd">
              {formatPercent(t)}
            </text>
          </g>
        ))}
        {trend.map((d, i) => {
          const x = PAD.left + i * slot + (slot - barW) / 2;
          const fr = d.runs ? d.failed / d.runs : 0;
          const sr = d.runs ? d.silent / d.runs : 0;
          const base = y(0);
          const fh = base - y(fr);
          const sh = base - y(sr);
          const gap = fh > 0 && sh > 0 ? 2 : 0;
          return (
            <g key={d.day}>
              {fh > 0 && <path d={barPath(x, base - fh, barW, fh, sh > 0 ? 0 : 4)} fill={FAILED} />}
              {sh > 0 && <path d={barPath(x, base - fh - gap - sh, barW, sh, 4)} fill={SILENT} />}
              {d.runs === 0 && <line x1={x} x2={x + barW} y1={base - 1} y2={base - 1} stroke="#4a5563" strokeDasharray="2 2" />}
              {(i === 0 || i === trend.length - 1 || (i % 7 === 0 && i < trend.length - 4)) && (
                <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#a3b0bd">
                  {d.day.slice(5)}
                </text>
              )}
              <rect
                x={PAD.left + i * slot}
                y={PAD.top}
                width={slot}
                height={plotH}
                fill={hover === i ? "rgba(255,255,255,0.05)" : "transparent"}
                onMouseEnter={() => setHover(i)}
              />
            </g>
          );
        })}
      </svg>
      {hd && (
        <div
          className="notice small"
          style={{
            position: "absolute",
            top: 24,
            left: `${Math.min(70, Math.max(0, ((hover! + 0.5) / trend.length) * 100 - 15))}%`,
            pointerEvents: "none",
            minWidth: 170,
          }}
        >
          <strong>{hd.day}</strong>
          <div>{hd.runs} runs</div>
          {hd.runs > 0 && (
            <>
              <div>Failed: {hd.failed}</div>
              <div>Silent failures: {hd.silent}</div>
              <div>Problem rate: {formatPercent(hd.rate ?? 0)}</div>
            </>
          )}
        </div>
      )}
      <details className="small" style={{ marginTop: 8 }}>
        <summary className="muted">Show as table</summary>
        <table className="wf-table">
          <thead>
            <tr>
              <th scope="col">Day (UTC)</th>
              <th scope="col">Runs</th>
              <th scope="col">Failed</th>
              <th scope="col">Silent</th>
              <th scope="col">Problem rate</th>
            </tr>
          </thead>
          <tbody>
            {trend.map((d) => (
              <tr key={d.day}>
                <td>{d.day}</td>
                <td className="num">{d.runs}</td>
                <td className="num">{d.failed}</td>
                <td className="num">{d.silent}</td>
                <td className="num">{d.rate === null ? "–" : formatPercent(d.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
