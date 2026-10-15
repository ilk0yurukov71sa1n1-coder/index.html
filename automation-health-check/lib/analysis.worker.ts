/**
 * Runs parsing and analysis off the main thread so 200k-row files never freeze the page.
 * The file is read here, in the browser. Nothing is sent anywhere.
 */
import { analyze } from "./analyze.ts";
import { distinctValues, guessMapping, guessStatus, ImportError, parseTable, toRuns, type Table } from "./parse.ts";
import { generateSample } from "./sample.ts";
import type { WorkerRequest, WorkerResponse } from "./protocol.ts";

let table: Table | null = null;
let fileName = "";

const reply = (msg: WorkerResponse) => postMessage(msg);
const progress = (stage: string) => reply({ id: null, type: "progress", stage });

function loaded(id: number) {
  const t = table!;
  reply({
    id,
    type: "loaded",
    data: { fileName, headers: t.headers, preview: t.rows.slice(0, 5), rowCount: t.rows.length, guess: guessMapping(t.headers) },
  });
}

addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  try {
    switch (req.type) {
      case "load-file": {
        progress("Reading file…");
        const text = await req.file.text();
        progress("Parsing rows…");
        table = parseTable(req.file.name, text);
        fileName = req.file.name;
        loaded(req.id);
        break;
      }
      case "load-sample": {
        table = generateSample().table;
        fileName = "Sample data (fictional)";
        loaded(req.id);
        break;
      }
      case "status-values": {
        if (!table) throw new ImportError("No file loaded.");
        const data = distinctValues(table, req.column).map((v) => ({ ...v, guess: guessStatus(v.value) }));
        reply({ id: req.id, type: "status-values", data });
        break;
      }
      case "analyze": {
        if (!table) throw new ImportError("No file loaded.");
        progress("Checking runs…");
        const { runs, ...report } = toRuns(table, req.mapping, req.statusMap);
        if (runs.length === 0) {
          const { badDate, missingWorkflow, ignoredStatus } = report.skipped;
          const why = [
            badDate && `${badDate} with an unreadable start time`,
            missingWorkflow && `${missingWorkflow} without a workflow name`,
            ignoredStatus && `${ignoredStatus} with an ignored status`,
          ].filter(Boolean).join(", ");
          throw new ImportError(`No usable runs were found (${why}). Check that the start-time and status columns are mapped correctly.`);
        }
        progress("Calculating…");
        const analysis = analyze(runs, req.settings);
        reply({ id: req.id, type: "result", data: { analysis, report, runsUsed: runs.length } });
        break;
      }
    }
  } catch (err) {
    const message =
      err instanceof ImportError ? err.message : `Something went wrong while reading this file (${err instanceof Error ? err.message : String(err)}).`;
    reply({ id: req.id, type: "error", message });
  }
});
