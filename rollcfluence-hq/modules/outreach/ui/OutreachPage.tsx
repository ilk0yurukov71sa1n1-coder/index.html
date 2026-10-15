"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PageProps } from "@/components/HqApp.tsx";
import { PageTitle, PrimaryButton } from "@/components/fx.tsx";
import { activeLeads, deletedLeads } from "../lib/state.ts";
import { nextAction, type NextAction } from "../lib/leads.ts";
import { exportLeads } from "../lib/csv.ts";
import type { Lead } from "../lib/types.ts";
import { NextActionTag, PLATFORM_LABEL, shortDate } from "./bits.tsx";
import { LeadPanel } from "./LeadPanel.tsx";
import { TemplatesTab } from "./TemplatesTab.tsx";
import { VerdictTab } from "./VerdictTab.tsx";

export type OutreachTab = "leads" | "templates" | "verdict" | "deleted";

const FILTERS: (NextAction | "all")[] = ["all", "Message them", "Wait for reply", "Send follow-up", "Run the 5-question interview", "Offer the free health check", "Ask what would make it a yes", "Thank them and close", "Do not contact"];

export function OutreachPage(props: PageProps) {
  const { snap, focus, outreach } = props;
  const [tab, setTab] = useState<OutreachTab>(focus.tab ?? "leads");
  useEffect(() => {
    if (focus.tab) setTab(focus.tab);
  }, [focus]);
  const deleted = deletedLeads(snap.outreach);

  return (
    <div className="stack">
      <PageTitle text="Outreach" sub="Find people, message them personally, learn whether the problem is real." />
      <nav className="tabs" aria-label="Outreach sections">
        {(
          [
            ["leads", "Leads"],
            ["templates", "Templates"],
            ["verdict", "Verdict & targets"],
            ["deleted", "Recently deleted"],
          ] as [OutreachTab, string][]
        ).map(([id, label]) => (
          <button key={id} type="button" aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>
            {label}
            {id === "deleted" && deleted.length > 0 && <span className="count">{deleted.length}</span>}
          </button>
        ))}
      </nav>
      {tab === "leads" && <LeadsTab {...props} />}
      {tab === "templates" && <TemplatesTab {...props} />}
      {tab === "verdict" && <VerdictTab {...props} />}
      {tab === "deleted" && <DeletedTab {...props} />}
    </div>
  );
}

