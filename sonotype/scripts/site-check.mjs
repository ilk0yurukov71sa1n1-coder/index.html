#!/usr/bin/env node
// Rollcfluence client-site check, part 1: static.
// Reads a built site (vercel.json + output folder) and checks the baseline every
// site we sell must meet: security headers, page basics, honesty rules, legal links,
// forms, third-party code and leaked secrets. No dependencies.
//
//   node scripts/site-check.mjs [projectDir] [--out dist]
//
// Exit code 1 when any FAIL is found, so it can gate a deploy.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--')) || '.';
const outIdx = args.indexOf('--out');
const outDir = join(dir, outIdx > -1 ? args[outIdx + 1] : 'dist');

const results = [];
const add = (level, area, msg) => results.push({ level, area, msg });
const pass = (a, m) => add('PASS', a, m);
const warn = (a, m) => add('WARN', a, m);
const fail = (a, m) => add('FAIL', a, m);

// ---------- 1. Security headers (vercel.json) ----------
const vjPath = join(dir, 'vercel.json');
const redirected = new Set();
if (!existsSync(vjPath)) {
  fail('headers', 'no vercel.json, so no security headers are sent');
} else {
  const vj = JSON.parse(readFileSync(vjPath, 'utf8'));
  for (const r of vj.redirects || []) redirected.add(r.source === '/' ? '/index.html' : r.source);
  const global = (vj.headers || []).find((h) => h.source === '/(.*)');
  const H = Object.fromEntries((global?.headers || []).map((h) => [h.key.toLowerCase(), h.value]));
  const need = {
    'content-security-policy': 'Content-Security-Policy',
    'strict-transport-security': 'Strict-Transport-Security',
    'x-content-type-options': 'X-Content-Type-Options',
    'referrer-policy': 'Referrer-Policy',
    'permissions-policy': 'Permissions-Policy',
  };
  for (const [k, name] of Object.entries(need)) {
    H[k] ? pass('headers', `${name} set`) : fail('headers', `${name} missing on /(.*)`);
  }
  if (!H['x-frame-options'] && !/frame-ancestors/.test(H['content-security-policy'] || '')) {
    fail('headers', 'page can be framed (no X-Frame-Options or frame-ancestors): clickjacking');
  }
  const csp = H['content-security-policy'] || '';
  const directive = (n) => (csp.match(new RegExp(`(?:^|;)\\s*${n}\\s+([^;]*)`)) || [])[1] || '';
  const scriptSrc = directive('script-src') || directive('default-src');
  if (csp) {
    /'unsafe-inline'/.test(scriptSrc) ? fail('csp', "script-src allows 'unsafe-inline' (XSS risk)") : pass('csp', 'no inline scripts allowed');
    /'unsafe-eval'/.test(scriptSrc) ? fail('csp', "script-src allows 'unsafe-eval'") : pass('csp', 'no eval allowed');
    /(^|\s)(\*|https:|http:)(\s|$)/.test(scriptSrc) ? fail('csp', 'script-src allows any host') : null;
    directive('object-src').includes("'none'") ? pass('csp', 'object-src none') : warn('csp', "object-src should be 'none'");
    directive('base-uri') ? pass('csp', 'base-uri set') : warn('csp', 'base-uri not set');
    const hosts = (scriptSrc.match(/https:\/\/[^\s]+/g) || []);
    if (hosts.length) warn('third-party', `scripts allowed from: ${hosts.join(', ')} (list them in the privacy page if they get visitor data)`);
  }
  const hsts = H['strict-transport-security'] || '';
  const maxAge = +(hsts.match(/max-age=(\d+)/) || [])[1] || 0;
  if (hsts && maxAge < 31536000) warn('headers', 'HSTS max-age under 1 year');
  if (vj.cleanUrls === false) warn('headers', 'cleanUrls disabled');
}

// ---------- 2. Walk the build ----------
if (!existsSync(outDir)) {
  fail('build', `no build folder at ${outDir}: run the build first`);
  report();
}
const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    statSync(p).isDirectory() ? walk(p) : files.push(p);
  }
})(outDir);
const rel = (p) => '/' + relative(outDir, p);
const html = files.filter((f) => extname(f) === '.html');
const text = files.filter((f) => ['.html', '.js', '.css', '.json', '.txt', '.xml'].includes(extname(f)));

