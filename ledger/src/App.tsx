import * as React from "react";
import { AnalyticsBento } from "@/components/ui/analytics-bento";
import ShapeWaves from "@/components/ui/ShapeWaves";
import ShapeWavesCanvas from "@/components/ui/shape-waves-canvas";
import { useLedger, blobUrl } from "@/lib/store";
import { summarize, compareForms, deadlines, CONST, MONTHS, MONTHS_SHORT, r2, type Entry, type Kind, type TaxType, type Settings } from "@/lib/tax";
import { cn } from "@/lib/utils";

/* ShapeWaves as in the React Bits usage example, cursor splash on (ilko asked
   for it here on 22 Oct, an exception to his no-cursor rule). The splash is a
   little wider and stronger than the example (40/0.4) so the trail is easy to see. */
const WAVES = { text: "</>", fontFamily: 'Geist, "Geist Sans", system-ui, sans-serif', fontWeight: 500, textSize: 0.6, shapes: "mixed", cellSize: 10, dotSize: 0.75, color: "#929292", hoverColor: "#ffffff", backgroundColor: "#000000", interactive: true, splashRadius: 50, splashStrength: 0.7, speed: 1, scale: 1, contrast: 1, brightness: 0.4, fade: 0.25 } as const;

/* ---------------- labels ---------------- */

const KIND: Record<Kind, string> = { income: "Приход", expense: "Разход", taxpaid: "Платен данък" };
const INCOME_CATS = ["Signature", "Concierge", "Flagship", "Месечна такса", "Дизайн добавка", "Друго"];
const EXPENSE_CATS = ["Техника", "Телефон и интернет", "Хостинг и софтуер", "AI услуги", "Реклама", "Счетоводство", "Офис", "Транспорт", "Друго"];
const TAX_TYPES: Record<TaxType, string> = { contrib: "Осигуровки", advance: "Авансов данък", vat97a: "ДДС по чл. 97а", annual: "Годишен данък" };
const METHODS = { bank: "Банков превод", card: "Карта", cash: "В брой" } as const;
// chrome shades, light to dark, for the expense treemap
const SHADES = ["#f1f2f4", "#d4d7db", "#b6babf", "#9a9ea4", "#7f838a", "#666a71", "#51545a", "#3f4247", "#2f3135"];

const eur = (n: number) => "€" + r2(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/,/g, " ");
const eur0 = (n: number) => "€" + Math.round(n).toLocaleString("en-US").replace(/,/g, " ");
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fmtDate = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS_SHORT[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
const pct = (a: number, b: number) => (b > 0 ? `${(((a - b) / b) * 100).toFixed(1)}%` : "");

/* ---------------- small UI ---------------- */

function Panel({ className, children, ...rest }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn("rounded-[22px] border border-border bg-card p-5 backdrop-blur-xl sm:p-6", className)} {...rest}>{children}</section>;
}
function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="mb-1.5 block text-[12px] font-medium tracking-[0.02em] text-muted-foreground">{children}</label>;
}
function Row({ label, value, strong, hint }: { label: React.ReactNode; value: string; strong?: boolean; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-border py-2.5 text-sm">
      <span className="min-w-0 text-muted-foreground">{label}{hint && <span className="mt-0.5 block text-xs text-muted-foreground/70">{hint}</span>}</span>
      <span className={cn("num shrink-0", strong ? "text-base font-semibold text-foreground" : "text-foreground/90")}>{value}</span>
    </div>
  );
}

/* ---------------- entry form ---------------- */

type Draft = Omit<Entry, "id" | "amount"> & { id?: string; amount: string };
const blank = (kind: Kind): Draft => ({ kind, date: todayISO(), amount: "", title: "", party: "", category: kind === "income" ? INCOME_CATS[0] : kind === "expense" ? EXPENSE_CATS[0] : undefined, invoiceNo: "", method: "bank", foreign: false, businessPct: 100, asset: false, taxType: kind === "taxpaid" ? "contrib" : undefined, docs: [], note: "" });

