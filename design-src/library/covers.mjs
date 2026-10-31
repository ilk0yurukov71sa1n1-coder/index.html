// Renders one "paper cover" image per study in src/config/site.js (library.papers)
// into public/media/papers/<id>.jpg. Run: node design-src/library/covers.mjs
// Needs Playwright and the Geist fonts from node_modules.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { library } from '../../src/config/site.js';

const font = f => readFileSync(new URL(`../../node_modules/@fontsource-variable/${f}`, import.meta.url)).toString('base64');
const sans = font('geist/files/geist-latin-wght-normal.woff2');
const mono = font('geist-mono/files/geist-mono-latin-wght-normal.woff2');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const page = p => `<!doctype html><html><head><style>
@font-face{font-family:G;src:url(data:font/woff2;base64,${sans})}
@font-face{font-family:M;src:url(data:font/woff2;base64,${mono})}
*{margin:0;box-sizing:border-box}
body{width:900px;height:1200px;background:${p.group === 'loss' ? '#150b0b' : '#fbf9f6'};font-family:G}
.c{position:absolute;inset:0;padding:84px 80px;display:flex;flex-direction:column;color:${p.group === 'loss' ? '#f4f1ec' : '#1e1615'}}
.rule{height:6px;width:120px;background:${p.group === 'loss' ? '#c23a42' : '#7d1d20'};margin-bottom:44px}
.kind{font-family:M;font-size:22px;letter-spacing:.12em;text-transform:uppercase;color:${p.group === 'loss' ? '#e0646b' : '#7d1d20'}}
.venue{font-family:M;font-size:20px;margin-top:14px;opacity:.6;letter-spacing:.04em}
h1{font-size:${p.title.length > 70 ? 46 : 56}px;line-height:1.08;letter-spacing:-.03em;font-weight:600;margin-top:64px}
.stat{margin-top:auto;font-size:${p.stat.length > 11 ? 100 : p.stat.length > 8 ? 120 : 140}px;white-space:nowrap;font-weight:650;letter-spacing:-.05em;line-height:.95;color:${p.group === 'loss' ? '#f4f1ec' : '#7d1d20'}}
.claim{font-size:28px;line-height:1.35;margin-top:22px;opacity:.75;max-width:720px}
.foot{display:flex;justify-content:space-between;margin-top:56px;padding-top:24px;border-top:1px solid currentColor;font-family:M;font-size:18px;letter-spacing:.08em;text-transform:uppercase;opacity:.55}
</style></head><body><div class="c">
<div class="rule"></div><p class="kind">${esc(p.kind)} · ${p.year}</p><p class="venue">${esc(p.venue)}</p>
<h1>${esc(p.title)}</h1>
<p class="stat">${esc(p.stat)}</p><p class="claim">${esc(p.claim)}</p>
<div class="foot"><span>Rollcfluence savings report</span><span>Source linked</span></div>
</div></body></html>`;

const out = new URL('../../public/media/papers/', import.meta.url);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 900, height: 1200 } });
for (const p of library.papers) {
  await tab.setContent(page(p));
  await tab.evaluate(() => document.fonts.ready);
  writeFileSync(new URL(`${p.id}.jpg`, out), await tab.screenshot({ type: 'jpeg', quality: 82 }));
  console.log('cover', p.id);
}
await browser.close();
