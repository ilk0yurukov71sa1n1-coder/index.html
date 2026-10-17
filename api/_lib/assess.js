// The Shield check: a short questionnaire every new account fills in once.
// Rule-based, no AI: each answer adds known risk points and maps to a Shield
// setting that reduces it. Shared by the API (scoring, storage) and the
// dashboard (questions, report), so both always agree.

export const QUESTIONS = [
  {
    id: 'use',
    q: 'What are you building with AI?',
    options: [
      ['chatbot', 'A chatbot or assistant inside my product'],
      ['internal', 'Internal tools or automations'],
      ['agents', 'AI agents that act on their own'],
      ['testing', 'Just testing for now'],
    ],
  },
  {
    id: 'providers',
    q: 'Which AI providers do you use?',
    options: [
      ['openai', 'OpenAI'],
      ['anthropic', 'Anthropic'],
      ['both', 'Both'],
      ['other', 'Another provider'],
    ],
  },
  {
    id: 'spend',
    q: 'Roughly what is your monthly AI bill?',
    options: [
      ['s', 'Under $50'],
      ['m', '$50 to $500'],
      ['l', '$500 to $5,000'],
      ['xl', 'Over $5,000'],
    ],
  },
  {
    id: 'volume',
    q: 'How many AI requests do you send a month?',
    options: [
      ['v1', 'Under 10,000'],
      ['v2', '10,000 to 200,000'],
      ['v3', '200,000 to 1.25 million'],
      ['v4', '1.25 to 3.5 million'],
      ['v5', 'More than 3.5 million'],
    ],
  },
  {
    id: 'keys',
    q: 'Where do your AI keys live today?',
    options: [
      ['client', 'In a website, mobile app or browser code'],
      ['repo', 'In a .env or config file in the code repository'],
      ['server', 'In server environment variables or a secret manager'],
      ['unsure', 'Not sure'],
    ],
  },
  {
    id: 'callers',
    q: 'Who can trigger an AI request?',
    options: [
      ['public', 'Anyone on the internet, no sign-in'],
      ['customers', 'Our signed-in customers'],
      ['team', 'Only our own team or servers'],
    ],
  },
  {
    id: 'origin',
    q: 'Where do the requests come from?',
    options: [
      ['fixed', 'Our servers with fixed IP addresses'],
      ['cloud', 'Serverless or cloud functions'],
      ['devices', 'Users’ browsers or phones'],
    ],
  },
  {
    id: 'pii',
    q: 'Do prompts include personal data, like names, emails or phone numbers?',
    options: [
      ['yes', 'Yes, often'],
      ['some', 'Sometimes'],
      ['no', 'No'],
    ],
  },
  {
    id: 'incident',
    q: 'Has a key ever leaked, or a bill jumped without warning?',
    options: [
      ['yes', 'Yes'],
      ['unknown', 'I would not know'],
      ['no', 'No'],
    ],
  },
];

const VALID = Object.fromEntries(QUESTIONS.map((x) => [x.id, x.options.map(([v]) => v)]));

// Returns clean answers, or null if anything is missing or unknown.
export const cleanAnswers = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const [id, values] of Object.entries(VALID)) {
    const v = String(raw[id] ?? '');
    if (!values.includes(v)) return null;
    out[id] = v;
  }
  return out;
};

// Monthly and daily caps in dollars, from the bill they told us about.
const CAPS = { s: [60, 5], m: [600, 40], l: [6000, 400], xl: [null, 1500] };
// Plan that covers the volume (same allowances as api/_lib/plans.js).
const PLAN = { v1: 'starter', v2: 'pro', v3: 'team', v4: 'scale', v5: 'business' };
// Requests a minute per key: about 5x the average rate, so bursts still pass.
const RPM = { v1: 20, v2: 30, v3: 150, v4: 400, v5: 1000 };

export const assess = (a) => {
  const risks = [];
  const add = (points, level, title, fix) => risks.push({ points, level, title, fix });

  if (a.keys === 'client') add(35, 'critical', 'A provider key in app or browser code can be copied by anyone who opens it.', 'Move the key into Shield, call Shield from your server, and rotate the old key at your provider today.');
  if (a.keys === 'repo') add(20, 'high', 'Keys in a repository leak through forks, logs and old commits.', 'Store the provider key in Shield and give your code a Shield key with a hard cap instead.');
  if (a.keys === 'unsure') add(12, 'medium', 'Nobody is sure where the keys are, so nobody can tell if one leaked.', 'Put every provider key in Shield, so there is one place to see and revoke them.');
  if (a.callers === 'public') add(20, 'high', 'Anyone can run up your bill by sending requests in a loop.', 'Set a low requests-per-minute limit, a daily cap and a max output tokens ceiling.');
  if (a.callers === 'customers') add(8, 'medium', 'One customer account can be abused to spend for everyone.', 'Send each customer’s ID as the end user so the Live view shows who is spending.');
  if (a.use === 'agents') add(15, 'high', 'Agents can loop on their own and spend all night.', 'Use a daily cap and keep auto-lock on, so a runaway agent stops by itself.');
  if (a.origin === 'devices') add(10, 'medium', 'Requests from devices can come from anywhere in the world.', 'Block countries you do not serve and keep the rate limit tight.');
  if (a.pii === 'yes') add(15, 'high', 'Personal data in prompts leaves your company with every request.', 'Turn on PII masking so emails, phone numbers and cards are replaced before they reach the provider.');
  if (a.pii === 'some') add(8, 'medium', 'Some prompts carry personal data to the provider.', 'Turn on PII masking on the keys that handle customer text.');
  if (a.incident === 'yes') add(15, 'high', 'A key that leaked once is often still in someone’s hands.', 'Rotate every provider key at the provider, then add it to Shield only.');
  if (a.incident === 'unknown') add(8, 'medium', 'Without alerts, a leak shows up only on the invoice.', 'Add an email or Slack alert for blocked requests, cap warnings and locks.');
  if (a.spend === 'xl') add(10, 'medium', 'A large bill means a leak costs thousands before anyone notices.', 'Set a daily cap well under one bad day of spend.');
  if (a.spend === 'l') add(5, 'medium', 'Your bill is big enough for a leak to hurt.', 'Set a daily and a monthly cap on every key.');

  risks.sort((x, y) => y.points - x.points);
  const score = Math.min(100, 10 + risks.reduce((s, r) => s + r.points, 0));
  const grade = score >= 70 ? 'critical' : score >= 45 ? 'high' : score >= 25 ? 'medium' : 'low';
  const [monthly, daily] = CAPS[a.spend];

  return {
    score,
    grade,
    risks,
    plan: PLAN[a.volume],
    settings: {
      monthly_cap_usd: monthly,
      daily_cap_usd: daily,
      rpm_limit: a.callers === 'team' ? Math.max(RPM[a.volume], 60) : RPM[a.volume],
      max_tokens: a.callers === 'public' ? 1000 : null,
      pii_redaction: a.pii !== 'no',
      ip_allowlist: a.origin === 'fixed',
      block_countries: a.origin === 'devices',
      rotate: a.keys === 'client' || a.keys === 'repo' || a.incident === 'yes',
      other_provider: a.providers === 'other',
    },
  };
};
