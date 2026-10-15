"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { activeLeads } from "@/modules/outreach/lib/state.ts";
import { nextAction } from "@/modules/outreach/lib/leads.ts";
import { NAV, BUILT_MODULE, type PageProps } from "./HqApp.tsx";

interface Item {
  id: string;
  group: "Go to" | "Actions" | "Leads";
  label: string;
  hint?: string;
  keywords: string;
  run: () => void;
}

/** Cmd+K: type to jump to a page, run an action or open a lead. Arrow keys + Enter, Esc to close. */
export function CommandPalette({ props, onClose }: { props: PageProps; onClose: () => void }) {
  const { snap, go, core, backend } = props;
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const items = useMemo<Item[]>(() => {
    const now = new Date(snap.core.now);
    const pages: Item[] = NAV.map((n) => ({
      id: `go-${n.id}`,
      group: "Go to",
      label: n.label,
      hint: n.module > BUILT_MODULE ? `Module ${n.module}` : `g ${n.key}`,
      keywords: `${n.label} page`,
      run: () => go(n.id),
    }));
    const exportUrl = backend.exportUrl("json");
    const actions: Item[] = [
      { id: "new-lead", group: "Actions", label: "Add a lead", hint: "n", keywords: "new lead add create", run: () => go("outreach", { tab: "leads", newLead: true }) },
      { id: "import", group: "Actions", label: "Import leads from CSV", keywords: "import csv excel tracker upload", run: () => go("outreach", { tab: "leads" }) },
      { id: "templates", group: "Actions", label: "Edit message templates", keywords: "templates messages edit", run: () => go("outreach", { tab: "templates" }) },
      { id: "verdict", group: "Actions", label: "See the 14-day verdict and targets", keywords: "verdict targets validation pass fail", run: () => go("outreach", { tab: "verdict" }) },
      { id: "deleted", group: "Actions", label: "Recently deleted leads", keywords: "deleted restore undo trash", run: () => go("outreach", { tab: "deleted" }) },
      { id: "backup", group: "Actions", label: "Back up now", keywords: "backup save copy", run: () => void core({ type: "backupNow" }) },
      ...(exportUrl ? [{ id: "export", group: "Actions" as const, label: "Export everything (JSON)", keywords: "export download json csv", run: () => window.location.assign(exportUrl) }] : []),
    ];
    const leads: Item[] = activeLeads(snap.outreach).map((l) => ({
      id: `lead-${l.id}`,
      group: "Leads",
      label: l.name,
      hint: nextAction(l, now, snap.outreach.settings.followUpDays),
      keywords: [l.name, l.company, l.email ?? "", l.handle ?? "", l.whatTheyDo].join(" "),
      run: () => go("outreach", { tab: "leads", leadId: l.id }),
    }));
    return [...pages, ...actions, ...leads];
  }, [snap, go, core, backend]);

  const shown = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const match = (it: Item) => terms.every((t) => `${it.label} ${it.keywords}`.toLowerCase().includes(t));
    const list = items.filter(match);
    return terms.length ? list.slice(0, 40) : list.filter((i) => i.group !== "Leads").concat(list.filter((i) => i.group === "Leads").slice(0, 5));
  }, [q, items]);

  useEffect(() => setSel(0), [q]);

  const choose = (it: Item | undefined) => {
    if (!it) return;
    onClose();
    it.run();
  };

  let lastGroup = "";
  return (
    <div className="palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-label="Command palette">
        <input
          ref={inputRef}
          id="palette-input"
          value={q}
          placeholder="Search leads, pages and actions…"
          aria-controls="palette-list"
          aria-activedescendant={shown[sel] ? `pi-${shown[sel]!.id}` : undefined}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel((s) => Math.min(shown.length - 1, s + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel((s) => Math.max(0, s - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(shown[sel]);
            }
          }}
        />
        <ul id="palette-list" role="listbox">
          {shown.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <li key={it.id} style={{ display: "contents" }}>
                {header && <div className="group">{header}</div>}
                <div
                  id={`pi-${it.id}`}
                  role="option"
                  aria-selected={i === sel}
                  className="palette-item"
                  onMouseEnter={() => setSel(i)}
                  onClick={() => choose(it)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, cursor: "pointer", background: i === sel ? "linear-gradient(90deg, rgba(207, 36, 48, .22), rgba(155, 15, 24, .08))" : undefined }}
                >
                  <span>{it.label}</span>
                  {it.hint && <span className="hint">{it.hint}</span>}
                </div>
              </li>
            );
          })}
          {shown.length === 0 && <li className="muted" style={{ padding: 12 }}>Nothing matches &ldquo;{q}&rdquo;.</li>}
        </ul>
      </div>
    </div>
  );
}

export function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [
    ["⌘K or /", "Search leads, pages and actions"],
    ["g then t", "Today"],
    ["g then o", "Outreach"],
    ["g then y", "System"],
    ["g then ,", "Settings"],
    ["n", "Add a lead"],
    ["Esc", "Close a panel"],
    ["?", "Show or hide this list"],
  ];
  return (
    <div className="palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-label="Keyboard shortcuts" style={{ padding: 16 }}>
        <h2 style={{ marginBottom: 10 }}>Keyboard shortcuts</h2>
        <table className="list">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <td><kbd>{k}</kbd></td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row" style={{ marginTop: 12 }}>
          <span className="spacer" />
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
