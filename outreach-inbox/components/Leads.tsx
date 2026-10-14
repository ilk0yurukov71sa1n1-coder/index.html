"use client";

import { useMemo, useRef, useState } from "react";
import { nextAction, type NextAction } from "@/lib/leads.ts";
import { exportLeads } from "@/lib/csv.ts";
import type { Lead } from "@/lib/types.ts";
import type { ViewProps } from "./App.tsx";
import { LeadPanel, editable } from "./LeadPanel.tsx";
import { NextActionTag, PLATFORM_LABEL, shortDate } from "./ui.tsx";

interface Props extends ViewProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  filter: string;
  onFilter: (f: string) => void;
}

const FILTERS: (NextAction | "all")[] = ["all", "Message them", "Wait for reply", "Send follow-up", "Run the 5-question interview", "Offer the free health check", "Ask what would make it a yes", "Thank them and close", "Do not contact"];

export function Leads({ snap, act, busy, openLead, selectedId, onSelect, filter, onFilter }: Props) {
  const { store } = snap;
  const now = new Date(snap.now);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const na = (l: Lead) => nextAction(l, now, store.settings.followUpDays);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return store.leads
      .filter((l) => filter === "all" || nextAction(l, now, store.settings.followUpDays) === filter)
      .filter((l) => !term || [l.name, l.company, l.email ?? "", l.handle ?? "", l.whatTheyDo].join(" ").toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.leads, filter, q, snap.now]);

  const selected = creating
    ? null
    : selectedId?.startsWith("name:")
      ? [...store.leads].reverse().find((l) => l.name === selectedId.slice(5)) ?? null
      : store.leads.find((l) => l.id === selectedId) ?? null;

  const exportCsv = () => {
    const blob = new Blob([exportLeads(store.leads, na)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `outreach-leads-${snap.now.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="stack">
      <div className="row">
        <h1>Leads</h1>
        <span className="muted small">{store.leads.length} total</span>
        <span className="spacer" />
        <button type="button" className="primary" onClick={() => { setCreating(true); onSelect(null); }}>
          Add lead
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}>
          Import CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) await act({ type: "importCsv", text: await f.text() });
          }}
        />
        <button type="button" onClick={exportCsv} disabled={snap.preview} title={snap.preview ? "Export works in the Mac app" : undefined}>
          Export CSV
        </button>
      </div>
      <p className="muted small">CSV columns: name, email, handle/link, platform, what they do, notes. Optional: company, first line.</p>

      <div className="leads-layout">
        <section className="panel stack" aria-label="Lead list">
          <div className="grid-2">
            <label className="field">
              Search
              <input id="lead-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, company, email…" />
            </label>
            <label className="field">
              Next action
              <select id="lead-filter" value={filter} onChange={(e) => onFilter(e.target.value)}>
                {FILTERS.map((f) => (
                  <option key={f} value={f}>
                    {f === "all" ? "All leads" : f}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="table-wrap">
            <table className="list">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Channel</th>
                  <th scope="col">Messaged</th>
                  <th scope="col">Replied</th>
                  <th scope="col">Pain</th>
                  <th scope="col">Pay</th>
                  <th scope="col">Next action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr
                    key={l.id}
                    aria-selected={l.id === selected?.id}
                    tabIndex={0}
                    onClick={() => { setCreating(false); onSelect(l.id); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { setCreating(false); onSelect(l.id); } }}
                  >
                    <td>
                      <strong>{l.name}</strong>
                      <div className="muted small">{l.company || l.whatTheyDo}</div>
                    </td>
                    <td><span className="chip">{PLATFORM_LABEL[l.platform]}</span></td>
                    <td className="num">{shortDate(l.dateMessaged)}</td>
                    <td className="yn">{l.replied ? "Y" : "N"}</td>
                    <td className="yn">{l.painConfirmed ?? "–"}</td>
                    <td className="yn">{l.wouldPay ?? "–"}</td>
                    <td><NextActionTag action={na(l)} /></td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted">
                      {store.leads.length === 0 ? "No leads yet. Add one or import your tracker as CSV." : "No leads match this filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="panel-sticky">
          {creating || selected ? (
            <LeadPanel key={selected ? selected.id + editable(selected) : "new"} lead={selected} snap={snap} act={act} busy={busy} openLead={openLead}
              onCreated={(id) => { setCreating(false); onSelect(id); }} onDeleted={() => onSelect(null)} />
          ) : (
            <section className="panel muted">Pick a lead to see their next step, write a message and log what happened.</section>
          )}
        </div>
      </div>
    </div>
  );
}
