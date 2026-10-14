import "server-only";

/**
 * Only answer requests made to this Mac's own address from this app's own pages.
 * Blocks other websites (and DNS-rebinding tricks) from reading or changing your data.
 */
export function rejectForeign(req: Request): Response | null {
  const host = (req.headers.get("host") ?? "").replace(/:\d+$/, "");
  if (host !== "localhost" && host !== "127.0.0.1") return new Response("Forbidden", { status: 403 });
  if (req.method !== "GET") {
    const origin = req.headers.get("origin");
    if (origin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return new Response("Forbidden", { status: 403 });
    if (!(req.headers.get("content-type") ?? "").includes("application/json")) return new Response("Expected JSON", { status: 415 });
  }
  return null;
}
