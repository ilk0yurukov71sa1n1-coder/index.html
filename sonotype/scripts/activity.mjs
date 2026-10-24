// Writes studio/activity.json: how many changes were committed to this
// repository (the studio site, Rollcfluence Shield and the tools around them)
// on each day, read straight from git. Run before a deploy to refresh it:
//   node scripts/activity.mjs
// Commits older than the first Rollcfluence commit are unrelated test files.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FIRST = '2026-10-16';
const log = execFileSync('git', ['log', '--all', '--no-merges', '--format=%ad', '--date=short'], { encoding: 'utf8' });
const counts = {};
for (const d of log.split('\n')) if (d && d >= FIRST) counts[d] = (counts[d] ?? 0) + 1;
const days = Object.keys(counts).sort().map((date) => ({ date, count: counts[date] }));
const today = new Date().toISOString().slice(0, 10);
const out = { source: 'git history of this repository', since: FIRST, updated: today, days };
writeFileSync(resolve(import.meta.dirname, '../studio/activity.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`${days.length} days, ${days.reduce((a, d) => a + d.count, 0)} commits, updated ${today}`);