// Leaked secrets and source maps
const secretPatterns = [
  [/sk_live_[0-9a-zA-Z]{10,}/, 'Stripe live secret key'],
  [/sk_test_[0-9a-zA-Z]{10,}/, 'Stripe test secret key'],
  [/whsec_[0-9a-zA-Z]{10,}/, 'Stripe webhook secret'],
  [/sb_secret_[0-9a-zA-Z_-]{10,}/, 'Supabase secret key'],
  [/re_[0-9a-zA-Z]{8,}_[0-9a-zA-Z]{8,}/, 'Resend API key'],
  [/sk-ant-[0-9a-zA-Z_-]{10,}/, 'Anthropic API key'],
  [/sk-(proj-)?[0-9a-zA-Z]{20,}/, 'OpenAI-style API key'],
  [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
];
let leaked = 0;
for (const f of text) {
  const s = readFileSync(f, 'utf8');
  for (const [re, name] of secretPatterns) {
    if (re.test(s)) { fail('secrets', `${name} pattern in ${rel(f)}`); leaked++; }
  }
  // service_role JWT: decode payloads of JWT-looking strings
  for (const jwt of s.match(/eyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]{10,}/g) || []) {
    try {
      const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
      if (payload.role === 'service_role') { fail('secrets', `Supabase service_role key in ${rel(f)}`); leaked++; }
    } catch {}
  }
}
if (!leaked) pass('secrets', `no known secret patterns in ${text.length} public files`);
const maps = files.filter((f) => f.endsWith('.map'));
maps.length ? warn('secrets', `${maps.length} source map(s) published (show original code)`) : pass('secrets', 'no source maps published');

