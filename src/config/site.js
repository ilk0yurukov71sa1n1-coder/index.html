// ─────────────────────────────────────────────────────────────
// ALL page copy, links and prices live here.
// Change words on the site by editing this file only.
// ─────────────────────────────────────────────────────────────

export const brand = {
  name: 'Rollcfluence',
  product: 'Shield',
  tagline: 'The firewall for your AI API keys',
  gatewayUrl: 'https://gateway.rollcfluence.com/v1',
};

export const links = {
  getKey: '#access',
  docs: '#how',
  login: '#access',
  status: '#',
  contact: 'mailto:rollcfluence@gmail.com',
  email: 'rollcfluence@gmail.com',
};

export const nav = [
  { label: 'Threats', href: '#threats' },
  { label: 'Research', href: '#research' },
  { label: 'Console', href: '#console' },
  { label: 'How it works', href: '#how' },
  { label: 'Network', href: '#network' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

export const hero = {
  eyebrow: 'Early access · EU-hosted gateway',
  title: ['One key in your app.', 'Every model behind it, guarded.'],
  body:
    'Your OpenAI, Anthropic and Gemini keys stay in our vault. Your app gets a Rollcfluence key that has a spend cap, a rate limit and an injection filter built into it, so a leaked key costs you nothing.',
  primary: { label: 'Get your Rollcfluence key', href: '#access' },
  secondary: { label: 'See the two-line migration', href: '#how' },
  hint: 'Move over the field. Click to pulse it.',
  panelLabel: 'Live field · reacts to you',
  stats: [
    { value: '< 12 ms', label: 'added latency, p95' },
    { value: '1 line', label: 'to integrate' },
    { value: '9', label: 'providers behind one key' },
    { value: '0', label: 'provider keys in your client' },
  ],
};

export const providers = [
  'OpenAI', 'Anthropic', 'Google Gemini', 'Mistral', 'Groq',
  'Cohere', 'DeepSeek', 'xAI', 'Azure OpenAI', 'AWS Bedrock',
];

export const threats = {
  index: '01',
  label: 'Threats',
  title: 'Leaked keys are drained in minutes, not days.',
  body:
    'Bots scan every public commit and app bundle for strings that start with sk-. A key found at 02:00 can be resold and looped against GPT-4-class models before you wake up, and the invoice still has your name on it.',
  items: [
    {
      name: 'Leaked keys',
      text: 'Your real provider keys never leave our vault. Your app holds a scoped Rollcfluence key you can rotate or kill in one click.',
    },
    {
      name: 'Prompt injection',
      text: 'Inbound prompts are screened for jailbreaks, system-prompt extraction and tool hijacking before they reach the model.',
    },
    {
      name: 'Bot and cost abuse',
      text: 'Per-user rate limits, hard spend caps and bot fingerprinting stop scripted traffic from turning into a five-figure invoice.',
    },
  ],
  demo: {
    caption: 'Hold the sheet to crumple it.',
    note: 'This is what Shield does to a leaked key: it is useless the moment it is found.',
  },
};

export const research = {
  index: '02',
  label: 'Research',
  title: 'What the studies say.',
  body: 'This is not a hypothetical risk. Here is what security researchers measured in the last two years, and what Shield does about each finding.',
  items: [
    {
      stat: '29M',
      text: 'hardcoded secrets were pushed to public GitHub in 2025, the biggest yearly jump on record.',
      answer: 'Your provider keys never sit in your repo. Only a scoped Rollcfluence key does, and you can kill it in one click.',
      source: 'GitGuardian, State of Secrets Sprawl 2026',
      href: 'https://blog.gitguardian.com/ai-secrets-spread-fast/',
    },
    {
      stat: '+81%',
      text: 'more leaked AI-service keys year over year: 1.27 million credentials for LLM and AI tools in 2025.',
      answer: 'Keys for OpenAI, Anthropic, Gemini and the rest live in our vault and are never returned.',
      source: 'GitGuardian, State of Secrets Sprawl 2026',
      href: 'https://www.techradar.com/pro/security/over-29-million-secrets-were-leaked-on-github-in-2025-and-ai-really-isnt-helping',
    },
    {
      stat: '$46k/day',
      text: 'is what a stolen key can cost when attackers resell model access. Sysdig called it LLMjacking and later saw estimates pass $100k a day.',
      answer: 'Hard daily spend caps per key. When the cap is hit, traffic stops, not your card.',
      source: 'Sysdig Threat Research, LLMjacking',
      href: 'https://www.sysdig.com/blog/llmjacking-stolen-cloud-credentials-used-in-new-ai-attack',
    },
    {
      stat: '#1',
      text: 'risk for LLM apps is prompt injection, and the 2025 list added Unbounded Consumption for cost attacks.',
      answer: 'Every prompt is screened before it reaches the model, and rate limits cap runaway usage.',
      source: 'OWASP Top 10 for LLM Applications 2025',
      href: 'https://genai.owasp.org/llm-top-10/',
    },
  ],
};

export const console_ = {
  index: '03',
  label: 'Console',
  title: 'Every call, on one screen.',
  scrollHint: 'Scroll to open the console',
  overlayTitle: 'Who called which model, what it cost, and what we stopped.',
  overlayBody:
    'Each row is a real request: the key, the route, the model, the latency and the verdict. Filter by user, export to CSV, or hand the audit trail to whoever asks.',
};

export const statement = {
  text: 'Zero keys exposed.',
  caption: 'A Rollcfluence key only works inside the limits you set. Copied anywhere else, it is a string of characters and nothing more.',
};

export const how = {
  index: '04',
  label: 'How it works',
  title: "Two lines of code. That's the migration.",
  steps: [
    {
      n: '01',
      name: 'Swap the base URL',
      text: 'Keep the SDK you already use. Change baseURL and the key name, and redeploy.',
    },
    {
      n: '02',
      name: 'Set your policies',
      text: 'Pick a daily € cap, requests per minute, the models a key may call and how strict the injection filter is.',
    },
    {
      n: '03',
      name: 'Read the verdicts',
      text: 'Each request gets passed, rate-limited or blocked, and the console shows you which one and why.',
    },
  ],
  code: {
    file: 'app/ai.js',
    before: "baseURL: 'https://api.openai.com/v1',",
    after: "baseURL: 'https://gateway.rollcfluence.com/v1',",
    beforeKey: 'apiKey: process.env.OPENAI_API_KEY,',
    afterKey: 'apiKey: process.env.ROLLCFLUENCE_KEY,',
  },
};

export const network = {
  index: '05',
  label: 'Edge network',
  title: 'Checked where the request starts.',
  body: 'Nine edge regions run the same checks, so a user in Sofia is screened in Sofia and only clean traffic travels on to the model provider.',
  hint: 'Drag to spin',
  // lat / lon of each edge region shown on the globe
  regions: [
    { name: 'Frankfurt', code: 'fra', lat: 50.1, lon: 8.7, ms: '6 ms' },
    { name: 'London', code: 'lhr', lat: 51.5, lon: -0.1, ms: '7 ms' },
    { name: 'Sofia', code: 'sof', lat: 42.7, lon: 23.3, ms: '8 ms' },
    { name: 'Virginia', code: 'iad', lat: 38.9, lon: -77.4, ms: '9 ms' },
    { name: 'San Francisco', code: 'sfo', lat: 37.8, lon: -122.4, ms: '9 ms' },
    { name: 'São Paulo', code: 'gru', lat: -23.5, lon: -46.6, ms: '11 ms' },
    { name: 'Singapore', code: 'sin', lat: 1.35, lon: 103.8, ms: '10 ms' },
    { name: 'Tokyo', code: 'hnd', lat: 35.7, lon: 139.7, ms: '9 ms' },
    { name: 'Sydney', code: 'syd', lat: -33.9, lon: 151.2, ms: '12 ms' },
  ],
  // pairs of region indexes to draw request arcs between
  arcs: [[0, 3], [1, 4], [2, 6], [3, 5], [0, 7], [6, 8], [4, 7], [1, 2]],
};

export const features = {
  index: '06',
  label: 'Features',
  title: 'Eight guards on every request.',
  items: [
    { name: 'Key vault', text: 'Provider keys are encrypted at rest and never returned. Issue scoped gateway keys per app, user or environment.', size: 'wide' },
    { name: 'Spend caps', text: 'Hard daily and monthly limits per key. When the cap hits, traffic stops, not your card.' },
    { name: 'Rate limits', text: 'Per IP, per user and per key limits with burst control.' },
    { name: 'Injection filter', text: 'Screens prompts for jailbreaks, prompt leaks and tool hijacking.' },
    { name: 'PII redaction', text: 'Emails, cards and phone numbers are masked before they leave your stack.' },
    { name: 'Bot traps', text: 'Honeypot routes and fingerprinting catch scrapers that try to replay your traffic.', size: 'wide' },
    { name: 'Failover', size: 'wide', text: 'If a provider goes down, requests route to your backup model automatically.' },
    { name: 'Audit log', size: 'wide', text: 'Every request, every block, every key change. Exportable.' },
  ],
};

export const pricing = {
  index: '07',
  label: 'Pricing',
  title: 'Pay for protected requests, nothing else.',
  note: 'Placeholder prices. Final pricing is set before launch.',
  tiers: [
    {
      name: 'Starter',
      price: '€0',
      period: '/month',
      blurb: 'For side projects and prototypes.',
      features: ['50k protected requests', '1 gateway key', 'Spend caps and rate limits', '7-day logs'],
      cta: 'Start free',
    },
    {
      name: 'Pro',
      price: '€49',
      period: '/month',
      blurb: 'For products with real users.',
      features: ['2M protected requests', 'Unlimited gateway keys', 'Injection filter and PII redaction', 'Provider failover', '30-day logs'],
      cta: 'Get Pro',
      featured: true,
    },
    {
      name: 'Business',
      price: 'Custom',
      period: '',
      blurb: 'For teams with compliance needs.',
      features: ['Volume pricing', 'SSO and roles', 'Dedicated region', '1-year audit log', 'Priority support'],
      cta: 'Talk to us',
    },
  ],
};

export const faq = {
  index: '08',
  label: 'FAQ',
  title: 'Before you switch your base URL.',
  items: [
    {
      q: 'Do I need to change my code?',
      a: 'Only the base URL and the key. Shield speaks the same API as the provider you already use, so your SDK keeps working.',
    },
    {
      q: 'How much latency does it add?',
      a: 'Under 12 ms at p95 in our edge regions. Streaming responses are passed through token by token.',
    },
    {
      q: 'Do you store my prompts?',
      a: 'Only if you turn logging on, and only for the retention period you choose. PII redaction runs before anything is stored.',
    },
    {
      q: 'What happens if Shield goes down?',
      a: 'You can set a fail-open or fail-closed policy per key. Fail-open sends traffic straight to the provider so your app stays up.',
    },
    {
      q: 'Which providers are supported?',
      a: 'OpenAI, Anthropic, Google Gemini, Mistral, Groq, Cohere, DeepSeek, xAI, Azure OpenAI and AWS Bedrock, with more on the way.',
    },
    {
      q: 'Can I bring my own keys?',
      a: 'Yes. You add your provider keys to the vault once, and Shield issues gateway keys on top of them.',
    },
  ],
};

export const access = {
  index: '09',
  label: 'Early access',
  title: 'Get your Rollcfluence key.',
  body: 'Early access opens in small batches. Leave a work email and your key arrives when your batch opens.',
  button: 'Shield my keys',
  formTitle: 'Where should we send your key?',
  placeholder: 'you@company.com',
  submit: 'Request access',
  success: 'You are in the queue. Your key goes to this address when your batch opens.',
};

// Chat helper (bottom-right). Answers come from the FAQ above plus these
// extra entries. Anything it can't answer is saved for you in Supabase.
export const chat = {
  button: 'Ask us',
  title: 'Rollcfluence help',
  greeting: 'Hi. Ask anything about Shield, or pick a question below.',
  suggestions: ['How much latency does it add?', 'Do you store my prompts?', 'How much does it cost?'],
  noMatch: "I don't have a good answer for that yet. Leave your email and the team will reply personally.",
  askEmail: 'Your email',
  send: 'Send',
  thanks: 'Got it. We will reply to you by email soon.',
  extra: [
    {
      q: 'How much does it cost?',
      a: 'Starter is free for 50k protected requests a month. Pro is €49 a month for 2M requests. Business is custom. These are early-access prices.',
      keywords: ['price', 'pricing', 'cost', 'costs', 'plan', 'plans', 'free', 'pay', 'euro', 'cheap', 'expensive'],
    },
    {
      q: 'How do I get access?',
      a: 'Leave your email in the early access form at the bottom of the page. Keys go out in small batches.',
      keywords: ['access', 'signup', 'sign', 'join', 'waitlist', 'start', 'key', 'get'],
    },
    {
      q: 'How do I contact you?',
      a: 'Email rollcfluence@gmail.com, or leave your question here with your email.',
      keywords: ['contact', 'email', 'talk', 'human', 'sales', 'support', 'help'],
    },
  ],
};

export const footer = {
  columns: [
    { title: 'Product', links: [['Threats', '#threats'], ['Console', '#console'], ['Features', '#features'], ['Pricing', '#pricing']] },
    { title: 'Developers', links: [['How it works', '#how'], ['Status', '#'], ['Security', '#']] },
    { title: 'Company', links: [['Contact', 'mailto:rollcfluence@gmail.com'], ['Privacy', '#'], ['Terms', '#']] },
  ],
  legal: `© ${new Date().getFullYear()} Rollcfluence. All rights reserved.`,
};
