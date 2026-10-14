import { snapshot } from "@/lib/server/app.ts";
import { rejectForeign } from "@/lib/server/guard.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = rejectForeign(req);
  if (denied) return denied;
  return Response.json(await snapshot(), { headers: { "Cache-Control": "no-store" } });
}
