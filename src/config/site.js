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
  status: '/status',
  contact: 'mailto:rollcfluence@gmail.com',
  email: 'rollcfluence@gmail.com',
  instagram: 'https://www.instagram.com/rollcfluence_official/',
};

export const nav = [
  { label: 'Threats', href: '#threats' },
  { label: 'Research', href: '#research' },
  { label: 'Why us', href: '#why' },
  { label: 'Get started', href: '#start' },
  { label: 'Compare', href: '#compare' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

export const hero = {
  eyebrow: 'Early access · AI API firewall',
  title: ['One key in your app.', 'Every model behind it, guarded.'],
  body:
    'Your OpenAI, Anthropic and Gemini keys stay in our vault. Your app gets a Rollcfluence key that has a spend cap, a rate limit and an injection filter built into it, so a leaked key costs you nothing.',
  primary: { label: 'Get your Rollcfluence key', href: '#access' },
  secondary: { label: 'See the two-line migration', href: '#how' },
  panel: {
    label: 'Rollcfluence Shield',
    stat: 'Up to $46,000 a day',
    text: 'is what one stolen AI key can cost before anyone notices. With Shield, the most it can ever cost is the cap you set.',
    source: 'Sysdig Threat Research, LLMjacking',
  },
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
    caption: 'Exhibit A · a leaked .env file',
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
    {
      stat: '22%',
      text: 'of breaches started with stolen or abused credentials, the most common way in for attackers.',
      answer: 'A Rollcfluence key only works inside its limits, so a stolen one is worth very little.',
      source: 'Verizon DBIR 2025, via Aembit',
      href: 'https://aembit.io/blog/credential-and-secrets-theft-2025-verizon-data-breach-report/',
    },
    {
      stat: '2,863',
      text: 'public Google API keys, from Maps and Firebase setups, were found to also unlock Gemini and bill its owner.',
      answer: 'Each Rollcfluence key is scoped to the models you allow, nothing else.',
      source: 'Truffle Security',
      href: 'https://trufflesecurity.com/blog/google-api-keys-werent-secrets-but-then-gemini-changed-the-rules',
    },
  ],
};

export const cost = {
  index: '03',
  label: 'What a leak costs',
  title: 'One leaked key. One night.',
  body: 'An illustrative timeline, priced with Sysdig\'s worst-case LLMjacking estimate of $46,000 a day.',
  timeline: [
    { time: '02:00', text: 'A key slips into a public commit, a mobile app bundle or a pasted screenshot.' },
    { time: '02:04', text: 'Bots that watch public code around the clock pick it up.' },
    { time: '02:30', text: 'Access to your models is resold through reverse proxies. Strangers start prompting on your account.' },
    { time: '08:00', text: 'You wake up to roughly $11,500 in usage you never made, and a provider threatening to suspend you.' },
  ],
  shield: 'With Shield, the key that leaked is a scoped Rollcfluence key. Its daily cap stops the spending at the limit you set, and you can kill it in one click from your phone.',
  key: {
    caption: 'This is a leaked Rollcfluence key. Reach for it.',
    taunts: ['rk_live_••••4f2a', 'Rate limited', 'Blocked at the edge', 'Spend cap reached', 'Key revoked'],
    notice: 'Every attempt with a stolen key hits a limit you set.',
  },
};

export const console_ = {
  index: '04',
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

export const why = {
  index: '05',
  label: 'Why start now',
  title: 'Why teams start with Rollcfluence.',
  items: [
    { name: 'Live in minutes', text: 'Change two lines. Your SDK, your models and your prompts stay exactly as they are.' },
    { name: 'Costs capped from day one', text: 'Every key gets a hard daily limit, so the worst day is a number you chose in advance.' },
    { name: 'Every model, one key', text: 'OpenAI, Anthropic, Gemini and seven more providers behind a single key you control.' },
    { name: 'Real people answer', text: 'Questions go straight to the team building Shield at rollcfluence@gmail.com.' },
  ],
};

export const how = {
  index: '06',
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

export const start = {
  index: '07',
  label: 'Get started',
  title: 'Never set up an API gateway? Start here.',
  body: 'No security background needed. If someone else built your app, send them this section.',
  steps: [
    { name: 'Get your key', text: 'Join early access at the bottom of this page. Your Rollcfluence key arrives by email.' },
    { name: 'Add your provider keys', text: 'Paste your OpenAI, Anthropic or Gemini keys into the vault once. They are encrypted and never shown again.' },
    { name: 'Swap two lines', text: 'Where your app sets its API address and key, put in ours. That is the whole code change.' },
    { name: 'Set your limits', text: 'Pick a daily spend cap and a rate limit. Start low. You can raise them any time.' },
  ],
  progress: 'of 4 done',
  help: 'Stuck on any step? Email rollcfluence@gmail.com and we will walk you through it.',
};

export const network = {
  index: '08',
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
  index: '09',
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

export const trust = {
  index: '10',
  label: 'Trust',
  title: 'Why you can trust us with your keys.',
  items: [
    { name: 'Your keys are never shown back', text: 'Provider keys are encrypted at rest. No endpoint returns them, not even to you.' },
    { name: 'Leave in one line', text: 'Shield speaks each provider\'s own API. Point your base URL back and you are out. No lock-in.' },
    { name: 'Your app stays up if we go down', text: 'Choose fail-open per key and traffic goes straight to the provider while Shield is unreachable.' },
    { name: 'Prompts are not kept by default', text: 'Logging stays off until you turn it on, and personal data is redacted before anything is stored.' },
  ],
  link: { label: 'Read how we secure this site', href: '/security' },
};

export const savings = {
  index: '11',
  label: 'Cost and savings',
  title: 'What Shield costs you, and what it saves.',
  body: 'Move the slider to your monthly AI bill. Everything below updates for your numbers.',
  worstPerDayUsd: 46000, // Sysdig worst-case LLMjacking estimate
  capFactor: 1.5, // suggested daily cap: 150% of an average day
  source: { label: 'Worst-case figure: Sysdig Threat Research, LLMjacking', href: 'https://www.sysdig.com/blog/llmjacking-stolen-cloud-credentials-used-in-new-ai-attack' },
  note: 'Estimates for planning, not a quote. Plan prices are early-access prices in euros, excluding VAT.',
  ease: [
    { value: '2 lines', label: 'of code to change' },
    { value: '< 10 min', label: 'from key to first protected call' },
    { value: '1 click', label: 'to revoke a key from anywhere' },
  ],
};

export const compare = {
  index: '12',
  label: 'Compare',
  title: 'Your options, side by side.',
  body: 'You can protect AI keys several ways. Here is an honest look at each, including what the providers already give you.',
  columns: ['Do nothing', 'Provider settings', 'Build it yourself', 'Rollcfluence Shield'],
  rows: [
    { label: 'Provider keys stay out of your app', values: ['no', 'no', 'yes', 'yes'] },
    { label: 'Hard spend cap', values: ['no', 'partial', 'yes', 'yes'], note: 'OpenAI offers project hard limits. Google Cloud budgets only alert.' },
    { label: 'Limits per end user, not just per account', values: ['no', 'no', 'yes', 'yes'] },
    { label: 'Prompt-injection screening', values: ['no', 'no', 'partial', 'yes'] },
    { label: 'All providers in one place', values: ['no', 'no', 'partial', 'yes'] },
    { label: 'Revoke a key without redeploying', values: ['no', 'no', 'yes', 'yes'] },
    { label: 'Time to set up', values: ['None', 'Per provider', 'Weeks of engineering', 'Two lines of code'] },
    { label: 'Ongoing cost', values: ['$0 until a leak', 'Free', 'Engineer time', 'From €0'] },
  ],
  sources: [
    { label: 'OpenAI spend limits', href: 'https://developers.openai.com/api/docs/guides/spend-limits' },
    { label: 'Gemini keys and budgets, Truffle Security', href: 'https://trufflesecurity.com/blog/google-api-keys-werent-secrets-but-then-gemini-changed-the-rules' },
  ],
  casesTitle: 'Real bills from leaked AI keys',
  cases: [
    {
      amount: '$82,314',
      text: 'run up in about two days on a stolen Google Cloud key used for Gemini. The startup normally spent about $180 a month.',
      source: 'The Register, March 2026',
      href: 'https://theregister.com/2026/03/03/gemini_api_key_82314_dollar_charge/',
    },
    {
      amount: '$1,039',
      text: 'of GPT-4 usage on a single stolen OpenAI key, one of many resold through free "pirate GPT-4" services.',
      source: 'Gigazine, reporting Motherboard, 2023',
      href: 'https://gigazine.net/gsc_news/en/20230608-pirating-gpt4-scraping-openai-api-keys',
    },
    {
      amount: '$46,000/day',
      text: 'Sysdig\'s worst-case estimate for an LLMjacking attack on cloud AI models, later seen above $100,000 a day.',
      source: 'Sysdig Threat Research',
      href: 'https://www.sysdig.com/blog/llmjacking-stolen-cloud-credentials-used-in-new-ai-attack',
    },
  ],
  value: 'The $82,314 bill alone would pay for more than 100 years of Shield Pro.',
};

export const story = {
  label: 'Why we started',
  title: 'AI keys became the most expensive passwords on the internet.',
  paragraphs: [
    'Every AI product runs on an API key, and every one of those keys can spend real money the second it leaks. Big companies have security teams for this. Most builders have a .env file and hope.',
    'We started Rollcfluence to give every team, from a solo developer to a growing startup, the same protection a large company would build for itself: keys kept out of reach, spending that can never run away, and attacks stopped before they cost anything.',
    'We are building it in the open, and we want to hear what you need from it.',
  ],
  sign: 'The Rollcfluence team',
};

export const pricing = {
  index: '13',
  label: 'Pricing',
  title: 'Pay for protected requests, nothing else.',
  note: 'Early-access prices in euros, excluding VAT. Provider usage (OpenAI, Anthropic, Google and others) is billed by them, not us. Extra requests beyond a plan: €0.20 per 1,000.',
  tiers: [
    {
      name: 'Starter',
      price: '€0',
      period: '/month',
      blurb: 'For side projects and prototypes.',
      features: ['10k protected requests a month', '2 gateway keys', 'Spend caps and rate limits', '7-day logs'],
      cta: 'Start free',
    },
    {
      name: 'Pro',
      price: '€49',
      period: '/month',
      blurb: 'For products with real users.',
      features: ['250k protected requests a month', 'Unlimited gateway keys', 'Injection filter and PII redaction', 'Provider failover', '30-day logs'],
      cta: 'Get Pro',
      featured: true,
    },
    {
      name: 'Team',
      price: '€299',
      period: '/month',
      blurb: 'For teams shipping AI at scale.',
      features: ['5M protected requests a month', 'Everything in Pro', 'Per-user limits for your customers', 'Roles for up to 10 seats', '90-day logs'],
      cta: 'Get Team',
    },
    {
      name: 'Business',
      price: 'Custom',
      period: '',
      blurb: 'For companies with compliance needs.',
      features: ['Volume pricing', 'SSO and unlimited seats', 'Dedicated region', '1-year audit log', 'Priority support'],
      cta: 'Talk to us',
      href: 'mailto:rollcfluence@gmail.com?subject=Rollcfluence%20Business',
    },
  ],
};

export const faq = {
  index: '14',
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

export const social = {
  handle: '@rollcfluence_official',
  label: 'Follow the build',
  title: 'We are building Shield in the open.',
  body: 'On Instagram we show what we ship, break down real API key leaks, and share security habits that protect you whether or not you ever use Rollcfluence.',
  points: ['What we shipped this week', 'Real leak breakdowns: how it happened and what it cost', 'One-minute security tips for AI apps'],
  cta: 'Follow on Instagram',
  qrAlt: 'QR code for the Rollcfluence Instagram account, rollcfluence_official',
};

export const access = {
  index: '15',
  label: 'Early access',
  title: 'Get your Rollcfluence key.',
  body: 'Early access opens in small batches. Leave a work email and your key arrives when your batch opens.',
  button: 'Shield my keys',
  formTitle: 'Where should we send your key?',
  placeholder: 'you@company.com',
  submit: 'Request access',
  sending: 'Securing your spot',
  sent: 'Spot secured in',
  failed: 'Not sent after',
  success: 'You are in the queue. Your key goes to this address when your batch opens.',
};

// Chat helper (bottom-right). Answers come from the FAQ above plus these
// extra entries. Anything it can't answer is saved for you in Supabase.
export const chat = {
  button: 'Ask us',
  title: 'Rollcfluence help',
  status: 'Online · replies instantly',
  greeting: "Hi, great to see you! I'm the Rollcfluence helper. Ask me anything about Shield, or pick a question below.",
  openers: ['Great question!', 'Happy to help!', 'Good one!', 'Glad you asked!'],
  followUp: 'Anything else I can help with?',
  hello: "Hello! Lovely to meet you. What would you like to know about keeping your AI keys safe?",
  thanksReply: "You're very welcome! I'm here whenever you need me.",
  suggestions: ['How much latency does it add?', 'Do you store my prompts?', 'How much does it cost?'],
  noMatch: "That's a great one, and it deserves a proper answer from the team. Leave your email and we'll reply to you personally.",
  askEmail: 'Your email',
  send: 'Send',
  thanks: "Thank you! Your question is with the team and we'll email you back soon.",
  extra: [
    {
      q: 'How much does it cost?',
      a: 'Starter is free for 10k protected requests a month. Pro is €49 a month for 250k, Team is €299 a month for 5M, and Business is custom. Your AI provider bills its own usage separately.',
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
    { title: 'Product', links: [['Threats', '#threats'], ['Research', '#research'], ['Compare', '#compare'], ['Savings', '#savings'], ['Pricing', '#pricing']] },
    { title: 'Developers', links: [['How it works', '#how'], ['Get started', '#start'], ['Status', '/status'], ['Security', '/security']] },
    { title: 'Company', links: [['Why we started', '#story'], ['Contact', 'mailto:rollcfluence@gmail.com'], ['Instagram', 'https://www.instagram.com/rollcfluence_official/'], ['Privacy', '/privacy'], ['Terms', '/terms']] },
  ],
  legal: `© ${new Date().getFullYear()} Rollcfluence. All rights reserved.`,
};
