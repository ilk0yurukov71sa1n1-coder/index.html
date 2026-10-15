import { hqSnapshot, runHq, logError } from "@/core/server/hq.ts";
import { rejectForeign } from "@/core/server/guard.ts";
import type { HqAction } from "@/core/api.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = rejectForeign(req);
  if (denied) return denied;
  try {
    return Response.json(hqSnapshot(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    logError("load", e);
    return Response.json({ error: "HQ couldn't read its data. Open the System page or restart HQ." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const denied = rejectForeign(req);
  if (denied) return denied;
  let action: HqAction;
  try {
    action = (await req.json()) as HqAction;
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const result = runHq(action);
  return Response.json({ result, snapshot: hqSnapshot() }, { headers: { "Cache-Control": "no-store" } });
}