// ---------- 3. Per page ----------
const strip = (s) => s.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
const visibleText = (s) => strip(s).replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ');
const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u;
const fakeWords = /\b(trusted by \d|[0-9][0-9,.]*\+ (happy )?(clients|customers|users)|#1 |best in (the )?world|guaranteed results|as seen on)\b/i;
const aiBadge = /made with (ai|claude|chatgpt|lovable|v0|bolt)|built with ai/i;

for (const f of html) {
  const s = readFileSync(f, 'utf8');
  const p = rel(f);
  if (redirected.has(p)) { pass('page', `${p} is redirected, not served`); continue; }
  const isLegal = /privacy|terms|dpa|cookie|refund|legal/.test(p);
  const t = visibleText(s);

  /<html[^>]*\blang=/.test(s) ? null : fail('page', `${p}: <html> has no lang`);
  /<title>[^<]{3,}<\/title>/.test(s) ? null : fail('page', `${p}: no <title>`);
  /name="viewport"/.test(s) ? null : fail('page', `${p}: no viewport meta (breaks phones)`);
  /name="description"/.test(s) ? null : warn('page', `${p}: no meta description`);
  /rel="(icon|shortcut icon)"/.test(s) ? null : fail('page', `${p}: no favicon link`);

  // images
  for (const img of s.match(/<img\b[^>]*>/gi) || []) {
    if (!/\balt=/.test(img)) fail('a11y', `${p}: image without alt: ${img.slice(0, 90)}`);
  }
  // inputs need a label or aria-label
  for (const inp of s.match(/<(input|select|textarea)\b[^>]*>/gi) || []) {
    if (/type="(hidden|submit|button)"/.test(inp)) continue;
    const id = (inp.match(/\bid="([^"]+)"/) || [])[1];
    const labelled = /aria-label(ledby)?=/.test(inp) || (id && new RegExp(`for="${id}"`).test(s));
    if (!labelled) {
      // also accept an input wrapped in <label>…</label>
      const wrapped = new RegExp(`<label\\b[^>]*>(?:(?!</label>)[\\s\\S])*${inp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(s);
      if (!wrapped) fail('a11y', `${p}: form field without label: ${inp.slice(0, 80)}`);
    }
  }
  // links
  for (const a of s.match(/<a\b[^>]*target="_blank"[^>]*>/gi) || []) {
    if (!/rel="[^"]*noopener/.test(a)) warn('security', `${p}: target=_blank without rel=noopener`);
  }
  for (const m of s.match(/(src|href)="http:\/\/[^"]+"/gi) || []) fail('security', `${p}: insecure http:// resource ${m}`);
  // inline scripts / handlers (blocked by a strict CSP anyway, but a sign of risk)
  if (/\son(click|load|error|submit|mouseover)=/i.test(s)) warn('security', `${p}: inline event handler (on…=) attribute`);
  // third-party scripts
  for (const m of s.match(/<script\b[^>]*src="https?:\/\/[^"]+"/gi) || []) warn('third-party', `${p}: external script ${m.match(/https?:\/\/[^"]+/)[0]}`);
  if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(s)) warn('legal', `${p}: Google Fonts loaded from Google (visitor IP goes to Google, an EU court fined this): self-host the fonts`);
  if (/googletagmanager|google-analytics|connect\.facebook|hotjar|clarity\.ms|tiktok/i.test(s)) {
    fail('legal', `${p}: tracking script found: needs a cookie consent banner before it loads`);
  }
  // honesty and house rules
  if (!isLegal && t.includes('—')) fail('copy', `${p}: em dash in visible text`);
  if (emoji.test(t)) fail('copy', `${p}: emoji in visible text`);
  if (fakeWords.test(t)) warn('honesty', `${p}: claim to verify: "${t.match(fakeWords)[0]}"`);
  if (aiBadge.test(t)) fail('copy', `${p}: "made with AI" style badge`);
  if (/aggregateRating|"reviewCount"/.test(s)) warn('honesty', `${p}: review stars in structured data: must be real reviews`);
  // legal links on every non-legal page
  if (!isLegal) {
    /href="[^"]*privacy/.test(s) ? null : fail('legal', `${p}: no link to the privacy page`);
    /href="[^"]*terms/.test(s) ? null : fail('legal', `${p}: no link to the terms page`);
  }
  // forms
  for (const form of s.match(/<form\b[\s\S]*?<\/form>/gi) || []) {
    const collects = /type="(email|tel)"|name="(email|phone|name)"/i.test(form);
    if (!collects) continue;
    /privacy/i.test(form) || /consent|съглас/i.test(form) ? null : warn('legal', `${p}: form collects personal data with no privacy notice next to it`);
    /type="checkbox"[^>]*checked/i.test(form) ? fail('legal', `${p}: pre-ticked checkbox in a form (consent must be opt-in)`) : null;
    /hp_|honeypot|name="website"|tabindex="-1"/i.test(form) ? null : warn('abuse', `${p}: form has no bot trap (honeypot)`);
  }
}

// required pages
const has = (re) => html.some((f) => re.test(rel(f)));
has(/privacy/) ? pass('legal', 'privacy page exists') : fail('legal', 'no privacy page');
has(/terms/) ? pass('legal', 'terms page exists') : fail('legal', 'no terms page');
has(/404/) ? pass('page', '404 page exists') : warn('page', 'no custom 404 page');
existsSync(join(outDir, 'robots.txt')) ? pass('page', 'robots.txt exists') : warn('page', 'no robots.txt');

// weight
const big = files.filter((f) => /\.(jpe?g|png|gif)$/i.test(f) && statSync(f).size > 400 * 1024);
for (const f of big) warn('speed', `${rel(f)} is ${(statSync(f).size / 1024 | 0)} KB: convert to WebP/AVIF or resize`);
const js = files.filter((f) => f.endsWith('.js')).reduce((n, f) => n + statSync(f).size, 0);
js > 600 * 1024 ? warn('speed', `JavaScript total ${(js / 1024) | 0} KB (aim under 600 KB)`) : pass('speed', `JavaScript total ${(js / 1024) | 0} KB`);

report();

function report() {
  const order = { FAIL: 0, WARN: 1, PASS: 2 };
  results.sort((a, b) => order[a.level] - order[b.level]);
  for (const r of results) console.log(`${r.level.padEnd(4)}  ${r.area.padEnd(11)} ${r.msg}`);
  const n = (l) => results.filter((r) => r.level === l).length;
  console.log(`\n${n('FAIL')} fail, ${n('WARN')} warn, ${n('PASS')} pass`);
  process.exit(n('FAIL') ? 1 : 0);
}
