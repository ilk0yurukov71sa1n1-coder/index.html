"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import type { ActionResult, CoreAction, CoreBackend, HqSnapshot } from "@/core/api.ts";
import type { OutreachAction } from "@/modules/outreach/lib/state.ts";
import ClickSpark from "./bits/ClickSpark/ClickSpark.tsx";
import { BRAND, BrandName, useReducedMotion } from "./fx.tsx";
import { CommandPalette, ShortcutHelp } from "./CommandPalette.tsx";
import { SystemPage } from "./SystemPage.tsx";
import { SettingsPage } from "./SettingsPage.tsx";
import { TodayPage } from "./TodayPage.tsx";
import { OutreachPage, type OutreachTab } from "@/modules/outreach/ui/OutreachPage.tsx";

export type Page = "today" | "outreach" | "inbox" | "health" | "clients" | "money" | "review" | "system" | "settings";

/** Sidebar order. `module` = the build step that brings it to life; `key` = the "g" shortcut letter. */
export const NAV: { id: Page; label: string; module: number; key: string; what: string }[] = [
  { id: "today", label: "Today", module: 0, key: "t", what: "" },
  { id: "outreach", label: "Outreach", module: 1, key: "o", what: "" },
  { id: "inbox", label: "Inbox", module: 2, key: "i", what: "Send from your Gmail with dry-run and limits, live replies, the follow-up queue and the suppression list." },
  { id: "health", label: "Health Check", module: 3, key: "h", what: "Import a client's run log and find failures, silent failures and what they cost." },
  { id: "clients", label: "Clients", module: 4, key: "c", what: "Clients, their Health Check history and one-page proof reports." },
  { id: "money", label: "Money", module: 5, key: "m", what: "Payments in, costs out, MRR, churn and monthly profit." },
  { id: "review", label: "Review", module: 6, key: "r", what: "Your 15-minute Sunday review, with the week's numbers filled in for you." },
  { id: "system", label: "System", module: 0, key: "y", what: "" },
  { id: "settings", label: "Settings", module: 0, key: ",", what: "" },
];

export const BUILT_MODULE = 1;

export interface Focus {
  leadId?: string | null;
  filter?: string;
  tab?: OutreachTab;
  newLead?: boolean;
}

export interface PageProps {
  snap: HqSnapshot;
  core: (a: CoreAction) => Promise<ActionResult>;
  outreach: (a: OutreachAction) => Promise<ActionResult>;
  busy: boolean;
  backend: CoreBackend;
  go: (p: Page, focus?: Focus) => void;
  focus: Focus;
}

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

export function HqApp({ backend }: { backend: CoreBackend }) {
  const [snap, setSnap] = useState<HqSnapshot | null>(null);
  const [page, setPage] = useState<Page>("today");
  const [focus, setFocus] = useState<Focus>({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ActionResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const reduced = useReducedMotion();

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

  /** Page changes glide (browser view transitions) unless "Reduce motion" is on. */
  const go = useCallback(
    (p: Page, f: Focus = {}) => {
      const apply = () => {
        setPage(p);
        setFocus(f);
      };
      const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
      if (!reduced && doc.startViewTransition) doc.startViewTransition(() => flushSync(apply));
      else apply();
    },
    [reduced],
  );

  const run = useCallback(
    async (a: Parameters<CoreBackend["act"]>[0]) => {
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
  const core = useCallback((a: CoreAction) => run({ module: "core", action: a }), [run]);
  const outreach = useCallback((a: OutreachAction) => run({ module: "outreach", action: a }), [run]);

  // Keyboard: Cmd/Ctrl+K palette, "/" palette, "?" help, "g" + letter to jump, "n" new lead.
  useEffect(() => {
    let waitingForG = false;
    let gTimer: ReturnType<typeof setTimeout> | undefined;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setPalette(false);
        setHelp(false);
        return;
      }
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (waitingForG) {
        waitingForG = false;
        const target = NAV.find((n) => n.key === e.key.toLowerCase());
        if (target) {
          e.preventDefault();
          go(target.id);
        }
        return;
      }
      if (e.key === "g") {
        waitingForG = true;
        clearTimeout(gTimer);
        gTimer = setTimeout(() => (waitingForG = false), 1200);
      } else if (e.key === "/") {
        e.preventDefault();
        setPalette(true);
      } else if (e.key === "?") {
        setHelp((v) => !v);
      } else if (e.key === "n") {
        go("outreach", { tab: "leads", newLead: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(gTimer);
    };
  }, [go]);

  const props = useMemo<PageProps | null>(() => (snap ? { snap, core, outreach, busy, backend, go, focus } : null), [snap, core, outreach, busy, backend, go, focus]);

  if (!snap || !props) {
    return <main>{loadError ? <div className="problems">HQ couldn&rsquo;t load: {loadError}. Is the Terminal window still open?</div> : <p className="muted">Opening HQ…</p>}</main>;
  }

  const current = NAV.find((n) => n.id === page)!;

  return (
    <>
      {snap.core.preview && <div className="preview-bar">Preview with example data. Your real HQ runs on your Mac from the launcher; nothing here is saved.</div>}
      <div className="layout">
        <aside className="sidebar">
          <div className="brand">
            <div><BrandName /></div>
            <span>Roll up. Stay clean.</span>
          </div>
          <nav className="nav" aria-label="Modules">
            <button type="button" className="kbd-hint" onClick={() => setPalette(true)} aria-label="Open command palette">
              <span>Search or jump</span>
              <kbd>⌘K</kbd>
            </button>
            {NAV.map((n) => (
              <button key={n.id} type="button" aria-current={page === n.id ? "page" : undefined} onClick={() => go(n.id)} title={`Shortcut: g then ${n.key}`}>
                {n.id === "system" && <span className={`dot ${snap.core.overall}`} aria-label={`System status ${snap.core.overall}`} />}
                {n.label}
                {n.module > BUILT_MODULE && <span className="soon">M{n.module}</span>}
              </button>
            ))}
          </nav>
          <div className="side-foot">
            <button type="button" className="kbd-hint" style={{ padding: 0, border: 0, background: "none" }} onClick={() => setHelp(true)}>
              <kbd>?</kbd> shortcuts
            </button>
            <span>
              HQ {snap.core.version}
              {snap.core.commit ? ` · ${snap.core.commit}` : ""}
            </span>
            <span>Runs only on this Mac</span>
          </div>
        </aside>
        <ClickSpark className="spark-layer" sparkColor={[BRAND.violet, BRAND.rose, "#f9a8d4"]} sparkSize={9} sparkRadius={18} sparkCount={9} duration={420} disabled={reduced}>
          <main key={page}>
            {page === "today" && <TodayPage {...props} />}
            {page === "outreach" && <OutreachPage {...props} />}
            {page === "system" && <SystemPage {...props} />}
            {page === "settings" && <SettingsPage {...props} />}
            {current.module > BUILT_MODULE && (
              <section className="panel soon-card">
                <h1>{current.label}</h1>
                <p>{current.what}</p>
                <p className="muted small">Comes in Module {current.module}. Built one module at a time so each part is tested before the next.</p>
              </section>
            )}
          </main>
        </ClickSpark>
      </div>
      {palette && <CommandPalette props={props} onClose={() => setPalette(false)} />}
      {help && <ShortcutHelp onClose={() => setHelp(false)} />}
      {toast && (
        <div className={`toast ${toast.ok ? "ok" : "err"}`} role="status" aria-live="polite">
          {toast.ok ? toast.message : toast.error}
        </div>
      )}
    </>
  );
}
