// Fails the build if anything that looks like a real secret ends up in the public bundle.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'dist';
const PATTERNS = [
  ['OpenAI / Anthropic key', /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}/],
  ['Stripe live key', /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const textFiles = walk(DIR).filter((f) => /\.(js|mjs|css|html|json|txt|map|svg)$/.test(f));
const found = [];
for (const file of textFiles) {
  const text = readFileSync(file, 'utf8');
  for (const [label, re] of PATTERNS) if (re.test(text)) found.push(`${label} in ${file}`);
}

if (found.length) {
  console.error('\n✗ Possible secrets in the public build:\n  ' + found.join('\n  '));
  process.exit(1);
}
console.log(`✓ Secret scan: ${textFiles.length} files clean`);
