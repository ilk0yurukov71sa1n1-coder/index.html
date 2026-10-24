// Bulgarian tax estimates for a self-employed person (свободна професия).
// Every rate below names its source. Values for years not in RATES fall back
// to the latest known year and are flagged `assumed` so the UI can say so.

export type Kind = "income" | "expense" | "taxpaid";
export type TaxType = "contrib" | "advance" | "vat97a" | "annual";

export interface Entry {
  id: string;
  kind: Kind;
  date: string; // YYYY-MM-DD, the day the money moved
  amount: number; // EUR
  title: string;
  party?: string;
  category?: string;
  invoiceNo?: string;
  method?: "bank" | "card" | "cash";
  foreign?: boolean; // supplier outside Bulgaria -> чл. 97а VAT
  businessPct?: number; // 0..100, share used for the business
  asset?: boolean; // long-term asset, depreciated 50% a year (computers)
  taxType?: TaxType;
  docs?: { id: string; name: string; type: string; size: number }[];
  note?: string;
  createdAt?: string;
}

export interface Settings {
  startDate: string; // first day of activity, YYYY-MM-DD
  sickness: boolean; // optional sickness/maternity cover (+3.5%)
}

interface YearRates {
  /** minimum and maximum monthly insurable income per month, Jan..Dec */
  min: number[];
  max: number[];
}

// НОИ: €550.66 / €2,111.64 until 31 Jul 2026, €620.20 / €2,300 from 1 Aug 2026
// (ЗБДОО 2026, ДВ бр. 68/28.07.2026).
const RATES: Record<number, YearRates> = {
  2026: {
    min: [...Array(7).fill(550.66), ...Array(5).fill(620.2)],
    max: [...Array(7).fill(2111.64), ...Array(5).fill(2300)],
  },
};

export const CONST = {
  statutory: 0.25, // чл. 29 ЗДДФЛ, нормативно признати разходи
  incomeTax: 0.1, // ЗДДФЛ, flat tax for individuals
  etTax: 0.15, // чл. 48 ЗДДФЛ, ЕТ
  corpTax: 0.1, // ЗКПО
  dividendTax: 0.05, // 2026
  vat: 0.2,
  vatThreshold: 51130, // ЗДДС from 1 Jan 2026, per calendar year
  contrib: 0.278, // pension + health for the self-employed
  contribSick: 0.313,
  assetRate: 0.5, // tax depreciation, computers and software
};

export const r2 = (n: number) => Math.round(n * 100) / 100;

export function ratesFor(year: number): YearRates & { assumed: boolean } {
  if (RATES[year]) return { ...RATES[year], assumed: false };
  const known = Object.keys(RATES).map(Number).sort((a, b) => a - b);
  const pick = year < known[0] ? known[0] : known[known.length - 1];
  const last = RATES[pick];
  const flat = (a: number[]) => Array(12).fill(year < pick ? a[0] : a[11]);
  return { min: flat(last.min), max: flat(last.max), assumed: true };
}

const yearOf = (d: string) => Number(d.slice(0, 4));
const monthOf = (d: string) => Number(d.slice(5, 7)) - 1;
const inYear = (es: Entry[], y: number) => es.filter((e) => yearOf(e.date) === y);
const sum = (es: Entry[]) => r2(es.reduce((a, e) => a + (Number(e.amount) || 0), 0));

/** Months (0-11) in `year` when the activity was running, up to `upToMonth`. */
export function activeMonths(year: number, settings: Settings, upToMonth = 11): number[] {
  // No start date saved yet: nothing is assumed, so no months count.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(settings.startDate)) return [];
  const sy = yearOf(settings.startDate), sm = monthOf(settings.startDate);
  if (year < sy) return [];
  const from = year === sy ? sm : 0;
  const out: number[] = [];
  for (let m = from; m <= upToMonth; m++) out.push(m);
  return out;
}

/** The deductible part of a business expense for a company or ЕТ. */
export function deductible(e: Entry, year: number): number {
  const share = (e.businessPct ?? 100) / 100;
  const base = (Number(e.amount) || 0) * share;
  if (!e.asset) return yearOf(e.date) === year ? base : 0;
  // 50% a year from the year of purchase, so two years in total
  const age = year - yearOf(e.date);
  return age === 0 || age === 1 ? base * CONST.assetRate : 0;
}

export interface YearSummary {
  year: number;
  assumed: boolean;
  income: number;
  expenses: number;
  foreign: number;
  statutory: number; // 25% recognised without receipts
  insurableBase: number;
  contribMinDue: number; // what the monthly minimum payments add up to
  contribTotal: number; // what the year really costs after the annual true-up
  contribTopUp: number; // extra due with the annual return
  taxable: number;
  incomeTax: number;
  vat97a: number;
  totalDue: number;
  paid: Record<TaxType, number>;
  paidTotal: number;
  remaining: number;
  vatProgress: number; // 0..1 of the €51,130 threshold
  months: number;
}

/**
 * The freelancer estimate for one calendar year.
 * Income is counted when received. Taxable income is income minus 25% minus
 * the social contributions for the year (both allowed by ЗДДФЛ).
 */
