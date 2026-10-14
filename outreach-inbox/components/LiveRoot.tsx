"use client";

import { useEffect, useState } from "react";
import type { Backend } from "@/lib/actions.ts";
import { createLiveBackend } from "@/lib/liveBackend.ts";
import { App } from "./App.tsx";

/** Hosted page: connects to the saved data and Gmail, then shows the app. */
export function LiveRoot() {
  const [state, setState] = useState<{ backend: Backend } | { error: string } | null>(null);
  useEffect(() => {
    createLiveBackend().then(
      (b) => setState("error" in b ? b : { backend: b }),
      (e: unknown) => setState({ error: `Couldn't load your saved data (${e instanceof Error ? e.message : String(e)}). Reload the page to try again.` }),
    );
  }, []);
  if (!state) return <main className="muted">Loading your leads…</main>;
  if ("error" in state) return <main><div className="problems">{state.error}</div></main>;
  return <App backend={state.backend} />;
}