function LeadsTab(props: PageProps) {
  const { snap, focus, outreach, busy, backend } = props;
  const store = snap.outreach;
  const now = new Date(snap.core.now);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>(focus.filter ?? "all");
  const [selectedId, setSelectedId] = useState<string | null>(focus.leadId ?? null);
  const [creating, setCreating] = useState(!!focus.newLead);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focus.filter) setFilter(focus.filter);
    if (focus.leadId) {
      setSelectedId(focus.leadId);
      setCreating(false);
    }
    if (focus.newLead) setCreating(true);
  }, [focus]);
  const na = (l: (typeof store.leads)[number]) => nextAction(l, now, store.settings.followUpDays);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return activeLeads(store)
      .filter((l) => filter === "all" || nextAction(l, now, store.settings.followUpDays) === filter)
      .filter((l) => !term || [l.name, l.company, l.email ?? "", l.handle ?? "", l.whatTheyDo].join(" ").toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, filter, q, snap.core.now]);

  const selected = creating
    ? null
    : selectedId?.startsWith("name:")
      ? [...activeLeads(store)].reverse().find((l) => l.name === selectedId.slice(5)) ?? null
      : activeLeads(store).find((l) => l.id === selectedId) ?? null;

  const exportCsv = () => {
    const blob = new Blob([exportLeads(activeLeads(store), na)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rollcfluence-leads-${snap.core.now.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="stack">
      <div className="row">
        <PrimaryButton onClick={() => { setCreating(true); setSelectedId(null); }}>Add lead</PrimaryButton>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}>Import CSV</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) await outreach({ type: "importCsv", text: await f.text() });
        }} />
        <button type="button" onClick={exportCsv} disabled={snap.core.preview || !backend.exportUrl("json")} title={snap.core.preview ? "Export works in the HQ app on your Mac" : undefined}>Export CSV</button>
        <span className="spacer" />
        <span className="muted small">CSV columns: name, email, handle/link, platform, what they do, notes</span>
      </div>

      <div className="leads-layout">
        <section className="panel stack" aria-label="Lead list">
          <div className="grid-2">
            <label className="field">Search<input id="lead-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, company, email…" /></label>
            <label className="field">
              Next action
              <select id="lead-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
                {FILTERS.map((f) => <option key={f} value={f}>{f === "all" ? "All leads" : f}</option>)}
              </select>
            </label>
          </div>
          <div className="table-wrap">
            <table className="list">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Messaged</th>
                  <th scope="col">Signals</th>
                  <th scope="col">Next action</th>
                </tr>
              </thead>
              <tbody className="stagger">
                {rows.map((l) => (
                  <tr key={l.id} className="clickable" aria-selected={l.id === selected?.id} tabIndex={0}
                    onClick={() => { setCreating(false); setSelectedId(l.id); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { setCreating(false); setSelectedId(l.id); } }}>
                    <td><strong>{l.name}</strong><div className="muted small">{l.company || l.whatTheyDo} · {PLATFORM_LABEL[l.platform]}</div></td>
                    <td className="num">{shortDate(l.dateMessaged)}</td>
                    <td><Signals lead={l} /></td>
                    <td><NextActionTag action={na(l)} /></td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      {activeLeads(store).length === 0 ? "No leads yet. Add one (press n) or import your tracker as CSV." : "No leads match this filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <div className="panel-sticky">
          {creating || selected ? (
            <LeadPanel key={selected ? selected.id + JSON.stringify([selected.name, selected.email, selected.firstLine, selected.replied, selected.painConfirmed, selected.wouldPay, selected.dateMessaged, selected.followUpSentAt]) : "new"}
              lead={selected} props={props}
              onCreated={(name) => { setCreating(false); setSelectedId(`name:${name}`); }}
              onDeleted={() => setSelectedId(null)} />
          ) : (
            <section className="panel muted">Pick a lead to see their next step, write a message, run the interview and log what happened.</section>
          )}
        </div>
      </div>
    </div>
  );
}

/** Recently deleted: restore with one click, or delete forever (for erasure requests) after a confirm. */
function DeletedTab({ snap, outreach, busy }: PageProps) {
  const deleted = deletedLeads(snap.outreach);
  const [confirming, setConfirming] = useState<string | null>(null);
  return (
    <section className="panel stack">
      <p className="muted small">
        Deleted leads wait here so a mistake is never permanent. If someone asks you to erase their data, use <strong>Delete forever</strong>: it removes them and their
        message history, wipes their name from the activity log and scrubs the database file. Only their email or handle stays on your do-not-contact list, so they
        are never contacted again. Backups made before that drop them as they rotate out (14 days).
      </p>
      {deleted.length === 0 && <p className="muted">Nothing deleted.</p>}
      <div className="stack stagger" style={{ gap: 8 }}>
        {deleted.map((l) => (
          <div key={l.id} className="row">
            <strong>{l.name}</strong>
            <span className="muted small">{l.company} · deleted {shortDate(l.deletedAt ?? null)}</span>
            <span className="spacer" />
            {confirming === l.id ? (
              <>
                <span className="small">Delete {l.name} forever? This can&rsquo;t be undone.</span>
                <button type="button" className="danger" disabled={busy} onClick={async () => { await outreach({ type: "purgeLead", id: l.id }); setConfirming(null); }}>Yes, delete forever</button>
                <button type="button" onClick={() => setConfirming(null)}>Keep</button>
              </>
            ) : (
              <>
                <button type="button" disabled={busy} onClick={() => void outreach({ type: "restoreLead", id: l.id })}>Restore</button>
                <button type="button" className="danger" disabled={busy} onClick={() => setConfirming(l.id)}>Delete forever…</button>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Replied / pain / would-pay as small labelled tags instead of Y/N columns. */
function Signals({ lead }: { lead: Lead }) {
  const tags: [string, string][] = [];
  if (lead.replied) tags.push(["Replied", "sig"]);
  if (lead.painConfirmed === "Y") tags.push(["Pain", "sig sig-pain"]);
  if (lead.painConfirmed === "N") tags.push(["No pain", "sig sig-no"]);
  if (lead.wouldPay === "Y") tags.push(["Would pay", "sig sig-pay"]);
  if (lead.wouldPay === "Maybe") tags.push(["Maybe pays", "sig sig-maybe"]);
  if (lead.wouldPay === "N") tags.push(["Won't pay", "sig sig-no"]);
  if (!tags.length) return <span className="muted">–</span>;
  return (
    <span className="sigs">
      {tags.map(([t, c]) => <span key={t} className={c}>{t}</span>)}
    </span>
  );
}
