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

// Text from both OpenAI and Anthropic shaped bodies. Only user-supplied turns
// are screened: the customer's own system prompt is trusted.
const userTexts = (body) => {
  const out = [];
  const take = (content) => {
    if (typeof content === 'string') out.push(content);
    else if (Array.isArray(content)) content.forEach((p) => typeof p?.text === 'string' && out.push(p.text));
  };
  (Array.isArray(body?.messages) ? body.messages : []).forEach((m) => m?.role !== 'system' && take(m?.content));
  return out;
};

export const injectionHit = (body) => {
  const texts = userTexts(body);
  return texts.some((t) => INJECTION.some((re) => re.test(t)));
};

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
