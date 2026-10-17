// Any provider with an OpenAI-compatible chat API (Gemini, Mistral, Groq,
// DeepSeek, xAI, OpenRouter and many more) works through one route:
//   POST /v1/compat/chat/completions
// The customer saves the provider's base URL and key once. Both are stored
// encrypted together, and Shield applies every key setting as usual.
import { publicHttps } from './url.js';

// Base URLs as each provider documents them. Customers can edit or replace them.
export const PRESETS = [
  ['Google Gemini', 'https://generativelanguage.googleapis.com/v1beta/openai'],
  ['Mistral', 'https://api.mistral.ai/v1'],
  ['Groq', 'https://api.groq.com/openai/v1'],
  ['DeepSeek', 'https://api.deepseek.com/v1'],
  ['xAI (Grok)', 'https://api.x.ai/v1'],
  ['OpenRouter', 'https://openrouter.ai/api/v1'],
  ['Together AI', 'https://api.together.xyz/v1'],
  ['Fireworks', 'https://api.fireworks.ai/inference/v1'],
  ['Perplexity', 'https://api.perplexity.ai'],
  ['Cohere', 'https://api.cohere.ai/compatibility/v1'],
  ['Azure OpenAI', 'https://YOUR-RESOURCE.openai.azure.com/openai/v1', 'Replace YOUR-RESOURCE with your Azure resource name. Use your deployment name as the model.'],
  ['AWS Bedrock', 'https://bedrock-runtime.eu-central-1.amazonaws.com/openai/v1', 'Use a Bedrock API key. Change eu-central-1 to your region. Serves the open-weight models on Bedrock (gpt-oss, DeepSeek, Mistral, Qwen and more).'],
];

// Azure documents its own api-key header next to Bearer; send both there.
export const isAzure = (base) => /\.(openai\.azure\.com|services\.ai\.azure\.com|cognitiveservices\.azure\.com)$/i.test(new URL(base).hostname);

// When the customer gives no prices, spend is counted at this rate (dollars
// per 1M tokens, input and output) so a cap is never under-counted.
export const FALLBACK_RATE = [15, 75];

const rate = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1000 ? n : NaN;
};

// Validates what the dashboard sends. Returns { config } or { error }.
export const checkCompat = (b) => {
  const name = String(b.name || '').trim().slice(0, 40) || 'OpenAI-compatible';
  const raw = String(b.base_url || '').trim().replace(/\/+$/, '');
  const u = raw.length <= 300 ? publicHttps(raw) : null;
  if (!u || u.search || u.hash) return { error: 'invalid_base_url' };
  // The Azure preset is a template until the customer fills in their resource name.
  if (/your-resource/i.test(u.hostname)) return { error: 'invalid_base_url' };
  const key = String(b.key || '').trim();
  if (key.length < 8 || key.length > 4000 || /\s/.test(key)) return { error: 'invalid_provider_key' };
  const pin = rate(b.price_in);
  const pout = rate(b.price_out);
  if (Number.isNaN(pin) || Number.isNaN(pout)) return { error: 'invalid_price' };
  return { config: { name, base: u.toString().replace(/\/+$/, ''), key, price: pin != null && pout != null ? [pin, pout] : null } };
};

export const compatRate = (config) => config?.price || FALLBACK_RATE;
