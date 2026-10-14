"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAnalyzer } from "@/lib/useAnalyzer.ts";
import type { Mapping, StatusClass } from "@/lib/parse.ts";
import type { AnalysisResult, LoadedFile, StatusValue } from "@/lib/protocol.ts";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/types.ts";
import { ImportScreen } from "./ImportScreen.tsx";
import { MappingScreen } from "./MappingScreen.tsx";
import { Dashboard } from "./Dashboard.tsx";
import { Report } from "./Report.tsx";

type View = "import" | "map" | "dashboard" | "report";

/** Column mappings remembered for this session only (in memory, never saved). */
const rememberedMappings = new Map<string, { mapping: Mapping; statusMap: Record<string, StatusClass> }>();
const headerKey = (headers: string[]) => headers.join("\u0001");

export function HealthCheckApp() {
  const { send, stage } = useAnalyzer();
  const [view, setView] = useState<View>("import");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState<LoadedFile | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [statusValues, setStatusValues] = useState<StatusValue[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, StatusClass>>({});
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const run = useCallback(async <T,>(task: () => Promise<T>): Promise<T | null> => {
    setBusy(true);
    setError(null);
    try {
      return await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const analyzeWith = useCallback(
    (m: Mapping, sm: Record<string, StatusClass>, s: Settings, file: LoadedFile) =>
      run(async () => {
        const res = await send<"result">({ type: "analyze", mapping: m, statusMap: sm, settings: s });
        rememberedMappings.set(headerKey(file.headers), { mapping: m, statusMap: sm });
        setResult(res.data);
        setView((v) => (v === "report" ? v : "dashboard"));
        return res.data;
      }),
    [run, send],
  );

  const onLoaded = (data: LoadedFile) => {
    const remembered = rememberedMappings.get(headerKey(data.headers));
    setLoaded(data);
    setMapping(remembered?.mapping ?? data.guess);
    setStatusMap(remembered?.statusMap ?? {});
    setStatusValues([]);
    setResult(null);
    return remembered;
  };

  const onFile = (file: File) =>
    run(async () => {
      const res = await send<"loaded">({ type: "load-file", file });
      onLoaded(res.data);
      setView("map");
    });

  const onSample = async () => {
    const res = await run(() => send<"loaded">({ type: "load-sample" }));
    if (!res) return;
    onLoaded(res.data);
    await analyzeWith(res.data.guess, {}, settings, res.data);
  };

  // Fetch distinct status values whenever the status column changes.
  const statusColumn = mapping?.status ?? null;
  useEffect(() => {
    if (!loaded || !statusColumn) return;
    let cancelled = false;
    send<"status-values">({ type: "status-values", column: statusColumn })
      .then((res) => {
        if (!cancelled) setStatusValues(res.data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [loaded, statusColumn, send]);

  const effectiveStatusMap = useCallback(
    () => ({ ...Object.fromEntries(statusValues.map((v) => [v.value, v.guess])), ...statusMap }),
    [statusValues, statusMap],
  );

  // Re-analyse (debounced) when settings change on the dashboard.
  const firstSettings = useRef(true);
  useEffect(() => {
    if (firstSettings.current) {
      firstSettings.current = false;
      return;
    }
    if (!loaded || !mapping || !result) return;
    const t = setTimeout(() => void analyzeWith(mapping, effectiveStatusMap(), settings, loaded), 300);
    return () => clearTimeout(t);
    // only settings changes should trigger this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const reset = () => {
    setView("import");
    setError(null);
  };

  return (
    <div className="shell">
      <header className="topbar no-print">
        <div className="brand">
          <strong>Rollcfluence</strong>
          <span>Automation Health Check</span>
        </div>
        <span className="privacy-pill">Your file never leaves this computer</span>
      </header>

      <main>
        {view === "import" && (
          <ImportScreen
            busy={busy}
            stage={stage}
            error={error}
            settings={settings}
            onSettings={setSettings}
            onFile={(f) => void onFile(f)}
            onSample={() => void onSample()}
          />
        )}
        {view === "map" && loaded && mapping && (
          <MappingScreen
            loaded={loaded}
            mapping={mapping}
            onMapping={setMapping}
            statusValues={statusValues}
            statusMap={statusMap}
            onStatusMap={setStatusMap}
            onAnalyze={() => void analyzeWith(mapping, effectiveStatusMap(), settings, loaded)}
            onBack={reset}
            busy={busy}
            stage={stage}
            error={error}
          />
        )}
        {view === "dashboard" && result && loaded && (
          <Dashboard
            result={result}
            fileName={loaded.fileName}
            settings={settings}
            onSettings={setSettings}
            busy={busy}
            error={error}
            onReport={() => setView("report")}
            onRemap={() => setView("map")}
            onNewFile={reset}
          />
        )}
        {view === "report" && result && loaded && <Report result={result} fileName={loaded.fileName} onBack={() => setView("dashboard")} />}
      </main>
    </div>
  );
}
