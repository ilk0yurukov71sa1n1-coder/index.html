/** Starts the analysis worker. Swapped for an inline (blob) version in the single-file preview build. */
export function createWorker(): Worker {
  return new Worker(new URL("./analysis.worker.ts", import.meta.url), { type: "module" });
}
