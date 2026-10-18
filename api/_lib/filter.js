// Request checks the gateway runs before forwarding: a basic prompt-injection
// screen and optional PII redaction. Both are pattern based. They catch the
// common, well-known phrasings, not every attack, and the dashboard says so.

const INJECTION = [
  /\bignore\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier)\s+(instructions|prompts?|rules|messages)/i,
  /\bdisregard\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier|system)\s+(instructions|prompts?|rules)/i,
  /\bforget\s+(all\s+|everything\s+)?(your|the|previous|prior)\s+(instructions|rules|training)/i,
  /\b(reveal|print|show|repeat|output)\s+(me\s+)?(your|the)\s+(system\s+prompt|hidden\s+instructions|initial\s+instructions)/i,
  /\byou\s+are\s+now\s+(in\s+)?(DAN|developer\s+mode|jailbreak)/i,
  /\bdo\s+anything\s+now\b/i,
  /<\s*\/?\s*(system|im_start|im_end)\s*>/i,
];

// Text of each turn in OpenAI and Anthropic shaped bodies.
const textOf = (content) => {
  if (typeof content === 'string') return [content];
  if (Array.isArray(content)) return content.filter((p) => typeof p?.text === 'string').map((p) => p.text);
  return [];
};
const hits = (content) => textOf(content).some((t) => INJECTION.some((re) => re.test(t)));
const TRUSTED = new Set(['system', 'developer']);

// Screens every turn except the customer's own system and developer prompts,
// because a browser-held history or tool output can carry an attack too.
// `hit`: block the request. `latest`: the newest user turn itself is the
// attack, which is what counts toward pausing a user or locking a key, so a
// conversation that merely quotes an old attack never pauses anyone.
export const injectionScan = (body) => {
  const messages = (Array.isArray(body?.messages) ? body.messages : []).filter((m) => m && !TRUSTED.has(m.role));
  const last = messages.findLast((m) => m.role === 'user');
  const latest = !!last && hits(last.content);
  return { hit: latest || messages.some((m) => hits(m.content)), latest };
};

export const injectionHit = (body) => injectionScan(body).hit;

const luhn = (digits) => {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2) n = n * 2 > 9 ? n * 2 - 9 : n * 2;
    sum += n;
  }
  return sum % 10 === 0;
};

const scrub = (text) =>
  text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/\b(?:\d[ -]?){13,19}\b/g, (m) => (luhn(m.replace(/\D/g, '')) ? '[card]' : m))
    .replace(/(?<![\w])\+?\d[\d\s().-]{7,}\d(?![\w])/g, (m) => (m.replace(/\D/g, '').length >= 9 ? '[phone]' : m));

// Returns a copy of the body with emails, card numbers and phone numbers
// replaced in user and assistant turns, plus how many were replaced.
export const redact = (body) => {
  let count = 0;
  const fix = (t) => {
    const r = scrub(t);
    if (r !== t) count++;
    return r;
  };
  const messages = (Array.isArray(body?.messages) ? body.messages : []).map((m) => {
    if (!m || m.role === 'system') return m;
    if (typeof m.content === 'string') return { ...m, content: fix(m.content) };
    if (Array.isArray(m.content)) return { ...m, content: m.content.map((p) => (typeof p?.text === 'string' ? { ...p, text: fix(p.text) } : p)) };
    return m;
  });
  return { body: { ...body, messages }, count };
};
