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
  contact: 'mailto:hello@rollcfluence.com',
};

export const nav = [
  { label: 'Threats', href: '#threats' },
  { label: 'Console', href: '#console' },
  { label: 'How it works', href: '#how' },
  { label: 'Network', href: '#network' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

export const hero = {
  eyebrow: 'AI API gateway · now in early access',
  title: ['Your AI keys,', 'behind a firewall.'],
  body:
    'Rollcfluence Shield sits in front of OpenAI, Anthropic, Gemini and the rest. It vaults your keys, caps your spend, and stops prompt injection and bot abuse before a single token is billed.',
  primary: { label: 'Get your gateway key', href: '#access' },
  secondary: { label: 'See how it works', href: '#how' },
  hint: 'Move your cursor over the field. Click to pulse it.',
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
  title: 'A leaked key is a blank cheque.',
  body:
    'One key pushed to a public repo or shipped in a mobile bundle gets found by scrapers in minutes. From there it is resold, looped by bots and drained until your provider cuts you off.',
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

export const console_ = {
  index: '02',
  label: 'Console',
  title: 'See every request.',
  scrollHint: 'Scroll to open the console',
  overlayTitle: 'One console for every key, model and attack.',
  overlayBody:
    'Live request logs, blocked threats, cost per user and per model, and an audit trail you can hand to your security team.',
};

export const statement = {
  text: 'Zero keys exposed.',
  caption: 'Every Rollcfluence key is scoped, rotatable and worthless outside your policies.',
};

export const how = {
  index: '03',
  label: 'How it works',
  title: 'Live in the time it takes to read this.',
  steps: [
    {
      n: '01',
      name: 'Swap the base URL',
      text: 'Point your existing SDK at the Rollcfluence gateway. No new library, no code rewrite.',
    },
    {
      n: '02',
      name: 'Set your policies',
      text: 'Choose spend caps, rate limits, allowed models and injection rules per key, per user or per route.',
    },
    {
      n: '03',
      name: 'Watch it work',
      text: 'Every request is logged, scored and either passed through or blocked, in real time.',
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
  index: '04',
  label: 'Edge network',
  title: 'Close to your users. Far from attackers.',
  body: 'Shield runs at the edge, so every request is checked in the region it starts in and forwarded to the provider over a private backbone.',
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
  index: '05',
  label: 'Features',
  title: 'Everything between the request and the bill.',
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
  index: '06',
  label: 'Pricing',
  title: 'Priced per protected request.',
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
  index: '07',
  label: 'FAQ',
  title: 'Questions, answered.',
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
  index: '08',
  label: 'Early access',
  title: 'Shield your first key today.',
  body: 'Hit the button. Then leave your email and we will send your gateway key as soon as your spot opens.',
  button: 'Shield my keys',
  formTitle: 'Request your gateway key',
  placeholder: 'you@company.com',
  submit: 'Request access',
  success: 'You are on the list. Check your inbox for your gateway key.',
};

export const footer = {
  columns: [
    { title: 'Product', links: [['Threats', '#threats'], ['Console', '#console'], ['Features', '#features'], ['Pricing', '#pricing']] },
    { title: 'Developers', links: [['How it works', '#how'], ['Status', '#'], ['Security', '#']] },
    { title: 'Company', links: [['Contact', 'mailto:hello@rollcfluence.com'], ['Privacy', '#'], ['Terms', '#']] },
  ],
  legal: `© ${new Date().getFullYear()} Rollcfluence. All rights reserved.`,
};
