import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const [,, file, out, w, h] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
await p.goto('file://' + file);
await p.waitForTimeout(400);
await p.screenshot({ path: out });
await b.close();
