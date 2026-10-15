import type { ImportReport, Mapping, StatusClass } from "./parse.ts";
import type { Analysis, Settings } from "./types.ts";

/** Messages between the page and the analysis Web Worker. Nothing here ever leaves the browser. */
export type WorkerRequest =
  | { id: number; type: "load-file"; file: File }
  | { id: number; type: "load-sample" }
  | { id: number; type: "status-values"; column: string }
  | { id: number; type: "analyze"; mapping: Mapping; statusMap: Record<string, StatusClass>; settings: Settings };

export interface LoadedFile {
  fileName: string;
  headers: string[];
  preview: string[][];
  rowCount: number;
  guess: Mapping;
}

export interface StatusValue {
  value: string;
  count: number;
  guess: StatusClass;
}

export interface AnalysisResult {
  analysis: Analysis;
  report: ImportReport;
  runsUsed: number;
}

export type WorkerResponse =
  | { id: number; type: "loaded"; data: LoadedFile }
  | { id: number; type: "status-values"; data: StatusValue[] }
  | { id: number; type: "result"; data: AnalysisResult }
  | { id: number; type: "error"; message: string }
  | { id: null; type: "progress"; stage: string };
