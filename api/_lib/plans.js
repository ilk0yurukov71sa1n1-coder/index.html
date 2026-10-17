// Plans and their monthly allowances. Prices are in euro cents, excluding VAT.
// Business is arranged by email, so it has no self-serve price or allowance.
import { incr, peek } from './redis.js';

export const PLANS = {
  starter: { name: 'Starter', cents: 0, requests: 10_000, keys: 2 },
  pro: { name: 'Pro', cents: 4900, requests: 250_000, keys: 20 },
  team: { name: 'Team', cents: 29900, requests: 5_000_000, keys: 20 },
  business: { name: 'Business', cents: null, requests: null, keys: 20 },
};
export const PAID = ['pro', 'team'];
export const planOf = (account) => PLANS[account?.plan] || PLANS.starter;

// One counter per account per calendar month (UTC), kept 40 days.
const monthKey = (accountId, d = new Date()) => `quota:${accountId}:${d.toISOString().slice(0, 7)}`;
const TTL = 40 * 86400;

// Requests forwarded to a provider this month.
export const requestsThisMonth = (accountId) => peek(monthKey(accountId));

// Counts one forwarded request. Returns false (and does not forward) once the plan's allowance is used up.
export const takeRequest = async (account) => {
  const { requests } = planOf(account);
  const n = await incr(monthKey(account.id), TTL);
  return requests == null || n <= requests;
};