function EntryForm({ initial, onClose, ledger }: { initial: Draft; onClose: () => void; ledger: ReturnType<typeof useLedger> }) {
  const [d, setD] = React.useState<Draft>(initial);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const switchKind = (kind: Kind) => setD((x) => ({ ...blank(kind), id: x.id, date: x.date, amount: x.amount, title: x.title, docs: x.docs, note: x.note }));

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setErr(null);
    try {
      const added = [];
      for (const f of Array.from(files)) added.push(await ledger.upload(f));
      set({ docs: [...(d.docs ?? []), ...added] });
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(String(d.amount).replace(",", "."));
    if (!(amount > 0)) { setErr("Въведи сума над 0."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) { setErr("Избери дата."); return; }
    if (!d.title.trim()) { setErr("Напиши кратко описание."); return; }
    setBusy(true); setErr(null);
    try {
      const clean: Omit<Entry, "id"> & { id?: string } = { ...d, amount: r2(amount), title: d.title.trim() };
      if (d.kind !== "expense") { delete clean.foreign; delete clean.asset; delete clean.businessPct; }
      if (d.kind !== "taxpaid") delete clean.taxType;
      await ledger.save(clean);
      onClose();
    } catch (e2) { setErr((e2 as Error).message || "Записът не се запази. Опитай пак."); setBusy(false); }
  };

  const isExp = d.kind === "expense", isInc = d.kind === "income", isTax = d.kind === "taxpaid";
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={submit} className="mx-auto my-6 w-[calc(100%-32px)] max-w-[560px] rounded-[22px] border border-border bg-popover p-5 shadow-2xl sm:p-6" aria-label="Запис">
        <div className="flex items-center justify-between gap-3">
          <h2 className="m-0 text-lg font-semibold tracking-[-0.02em]">{d.id ? "Промени запис" : "Нов запис"}</h2>
          <button type="button" className="btn h-8 px-3" onClick={onClose}>Затвори</button>
        </div>

        <div role="tablist" aria-label="Вид" className="mt-4 grid grid-cols-3 gap-1 rounded-[10px] bg-muted p-1">
          {(Object.keys(KIND) as Kind[]).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={d.kind === k} onClick={() => switchKind(k)}
              className={cn("h-8 rounded-[7px] text-[13px] font-medium transition-colors", d.kind === k ? "bg-background text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}>{KIND[k]}</button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div><Label htmlFor="f-date">Дата на плащането</Label><input id="f-date" className="field" type="date" value={d.date} onChange={(e) => set({ date: e.target.value })} required /></div>
          <div><Label htmlFor="f-amount">Сума в евро</Label><input id="f-amount" className="field num" inputMode="decimal" placeholder="0.00" value={d.amount} onChange={(e) => set({ amount: e.target.value })} required /></div>
          <div className="col-span-2"><Label htmlFor="f-title">Описание</Label><input id="f-title" className="field" placeholder={isInc ? "Сайт за Salon Aurora, аванс 50%" : isExp ? "Лаптоп MacBook Air" : "Осигуровки за октомври"} value={d.title} onChange={(e) => set({ title: e.target.value })} required /></div>

          {!isTax && <div><Label htmlFor="f-party">{isInc ? "Клиент" : "Доставчик"}</Label><input id="f-party" className="field" value={d.party ?? ""} onChange={(e) => set({ party: e.target.value })} /></div>}
          {!isTax && (
            <div><Label htmlFor="f-cat">{isInc ? "Пакет" : "Категория"}</Label>
              <select id="f-cat" className="field" value={d.category} onChange={(e) => set({ category: e.target.value })}>
                {(isInc ? INCOME_CATS : EXPENSE_CATS).map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          )}
          {isTax && (
            <div className="col-span-2"><Label htmlFor="f-tax">Какво плати</Label>
              <select id="f-tax" className="field" value={d.taxType} onChange={(e) => set({ taxType: e.target.value as TaxType })}>
                {(Object.keys(TAX_TYPES) as TaxType[]).map((t) => <option key={t} value={t}>{TAX_TYPES[t]}</option>)}
              </select>
            </div>
          )}
          <div><Label htmlFor="f-inv">{isTax ? "Номер на платежното" : "Фактура №"}</Label><input id="f-inv" className="field num" value={d.invoiceNo ?? ""} onChange={(e) => set({ invoiceNo: e.target.value })} /></div>
          <div><Label htmlFor="f-method">Начин на плащане</Label>
            <select id="f-method" className="field" value={d.method} onChange={(e) => set({ method: e.target.value as Entry["method"] })}>
              {(Object.keys(METHODS) as (keyof typeof METHODS)[]).map((m) => <option key={m} value={m}>{METHODS[m]}</option>)}
            </select>
          </div>
        </div>

        {isInc && d.method !== "bank" && <p className="mt-3 text-xs text-warn">При плащане в брой или с карта може да ти трябва касов бон (Наредба Н-18). Питай счетоводителя.</p>}

        {isExp && (
          <div className="mt-4 grid gap-3 rounded-[14px] border border-border p-3.5">
            <label className="flex items-start gap-3 text-sm"><input id="f-foreign" type="checkbox" className="mt-0.5 size-4 accent-[#d4d7db]" checked={!!d.foreign} onChange={(e) => set({ foreign: e.target.checked })} />
              <span>Доставчикът е от чужбина <span className="block text-xs text-muted-foreground">Vercel, Anthropic, Google, Meta. Дължиш 20% ДДС по чл. 97а върху сумата.</span></span></label>
            <label className="flex items-start gap-3 text-sm"><input id="f-asset" type="checkbox" className="mt-0.5 size-4 accent-[#d4d7db]" checked={!!d.asset} onChange={(e) => set({ asset: e.target.checked })} />
              <span>Дълготраен актив <span className="block text-xs text-muted-foreground">Лаптоп, телефон, монитор. При ЕТ или ЕООД се отписва по 50% на година.</span></span></label>
            <div className="flex items-center gap-3 text-sm">
              <label htmlFor="f-share" className="shrink-0">Използваш го за бизнеса</label>
              <input id="f-share" type="range" min={0} max={100} step={5} value={d.businessPct ?? 100} onChange={(e) => set({ businessPct: Number(e.target.value) })} className="min-w-0 flex-1 accent-[#d4d7db]" />
              <span className="num w-11 text-right">{d.businessPct ?? 100}%</span>
            </div>
          </div>
        )}

        <div className="mt-4">
          <Label>Документи (фактура, бележка, договор, платежно)</Label>
          <div className="flex flex-wrap gap-2">
            {(d.docs ?? []).map((f) => (
              <span key={f.id} className="inline-flex max-w-full items-center gap-2 rounded-[8px] border border-border bg-muted px-2.5 py-1.5 text-xs">
                <span className="truncate">{f.name}</span>
                <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={`Махни ${f.name}`} onClick={() => set({ docs: (d.docs ?? []).filter((x) => x.id !== f.id) })}>×</button>
              </span>
            ))}
            {ledger.canUpload() ? (
              <>
                <input ref={fileRef} id="f-files" type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => addFiles(e.target.files)} />
                <label htmlFor="f-files" className={cn("btn h-8 px-3", busy && "pointer-events-none opacity-50")}>{busy ? "Качвам…" : "Качи файл"}</label>
              </>
            ) : <span className="text-xs text-muted-foreground">Качването работи, когато страницата е отворена в Claude.</span>}
          </div>
        </div>

        <div className="mt-4"><Label htmlFor="f-note">Бележка</Label><textarea id="f-note" className="field" rows={2} value={d.note ?? ""} onChange={(e) => set({ note: e.target.value })} /></div>

        {err && <p role="alert" className="mt-3 text-sm text-[#ff9a9d]">{err}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>Отказ</button>
          <button type="submit" className="btn btn-chrome" disabled={busy}>{d.id ? "Запази промените" : "Запази записа"}</button>
        </div>
      </form>
    </div>
  );
}

/* ---------------- settings ---------------- */

function SettingsPanel({ settings, saved, onSave, disabled }: { settings: Settings; saved: boolean; onSave: (s: Settings) => Promise<void>; disabled: boolean }) {
  const [s, setS] = React.useState(settings);
  const [msg, setMsg] = React.useState<string | null>(null);
  React.useEffect(() => setS(settings), [settings]);
  const dirty = s.startDate !== settings.startDate || s.sickness !== settings.sickness;
  return (
    <Panel aria-label="Настройки">
      <h2 className="m-0 text-[17px] font-semibold tracking-[-0.02em]">Настройки</h2>
      {!saved && <p className="mt-1.5 text-sm text-warn">Запази датата, от която започваш дейност. От нея зависят осигуровките.</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="s-start">Начало на дейността (регистрация в НАП)</Label><input id="s-start" type="date" className="field" value={s.startDate} onChange={(e) => setS({ ...s, startDate: e.target.value })} /></div>
        <label className="flex items-start gap-3 self-end pb-2 text-sm"><input id="s-sick" type="checkbox" className="mt-0.5 size-4 accent-[#d4d7db]" checked={s.sickness} onChange={(e) => setS({ ...s, sickness: e.target.checked })} />
          <span>Осигурявам се и за болнични <span className="block text-xs text-muted-foreground">31,3% вместо 27,8%</span></span></label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button className="btn btn-chrome" disabled={disabled || (!dirty && saved)} onClick={async () => { setMsg(null); try { await onSave(s); setMsg("Запазено."); } catch (e) { setMsg((e as Error).message); } }}>Запази</button>
        {msg && <span className="text-sm text-muted-foreground" role="status">{msg}</span>}
      </div>
    </Panel>
  );
}

/* ---------------- the app ---------------- */

export default function App() {
  const ledger = useLedger();
  const { entries, settings, status } = ledger;
  const today = todayISO();
  const thisYear = Number(today.slice(0, 4));
  const years = React.useMemo(() => {
    const ys = new Set([thisYear, ...entries.map((e) => Number(e.date.slice(0, 4)))]);
    return [...ys].sort((a, b) => b - a);
  }, [entries, thisYear]);
  const [year, setYear] = React.useState(thisYear);
  const [form, setForm] = React.useState<Draft | null>(null);
  const [filter, setFilter] = React.useState<Kind | "all">("all");
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [gpuOk, setGpuOk] = React.useState(() => typeof navigator !== "undefined" && "gpu" in navigator);
  // WebGPU can exist and still never start inside a sandboxed frame: fall back after 2.5 s
  React.useEffect(() => {
    if (!gpuOk) return;
    const t = window.setTimeout(() => { if (document.querySelector(".shape-waves")?.getAttribute("data-ready") !== "true") setGpuOk(false); }, 2500);
    return () => window.clearTimeout(t);
  }, [gpuOk]);

  const upTo = year === thisYear ? Number(today.slice(5, 7)) - 1 : 11;
  const S = React.useMemo(() => summarize(entries, settings, year), [entries, settings, year]);
  const prev = React.useMemo(() => summarize(entries, settings, year - 1), [entries, settings, year]);
  const cmp = React.useMemo(() => compareForms(entries, settings, year), [entries, settings, year]);
  const due = React.useMemo(() => deadlines(entries, settings, today, 75), [entries, settings, today]);
  const yearEntries = entries.filter((e) => e.date.startsWith(String(year)));
  const shown = yearEntries.filter((e) => filter === "all" || e.kind === filter);
  const docs = yearEntries.flatMap((e) => (e.docs ?? []).map((f) => ({ ...f, entry: e })));
  const canWrite = status === "ready";

  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(null), 2600); };

  /* ---- bento data from real entries ---- */
  const byMonth = (y: number, kind: Kind) => { const a = Array(12).fill(0); for (const e of entries) if (e.kind === kind && e.date.startsWith(String(y))) a[Number(e.date.slice(5, 7)) - 1] += e.amount; return a.map(r2); };
  const incM = byMonth(year, "income"), expM = byMonth(year, "expense"), incP = byMonth(year - 1, "income"), expP = byMonth(year - 1, "expense");
  const hasPrev = incP.some(Boolean) || expP.some(Boolean);
  let run = 0;
  const cumulative = incM.slice(0, upTo + 1).map((v, i) => ({ label: `${MONTHS[i]} ${year}`, value: (run += v) }));
  const series = cumulative.length > 1 ? cumulative : [{ label: `начало на ${year}`, value: 0 }, ...cumulative];
  const incomes = yearEntries.filter((e) => e.kind === "income");
  const expenses = yearEntries.filter((e) => e.kind === "expense");
  const m = upTo, q = Math.floor(upTo / 3);
  const expIn = (pred: (mm: number) => boolean, cat?: string) => r2(expenses.filter((e) => pred(Number(e.date.slice(5, 7)) - 1) && (!cat || e.category === cat)).reduce((a, e) => a + e.amount, 0));
  const incIn = (pred: (mm: number) => boolean) => r2(incomes.filter((e) => pred(Number(e.date.slice(5, 7)) - 1)).reduce((a, e) => a + e.amount, 0));
  const P = [(mm: number) => mm === m, (mm: number) => Math.floor(mm / 3) === q, () => true];
  const periodNames = [MONTHS[m], `${q + 1}-во тримесечие`, String(year)];
  const cats = EXPENSE_CATS.map((c, i) => ({ c, color: SHADES[i], values: P.map((p) => expIn(p, c)) })).filter((x) => x.values[2] > 0);
  const yearStats = years.filter((y) => y <= thisYear).map((y) => {
    const s = summarize(entries, settings, y), sp = summarize(entries, settings, y - 1);
    const n = entries.filter((e) => e.kind === "income" && e.date.startsWith(String(y))).length;
    const active = Math.max(1, s.months || 12);
    return {
      label: String(y), values: byMonth(y, "income"),
      stats: [
        { label: "Средно на месец", value: s.income / active, delta: pct(s.income / active, sp.income / Math.max(1, sp.months || 12)), note: `${s.months || 0} мес. дейност` },
        { label: "Общо за годината", value: s.income, delta: pct(s.income, sp.income), note: `${n} плащания` },
      ],
      rows: [{ label: "Данък 10% (оценка)", value: eur(s.incomeTax) }, { label: "Осигуровки (оценка)", value: eur(s.contribTotal) }, { label: "ДДС по чл. 97а", value: eur(s.vat97a) }],
    };
  });

  const exportCsv = async () => {
    const head = ["Дата", "Вид", "Описание", "Клиент/доставчик", "Категория", "Фактура/платежно", "Сума EUR", "Начин", "От чужбина (97а)", "Бизнес %", "Актив", "Данък", "Документи", "Бележка"];
    const q2 = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = yearEntries.slice().reverse().map((e) => [e.date, KIND[e.kind], e.title, e.party, e.category, e.invoiceNo, e.amount.toFixed(2), e.method ? METHODS[e.method] : "", e.foreign ? "да" : "", e.kind === "expense" ? e.businessPct ?? 100 : "", e.asset ? "да" : "", e.taxType ? TAX_TYPES[e.taxType] : "", (e.docs ?? []).map((d) => d.name).join(" | "), e.note]);
    const csv = "﻿" + [head, ...rows].map((r) => r.map(q2).join(",")).join("\r\n");
    try { await ledger.download(`rollcfluence-${year}.csv`, csv); } catch (e) { const c = (e as { code?: string }).code; if (c !== "declined") flash((e as Error).message || "Файлът не се изтегли."); }
  };

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        {gpuOk ? (
          <ShapeWaves {...WAVES} flow={0} direction={0} glow={0.35} intro introDuration={1.6} paused={false} onError={() => setGpuOk(false)} />
        ) : (
          <ShapeWavesCanvas {...WAVES} />
        )}
      </div>

      <div className="relative z-10 mx-auto max-w-[1240px] pb-16" style={{ paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))", paddingTop: 28 }}>
        {/* header */}
        <header className="flex flex-wrap items-end justify-between gap-4 rounded-[22px] border border-border bg-card p-5 backdrop-blur-xl sm:p-6">
          <div className="min-w-0">
            <div className="chrome-text text-[13px] font-semibold tracking-[0.32em]">ROLLCFLUENCE</div>
            <h1 className="m-0 mt-1.5 text-[30px] font-medium leading-tight tracking-[-0.03em] sm:text-[38px]" style={{ textWrap: "balance" }}>Данъци и документи</h1>
            <p className="m-0 mt-1 text-sm text-muted-foreground">Свободна професия · данък 10% след 25% признати разходи · суми в евро</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="year" className="sr-only">Година</label>
            <select id="year" className="field h-[38px] w-auto" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button className="btn" onClick={exportCsv} disabled={!yearEntries.length || !ledger.canDownload()}>CSV за счетоводителя</button>
            <button className="btn btn-chrome" onClick={() => setForm(blank("income"))} disabled={!canWrite}>Нов запис</button>
          </div>
        </header>

        {status === "readonly" && (
          <Panel className="mt-5 border-warn/40"><p className="m-0 text-sm">{ledger.error ?? "Записите се пазят само когато страницата е отворена в Claude и си влязъл в профила си. Тук може само да я разгледаш."}</p></Panel>
        )}

        {/* what you will pay */}
        <div className="mt-6 grid grid-cols-12 gap-4">
          <Panel className="col-span-12 lg:col-span-7" aria-label="Колко ще платиш">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[13px] text-muted-foreground">Колко ще платиш за {year}</div>
                <div className="num mt-2 text-[40px] font-medium leading-none sm:text-[50px]">{eur(S.totalDue)}</div>
                <div className="mt-2 text-[13px] text-muted-foreground">Платено <span className="num text-foreground/85">{eur(S.paidTotal)}</span> · Остава <span className="num text-foreground">{eur(Math.max(0, S.remaining))}</span></div>
              </div>
              <div className="w-full max-w-[260px]">
                <div className="flex justify-between text-xs text-muted-foreground"><span>Праг за ДДС</span><span className="num">{eur0(S.income)} / {eur0(CONST.vatThreshold)}</span></div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Оборот спрямо прага за ДДС" aria-valuenow={Math.round(S.vatProgress * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, S.vatProgress * 100)}%`, background: S.vatProgress > 0.8 ? "var(--warn)" : "var(--chrome)" }} />
                </div>
                <div className="mt-1.5 text-xs text-muted-foreground">{S.vatProgress >= 1 ? "Прагът е минат. Регистрация по ДДС до 7 дни." : S.vatProgress > 0.8 ? "Наближаваш прага. Говори със счетоводителя." : "Над прага трябва пълна регистрация по ДДС."}</div>
              </div>
            </div>
            <div className="mt-5">
              <Row label="Осигуровки" hint={`${S.months} мес. × минимум, ${settings.sickness ? "31,3%" : "27,8%"}`} value={eur(S.contribMinDue)} />
              <Row label="Доплащане на осигуровки с годишната декларация" hint="Ако 75% от прихода е над минималния осигурителен доход" value={eur(S.contribTopUp)} />
              <Row label="Данък 10%" hint={`върху ${eur(S.taxable)}: приход минус 25% минус осигуровки`} value={eur(S.incomeTax)} />
              <Row label="ДДС по чл. 97а" hint={`20% от ${eur(S.foreign)} покупки от чужбина`} value={eur(S.vat97a)} />
              <Row label="Общо" value={eur(S.totalDue)} strong />
            </div>
            {S.assumed && <p className="mb-0 mt-3 text-xs text-warn">За {year} още няма обявен минимален осигурителен доход. Използвам последния известен (€620,20).</p>}
          </Panel>

          <Panel className="col-span-12 lg:col-span-5" aria-label="Признати разходи">
            <div className="text-[13px] text-muted-foreground">Признати разходи 25%</div>
            <div className="num mt-2 text-[34px] font-medium leading-none">{eur(S.statutory)}</div>
            <p className="mb-0 mt-3 text-sm leading-relaxed text-foreground/85">
              Като свободна професия държавата ти признава 25% от прихода, без бележки. Лаптопът, телефонът и сметките <b className="font-semibold text-foreground">не намаляват данъка ти допълнително</b>, защото тези 25% ги покриват. Записвай ги все пак: при ЕТ и ЕООД те се приспадат.
            </p>
            <div className="mt-4">
              <div className="text-xs text-muted-foreground">Данък и осигуровки за {year}, ако беше…</div>
              <Row label="Свободна професия (сега)" value={eur(cmp.freelancer)} strong />
              <Row label="ЕТ, 15% върху печалбата" value={eur(cmp.et)} />
              <Row label="ЕООД, 10% + 5% дивидент" hint="плюс по-скъп счетоводител" value={eur(cmp.eood)} />
              <p className="mb-0 mt-2 text-xs text-muted-foreground">Реални разходи, които биха се приспаднали: <span className="num">{eur(cmp.deductibleExpenses)}</span>. Груба оценка, без ДДС по 97а.</p>
            </div>
          </Panel>
        </div>

        {/* deadlines */}
        <Panel className="mt-4" aria-label="Срокове">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="m-0 text-[17px] font-semibold tracking-[-0.02em]">Следващи срокове</h2>
            <span className="text-xs text-muted-foreground">следващите 75 дни, по НАП и НОИ</span>
          </div>
          {due.length ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {due.map((d) => {
                const days = Math.round((new Date(d.date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 864e5);
                return (
                  <div key={d.date + d.title} className={cn("rounded-[14px] border p-3.5", days <= 7 ? "border-warn/50" : "border-border")}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="num text-sm">{fmtDate(d.date)}</span>
                      <span className={cn("text-xs", days <= 7 ? "text-warn" : "text-muted-foreground")}>{days === 0 ? "днес" : `след ${days} дни`}</span>
                    </div>
                    <div className="mt-1.5 text-sm text-foreground/90">{d.title}</div>
                    <div className="num mt-1 text-[15px]">{d.amount === null ? "сумата излиза от декларацията" : eur(d.amount)}</div>
                  </div>
                );
              })}
            </div>
          ) : <p className="mb-0 mt-3 text-sm text-muted-foreground">Няма срокове в следващите 75 дни. Провери датата на начало в настройките.</p>}
        </Panel>

        {/* analytics */}
        <div className="mt-4">
          {yearEntries.some((e) => e.kind !== "taxpaid") ? (
            <AnalyticsBento
              currency="€"
              credit={false}
              fontFamily="var(--font-sans)"
              monoFamily="var(--font-mono)"
              colors={{ revenue: ["#6f737a", "#f3f4f6"], desktop: ["#9fa3a9", "#ffffff"], mobile: ["#4a4d53", "#9a9ea4"], radar: "#e4e6ea" }}
              revenue={{ label: "Приходи", value: S.income, delta: year === thisYear ? "" : pct(S.income, prev.income), note: <>Средно на плащане <span className="text-foreground/80">{eur0(incomes.length ? S.income / incomes.length : 0)}</span></>, caption: `Натрупано за ${year}`, series }}
              sessions={{ label: "Нетно след разходи", value: r2(S.income - S.expenses), delta: "", note: "Приходи нагоре, разходи надолу, по месеци", desktop: hasPrev ? [incM, incP] : [incM], mobile: hasPrev ? [expM, expP] : [expM], axis: MONTHS_SHORT, prefix: "€", labels: { desktop: "Приходи", mobile: "Разходи", prior: `${year - 1}`, current: String(year) } }}
              categories={{
                title: "Разходи по категория",
                shareLabel: "Дял",
                emptyLabel: "Още няма разходи за този период",
                groups: (cats.length ? cats : [{ c: "Друго", color: SHADES[8] }]).map((x) => ({ id: x.c, name: x.c, color: x.color, ink: (SHADES.indexOf(x.color) < 4 ? "dark" : "light") as "dark" | "light" })),
                periods: P.map((p, i) => ({ label: periodNames[i], total: expIn(p), delta: "", compare: `приходи ${eur0(incIn(p))}` })),
                items: cats.map((x) => ({ name: x.c, group: x.c, values: x.values })),
                table: { columns: ["", periodNames[0], "Тримесечие", "Година"], rows: [
                  { label: "Приходи", values: P.map((p) => eur0(incIn(p))) },
                  { label: "Разходи", values: P.map((p) => eur0(expIn(p))) },
                  { label: "Нетно", values: P.map((p) => eur0(incIn(p) - expIn(p))) },
                ] },
              }}
              seasonality={{ title: "Приходи по месеци", valueLabel: "Приходи", axis: MONTHS_SHORT, years: yearStats.length ? yearStats : [{ label: String(year), values: Array(12).fill(0), stats: [], rows: [] }] }}
            />
          ) : (
            <Panel className="grid place-items-center py-12 text-center" aria-label="Графики">
              <div className="max-w-[420px]">
                <div className="text-[17px] font-semibold tracking-[-0.02em]">Тук ще видиш приходите и разходите си</div>
                <p className="mt-2 text-sm text-muted-foreground">Добави първото плащане от клиент или първата сметка. Графиките, данъкът и сроковете се смятат от твоите записи.</p>
                <button className="btn btn-chrome mt-3" onClick={() => setForm(blank("income"))} disabled={!canWrite}>Добави първия запис</button>
              </div>
            </Panel>
          )}
        </div>

        {/* entries */}
        <Panel className="mt-4" aria-label="Записи">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="m-0 text-[17px] font-semibold tracking-[-0.02em]">Записи за {year}</h2>
            <div role="tablist" aria-label="Филтър" className="inline-flex gap-1 rounded-[10px] bg-muted p-1">
              {(["all", "income", "expense", "taxpaid"] as const).map((k) => (
                <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
                  className={cn("h-7 rounded-[7px] px-2.5 text-xs font-medium", filter === k ? "bg-background text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}>
                  {k === "all" ? "Всички" : KIND[k]}
                </button>
              ))}
            </div>
          </div>
          {shown.length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-2 font-medium">Дата</th><th className="py-2 font-medium">Описание</th><th className="py-2 font-medium">Вид</th><th className="py-2 text-right font-medium">Сума</th><th className="py-2 text-right font-medium"><span className="sr-only">Действия</span></th></tr></thead>
                <tbody>
                  {shown.map((e) => (
                    <tr key={e.id} className="border-t border-border align-top">
                      <td className="num whitespace-nowrap py-3 pr-3 text-muted-foreground">{fmtDate(e.date)}</td>
                      <td className="py-3 pr-3">
                        <div className="text-foreground">{e.title}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{[e.party, e.category, e.taxType && TAX_TYPES[e.taxType], e.invoiceNo && `№ ${e.invoiceNo}`, e.foreign && "чл. 97а", e.asset && "актив", e.kind === "expense" && (e.businessPct ?? 100) < 100 && `${e.businessPct}% бизнес`].filter(Boolean).join(" · ")}</div>
                        {!!e.docs?.length && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {e.docs.map((d) => <a key={d.id} href={blobUrl(d.id)} target="_blank" rel="noopener" className="rounded-[6px] border border-border px-2 py-0.5 text-xs text-foreground/80 hover:border-foreground/30">{d.name}</a>)}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-3 text-muted-foreground">{KIND[e.kind]}</td>
                      <td className={cn("num whitespace-nowrap py-3 text-right", e.kind === "income" ? "text-foreground" : "text-foreground/75")}>{e.kind === "income" ? "+" : "−"}{eur(e.amount)}</td>
                      <td className="whitespace-nowrap py-2 pl-3 text-right">
                        {confirmId === e.id ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">Изтрий и файловете?</span>
                            <button className="btn btn-danger h-7 px-2.5 text-xs" onClick={async () => { setConfirmId(null); await ledger.remove(e); flash("Записът е изтрит."); }}>Да</button>
                            <button className="btn h-7 px-2.5 text-xs" onClick={() => setConfirmId(null)}>Не</button>
                          </span>
                        ) : (
                          <span className="inline-flex gap-1.5">
                            <button className="btn h-7 px-2.5 text-xs" disabled={!canWrite} onClick={() => setForm({ ...e, amount: String(e.amount) })}>Промени</button>
                            <button className="btn h-7 px-2.5 text-xs" disabled={!canWrite} onClick={() => setConfirmId(e.id)}>Изтрий</button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="mb-0 mt-3 text-sm text-muted-foreground">Няма записи за {year}{filter !== "all" ? " от този вид" : ""}.</p>}
        </Panel>

        {/* documents */}
        <Panel className="mt-4" aria-label="Документи">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="m-0 text-[17px] font-semibold tracking-[-0.02em]">Документи за {year}</h2>
            <span className="text-xs text-muted-foreground">{docs.length} файла · пазят се в тази частна страница</span>
          </div>
          {docs.length ? (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {docs.map((d) => (
                <a key={d.id} href={blobUrl(d.id)} target="_blank" rel="noopener" className="group block min-w-0 overflow-hidden rounded-[14px] border border-border bg-muted/40 hover:border-foreground/30">
                  <div className="grid aspect-[4/3] max-w-full place-items-center overflow-hidden bg-black/40">
                    {d.type.startsWith("image/") ? <img src={blobUrl(d.id)} alt="" className="size-full object-cover" loading="lazy" /> : <span className="num text-sm text-muted-foreground">PDF</span>}
                  </div>
                  <div className="p-2.5">
                    <div className="truncate text-xs text-foreground/90">{d.name}</div>
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{fmtDate(d.entry.date)} · {d.entry.title}</div>
                  </div>
                </a>
              ))}
            </div>
          ) : <p className="mb-0 mt-3 text-sm text-muted-foreground">Качи фактура, бележка или договор към всеки запис. Тук ще ги виждаш всички на едно място.</p>}
        </Panel>

        <div className="mt-4"><SettingsPanel settings={settings} saved={ledger.hasSettings} disabled={!canWrite} onSave={ledger.saveSettings} /></div>

        <footer className="mt-8 text-xs leading-relaxed text-muted-foreground">
          <p className="m-0 max-w-[760px]">Това е оценка от твоите записи, не данъчен съвет. Потвърди сумите със счетоводител. Ставки за 2026: данък 10% (ЗДДФЛ), 25% признати разходи (чл. 29 ЗДДФЛ), осигуровки 27,8% върху минимум €550,66 до юли и €620,20 от август, максимум €2 300 (НОИ, ДВ бр. 68/2026), праг за ДДС €51 130 (ЗДДС), ДДС по чл. 97а 20%. Срокове: осигуровки до 25-о, ДДС по 97а до 14-о, авансов данък до 25-о след тримесечието, годишна декларация до 30 април.</p>
          <p className="m-0 mt-2">Графики: Analytics Bento от vasnev.art · Фон: ShapeWaves от React Bits</p>
        </footer>
      </div>

      {form && <EntryForm key={form.id ?? "new"} initial={form} ledger={ledger} onClose={() => { setForm(null); }} />}
      {toast && <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-[10px] border border-border bg-popover px-4 py-2.5 text-sm shadow-xl" style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}>{toast}</div>}
    </div>
  );
}
