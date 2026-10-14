import type { Action, Backend, Snapshot } from "./actions.ts";
import type { Result } from "./engine.ts";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `The app answered ${res.status}.`);
  return body;
}

/** Talks to this Mac's own server only (localhost). */
export const httpBackend: Backend = {
  load: () => call<Snapshot>("/api/state"),
  act: (a: Action) =>
    call<{ snapshot: Snapshot; result: Result }>("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(a),
    }),
};
