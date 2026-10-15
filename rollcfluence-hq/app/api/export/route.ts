import { fullExport, logError } from "@/core/server/hq.ts";
import { rejectForeign } from "@/core/server/guard.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/export?file=all.json  or  ?file=<collection>.csv */
export async function GET(req: Request) {
  const denied = rejectForeign(req);
  if (denied) return denied;
  const file = new URL(req.url).searchParams.get("file") ?? "all.json";
  try {
    const out = fullExport();
    const day = out.json.exportedAt.slice(0, 10);
    if (file === "all.json") {
      return new Response(JSON.stringify(out.json, null, 2), {
        headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="rollcfluence-hq-${day}.json"`, "Cache-Control": "no-store" },
      });
    }
    const csv = out.csv[file];
    if (!csv || !/^[a-z0-9_-]+\.csv$/i.test(file)) return new Response("Not found", { status: 404 });
    return new Response(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="hq-${day}-${file}"`, "Cache-Control": "no-store" },
    });
  } catch (e) {
    logError("export", e);
    return new Response("Export failed. See the System page.", { status: 500 });
  }
}
