// ─────────────────────────────────────────────────────────────
// ALL page copy, links and prices live here.
// Change words on the site by editing this file only.
// ─────────────────────────────────────────────────────────────

export const brand = {
  name: 'Rollcfluence',
  product: 'Shield',
  tagline: 'The firewall for your AI API keys',
  gatewayUrl: 'https://rollcfluence-shield.vercel.app/v1',
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

// Left-side page index (LineSidebar). Each id is a section id from sections.js.
export const pageIndex = {
  label: 'On this page',
  items: [
    { id: 'threats', label: 'Threats' },
    { id: 'research', label: 'Research' },
    { id: 'how', label: 'How it works' },
    { id: 'start', label: 'Get started' },
    { id: 'features', label: 'Features' },
    { id: 'savings', label: 'Savings' },
    { id: 'compare', label: 'Compare' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'faq', label: 'FAQ' },
    { id: 'story', label: 'Why we started' },
    { id: 'access', label: 'Get access' },
  ],
};

export const hero = {
  eyebrow: 'Limited early access · AI API firewall',
  title: ['One key in your app.', 'Every model behind it, guarded.'],
  body:
    'Your AI provider keys stay in our encrypted vault. Your app gets a Rollcfluence key with a spend cap, a rate limit and an injection filter built in, so a leaked key can cost you no more than the cap you set.',
  primary: { label: 'Get your Rollcfluence key', href: '#access' },
  secondary: { label: 'See the two-line migration', href: '#how' },
  panel: {
    label: 'Rollcfluence Shield',
    stat: 'Up to $46,000 a day',
    text: 'is what one stolen AI key can cost before anyone notices. With Shield, the most it can ever cost is the cap you set.',
    source: 'Sysdig Threat Research, LLMjacking',
  },
  stats: [
    { value: '2 lines', label: 'to integrate: base URL and key' },
    { value: '10+', label: 'providers behind one key: OpenAI, Anthropic, Gemini and more' },
    { value: '1 click', label: 'to revoke a key' },
    { value: '0', label: 'provider keys in your client' },
  ],
};

// All live today: OpenAI and Anthropic natively, the rest through the
// OpenAI-compatible route (/v1/compat, presets in api/_lib/compat.js).
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
      text: 'Per-key rate limits and hard spend caps stop scripted traffic from turning into a five-figure invoice.',
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
      answer: 'Your AI provider keys live in our vault, encrypted with AES-256-GCM, and are never shown again.',
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
  caption: 'A Rollcfluence key only works inside the limits you set. If one leaks, it can never spend past your caps, and you can lock it in one click or allow it only from your own servers.',
};

export const why = {
  index: '05',
  label: 'Why start now',
  title: 'Why teams start with Rollcfluence.',
  items: [
    { name: 'Live in minutes', text: 'Change two lines. Your SDK, your models and your prompts stay exactly as they are.' },
    { name: 'Costs capped from day one', text: 'Every key gets a hard daily limit, so the worst day is a number you chose in advance.' },
    { name: 'Every model, one key', text: 'OpenAI, Anthropic and any provider with an OpenAI-compatible API, like Gemini, Mistral, Groq, DeepSeek or xAI, behind keys you control.' },
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
    after: "baseURL: 'https://rollcfluence-shield.vercel.app/v1',",
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
    { name: 'Add your provider keys', text: 'Paste your OpenAI or Anthropic key into the vault once. It is encrypted and never shown again.' },
    { name: 'Swap two lines', text: 'Where your app sets its API address and key, put in ours. That is the whole code change.' },
    { name: 'Set your limits', text: 'Pick a daily spend cap and a rate limit. Start low. You can raise them any time.' },
  ],
  progress: 'of 4 done',
  help: 'Stuck on any step? Email rollcfluence@gmail.com and we will walk you through it.',
};

export const network = {
  index: '08',
  label: 'Network',
  title: 'One region today. Closer to you next.',
  body: 'Today every request is checked in one region, Washington, D.C. (US East), next to the provider APIs. Running the same checks close to your users, starting with Europe, is the next step.',
  hint: 'Drag to spin',
  // lat / lon of each edge region shown on the globe
  regions: [
    { name: 'Frankfurt', code: 'fra', lat: 50.1, lon: 8.7, ms: 'Planned' },
    { name: 'London', code: 'lhr', lat: 51.5, lon: -0.1, ms: 'Planned' },
    { name: 'Sofia', code: 'sof', lat: 42.7, lon: 23.3, ms: 'Planned' },
    { name: 'Virginia', code: 'iad', lat: 38.9, lon: -77.4, ms: 'Live' },
    { name: 'San Francisco', code: 'sfo', lat: 37.8, lon: -122.4, ms: 'Planned' },
    { name: 'São Paulo', code: 'gru', lat: -23.5, lon: -46.6, ms: 'Planned' },
    { name: 'Singapore', code: 'sin', lat: 1.35, lon: 103.8, ms: 'Planned' },
    { name: 'Tokyo', code: 'hnd', lat: 35.7, lon: 139.7, ms: 'Planned' },
    { name: 'Sydney', code: 'syd', lat: -33.9, lon: 151.2, ms: 'Planned' },
  ],
  // pairs of region indexes to draw request arcs between
  arcs: [[0, 3], [1, 4], [2, 6], [3, 5], [0, 7], [6, 8], [4, 7], [1, 2]],
};

