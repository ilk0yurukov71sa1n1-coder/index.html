// AI power bands for the per-key dial (Keys). Each band is a named
// allowed_models list the gateway already enforces (api/gateway.js). Every
// name is in the price table (api/_lib/prices.js), and the gateway lets a
// name through with any "-suffix", so bare names that would also let in a
// pricier model (gpt-5 → gpt-5-pro, o3 → o3-pro) are left out on purpose.
// Lower bands hold only cheaper models; each band adds to the one before.
// Models from OpenAI-compatible providers (Gemini, Mistral, Groq, DeepSeek,
// xAI, Cohere) have no list price here, so only "Strongest" lets them in.
const CHEAP = ['gpt-5-nano', 'gpt-4.1-nano', 'gpt-4o-mini', 'gpt-5-mini', 'gpt-4.1-mini', 'claude-3-haiku', 'claude-haiku-5-5', 'claude-haiku-4-5'];
const BALANCED = [...CHEAP, 'o4-mini', 'gpt-4.1', 'gpt-4o', 'claude-sonnet-5-5', 'claude-sonnet-4-5'];
const STRONG = [...BALANCED, 'gpt-5-chat', 'claude-opus-5-5', 'claude-opus-4-5'];

export const BANDS = [
  { level: 1, name: 'Fast & cheap', models: CHEAP, note: 'Small, quick models. They cost the least per answer and suit chat, sorting and short replies.' },
  { level: 2, name: 'Balanced', models: BALANCED, note: 'Adds mid-size models. Better at longer, harder work, at a few times the price per answer.' },
  { level: 3, name: 'Strong', models: STRONG, note: 'Adds top models, but not the priciest tiers such as gpt-5-pro, o3-pro or Claude Fable, which cost many times more per answer.' },
  { level: 4, name: 'Strongest', models: [], note: 'Every model is allowed, including pro tiers and other providers. Your spend caps are the only brake.' },
];

const same = (a, b) => a.length === b.length && a.every((m) => b.includes(m));
const parse = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((s) => s.trim()).filter(Boolean);

// The band a list matches exactly, or null for a hand-made ("Custom") list.
export const bandOf = (models) => {
  const list = parse(models);
  return BANDS.find((b) => same(b.models, list)) || null;
};

// Where to rest the dial for a custom list: the lowest band that already
// allows every model in it, so the dial never suggests less than it allows.
export const nearestLevel = (models) => {
  const list = parse(models);
  if (!list.length) return 4;
  const fits = (b) => list.every((m) => b.models.some((x) => m === x || m.startsWith(`${x}-`)));
  return (BANDS.find((b) => b.models.length && fits(b)) || BANDS[3]).level;
};
