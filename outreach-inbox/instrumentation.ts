/** Starts the background inbox check when the server starts (Node.js runtime only). */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startPolling } = await import("./lib/server/app.ts");
    await startPolling();
  }
}