export const features = {
  index: '09',
  label: 'Features',
  title: 'Six guards today. Two on the way.',
  items: [
    { name: 'Key vault', text: 'Provider keys are encrypted at rest and never returned. Issue scoped gateway keys per app, user or environment.', size: 'wide' },
    { name: 'Spend caps', text: 'Hard daily and monthly limits per key. When the cap hits, traffic stops, not your card.' },
    { name: 'Rate limits', text: 'Requests-per-minute limits on every key. Over the limit, Shield answers 429 and the provider is never called.' },
    { name: 'Injection filter', text: 'Screens prompts for common jailbreak and prompt-leak phrases. A basic pattern filter today, not a guarantee.' },
    { name: 'PII redaction', text: 'Emails, cards and phone numbers are masked before they leave your stack.' },
    { name: 'Bot traps · coming next', text: 'Honeypot routes and fingerprinting to catch scrapers that replay your traffic. Not built yet.', size: 'wide' },
    { name: 'Failover · coming next', size: 'wide', text: 'If a provider goes down, requests route to your backup model. Not built yet.' },
    { name: 'Audit log', size: 'wide', text: 'Every request and every block, with model, tokens and estimated cost. Export to CSV.' },
  ],
};

export const trust = {
  index: '10',
  label: 'Trust',
  title: 'Why you can trust us with your keys.',
  items: [
    { name: 'Your keys are never shown back', text: 'Provider keys are encrypted at rest. No endpoint returns them, not even to you.' },
    { name: 'Leave in one line', text: 'Shield speaks each provider\'s own API. Point your base URL back and you are out. No lock-in.' },
    { name: 'If we go down, you are not stuck', text: 'Requests fail with a clear error, so your app can call the provider directly. A per-key fail-open switch is coming next.' },
    { name: 'Prompts are not kept', text: 'Shield does not store prompts or responses, unless you turn on caching for a request: then the answer is kept encrypted for up to 7 days. It logs only the request details you see in your dashboard.' },
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
  swipe: 'Swipe sideways to see every option',
  columns: ['Do nothing', 'Provider settings', 'Build it yourself', 'Rollcfluence Shield'],
  rows: [
    { label: 'Provider keys stay out of your app', values: ['no', 'no', 'yes', 'yes'] },
    { label: 'Hard spend cap', values: ['no', 'partial', 'yes', 'yes'], note: 'OpenAI offers project hard limits. Google Cloud budgets only alert.' },
    { label: 'Limits per end user, not just per account', values: ['no', 'no', 'yes', 'partial'], note: 'Shield limits each key today. Give each user or app its own key.' },
    { label: 'Prompt-injection screening', values: ['no', 'no', 'partial', 'partial'], note: 'Shield runs a basic pattern filter today.' },
    { label: 'All providers in one place', values: ['no', 'no', 'partial', 'partial'], note: 'OpenAI, Anthropic and OpenAI-compatible APIs today.' },
    { label: 'Revoke a key without redeploying', values: ['no', 'no', 'yes', 'yes'] },
    { label: 'Personal data masked before it reaches the AI provider', values: ['no', 'no', 'partial', 'yes'] },
    { label: 'Automatic failover to a backup model', values: ['no', 'no', 'partial', 'Coming next'] },
    { label: 'Bot and scraper traps', values: ['no', 'no', 'partial', 'Coming next'] },
    { label: 'Per-request audit log you can export', values: ['no', 'partial', 'partial', 'yes'], note: 'Providers show usage per account or project, not per request of your users.' },
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

export const history = {
  label: 'History and goals',
  title: 'How we got here, and where we are going.',
  period: '2022 → what comes next',
  hint: 'Keep scrolling to travel the timeline',
  top: [
    { id: 'h1', order: 1, date: '2022 · November', stat: 'Day one', heading: 'ChatGPT launches', content: 'Within months every product wants AI, and every AI call runs on a secret key that can spend money.' },
    { id: 'h2', order: 2, date: '2024 · May', stat: '$46,000 a day', heading: 'LLMjacking gets a name', content: 'Sysdig documents attackers stealing AI keys and reselling the access on the victim\'s bill.' },
    { id: 'h3', order: 3, date: '2025', stat: '1.27M keys', heading: 'Leaks hit a record', content: 'GitGuardian finds leaked AI-service keys on public GitHub up 81% in a single year.' },
    { id: 'h4', order: 4, date: '2026 · October', stat: '100 teams', heading: 'Shield opens', content: 'Rollcfluence Shield starts early access, one limited batch at a time.' },
  ],
  bottom: [
    { id: 'g1', order: 5, date: 'Goal 01', heading: 'Shield every key', content: 'Every AI key a team uses sits behind a hard cap, a rate limit and an injection filter.' },
    { id: 'g2', order: 6, date: 'Goal 02', heading: 'Budgets for AI agents', content: 'Agents that act on their own get their own wallet, and can never spend more than you allow.' },
    { id: 'g3', order: 7, date: 'Goal 03', heading: 'The trust layer for AI', content: 'One place where every company sees, verifies and controls what its AI does and spends.' },
  ],
};

export const story = {
  label: 'Why we started',
  mission: 'We built Shield with one purpose: a leaked AI key should never cost you more than the limit you set.',
  paragraphs: [
    'AI keys became the most expensive passwords on the internet, and most teams guard them with a .env file and hope. We built the protection big companies build for themselves, for everyone else.',
    'Your provider keys stay in an encrypted vault and your app gets a key with hard limits. You can set it up from your own computer in minutes, with two lines of code.',
    'Why depend on someone else\'s keys and someone else\'s rules? With Shield you bring your own provider keys, so you never rent access through a middleman\'s account, and every rule is one you set yourself and can change at any moment.',
    'The protection grows with you. The time and money that used to go to leaks, surprise bills and firefighting goes back to the problems you actually want to solve.',
  ],
  closing: 'The wiser the user, the stronger the business.',
  sign: 'Rollcfluence',
};

export const layers = {
  label: 'Layers of protection',
  title: ['Layer by layer,', 'we guard what is yours'],
  left: 'An encrypted vault, spend caps, rate limits, IP and country rules, and injection and PII filters. Every request passes each layer before it reaches your AI provider.',
  right: 'Every team gets the same protection, from the free plan up. Stay with us and help decide which layer we build next.',
  cta: 'Join the first batch',
};

export const vision = {
  label: 'What comes next',
  title: 'This is only the beginning.',
  big: [
    'AI is moving from answering questions to taking actions. Agents already book, buy, write code and call other AIs on their own, and each of them holds a key. The more AI does, the more those keys are worth, to you and to anyone who steals them.',
    'Shield is our first step. The goal is bigger: to be the layer every company trusts to decide what its AI is allowed to spend and do. The teams in the first batches will shape what it becomes.',
  ],
  cta: 'Claim a spot in the first batch',
};

export const library = {
  index: '13',
  label: 'Savings report',
  title: 'The studies behind the savings.',
  body: 'Every number here comes from a published paper, an official provider page or a named incident report. Drag through the stack, click a paper to open it, and read the full report for the maths and the fine print.',
  report: { label: 'Read the full savings report', href: '/report' },
  groups: [
    { id: 'loss', title: 'What an unprotected key costs', note: 'This is the money Shield exists to stop.' },
    { id: 'bill', title: 'Proven ways to cut the AI bill', note: 'Independent research. Shield does not do these for you today; they work alongside it.' },
  ],
  papers: [
    {
      id: 'register-gemini',
      group: 'loss',
      kind: 'Incident report',
      venue: 'The Register',
      year: '2026',
      title: 'Stolen Gemini API key runs up an $82,314 bill',
      stat: '$82,314',
      claim: 'charged in about two days on a stolen Google Cloud key, for a startup that normally spent around $180 a month.',
      caveat: 'One reported case. It shows the scale, not a typical loss.',
      href: 'https://theregister.com/2026/03/03/gemini_api_key_82314_dollar_charge/',
    },
    {
      id: 'sysdig-llmjacking',
      group: 'loss',
      kind: 'Threat research',
      venue: 'Sysdig Threat Research Team',
      year: '2024',
      title: 'LLMjacking: stolen cloud credentials used in new AI attack',
      stat: '$46,000 / day',
      claim: 'is Sysdig\'s estimate of what an attacker can burn on a victim\'s account by reselling access to stolen AI keys.',
      caveat: 'A worst-case estimate for a fully abused account, not an average.',
      href: 'https://www.sysdig.com/blog/llmjacking-stolen-cloud-credentials-used-in-new-ai-attack',
    },
    {
      id: 'gitguardian-2026',
      group: 'loss',
      kind: 'Industry report',
      venue: 'GitGuardian',
      year: '2026',
      title: 'The State of Secrets Sprawl 2026',
      stat: '1.27M keys',
      claim: 'for AI services were found leaked on public GitHub in 2025, up 81% on the year before.',
      caveat: 'Counts public GitHub only; private leaks are not included.',
      href: 'https://blog.gitguardian.com/ai-secrets-spread-fast/',
    },
    {
      id: 'ibm-breach-2025',
      group: 'loss',
      kind: 'Industry report',
      venue: 'IBM and Ponemon Institute',
      year: '2025',
      title: 'Cost of a Data Breach Report 2025',
      stat: '$4.44M',
      claim: 'is the global average cost of a data breach, from 600 organisations in 16 countries. The US average hit a record $10.22M.',
      caveat: 'Covers all breaches, not only leaked AI keys.',
      href: 'https://www.ibm.com/reports/data-breach',
    },
    {
      id: 'verizon-dbir-2025',
      group: 'loss',
      kind: 'Industry report',
      venue: 'Verizon',
      year: '2025',
      title: 'Data Breach Investigations Report 2025',
      stat: '22%',
      claim: 'of breaches started with stolen or abused credentials, the most common way attackers got in.',
      caveat: 'Figure as summarised by Aembit; credentials of all kinds, not only API keys.',
      href: 'https://aembit.io/blog/credential-and-secrets-theft-2025-verizon-data-breach-report/',
    },
    {
      id: 'frugalgpt',
      group: 'bill',
      kind: 'Peer-reviewed paper',
      venue: 'Chen, Zaharia, Zou · Stanford · TMLR',
      year: '2024',
      title: 'FrugalGPT: How to Use Large Language Models While Reducing Cost and Improving Performance',
      stat: 'Up to 98%',
      claim: 'lower cost while matching GPT-4 accuracy, by sending each query to the cheapest model that can answer it well.',
      caveat: '98% was the best of three datasets; the other two saved 73% and 59%.',
      href: 'https://arxiv.org/abs/2305.05176',
    },
    {
      id: 'routellm',
      group: 'bill',
      kind: 'Peer-reviewed paper',
      venue: 'Ong et al. · UC Berkeley, Anyscale, Canva · ICLR',
      year: '2025',
      title: 'RouteLLM: Learning to Route LLMs from Preference Data',
      stat: 'Over 2x',
      claim: 'cheaper in some settings without losing response quality, by routing easy prompts to a smaller model.',
      caveat: 'The paper says "in certain cases"; savings depend on your traffic.',
      href: 'https://arxiv.org/abs/2406.18665',
    },
    {
      id: 'semantic-cache',
      group: 'bill',
      kind: 'Research preprint',
      venue: 'Regmi, Pun · arXiv',
      year: '2024',
      title: 'GPT Semantic Cache: Reducing LLM Costs and Latency via Semantic Embedding Caching',
      stat: 'Up to 68.8%',
      claim: 'fewer API calls by answering repeated, similar questions from a cache instead of the model.',
      caveat: 'A preprint, not yet peer-reviewed. Works best when users ask similar things.',
      href: 'https://arxiv.org/abs/2411.05276',
    },
    {
      id: 'llmlingua',
      group: 'bill',
      kind: 'Peer-reviewed paper',
      venue: 'Jiang et al. · Microsoft Research · EMNLP',
      year: '2023',
      title: 'LLMLingua: Compressing Prompts for Accelerated Inference of Large Language Models',
      stat: 'Up to 20x',
      claim: 'shorter prompts with little loss in quality, so you pay for far fewer input tokens.',
      caveat: 'At 20x Microsoft reports about a 1.5 point drop; results vary by task.',
      href: 'https://aclanthology.org/2023.emnlp-main.825',
    },
    {
      id: 'anthropic-caching',
      group: 'bill',
      kind: 'Provider documentation',
      venue: 'Anthropic',
      year: '2024',
      title: 'Prompt caching with Claude',
      stat: 'Up to 90%',
      claim: 'lower cost and up to 85% lower latency for long prompts that repeat, such as a big system prompt or document.',
      caveat: 'Only the cached part of the prompt gets cheaper, and writing to the cache costs extra.',
      href: 'https://www.anthropic.com/news/prompt-caching',
    },
    {
      id: 'openai-batch',
      group: 'bill',
      kind: 'Provider documentation',
      venue: 'OpenAI',
      year: '2024',
      title: 'Batch API',
      stat: '50% off',
      claim: 'for requests that can wait: results come back within 24 hours at half the normal price.',
      caveat: 'Not for live chat, and not every model supports it.',
      href: 'https://help.openai.com/en/articles/9197833-batch-api-faq',
    },
  ],
};

export const market = {
  index: '14',
  label: 'Why now',
  title: 'AI is growing faster than the safety around it.',
  body: 'Almost every company is putting AI to work, and the money behind it is jumping year after year. Protection has not kept up, so we built Shield to give everyone the same safety net, not only the companies that can afford a security team.',
  stats: [
    {
      stat: '$644B',
      text: 'forecast worldwide spending on generative AI in 2025, up 76% on 2024.',
      note: 'Most of it is hardware with AI built in.',
      source: 'Gartner, March 2025',
      href: 'https://www.gartner.com/en/newsroom/press-releases/2025-03-31-gartner-forecasts-worldwide-genai-spending-to-reach-644-billion-in-2025',
    },
    {
      stat: '88%',
      text: 'of organisations now use AI in at least one part of the business, up from 78% a year earlier.',
      source: 'McKinsey, The State of AI 2025',
      href: 'https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai',
    },
    {
      stat: '62%',
      text: 'are already scaling (23%) or testing (39%) AI agents that act on their own, each one holding keys.',
      source: 'McKinsey, The State of AI 2025',
      href: 'https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai',
    },
    {
      stat: '+81%',
      text: 'more leaked AI-service keys in one year. Adoption is outrunning protection.',
      source: 'GitGuardian, State of Secrets Sprawl 2026',
      href: 'https://blog.gitguardian.com/ai-secrets-spread-fast/',
    },
  ],
  forTitle: 'Safety for everyone, at every size.',
  for: [
    { who: 'Solo developers', price: '€0', text: 'Spend caps and rate limits on the free Starter plan, 10k protected requests a month.' },
    { who: 'Startups', price: '€49 / month', text: 'Spend caps, the injection filter and PII redaction on Pro, without hiring a security engineer.' },
    { who: 'Growing teams', price: '€299 / month', text: '1.25M protected requests a month on Team, with every defense, alert and report included.' },
  ],
  forNote: 'The same guards a large company would build for itself. Prices exclude VAT.',
};

export const pricing = {
  index: '15',
  label: 'Pricing',
  title: 'Cheaper than one leaked key.',
  note: 'Early-access prices in euros, excluding VAT. Your AI provider (OpenAI, Anthropic or another) bills its own usage, not us. When a plan\'s monthly requests run out, Shield stops forwarding until the 1st or until you upgrade. Pay-as-you-go extra requests are coming next.',
  value: {
    title: 'Count answers, not invoices.',
    body: 'One request is one message your app sends to an AI model and the answer it gets back: one chatbot reply, one summary, one translation.',
    facts: ['1 request = 1 AI answer', 'Pro: about {n} answers a day', 'One cent covers about {c} requests on Pro'],
    dayPaid: 'About {eur} a day for about {n} answers a day.',
    dayFree: 'About {n} answers a day, free.',
    footnote: 'Per-day figures divide the monthly allowance and price by 30 and round down.',
  },
  hookSource: { label: 'Stolen Gemini key: $82,314 in about two days, The Register, March 2026', href: 'https://theregister.com/2026/03/03/gemini_api_key_82314_dollar_charge/' },
  tiers: [
    {
      id: 'starter',
      name: 'Starter',
      price: '€0',
      period: '/month',
      image: '/media/silk-starter.jpg',
      hook: 'Free forever. No card.',
      blurb: 'For side projects and prototypes.',
      pick: 'Pick this if you are building something new and want caps on day one.',
      features: ['10k protected requests a month', '2 gateway keys', 'Spend caps and rate limits', 'Injection filter and auto-lock'],
      cta: 'Join free',
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '€49',
      period: '/month',
      image: '/media/silk-pro.jpg',
      hook: 'Less than one bad hour with a leaked key.*',
      blurb: 'For products with real users.',
      pick: 'Pick this if real customers use your AI feature and a surprise bill would hurt.',
      features: ['200k protected requests a month', 'Up to 20 gateway keys', 'PII masking and IP allow-lists', 'Email, Slack, Discord and webhook alerts', 'Provider failover (coming next)'],
      cta: 'Join for Pro',
      featured: true,
    },
    {
      id: 'team',
      name: 'Team',
      price: '€299',
      period: '/month',
      image: '/media/silk-team.jpg',
      hook: 'About €0.24 per 1,000 protected requests.',
      blurb: 'For teams shipping AI at scale.',
      pick: 'Pick this if several apps or environments call AI every minute of the day.',
      features: ['1.25M protected requests a month', 'Everything in Pro', 'Per-user limits for your customers (coming next)', 'Roles for up to 10 seats (coming next)'],
      cta: 'Join for Team',
    },
    {
      id: 'scale',
      name: 'Scale',
      price: '€799',
      period: '/month',
      image: '/media/silk-scale.jpg',
      hook: 'About €0.23 per 1,000 protected requests.',
      blurb: 'For high-traffic AI products.',
      pick: 'Pick this if AI is your product and millions of requests a month go through it.',
      features: ['3.5M protected requests a month', 'Everything in Team', 'Priority email support from the founder'],
      cta: 'Join for Scale',
    },
    {
      id: 'business',
      name: 'Business',
      price: 'Custom',
      period: '',
      image: '/media/silk-business.jpg',
      hook: 'Your volume, your terms.',
      blurb: 'For companies with compliance needs.',
      pick: 'Pick this if you need more than 3.5M requests or a signed agreement.',
      features: ['Volume pricing', 'A contract and invoice terms', 'SSO and unlimited seats (planned)', 'Dedicated region (planned)'],
      cta: 'Talk to us',
      href: 'mailto:rollcfluence@gmail.com?subject=Rollcfluence%20Business',
    },
  ],
};

// Model comparison under the plans. Prices come from api/_lib/prices.js
// (the same table the gateway uses for spend caps).
export const modelCompare = {
  title: 'Why wait for your AI provider to tell you what you owe?',
  intro: 'Set your own limit and know your bill before it arrives. Pick your traffic: we estimate the provider bill for each model and show which Shield plan covers it.',
  models: [
    ['openai', 'gpt-5-nano', 'GPT-5 nano'],
    ['openai', 'gpt-5-mini', 'GPT-5 mini'],
    ['openai', 'gpt-4.1-mini', 'GPT-4.1 mini'],
    ['openai', 'gpt-4o-mini', 'GPT-4o mini'],
    ['openai', 'gpt-5', 'GPT-5'],
    ['openai', 'o3', 'o3'],
    ['anthropic', 'claude-haiku-4', 'Claude Haiku 4'],
    ['anthropic', 'claude-sonnet-4', 'Claude Sonnet 4'],
    ['anthropic', 'claude-opus-4-5', 'Claude Opus 4.5'],
  ],
  sizes: [
    { id: 'short', label: 'Short chat', input: 500, output: 200 },
    { id: 'chat', label: 'Chat with context', input: 1500, output: 500 },
    { id: 'doc', label: 'Long document', input: 6000, output: 800 },
  ],
  volumes: [10_000, 50_000, 200_000, 500_000, 1_250_000, 3_500_000, 10_000_000],
  note: 'Estimates at list prices in US dollars, checked 2026-10-16. Your provider\'s invoice is the real number. Shield plans are in euros.',
  sources: [
    ['OpenAI API pricing', 'https://openai.com/api/pricing'],
    ['Anthropic pricing', 'https://www.anthropic.com/pricing'],
  ],
};

export const faq = {
  index: '16',
  label: 'FAQ',
  title: 'Before you switch your base URL.',
  items: [
    {
      q: 'Do I need to change my code?',
      a: 'Only the base URL and the key. Shield speaks the same API as the provider you already use, so your SDK keeps working.',
      keywords: ['code', 'change', 'sdk', 'migrate', 'migration', 'rewrite', 'base', 'url'],
    },
    {
      q: 'How much latency does it add?',
      a: 'We have not measured it on real traffic yet, so we will not quote a number. Shield is one extra hop, and streaming responses are passed through chunk by chunk.',
      keywords: ['latency', 'slow', 'speed', 'fast', 'delay', 'performance', 'overhead', 'milliseconds'],
    },
    {
      q: 'Do you store my prompts?',
      a: 'No. Shield does not store prompts or responses. It keeps only request details: time, key, model, token counts, estimated cost and whether it was blocked.',
      keywords: ['prompts', 'store', 'save', 'log', 'logs', 'responses', 'keep', 'read'],
    },
    {
      q: 'What happens if Shield goes down?',
      a: 'Requests through Shield fail with a clear error, so your app can fall back to calling the provider directly. A per-key fail-open switch is on our list, not built yet.',
      keywords: ['down', 'outage', 'offline', 'uptime', 'fails', 'failure', 'reliability', 'sla'],
    },
    {
      q: 'Which providers are supported?',
      a: 'OpenAI (/v1/chat/completions), Anthropic (/v1/messages) and any provider with an OpenAI-compatible chat API (/v1/compat/chat/completions), such as Google Gemini, Mistral, Groq, DeepSeek, xAI, Cohere, Azure OpenAI, AWS Bedrock or OpenRouter. Streaming works on all of them.',
      keywords: ['providers', 'openai', 'anthropic', 'claude', 'gpt', 'chatgpt', 'models', 'supported', 'cohere', 'azure', 'bedrock', 'aws'],
    },
    {
      q: 'Can I bring my own keys?',
      a: 'Yes. You add your OpenAI or Anthropic key once. It is stored encrypted (AES-256-GCM), and Shield issues gateway keys on top of it.',
      keywords: ['own', 'bring', 'byok', 'keys', 'key', 'account'],
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
  index: '17',
  label: 'Early access',
  title: 'Get your Rollcfluence key.',
  body: 'Access is limited on purpose. We open Shield to 100 teams per batch so every team gets set up properly and every key is watched closely. Confirm your email to hold your spot.',
  limits: ['100 teams per batch', 'One request per company', 'Every email confirmed', 'Every request reviewed by us'],
  goalLabel: 'What do you want Shield to do first?',
  goals: ['Cap my AI spend', 'Stop leaked keys', 'All of it', 'Block prompt injection', 'Per-user limits'],
  goalDefault: 2, // index of the goal the wheel starts on
  button: 'Shield my keys',
  formTitle: 'Where should we send your key?',
  placeholder: 'you@company.com',
  submit: 'Request access',
  sending: 'Securing your spot',
  sent: 'Spot secured in',
  failed: 'Not sent after',
  success: 'You are in the queue. Your key goes to this address when your batch opens.',
  verifySuccess: 'Almost there. We sent a confirmation link to your inbox. Your spot is held once you click it.',
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
      a: 'Starter is free for 10k protected requests a month. Pro is €49 a month for 200k, Team is €299 for 1.25M, Scale is €799 for 3.5M, and Business is custom. Your AI provider bills its own usage separately.',
      keywords: ['price', 'prices', 'pricing', 'cost', 'costs', 'much', 'plans', 'pay', 'euro', 'cheap', 'expensive', 'money'],
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
    {
      q: 'What is Rollcfluence Shield?',
      a: 'Shield is a firewall for your AI API keys. Your OpenAI, Anthropic or other provider key stays in our encrypted vault, and your app gets a Shield key with a spend cap, a rate limit and filters built in. A leaked Shield key can only spend what you allow.',
      keywords: ['this', 'shield', 'rollcfluence', 'product', 'explain', 'firewall', 'about', 'gateway', 'proxy', 'overview'],
    },
    {
      q: 'Which plan should I pick?',
      a: 'Pick by monthly requests: Starter (free) up to 10k, Pro (€49) up to 200k, Team (€299) up to 1.25M, Scale (€799) up to 3.5M, and Business above that. The Shield check after sign-up also recommends a plan from your answers.',
      keywords: ['which', 'plan', 'pick', 'choose', 'right', 'recommend', 'starter', 'pro', 'team', 'scale', 'business', 'tier'],
    },
    {
      q: 'Is there a free plan?',
      a: 'Yes. Starter is free forever for 10k protected requests a month and 2 gateway keys, with spend caps, rate limits, the injection filter and auto-lock included. No card needed.',
      keywords: ['free', 'starter', 'trial', 'card', 'cost', 'nothing', 'zero'],
    },
    {
      q: 'Do prices include VAT?',
      a: 'No. Prices are in euros per month, excluding VAT. VAT is added where it applies.',
      keywords: ['vat', 'tax', 'taxes', 'euro', 'invoice', 'price', 'including', 'excluding'],
    },
    {
      q: 'Can I cancel any time?',
      a: 'Yes. Plans renew monthly and you can cancel from Plan and billing in your dashboard. You keep your plan until the end of the period you paid for, then move back to Starter.',
      keywords: ['cancel', 'cancellation', 'stop', 'subscription', 'contract', 'commitment', 'refund', 'downgrade', 'monthly'],
    },
    {
      q: 'How do I pay?',
      a: 'By card, through a certified card processor. We never see or store your card number. Business plans can be invoiced.',
      keywords: ['pay', 'payment', 'card', 'credit', 'debit', 'invoice', 'billing', 'checkout'],
    },
    {
      q: 'What happens when I go over my plan?',
      a: 'When the monthly request allowance is used up, Shield stops forwarding new requests until the next month or until you move to a bigger plan. There are no surprise overage charges.',
      keywords: ['over', 'limit', 'exceed', 'allowance', 'quota', 'overage', 'extra', 'more', 'run', 'out'],
    },
    {
      q: 'How do spend caps work?',
      a: 'Each Shield key has a daily and a monthly cap in dollars. Shield adds up the estimated cost of every request, and once a cap is reached it answers with an error and never calls your provider, so the bill stops there.',
      keywords: ['cap', 'caps', 'spend', 'spending', 'budget', 'bill', 'daily', 'day', 'monthly', 'stop', 'runaway', 'overspend'],
    },
    {
      q: 'What if my Shield key leaks?',
      a: 'A leaked Shield key can only spend up to its cap, at its rate limit, from the IPs and countries you allow. You can revoke or lock it in one click, auto-lock can shut it off when attacks repeat, and your real provider key is never exposed.',
      keywords: ['leak', 'leaked', 'stolen', 'compromised', 'hacked', 'exposed', 'github', 'revoke', 'lock', 'attack'],
    },
    {
      q: 'Which protections do I get?',
      a: 'Spend caps, rate limits, a model allow-list, an IP allow-list, country blocking, key expiry, a max output tokens ceiling, a prompt-injection filter, PII masking, auto-lock, alerts and a security log. Bot traps and provider failover are coming next.',
      keywords: ['protection', 'protections', 'features', 'security', 'defense', 'what', 'includes', 'list', 'block'],
    },
    {
      q: 'Does the injection filter stop every attack?',
      a: 'No filter can promise that. Ours catches common jailbreak and prompt-leak phrases with patterns today. Treat it as one layer next to caps, rate limits and allow-lists, which are hard limits.',
      keywords: ['injection', 'jailbreak', 'prompt', 'filter', 'guarantee', 'attack', 'safe'],
    },
    {
      q: 'What is PII masking?',
      a: 'When it is on, emails, card numbers and phone numbers in prompts are replaced before the request leaves for the provider. It is available on Pro and above.',
      keywords: ['pii', 'personal', 'mask', 'masking', 'redact', 'redaction', 'hide', 'emails', 'phone', 'cards'],
    },
    {
      q: 'Where is my data stored?',
      a: 'Account data is stored in an EU database in Frankfurt. Prompts and responses are not stored, unless you turn on caching (encrypted, up to 7 days). Request details are kept for up to 90 days. The Privacy policy and DPA have the full detail.',
      keywords: ['where', 'data', 'stored', 'storage', 'eu', 'europe', 'region', 'retention', 'delete', 'frankfurt', 'server', 'servers'],
    },
    {
      q: 'Are you GDPR compliant?',
      a: 'We built Shield for EU teams: prompts are not stored unless you turn on caching, account data sits in the EU, request history is kept for up to 90 days, and a Data Processing Agreement is published at /dpa. We do not claim any certification we do not have.',
      keywords: ['gdpr', 'compliance', 'compliant', 'dpa', 'privacy', 'certified', 'soc', 'iso', 'legal'],
    },
    {
      q: 'How are provider keys protected?',
      a: 'They are encrypted with AES-256-GCM before they are saved, and no endpoint ever returns them, not even to you. Only the gateway decrypts a key in memory to forward your request.',
      keywords: ['provider', 'key', 'keys', 'encrypted', 'encryption', 'aes', 'vault', 'secure', 'stored', 'safe'],
    },
    {
      q: 'How do I set it up?',
      a: 'Sign in, add your provider key, create a Shield key, then change two lines in your app: the base URL to https://rollcfluence-shield.vercel.app/v1 and the API key to your Shield key. Your existing SDK keeps working.',
      keywords: ['setup', 'set', 'install', 'start', 'integrate', 'integration', 'base', 'url', 'sdk', 'code', 'minutes', 'begin'],
    },
    {
      q: 'Can I use Gemini, Mistral or other models?',
      a: 'Yes, any provider with an OpenAI-compatible chat API works through /v1/compat: Google Gemini, Mistral, Groq, DeepSeek, xAI, Cohere, Azure OpenAI, AWS Bedrock, OpenRouter, Together, Fireworks and more. Add the provider under Provider keys in the dashboard.',
      keywords: ['gemini', 'google', 'mistral', 'groq', 'deepseek', 'xai', 'grok', 'openrouter', 'llama', 'compatible', 'other', 'models', 'model', 'cohere', 'azure', 'bedrock', 'aws'],
    },
    {
      q: 'Do you support streaming?',
      a: 'Yes. Streaming responses pass through chunk by chunk on every supported provider, and usage is still counted.',
      keywords: ['stream', 'streaming', 'sse', 'chunks', 'realtime'],
    },
    {
      q: 'Can I try the dashboard first?',
      a: 'Yes. Open the demo at /app?demo to click through a dashboard filled with sample data. Nothing you do there is saved.',
      keywords: ['demo', 'try', 'test', 'preview', 'dashboard', 'see', 'look', 'example'],
    },
    {
      q: 'What is the Shield check?',
      a: 'Nine quick questions when you sign up. You get a risk score, what to fix first, a recommended plan and a setup list that ticks itself off as you configure Shield.',
      keywords: ['check', 'assessment', 'score', 'risk', 'questions', 'onboarding', 'evaluate', 'audit'],
    },
    {
      q: 'Do you have alerts?',
      a: 'Yes. Shield can alert you by email, Slack, Discord or a signed webhook when requests are blocked, a cap is close, or a key gets locked.',
      keywords: ['alert', 'alerts', 'notify', 'notification', 'slack', 'discord', 'webhook', 'email', 'warning'],
    },
    {
      q: 'Can I limit each of my own users?',
      a: 'You can send your end user ID with each request and see who spends what in the Live view. Hard per-user limits for your customers are coming next on the Team plan.',
      keywords: ['user', 'users', 'customer', 'customers', 'per', 'end', 'tenant', 'individual', 'each'],
    },
    {
      q: 'Do you have team seats or SSO?',
      a: 'Not yet. Roles for up to 10 seats are coming next on Team, and SSO with unlimited seats is planned for Business.',
      keywords: ['seats', 'team', 'members', 'roles', 'sso', 'saml', 'login', 'colleagues', 'invite'],
    },
    {
      q: 'What is coming next?',
      a: 'Provider failover, bot traps, per-user limits for your customers, team roles, smarter injection detection, native Cohere, Azure OpenAI and AWS Bedrock, and an EU-only region.',
      keywords: ['next', 'roadmap', 'coming', 'soon', 'future', 'planned', 'plans', 'new'],
    },
    {
      q: 'Why is access limited?',
      a: 'We open Shield to 100 teams per batch, so every team gets set up properly and every key is watched closely. Confirm your email on the waitlist to hold your spot.',
      keywords: ['limited', 'batch', 'waitlist', 'wait', 'when', 'invite', 'access', 'spot', 'queue'],
    },
    {
      q: 'Who is Shield for?',
      a: 'Small teams and startups that call AI APIs from their product and cannot afford a leaked key or a runaway bill, especially teams in the EU.',
      keywords: ['who', 'for', 'startup', 'startups', 'small', 'teams', 'company', 'agency', 'developers', 'indie'],
    },
    {
      q: 'Why not just use the provider’s own limits?',
      a: 'Provider limits are per account and often only warn you after the money is spent. Shield gives every app and environment its own key with hard caps, rate limits, IP and country rules, and one place to revoke it, across all your providers.',
      keywords: ['why', 'provider', 'openai', 'anthropic', 'own', 'limits', 'already', 'difference', 'instead', 'need', 'worth'],
    },
  ],
};

// Small interface words used inside components, kept here so they translate.
export const ui = {
  signIn: 'Sign in',
  join: 'Join the waitlist',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',
  language: 'Language',
  status: 'System status',
  seePlans: 'See every plan',
  recommended: 'Recommended',
  yes: 'Yes',
  no: 'No',
  partly: 'Partly',
  requestsMonth: 'Requests a month',
  requestSize: 'Request size',
  tokensInOut: 'in · {out} out tokens',
  planCovers: 'Shield plan that covers this',
  inputRate: 'Input / 1M tokens',
  outputRate: 'Output / 1M tokens',
  providerBill: 'Your provider bill / month',
  validEmail: 'Enter a valid work email.',
  signupClosed: 'Signups are not open just yet. Email rollcfluence@gmail.com and we will save your spot by hand.',
  wentWrong: 'Something went wrong. Try again in a minute.',
  consentPre: 'By joining you agree to our',
  terms: 'Terms',
  and: 'and',
  privacy: 'Privacy policy',
  savings: {
    bill: 'Your monthly AI bill',
    night: 'One leaked key, one night, no cap',
    nightText: 'Eight hours at the worst-case rate attackers can burn.',
    worst: 'Your worst day with Shield',
    worstText: 'A daily cap at 150% of your average day. Past it, traffic stops.',
    plan: 'Your plan',
    custom: 'custom',
    free: 'free',
    perMonth: '/mo',
    customText: 'Volume pricing for your traffic. We size it with you.',
    freeText: 'Free while your traffic is small. Caps and rate limits included.',
    yearText: '{amount} a year, all providers and keys included.',
    payback: 'Pays for itself if it stops a leak',
    minutes: '{n} min',
    dayOne: 'Day one',
    oneIncident: 'One incident',
    paybackText: 'That is how long the worst case takes to cost more than a month of {plan}.',
    nothingText: 'There is nothing to pay back on the free plan.',
    incidentText: 'A single stopped incident covers years of the plan.',
    talk: 'Talk to us',
  },
  feedback: {
    title: 'What do you think of Shield so far?',
    scores: ['Poor', 'Meh', 'Okay', 'Good', 'Love it'],
    rating: 'Your rating',
    message: 'What would make it better? What is missing? (optional)',
    email: 'Email, if you want a reply (optional)',
    send: 'Send feedback',
    sending: 'Sending…',
    done: 'Thank you. We read every answer, and it shapes what we build next.',
    pick: 'Pick a score from 1 to 5 first.',
    bad: 'Check the email address.',
    error: 'That did not go through. Try again in a moment.',
  },
  chatUi: {
    close: 'Close chat',
    placeholder: 'Type your question',
    question: 'Your question',
    ask: 'Ask',
    badEmail: 'Enter a valid email.',
    notSent: "That didn't send. Email us at",
    orEmail: 'or email',
    sendingTeam: 'Sending to the team',
    thinking: 'Thinking…',
    aiNote: 'AI answers can be wrong. For anything important, email us.',
    leaveEmail: 'Want a person to follow up? Leave your email.',
    didYouMean: 'Did you mean:',
    related: 'Related:',
  },
};

export const footer = {
  columns: [
    { title: 'Product', links: [['Threats', '#threats'], ['Research', '#research'], ['Compare', '#compare'], ['Savings', '#savings'], ['Pricing', '#pricing']] },
    { title: 'Developers', links: [['How it works', '#how'], ['Get started', '#start'], ['Status', '/status'], ['Security', '/security']] },
    { title: 'Company', links: [['Why we started', '#story'], ['Contact', 'mailto:rollcfluence@gmail.com'], ['Instagram', 'https://www.instagram.com/rollcfluence_official/'], ['Privacy', '/privacy'], ['Terms', '/terms'], ['Data processing', '/dpa'], ['Acceptable use', '/acceptable-use']] },
  ],
  legal: `© ${new Date().getFullYear()} Rollcfluence. All rights reserved.`,
};
