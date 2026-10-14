"use client";

import { useCallback, useEffect, useState } from "react";
import type { ActionResult, CoreAction, CoreBackend, CoreSnapshot } from "@/core/api.ts";
import { SystemPage } from "./SystemPage.tsx";
import { SettingsPage } from "./SettingsPage.tsx";
import { TodayPage } from "./TodayPage.tsx";

export type Page = "today" | "outreach" | "inbox" | "health" | "clients" | "money" | "review" | "system" | "settings";

/** Sidebar order. `module` = the build step that brings it to life. */
export const NAV: { id: Page; label: string; module: number; what: string }[] = [
  { id: "today", label: "Today", module: 6, what: "Your day on one screen: follow-ups due, replies to answer, interviews, reports due, the validation verdict and anything red in System." },
  { id: "outreach", label: "Outreach", module: 1, what: "Leads, next actions, personalised templates, assisted DMs, the 5-question interview and the 14-day verdict." },
  { id: "inbox", label: "Inbox", module: 2, what: "Send from your Gmail with dry-run and limits, live replies, the follow-up queue and the suppression list." },
  { id: "health", label: "Health Check", module: 3, what: "Import a client's run log and find failures, silent failures and what they cost." },
  { id: "clients", label: "Clients", module: 4, what: "Clients, their Health Check history and one-page proof reports." },
  { id: "money", label: "Money", module: 5, what: "Payments in, costs out, MRR, churn and monthly profit." },
  { id: "review", label: "Review", module: 6, what: "Your 15-minute Sunday review, with the week's numbers filled in for you." },
  { id: "system", label: "System", module: 0, what: "" },
  { id: "settings", label: "Settings", module: 0, what: "" },
];

export const BUILT_MODULE = 0;

export interface PageProps {
  snap: CoreSnapshot;
  act: (a: CoreAction) => Promise<ActionResult>;
  busy: boolean;
  backend: CoreBackend;
  go: (p: Page) => void;
}

export function HqApp({ backend }: { backend: CoreBackend }) {
  const [snap, setSnap] = useState<CoreSnapshot | null>(null);
  const [page, setPage] = useState<Page>("today");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ActionResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    backend.load().then(
      (s) => {
        setSnap(s);
        setLoadError(null);
      },
      (e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)),
    );
  }, [backend]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.ok ? 4000 : 10000);
    return () => clearTimeout(t);
  }, [toast]);

  const act = useCallback(
    async (a: CoreAction) => {
      setBusy(true);
      try {
        const { snapshot, result } = await backend.act(a);
        setSnap(snapshot);
        setToast(result);
        return result;
      } catch (e) {
        const result: ActionResult = { ok: false, error: e instanceof Error ? e.message : String(e) };
        setToast(result);
        return result;
      } finally {
        setBusy(false);
      }
    },
    [backend],
  );

  if (!snap) {
    return <main>{loadError ? <div className="problems">HQ couldn&rsquo;t load: {loadError}. Is the Terminal window still open?</div> : <p className="muted">Opening HQ…</p>}</main>;
  }

  const props: PageProps = { snap, act, busy, backend, go: setPage };
  const current = NAV.find((n) => n.id === page)!;

  return (
    <>
      {snap.preview && <div className="preview-bar">Preview with example data. Your real HQ runs on your Mac from the launcher; nothing here is saved.</div>}
      <div className="layout">
        <aside className="sidebar">
          <div className="brand">
            <strong>Rollcfluence HQ</strong>
            <span>Roll up. Stay clean.</span>
          </div>
          <nav className="nav" aria-label="Modules">
            {NAV.map((n) => (
              <button key={n.id} type="button" aria-current={page === n.id ? "page" : undefined} onClick={() => setPage(n.id)}>
                {n.id === "system" && <span className={`dot ${snap.overall}`} aria-label={`System status ${snap.overall}`} />}
                {n.label}
                {n.module > BUILT_MODULE && n.id !== "today" && <span className="soon">M{n.module}</span>}
              </button>
            ))}
          </nav>
          <div className="side-foot">
            <span>
              HQ {snap.version}
              {snap.commit ? ` · ${snap.commit}` : ""}
            </span>
            <span>Runs only on this Mac</span>
          </div>
        </aside>
        <main>
          {page === "today" && <TodayPage {...props} />}
          {page === "system" && <SystemPage {...props} />}
          {page === "settings" && <SettingsPage {...props} />}
          {current.module > BUILT_MODULE && page !== "today" && (
            <section className="panel soon-card">
              <h1>{current.label}</h1>
              <p>{current.what}</p>
              <p className="muted small">Comes in Module {current.module}. Built one module at a time so each part is tested before the next.</p>
            </section>
          )}
        </main>
      </div>
      {toast && (
        <div className={`toast ${toast.ok ? "ok" : "err"}`} role="status" aria-live="polite">
          {toast.ok ? toast.message : toast.error}
        </div>
      )}
    </>
  );
}
