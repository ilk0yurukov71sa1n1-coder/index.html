/** Opens HQ (and makes the start-up backup) as soon as the server starts. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { hq } = await import("./core/server/hq.ts");
    hq();
  }
}
