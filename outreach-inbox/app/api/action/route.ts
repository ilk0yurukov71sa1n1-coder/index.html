import { runAction } from "@/lib/server/app.ts";
import { rejectForeign } from "@/lib/server/guard.ts";
import type { Action } from "@/lib/actions.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = rejectForeign(req);
  if (denied) return denied;
  let action: Action;
  try {
    action = (await req.json()) as Action;
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  try {
    return Response.json(await runAction(action), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Something went wrong." }, { status: 500 });
  }
}
