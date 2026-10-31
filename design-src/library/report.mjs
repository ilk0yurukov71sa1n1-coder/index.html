// Writes public/report.html (the savings report) from the same data the
// landing page uses, so the numbers can never drift apart.
// Run: node design-src/library/report.mjs
import { writeFileSync } from 'node:fs';
import { library, market, compare } from '../../src/config/site.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const paper = (p) => `<div class="paper">
<p class="k">${esc(p.kind)} · ${esc(p.venue)} · ${p.year}</p>
<h3>${esc(p.title)}</h3>
<p class="claim"><b>${esc(p.stat)}</b> ${esc(p.claim)}</p>
<p class="fine">Fine print: ${esc(p.caveat)} <a href="${p.href}" target="_blank" rel="noopener noreferrer">Read the source ↗</a></p>
</div>`;
const group = (id) => library.papers.filter((p) => p.group === id).map(paper).join('\n');
const cases = compare.cases;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Savings report · Rollcfluence Shield</title>
<meta name="description" content="What leaked AI keys cost, what the research says you can save on AI, and what Rollcfluence Shield does and does not do. Every number is sourced." />
<meta name="theme-color" content="#f4f1ec" />
<link rel="icon" type="image/png" href="/favicon.png" />
<link rel="stylesheet" href="/pages/pages.css" />
</head>
<body>
<main class="wrap">
<a class="top" href="/"><img src="/logo-rc.png" alt="" width="28" height="28" />rollcfluence</a>
<h1>The AI savings report</h1>
<p class="meta">Rollcfluence research · October 2026 · ${new Set([...library.papers, ...market.stats].map((x) => x.href)).size} sources, all linked</p>

<p class="lead">AI keys are now money. This report collects what independent researchers, providers and journalists have measured about what an unprotected key costs, and what the research says you can save on an AI bill.</p>
<p class="note">How to read it: every number links to where it came from. "Up to" figures are best cases from the source, not averages, and we say so next to each one. Nothing here is a measured result of Rollcfluence Shield itself; Shield is in early access and we will publish our own numbers once we have them.</p>

<div class="figs">
${library.papers.filter((p) => ['register-gemini', 'sysdig-llmjacking', 'frugalgpt', 'semantic-cache'].includes(p.id)).map((p) => `<div class="fig"><b>${esc(p.stat)}</b><span>${esc(p.venue)}, ${p.year}</span></div>`).join('\n')}
</div>

<h2>1. Why this matters now</h2>
<ul>
${market.stats.map((s) => `<li><b>${esc(s.stat)}</b> ${esc(s.text)}${s.note ? ' ' + esc(s.note) : ''} <a href="${s.href}" target="_blank" rel="noopener noreferrer">${esc(s.source)} ↗</a></li>`).join('\n')}
</ul>

<h2>2. What an unprotected key costs</h2>
<p>${esc(library.groups[0].note)}</p>
${group('loss')}

<h2>3. A worked example</h2>
<p>An illustration, not a measurement. A key leaks on a Friday evening and nobody looks until Monday morning, about 2.5 days.</p>
<div class="math">
<p>Without a cap, at Sysdig's worst-case rate:<br/>2.5 days × $46,000 a day ≈ $115,000</p>
<p>With a Shield spend cap you set at, say, $50 a day:<br/>2.5 days × $50 a day = $125 at most</p>
</div>
<p>The real figure depends on the attacker and the models they use. ${esc(cases[0].amount)} ${esc(cases[0].text)} (<a href="${cases[0].href}" target="_blank" rel="noopener noreferrer">${esc(cases[0].source)} ↗</a>). For comparison, the Shield Pro plan is €49 a month.</p>

<h2>4. Proven ways to cut the AI bill</h2>
<p>${esc(library.groups[1].note)}</p>
${group('bill')}

<h2>5. What Shield does, and what it does not</h2>
<ul>
<li>Does: keeps provider keys in a vault, puts hard spend caps and rate limits on every key, screens prompts for injection, masks personal data, fails over to a backup model and logs every request.</li>
<li>Does not today: model routing, response caching or prompt compression (section 4). Those cut the bill; Shield stops the bill from being stolen. They work well together.</li>
<li>Prices: Starter €0, Pro €49 a month, Team €299 a month, excluding VAT. Provider usage is billed by the providers.</li>
</ul>

<h2>6. Limits of this report</h2>
<ul>
<li>Market forecasts come from analyst firms and differ in scope; the Gartner figure is mostly hardware.</li>
<li>Incident costs are reported cases and worst-case estimates. Most leaks are smaller, some are larger.</li>
<li>Research savings were measured on the authors' benchmarks. Your traffic will give different results.</li>
<li>Found an error? Email <a href="mailto:rollcfluence@gmail.com?subject=Savings%20report">rollcfluence@gmail.com</a> and we will fix it.</li>
</ul>

<div class="btnrow">
<a class="btn" href="/#access">Join early access</a>
<a class="btn ghost" href="/#library">Back to the papers</a>
</div>
</main>
</body>
</html>
`;
writeFileSync(new URL('../../public/report.html', import.meta.url), html);
console.log('wrote public/report.html');
