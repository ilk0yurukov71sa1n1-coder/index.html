import type { CoreAction, CoreBackend, CoreSnapshot, ActionResult } from "./api.ts";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `HQ answered ${res.status}.`);
  return body;
}

/** Talks only to this Mac's own HQ server. */
export const httpBackend: CoreBackend = {
  load: () => call<CoreSnapshot>("/api/core"),
  act: (a: CoreAction) =>
    call<{ snapshot: CoreSnapshot; result: ActionResult }>("/api/core", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a) }),
  exportUrl: (kind) => `/api/export?file=${encodeURIComponent(kind === "json" ? "all.json" : kind)}`,
};
