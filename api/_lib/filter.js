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
  // Bounded whitespace: "<" followed by a megabyte of spaces must not backtrack for minutes.
  /<\s{0,8}\/?\s{0,8}(system|im_start|im_end)\s{0,8}>/i,
];

// Text of each turn in OpenAI and Anthropic shaped bodies, including the
// text inside Anthropic tool_result blocks (a string or a nested array).
const textOf = (content, depth = 0) => {
  if (typeof content === 'string') return [content];
  if (!Array.isArray(content) || depth > 4) return [];
  return content.flatMap((p) => {
    if (typeof p?.text === 'string') return [p.text];
    if (p?.type === 'tool_result') return textOf(p.content, depth + 1);
    return [];
  });
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

// Every repeat is bounded and each match must start at a boundary, so every
// pattern runs in linear time on hostile input.
const scrub = (text) =>
  text
    .replace(/(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,8}\.[A-Za-z]{2,24}/g, '[email]')
    .replace(/\b(?:\d[ -]?){13,19}\b/g, (m) => (luhn(m.replace(/\D/g, '')) ? '[card]' : m))
    .replace(/(?<![\w])\+?\d[\d\s().-]{7,24}\d(?![\w])/g, (m) => (m.replace(/\D/g, '').length >= 9 ? '[phone]' : m));

// A single text part larger than this is passed on unredacted (and counted in
// `skipped`), so one huge body cannot hold a function for minutes. The
// injection screen still reads it.
export const REDACT_MAX = 100 * 1024;

// Returns a copy of the body with emails, card numbers and phone numbers
// replaced in user and assistant turns (and tool results), plus how many
// parts were changed and how many were too large to redact.
export const redact = (body) => {
  let count = 0;
  let skipped = 0;
  const fix = (t) => {
    if (t.length > REDACT_MAX) {
      skipped++;
      return t;
    }
    const r = scrub(t);
    if (r !== t) count++;
    return r;
  };
  const parts = (content, depth = 0) => {
    if (typeof content === 'string') return fix(content);
    if (!Array.isArray(content) || depth > 4) return content;
    return content.map((p) => {
      if (typeof p?.text === 'string') return { ...p, text: fix(p.text) };
      if (p?.type === 'tool_result' && p.content != null) return { ...p, content: parts(p.content, depth + 1) };
      return p;
    });
  };
  const messages = (Array.isArray(body?.messages) ? body.messages : []).map((m) => {
    if (!m || m.role === 'system') return m;
    if (typeof m.content === 'string' || Array.isArray(m.content)) return { ...m, content: parts(m.content) };
    return m;
  });
  return { body: { ...body, messages }, count, skipped };
};
