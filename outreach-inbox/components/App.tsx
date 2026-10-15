"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Action, Backend, Snapshot } from "@/lib/actions.ts";
import type { Result } from "@/lib/engine.ts";
import { followUpQueue } from "@/lib/engine.ts";
import { effectiveCap, sentToday } from "@/lib/rules.ts";
import { sofiaParts } from "@/lib/time.ts";
import { Dashboard } from "./Dashboard.tsx";
import { Leads } from "./Leads.tsx";
import { Inbox } from "./Inbox.tsx";
import { Templates } from "./Templates.tsx";
import { SettingsView } from "./SettingsView.tsx";
import { flushSync } from "react-dom";
import ClickSpark from "./bits/ClickSpark/ClickSpark.tsx";
import { BRAND, BrandName, useReducedMotion } from "./fx.tsx";

export type View = "dashboard" | "leads" | "inbox" | "templates" | "settings";
export type Act = (a: Action) => Promise<Result>;

export interface ViewProps {
  snap: Snapshot;
  act: Act;
  busy: boolean;
  openLead: (id: string, filter?: string) => void;
  saveFile: (filename: string, text: string) => Promise<void>;
}

export function App({ backend }: { backend: Backend }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Result | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [leadFilter, setLeadFilter] = useState<string>("all");
  const [loadError, setLoadError] = useState<string | null>(null);
  const reduced = useReducedMotion();
  /** Tab changes glide (browser view transitions) unless "Reduce motion" is on. */
  const switchView = useCallback(
    (v: View) => {
      const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
      if (!reduced && doc.startViewTransition) doc.startViewTransition(() => flushSync(() => setView(v)));
      else setView(v);
    },
    [reduced],
  );

  const refresh = useCallback(() => {
    backend.load().then(setSnap, (e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, [backend]);

  useEffect(() => {
    refresh();
    // pick up new replies found by the background inbox check
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.ok ? 4000 : 9000);
    return () => clearTimeout(t);
  }, [toast]);

  const act: Act = useCallback(
    async (a) => {
      setBusy(true);
      try {
        const { snapshot, result } = await backend.act(a);
        setSnap(snapshot);
        setToast(result);
        return result;
      } catch (e) {
        const result: Result = { ok: false, error: e instanceof Error ? e.message : String(e) };
        setToast(result);
        return result;
      } finally {
        setBusy(false);
      }
    },
    [backend],
  );

  const openLead = useCallback((id: string, filter?: string) => {
    setLeadId(id || null);
    if (filter) setLeadFilter(filter);
    switchView("leads");
  }, [switchView]);

  const counts = useMemo(() => {
    if (!snap) return { followUps: 0, replies: 0 };
    const now = new Date(snap.now);
    return { followUps: followUpQueue(snap.store, now).length, replies: snap.store.replies.length };
  }, [snap]);

  if (loadError) return <main><div className="problems">Could not load your data: {loadError}</div></main>;
  if (!snap) return <main className="muted">Loading…</main>;

  const s = snap.store.settings;
  const now = new Date(snap.now);
  const sp = sofiaParts(now);
  const saveFile = backend.saveFile ?? browserDownload;
  const props: ViewProps = { snap, act, busy, openLead, saveFile };

  return (
    <>
      {snap.preview && <PreviewBar act={act} now={now} />}
      <header className="topbar">
        <div className="topbar-inner">
          <div className="row">
            <div className="brand">
              <BrandName />
              <span className="muted">Outreach Inbox</span>
            </div>
            <span className="spacer" />
            <span className="pill num" title="Emails sent today against your daily limit">
              Sent today: {sentToday(snap.store.sent, now)} / {effectiveCap(s)}
            </span>
            <span className="pill num">
              Sofia {String(sp.hour).padStart(2, "0")}:{String(sp.minute).padStart(2, "0")}
            </span>
            {s.dryRun ? <span className="pill dry">Dry-run: emails go to you</span> : <span className="pill live">Live sending</span>}
          </div>
          <nav className="tabs" aria-label="Main">
            {(
              [
                ["dashboard", "Dashboard"],
                ["leads", "Leads"],
                ["inbox", "Inbox"],
                ["templates", "Templates"],
                ["settings", "Settings"],
              ] as [View, string][]
            ).map(([v, label]) => (
              <button key={v} type="button" aria-current={view === v ? "page" : undefined} onClick={() => switchView(v)}>
                {label}
                {v === "inbox" && counts.followUps > 0 && <span className="count" title="Follow-ups waiting for approval">{counts.followUps}</span>}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <ClickSpark className="spark-layer" sparkColor={[BRAND.bright, BRAND.deep, BRAND.tint]} sparkSize={9} sparkRadius={18} sparkCount={9} duration={420} disabled={reduced}>
      <main key={view}>
        {view === "dashboard" && <Dashboard {...props} />}
        {view === "leads" && <Leads {...props} selectedId={leadId} onSelect={setLeadId} filter={leadFilter} onFilter={setLeadFilter} />}
        {view === "inbox" && <Inbox {...props} />}
        {view === "templates" && <Templates {...props} />}
        {view === "settings" && <SettingsView {...props} />}
      </main>
      </ClickSpark>
      {toast && (
        <div className={`toast ${toast.ok ? "ok" : "err"}`} role="status" aria-live="polite">
          {toast.ok ? toast.message : toast.error}
        </div>
      )}
    </>
  );
}

async function browserDownload(filename: string, text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function PreviewBar({ act, now }: { act: Act; now: Date }) {
  const { hour, minute } = sofiaParts(now);
  const toTen = (((10 - hour + 24) % 24) * 60 - minute) / 60 || 24;
  return (
    <div className="preview-bar">
      <div className="row">
        <strong>Live preview</strong>
        <span>Fictional demo data. Nothing is sent. Demo clock:</span>
        <button type="button" onClick={() => void act({ type: "demoAdvance", hours: toTen })}>
          Jump to 10:00 Sofia
        </button>
        <button type="button" onClick={() => void act({ type: "demoAdvance", hours: 24 })}>
          +1 day
        </button>
        <button type="button" onClick={() => void act({ type: "demoAdvance", hours: 72 })}>
          +3 days
        </button>
        <button type="button" onClick={() => void act({ type: "demoReset" })}>
          Reset demo
        </button>
      </div>
    </div>
  );
}
