// One-click rule sets for common situations. Each one only changes settings
// the gateway already enforces on every request (see api/dash.js limitsPatch).
const inDays = (d) => new Date(Date.now() + d * 864e5).toISOString();

export const RULES = [
  {
    id: 'safe',
    title: 'Safe start',
    when: 'Any new key, before it goes into an app.',
    does: '$10 a day, $100 a month, 60 requests a minute, 4,096 output tokens, injection filter and auto-lock on.',
    patch: () => ({ daily_cap_usd: 10, monthly_cap_usd: 100, rpm_limit: 60, max_tokens: 4096, injection_filter: true, auto_lock: true }),
  },
  {
    id: 'public',
    title: 'Public chatbot',
    when: 'Strangers type the prompts: a chat widget, a support bot, a free tool.',
    does: '$5 a day, $50 a month, 30 requests a minute, 1,024 output tokens, injection filter, PII masking and auto-lock on.',
    patch: () => ({ daily_cap_usd: 5, monthly_cap_usd: 50, rpm_limit: 30, max_tokens: 1024, injection_filter: true, pii_redaction: true, auto_lock: true }),
  },
  {
    id: 'personal',
    title: 'Personal data',
    when: 'Prompts can contain names, emails, phone numbers or card numbers.',
    does: 'PII masking, injection filter and auto-lock on. Your caps stay as they are.',
    patch: () => ({ pii_redaction: true, injection_filter: true, auto_lock: true }),
  },
  {
    id: 'server',
    title: 'Server only',
    when: 'Only your own backend calls the AI, never a browser or phone.',
    does: '120 requests a minute, 4,096 output tokens, injection filter and auto-lock on.',
    next: 'Finish it by adding your server IPs to the key under Keys. Then a stolen copy is useless anywhere else.',
    patch: () => ({ rpm_limit: 120, max_tokens: 4096, injection_filter: true, auto_lock: true }),
  },
  {
    id: 'test',
    title: 'Testing',
    when: 'A prototype, a demo or a key you share with a freelancer.',
    does: '$1 a day, $10 a month, 20 requests a minute, 1,024 output tokens, and the key expires in 14 days.',
    patch: () => ({ daily_cap_usd: 1, monthly_cap_usd: 10, rpm_limit: 20, max_tokens: 1024, expires_at: inDays(14), injection_filter: true, auto_lock: true }),
  },
  {
    id: 'flood',
    title: 'Runaway loop or bot flood',
    when: 'Spend or requests suddenly jump and you are not sure why.',
    does: '10 requests a minute and $2 a day until you find the cause. Auto-lock on.',
    patch: () => ({ rpm_limit: 10, daily_cap_usd: 2, auto_lock: true }),
  },
  {
    id: 'leak',
    title: 'Key may have leaked',
    when: 'The key showed up in a repo, a screenshot, a log or a chat.',
    does: 'Locks the key now. Every request is refused and nothing reaches your provider.',
    next: 'Then create a new key, put it in your app, and revoke this one under Keys.',
    lock: true,
  },
];
