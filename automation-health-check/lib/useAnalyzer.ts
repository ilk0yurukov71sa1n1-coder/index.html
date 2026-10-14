"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkerRequest, WorkerResponse } from "./protocol.ts";
import { createWorker } from "./createWorker.ts";

type Pending = { resolve: (r: WorkerResponse) => void; reject: (e: Error) => void };
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

/** Owns the analysis Web Worker and turns its messages into promises. */
export function useAnalyzer() {
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, Pending>());
  const nextId = useRef(1);
  const [stage, setStage] = useState<string | null>(null);

  useEffect(() => {
    const worker = createWorker();
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.id === null) {
        setStage(msg.stage);
        return;
      }
      const p = pending.current.get(msg.id);
      if (!p) return;
      pending.current.delete(msg.id);
      if (pending.current.size === 0) setStage(null);
      if (msg.type === "error") p.reject(new Error(msg.message));
      else p.resolve(msg);
    };
    worker.onerror = () => {
      for (const p of pending.current.values()) p.reject(new Error("The analysis worker stopped unexpectedly."));
      pending.current.clear();
      setStage(null);
    };
    workerRef.current = worker;
    const map = pending.current;
    return () => {
      worker.terminate();
      map.clear();
    };
  }, []);

  const send = useCallback(<T extends WorkerResponse["type"]>(req: DistributiveOmit<WorkerRequest, "id">) => {
    const worker = workerRef.current;
    if (!worker) return Promise.reject(new Error("Still starting up, try again in a moment."));
    const id = nextId.current++;
    return new Promise<Extract<WorkerResponse, { type: T }>>((resolve, reject) => {
      pending.current.set(id, { resolve: resolve as (r: WorkerResponse) => void, reject });
      worker.postMessage({ ...req, id } as WorkerRequest);
    });
  }, []);

  return { send, stage };
}
