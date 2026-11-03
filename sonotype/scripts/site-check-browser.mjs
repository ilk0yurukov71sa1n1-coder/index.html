#!/usr/bin/env node
// Rollcfluence client-site check, part 2: in a real browser.
// Opens each page on a phone and a desktop with the vercel.json headers applied,
// then checks what a static scan cannot: blocked or broken resources, console
// errors, text contrast (WCAG AA), keyboard focus, sideways scrolling on phones,
// requests to outside servers, and cookies set without consent.
//
//   npx vite preview --port 5191 &
//   node scripts/site-check-browser.mjs http://localhost:5191 /studio/ /studio/book/ ...
//
// Uses the Playwright that is already on the machine. Exit code 1 on any FAIL.

import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let playwright;
for (const p of ['playwright', '/opt/node-tools/node_modules/playwright']) {
  try { playwright = require(p); break; } catch {}
}
if (!playwright) { console.error('Playwright not found'); process.exit(2); }

const [base = 'http://localhost:5191', ...paths] = process.argv.slice(2);
const pages = paths.length ? paths : ['/studio/'];
const origin = new URL(base).origin;

// Global headers from vercel.json, so CSP problems show up locally too.
const headers = {};
if (existsSync('vercel.json')) {
  const vj = JSON.parse(readFileSync('vercel.json', 'utf8'));
  for (const h of (vj.headers || []).find((x) => x.source === '/(.*)')?.headers || []) {
    if (!/strict-transport|upgrade/i.test(h.key)) headers[h.key] = h.value.replace(/;?\s*upgrade-insecure-requests/, '');
  }
}

const results = [];
const add = (level, area, msg) => results.push({ level, area, msg });

const browser = await playwright.chromium.launch();
for (const vp of [{ name: 'phone', width: 375, height: 760 }, { name: 'desktop', width: 1366, height: 860 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: 'reduce' });
  await ctx.route('**/*', async (route) => {
    const req = route.request();
    if (new URL(req.url()).origin !== origin) return route.continue();
    const res = await route.fetch();
    const isDoc = req.resourceType() === 'document';
    await route.fulfill({ response: res, headers: isDoc ? { ...res.headers(), ...headers } : res.headers() });
  });

  for (const path of pages) {
    const page = await ctx.newPage();
    const tag = `${vp.name} ${path}`;
    const outside = new Set();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => { const o = new URL(r.url()).origin; if (o !== origin && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) outside.add(o); });
    page.on('response', (r) => { if (r.status() >= 400 && new URL(r.url()).origin === origin) errors.push(`${r.status()} ${new URL(r.url()).pathname}`); });

    const res = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 45000 }).catch((e) => { add('FAIL', 'load', `${tag}: ${e.message}`); return null; });
    if (!res) { await page.close(); continue; }
    if (res.status() >= 400) add('FAIL', 'load', `${tag}: HTTP ${res.status()}`);
    await page.waitForTimeout(800);

    for (const e of [...new Set(errors)].slice(0, 8)) add(/Content Security Policy|Refused to/.test(e) ? 'FAIL' : 'WARN', 'console', `${tag}: ${e.slice(0, 160)}`);
    if (!errors.length) add('PASS', 'console', `${tag}: no errors`);
    outside.size ? add('WARN', 'privacy', `${tag}: talks to ${[...outside].join(', ')} (must be in the privacy page)`) : add('PASS', 'privacy', `${tag}: no outside servers`);

    const cookies = await ctx.cookies();
    if (cookies.length) add('FAIL', 'legal', `${tag}: cookies set before any consent: ${cookies.map((c) => c.name).join(', ')}`);

    // sideways scroll on phones
    if (vp.name === 'phone') {
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      over > 1 ? add('FAIL', 'layout', `${tag}: page scrolls sideways by ${over}px`) : add('PASS', 'layout', `${tag}: no sideways scroll`);
    }

    // contrast of visible text (AA: 4.5, large text 3)
    const low = await page.evaluate(() => {
      const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
      const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const bgOf = (el) => {
        for (let n = el; n; n = n.parentElement) {
          const cs = getComputedStyle(n);
          if (cs.backgroundImage !== 'none' || cs.filter !== 'none') return null; // image or effect behind: can't judge
          const c = parse(cs.backgroundColor); if (c && c.a > 0.95) return c;
        }
        return { r: 255, g: 255, b: 255, a: 1 };
      };
      const out = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const seen = new Set();
      while (walker.nextNode()) {
        const el = walker.currentNode.parentElement; const txt = walker.currentNode.textContent.trim();
        if (!el || !txt || seen.has(el)) continue; seen.add(el);
        const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
        if (!r.width || cs.visibility === 'hidden' || +cs.opacity === 0 || el.closest('[aria-hidden="true"],[hidden]')) continue;
        if (el.closest('canvas,svg')) continue;
        const fg = parse(cs.color); const bg = bgOf(el); if (!fg || !bg || fg.a < 0.5) continue;
        const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x); const ratio = (a + 0.05) / (b + 0.05);
        const size = parseFloat(cs.fontSize); const bold = +cs.fontWeight >= 700;
        const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
        if (ratio < need) out.push(`${ratio.toFixed(2)} < ${need}: "${txt.slice(0, 40)}"`);
      }
      return out;
    });
    low.slice(0, 6).forEach((l) => add('WARN', 'contrast', `${tag}: ${l}`));
    if (low.length > 6) add('WARN', 'contrast', `${tag}: ${low.length - 6} more low-contrast texts`);
    if (!low.length) add('PASS', 'contrast', `${tag}: text contrast meets AA where measurable`);

    // keyboard: first 40 tab stops each show a visible focus style
    if (vp.name === 'desktop') {
      let noRing = 0, stops = 0;
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press('Tab');
        const info = await page.evaluate(() => {
          const el = document.activeElement; if (!el || el === document.body) return null;
          const cs = getComputedStyle(el);
          const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
          return { ring, name: el.tagName + (el.textContent || '').trim().slice(0, 20) };
        });
        if (!info) break; stops++; if (!info.ring) noRing++;
      }
      stops === 0 ? add('FAIL', 'keyboard', `${tag}: nothing can be reached with Tab`) :
        noRing ? add('WARN', 'keyboard', `${tag}: ${noRing} of ${stops} tab stops show no focus ring`) :
        add('PASS', 'keyboard', `${tag}: ${stops} tab stops, all with a focus ring`);
    }
    await page.close();
  }
  await ctx.close();
}
await browser.close();

const order = { FAIL: 0, WARN: 1, PASS: 2 };
results.sort((a, b) => order[a.level] - order[b.level]);
for (const r of results) console.log(`${r.level.padEnd(4)}  ${r.area.padEnd(9)} ${r.msg}`);
const n = (l) => results.filter((r) => r.level === l).length;
console.log(`\n${n('FAIL')} fail, ${n('WARN')} warn, ${n('PASS')} pass`);
process.exit(n('FAIL') ? 1 : 0);
