// List prices in US dollars per 1M tokens [input, output], used to estimate
// what each request cost so spend caps can be enforced. Estimates only: the
// provider's own invoice is the source of truth. Checked 2026-10-16 against
// https://openai.com/api/pricing and https://www.anthropic.com/pricing.
// Unknown models are charged at the most expensive known rate for their
// provider, so a cap is never under-counted.
export const PRICES = {
  openai: {
    'gpt-4o-mini': [0.15, 0.6],
    'gpt-4o': [2.5, 10],
    'gpt-4.1-nano': [0.1, 0.4],
    'gpt-4.1-mini': [0.4, 1.6],
    'gpt-4.1': [2, 8],
    'gpt-5-nano': [0.05, 0.4],
    'gpt-5-mini': [0.25, 2],
    'gpt-5': [1.25, 10],
    'o4-mini': [1.1, 4.4],
    'o3-mini': [1.1, 4.4],
    o3: [2, 8],
    'o3-pro': [20, 80],
    o1: [15, 60],
    'o1-pro': [150, 600],
    'gpt-5-pro': [15, 120],
    'gpt-5-chat': [1.25, 10],
    'chatgpt-4o': [5, 15],
  },
  anthropic: {
    'claude-3-5-haiku': [0.8, 4],
    'claude-haiku-4': [1, 5],
    'claude-3-7-sonnet': [3, 15],
    'claude-sonnet-4': [3, 15],
    'claude-opus-4': [15, 75],
    'claude-opus-4-1': [15, 75],
    'claude-opus-4-5': [5, 25],
    'claude-sonnet-4-5': [3, 15],
    'claude-haiku-4-5': [1, 5],
    'claude-3-5-sonnet': [3, 15],
    'claude-3-haiku': [0.25, 1.25],
  },
};

const ceiling = (provider) =>
  Object.values(PRICES[provider] || {}).reduce((m, p) => (p[0] + p[1] > m[0] + m[1] ? p : m), [15, 75]);

// A model matches its exact name or the name plus a date or "-latest", so
// 'gpt-4o-mini-2024-07-18' finds 'gpt-4o-mini' but 'o1-pro' never falls back
// to the cheaper 'o1'. Anything else is charged at the ceiling.
const VERSION = /^(-\d{4}-?\d{2}-?\d{2}|-latest)?$/;
export const priceFor = (provider, model) => {
  const table = PRICES[provider] || {};
  const name = String(model || '').toLowerCase();
  const hit = Object.keys(table).find((k) => name.startsWith(k) && VERSION.test(name.slice(k.length)));
  return hit ? { rate: table[hit], known: true } : { rate: ceiling(provider), known: false };
};

// Cost in millionths of a dollar ("micros"), so sums stay exact integers.
export const costMicros = (provider, model, input, output) => {
  const { rate } = priceFor(provider, model);
  return Math.ceil((Number(input) || 0) * rate[0] + (Number(output) || 0) * rate[1]);
};