export function summarize(entries: Entry[], settings: Settings, year: number, upToMonth = 11): YearSummary {
  const rates = ratesFor(year);
  const ys = inYear(entries, year);
  const income = sum(ys.filter((e) => e.kind === "income"));
  const expenses = sum(ys.filter((e) => e.kind === "expense"));
  const foreign = sum(ys.filter((e) => e.kind === "expense" && e.foreign));
  const months = activeMonths(year, settings, upToMonth);
  const rate = settings.sickness ? CONST.contribSick : CONST.contrib;

  const minBase = months.reduce((a, m) => a + rates.min[m], 0);
  const maxBase = months.reduce((a, m) => a + rates.max[m], 0);
  const statutory = r2(income * CONST.statutory);
  const net = income - statutory;
  const insurableBase = months.length ? r2(Math.min(maxBase, Math.max(minBase, net))) : 0;
  const contribMinDue = r2(minBase * rate);
  const contribTotal = r2(insurableBase * rate);
  const contribTopUp = r2(Math.max(0, contribTotal - contribMinDue));
  const taxable = r2(Math.max(0, net - contribTotal));
  const incomeTax = r2(taxable * CONST.incomeTax);
  const vat97a = r2(foreign * CONST.vat);
  const totalDue = r2(contribTotal + incomeTax + vat97a);

  const paid = { contrib: 0, advance: 0, vat97a: 0, annual: 0 } as Record<TaxType, number>;
  for (const e of ys) if (e.kind === "taxpaid" && e.taxType) paid[e.taxType] = r2(paid[e.taxType] + (Number(e.amount) || 0));
  const paidTotal = r2(paid.contrib + paid.advance + paid.vat97a + paid.annual);

  return {
    year, assumed: rates.assumed, income, expenses, foreign, statutory, insurableBase,
    contribMinDue, contribTotal, contribTopUp, taxable, incomeTax, vat97a, totalDue,
    paid, paidTotal, remaining: r2(totalDue - paidTotal),
    vatProgress: income / CONST.vatThreshold, months: months.length,
  };
}

export interface Compare {
  freelancer: number;
  et: number;
  eood: number;
  deductibleExpenses: number;
}

/**
 * Rough yearly total (tax + contributions) under each legal form, using the
 * expenses entered. ЕТ and ЕООД deduct real expenses; a freelancer does not.
 * The ЕООД owner is assumed self-insured on the minimum and to take all
 * profit out as a dividend.
 */
export function compareForms(entries: Entry[], settings: Settings, year: number): Compare {
  const s = summarize(entries, settings, year);
  const rates = ratesFor(year);
  const months = activeMonths(year, settings);
  const rate = settings.sickness ? CONST.contribSick : CONST.contrib;
  const minBase = months.reduce((a, m) => a + rates.min[m], 0);
  const maxBase = months.reduce((a, m) => a + rates.max[m], 0);
  const ded = r2(entries.filter((e) => e.kind === "expense").reduce((a, e) => a + deductible(e, year), 0));

  const etProfit = Math.max(0, s.income - ded);
  const etContrib = months.length ? Math.min(maxBase, Math.max(minBase, etProfit)) * rate : 0;
  const et = r2(etContrib + Math.max(0, etProfit - etContrib) * CONST.etTax);

  const ownerContrib = months.length ? minBase * rate : 0;
  const profit = Math.max(0, s.income - ded - ownerContrib);
  const corp = profit * CONST.corpTax;
  const eood = r2(ownerContrib + corp + (profit - corp) * CONST.dividendTax);

  return { freelancer: r2(s.contribTotal + s.incomeTax), et, eood, deductibleExpenses: ded };
}

export interface Deadline {
  date: string;
  title: string;
  amount: number | null; // null when it can't be estimated yet
  type: TaxType;
}

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Upcoming payment dates from `today`, for the next `days` days. */
export function deadlines(entries: Entry[], settings: Settings, today: string, days = 120): Deadline[] {
  const t0 = new Date(today + "T00:00:00Z").getTime(), t1 = t0 + days * 864e5;
  const out: Deadline[] = [];
  const rate = settings.sickness ? CONST.contribSick : CONST.contrib;
  const ty = yearOf(today);
  for (let y = ty - 1; y <= ty + 1; y++) {
    const months = activeMonths(y, settings);
    const rates = ratesFor(y);
    const ys = inYear(entries, y);
    for (const m of months) {
      // contributions for month m are due by the 25th of the next month
      const ny = m === 11 ? y + 1 : y, nm = (m + 1) % 12;
      out.push({ date: iso(ny, nm, 25), title: `Осигуровки за ${MONTHS[m]} ${y}`, amount: r2(rates.min[m] * rate), type: "contrib" });
      const foreign = sum(ys.filter((e) => e.kind === "expense" && e.foreign && monthOf(e.date) === m));
      if (foreign > 0) out.push({ date: iso(ny, nm, 14), title: `ДДС по чл. 97а за ${MONTHS[m]} ${y}`, amount: r2(foreign * CONST.vat), type: "vat97a" });
    }
    for (let q = 0; q < 3; q++) {
      if (!months.some((m) => Math.floor(m / 3) === q)) continue;
      const qi = ys.filter((e) => e.kind === "income" && Math.floor(monthOf(e.date) / 3) === q);
      const qMonths = months.filter((m) => Math.floor(m / 3) === q);
      const contrib = qMonths.reduce((a, m) => a + rates.min[m] * rate, 0);
      const base = Math.max(0, sum(qi) * (1 - CONST.statutory) - contrib);
      out.push({ date: iso(y, q * 3 + 3, 25), title: `Авансов данък за ${q + 1}-во тримесечие ${y}`, amount: r2(base * CONST.incomeTax), type: "advance" });
    }
    if (months.length) out.push({ date: iso(y + 1, 3, 30), title: `Годишна декларация по чл. 50 за ${y}`, amount: null, type: "annual" });
  }
  return out
    .filter((d) => { const t = new Date(d.date + "T00:00:00Z").getTime(); return t >= t0 && t <= t1; })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export const MONTHS = ["януари", "февруари", "март", "април", "май", "юни", "юли", "август", "септември", "октомври", "ноември", "декември"];
export const MONTHS_SHORT = ["яну", "фев", "мар", "апр", "май", "юни", "юли", "авг", "сеп", "окт", "ное", "дек"];
