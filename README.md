# Rollcfluence Shield · landing page

Landing page for the Rollcfluence AI API gateway. React + Vite, React Bits components, deployed on Vercel.

## Run it

```bash
npm install
```
```bash
npm run dev
```
Then open http://localhost:5173.

`npm run build` builds to `dist/` and runs a secret scan on the output (the build fails if anything that looks like an API key ends up in the public bundle).

## Where things live

| What you want to change | File |
|---|---|
| Any words, links, prices, FAQ, regions | `src/config/site.js` |
| Section order, add or remove a section | `src/config/sections.js` |
| Brand colours, fonts, spacing | `src/styles/tokens.css` |
| One section's layout | `src/sections/<Name>.jsx` + `.css` |
| React Bits components (untouched copies) | `src/components/reactbits/` |
| Security headers | `vercel.json` |
| Waitlist endpoint | `api/waitlist.js` |
| Artwork sources (console mock, leaked .env sheet) | `design-src/` |

### Adding a new section
1. Create `src/sections/MySection.jsx` (copy any existing section as a starting point).
2. Import it in `src/config/sections.js` and add one line where it should appear.
3. Put its copy in `src/config/site.js`.

## Security baseline (site-shield-lite)
- HTTPS + HSTS, strict Content-Security-Policy, no framing, nosniff, strict referrer, locked-down permissions (`vercel.json`).
- No secrets in client code; `.env*` is git-ignored; build-time secret scan (`scripts/check-secrets.mjs`).
- Fonts self-hosted, no third-party scripts.
- Waitlist API: POST-only, JSON-only, same-origin check, honeypot field, per-IP rate limit, masked logging.
- `/api/` disallowed in `robots.txt`.

The old standalone HTML sites are in `archive/`.
