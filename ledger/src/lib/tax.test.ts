import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize, compareForms, deadlines, deductible, ratesFor, type Entry, type Settings } from "./tax.ts";

const S: Settings = { startDate: "2026-08-01", sickness: false };
const inc = (date: string, amount: number): Entry => ({ id: date + amount, kind: "income", date, amount, title: "x" });
const exp = (date: string, amount: number, extra: Partial<Entry> = {}): Entry => ({ id: date + amount, kind: "expense", date, amount, title: "y", ...extra });

test("freelancer year with income above the minimum", () => {
  const s = summarize([inc("2026-09-10", 2500), inc("2026-11-02", 3500)], S, 2026);
  assert.equal(s.income, 6000);
  assert.equal(s.statutory, 1500);
  assert.equal(s.months, 5);
  assert.equal(s.insurableBase, 4500); // 75% of income, above 5 x 620.20
  assert.equal(s.contribMinDue, 862.08); // 3101 x 27.8%
  assert.equal(s.contribTotal, 1251);
  assert.equal(s.contribTopUp, 388.92);
  assert.equal(s.taxable, 3249);
  assert.equal(s.incomeTax, 324.9);
  assert.equal(s.assumed, false);
});

test("no income still owes the minimum contributions and no tax", () => {
  const s = summarize([], S, 2026);
  assert.equal(s.contribTotal, 862.08);
  assert.equal(s.contribTopUp, 0);
  assert.equal(s.incomeTax, 0);
});

test("sickness cover uses 31.3%", () => {
  const s = summarize([], { ...S, sickness: true }, 2026);
  assert.equal(s.contribTotal, 970.61); // 3101 x 31.3%
});

test("contributions stop at the maximum insurable income", () => {
  const s = summarize([inc("2026-08-20", 100000)], S, 2026);
  assert.equal(s.insurableBase, 11500); // 5 x 2,300
});

test("foreign purchases give 20% VAT under чл. 97а; laptop and phone do not lower freelancer tax", () => {
  const base = summarize([inc("2026-09-01", 4000)], S, 2026);
  const withCosts = summarize([inc("2026-09-01", 4000), exp("2026-09-02", 100, { foreign: true }), exp("2026-09-03", 1500, { asset: true })], S, 2026);
  assert.equal(withCosts.vat97a, 20);
  assert.equal(withCosts.incomeTax, base.incomeTax);
});

test("tax payments reduce what is left to pay", () => {
  const es: Entry[] = [inc("2026-09-01", 4000), { id: "p", kind: "taxpaid", taxType: "contrib", date: "2026-09-25", amount: 172.42, title: "НОИ" }];
  const s = summarize(es, S, 2026);
  assert.equal(s.paid.contrib, 172.42);
  assert.equal(s.remaining, Math.round((s.totalDue - 172.42) * 100) / 100);
});

test("assets depreciate 50% a year for ЕТ and ЕООД, mixed use counts its share", () => {
  const laptop = exp("2026-10-01", 1500, { asset: true });
  assert.equal(deductible(laptop, 2026), 750);
  assert.equal(deductible(laptop, 2027), 750);
  assert.equal(deductible(laptop, 2028), 0);
  assert.equal(deductible(exp("2026-10-01", 40, { businessPct: 50 }), 2026), 20);
});

test("form comparison", () => {
  const c = compareForms([inc("2026-09-01", 6000), exp("2026-09-02", 1000)], S, 2026);
  assert.equal(c.freelancer, 1575.9); // 1251 + 324.90
  assert.equal(c.deductibleExpenses, 1000);
  // ЕТ: profit 5000, contributions 5000 x 27.8% = 1390, tax 15% of 3610 = 541.50
  assert.equal(c.et, 1931.5);
  // ЕООД: owner 862.078, profit 4137.922, corp 413.79, dividend 5% of 3724.13 = 186.21
  assert.equal(c.eood, 1462.08);
});

test("deadlines from 22 Oct 2026", () => {
  const ds = deadlines([inc("2026-09-01", 4000), exp("2026-09-15", 50, { foreign: true })], S, "2026-10-22", 40);
  assert.deepEqual(ds.map((d) => d.date), ["2026-10-25", "2026-10-25", "2026-11-25"]);
  const adv = ds.find((d) => d.type === "advance")!;
  assert.equal(adv.amount, 265.52); // Q3: 4000 x 75% - 2 x 172.4156 = 2655.17 -> 10%
  const vatOct = deadlines([exp("2026-10-03", 50, { foreign: true })], S, "2026-10-22", 40).find((d) => d.type === "vat97a")!;
  assert.equal(vatOct.amount, 10);
});

test("unknown years reuse the last known rates and say so", () => {
  const r = ratesFor(2027);
  assert.equal(r.assumed, true);
  assert.equal(r.min[0], 620.2);
});
