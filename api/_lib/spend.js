// Spend so far today and this month for one key, for the spend caps.
// Kept as Redis counters that each request adds its cost to, so a check is
// one round trip instead of summing the key's whole history in Postgres.
// A missing counter (new day, or Redis was flushed) is seeded once from the
// database. Without Upstash it falls back to the database every time.
import { db } from './db.js';
import { dayStart, monthStart } from './http.js';
import { getMany, incrBy, seed, setValue } from './redis.js';

const keysFor = (keyId, d = new Date()) => {
  const iso = d.toISOString();
  return { day: `spend:${keyId}:${iso.slice(0, 10)}`, month: `spend:${keyId}:${iso.slice(0, 7)}` };
};
const DAY_TTL = 2 * 86400;
const MONTH_TTL = 40 * 86400;

export const spendSoFar = async (key) => {
  const needDay = key.daily_cap_micros != null;
  const needMonth = key.monthly_cap_micros != null;
  if (!needDay && !needMonth) return { today: 0, month: 0 };
  const k = keysFor(key.id);
  const got = await getMany([k.day, k.month]);
  const fromDb = (since) => db.keySpend(key.id, since);
  if (!got) return { today: needDay ? await fromDb(dayStart()) : 0, month: needMonth ? await fromDb(monthStart()) : 0 };
  let [today, month] = got;
  if (needDay && today == null) {
    today = await fromDb(dayStart());
    await seed(k.day, today, DAY_TTL);
  }
  if (needMonth && month == null) {
    month = await fromDb(monthStart());
    await seed(k.month, month, MONTH_TTL);
  }
  return { today: today || 0, month: month || 0 };
};

// Adds a finished request's cost to both counters. Call it after the
// request's usage row is written: if a counter did not exist yet, it is
// rebuilt from the database so no earlier spend is lost.
export const addSpend = async (keyId, micros) => {
  if (!micros) return;
  const k = keysFor(keyId);
  const [day, month] = await Promise.all([incrBy(k.day, micros, DAY_TTL), incrBy(k.month, micros, MONTH_TTL)]);
  if (day === micros) await setValue(k.day, await db.keySpend(keyId, dayStart()), DAY_TTL);
  if (month === micros) await setValue(k.month, await db.keySpend(keyId, monthStart()), MONTH_TTL);
};
