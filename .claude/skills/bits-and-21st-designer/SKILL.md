---
name: bits-and-21st-designer
description: Use whenever Ilko builds anything with a visual design in React (site, landing page, section, dashboard, UI). Interviews him in depth, then picks and installs free React Bits and 21st.dev components.
---

# Bits + 21st Designer

Build designs from free, ready-made components — React Bits first, 21st.dev second — and never write a line of UI before a full interview is done.

## Golden rules

1. **Interview first. Always.** No code, no installs, no file creation until every round below is answered (or Ilko says "you pick" for a round).
2. **Free only.** Skip React Bits Pro and anything on 21st that needs a paid plan.
3. **React Bits is the default source** — free, unlimited CLI installs.
4. **21st.dev free accounts get only 2 code retrievals/copies/installs per day total** (web, CLI and MCP combined). Spend them only on things React Bits doesn't have (navbars, pricing, footers, forms, auth, testimonials, full heroes). Tell Ilko before using one: "This uses 1 of your 2 free 21st installs today."
5. **Plain shadcn/ui basics** (button, card, tabs, dialog, input…) never go through 21st — install them free with `npx shadcn@latest add <name>`.
6. **Light on the laptop.** Max one WebGL/canvas-heavy background per page, lazy-load heavy parts, respect `prefers-reduced-motion`.
7. **Ilko is learning.** Every command is copy-paste ready, one per code block, in the order to run them, with one line saying what it does.

## Step 1 — The interview

Use `AskUserQuestion` (max 4 questions per call, multiple rounds). If that tool is missing, ask in plain text one round at a time. Always offer a recommended option first. Wait for answers before the next round. Adapt later rounds to earlier answers — skip questions already answered.

**Round 1 — The project**
- What are we building? (landing page / full multi-page site / single section for an existing site / dashboard or app UI)
- Who is it for? (Rollcfluence / a client business / personal brand / experiment)
- New project or existing one? (if existing: Vite or Next.js, and does it already have Tailwind + shadcn `components.json`?)
- Language + styling? (TypeScript + Tailwind recommended / TS + CSS / JS + Tailwind / JS + CSS) → this sets the React Bits variant suffix: `-TS-TW`, `-TS-CSS`, `-JS-TW`, `-JS-CSS`

**Round 2 — Look and feel**
- Mood? (dark premium / clean minimal / bold playful / futuristic tech) — multiSelect allowed
- Colours? (Rollcfluence off-black + purple-red / client brand colours — ask for hex codes / pick for me / I'll describe)
- Light, dark, or both?
- Any reference sites or screenshots to match the vibe? (free text — ask him to paste links or attach images)

**Round 3 — Sections** (multiSelect)
- Which sections? Hero, navbar, features, services, showcase/portfolio, testimonials, pricing, FAQ, CTA, contact/booking form, footer, stats/counters, logo marquee.
- What's the ONE action a visitor should take? (book / buy / contact / sign up / follow)
- Is the copy ready, or should I write placeholder text?
- Images/logo/3D renders available? (attached / use placeholders)

**Round 4 — Motion and performance**
- How much animation? (subtle polish / noticeable wow moments / maximum show-off)
- Animated background? (yes WebGL e.g. Aurora/Particles/Silk / CSS-only light gradient / none)
- Mostly viewed on? (phone / desktop / both equally) — phones get lighter effects
- Text effects on headlines? (yes split/blur/scramble reveal / no)

**Round 5 — Component picks (per section)**
For each chosen section, research candidates (see Step 2), then ask Ilko to choose between 2–3 options per section, each with name, source, live preview link, and a one-line "why". Mark which ones cost a 21st install.

**Round 6 — Confirm the plan**
Show a short table: section → component → source → cost (free / 1 of 2 daily 21st installs). Ask "Build this?" Only then continue.

## Step 2 — Finding components

**React Bits** (reactbits.dev — browse index at https://reactbits.dev/get-started/index). Four categories: Text Animations, Animations, Components, Backgrounds. Good defaults to suggest:
- Headlines: SplitText, BlurText, ShinyText, GradientText, DecryptedText, RotatingText
- Backgrounds: Aurora, Silk, Particles, Threads, Galaxy, Squares, Iridescence
- Components: SpotlightCard, TiltedCard, Dock, InfiniteMenu, FlowingMenu, Stack, CircularGallery
- Animations: FadeContent, AnimatedContent, ClickSpark, Magnet, CountUp

Verify a name exists on the site before suggesting it — names change.

**21st.dev** — browse for free via markdown pages (don't pull code until Ilko picks):
- Category list: `https://21st.dev/community/components/s/<tag>.md` — tags: hero, features, cta, pricing-section, testimonials, navigation, footer, form, login, card, button, background, text-animation, marquee, carousel, dashboard, chart
- Component page: `https://21st.dev/@<author>/components/<slug>.md` (shows license, deps, live preview, install command)
- Check the License line. Prefer `mit`. Flag `unknown` licenses for client work.

## Step 3 — Project setup (only if new)

Vite + React + TypeScript + Tailwind v4 + shadcn.

Create the project:
```bash
npm create vite@latest my-site -- --template react-ts
```

Go into it and install:
```bash
cd my-site && npm install
```

Add Tailwind:
```bash
npm install tailwindcss @tailwindcss/vite
```

Then: add `@import "tailwindcss";` to `src/index.css`, add the `tailwindcss()` plugin and `@` path alias in `vite.config.ts`, add `"baseUrl": ".", "paths": {"@/*": ["./src/*"]}` to `tsconfig.json` and `tsconfig.app.json`, `npm i -D @types/node`.

Set up shadcn:
```bash
npx shadcn@latest init
```

If any step differs from the current shadcn Vite docs (https://ui.shadcn.com/docs/installation/vite), follow the docs and tell Ilko what changed.

## Step 4 — Installing

**React Bits** (free, unlimited). Swap the name and the variant suffix from Round 1:
```bash
npx shadcn@latest add @react-bits/SplitText-TS-TW
```

**21st.dev** (needs a free API key from https://21st.dev/mcp):
- Ilko sets it once in his terminal: `export API_KEY_21ST=his_key` (or puts it in `.env.local`). Never paste the key into code, chat, or git. Make sure `.env*` is in `.gitignore`.

Install one 21st component (uses 1 of 2 free daily installs):
```bash
npx shadcn@latest add "https://21st.dev/r/<author>/<slug>?api_key=$API_KEY_21ST"
```

If he's out of free installs for today: offer a React Bits / plain shadcn alternative, or wait until tomorrow — never work around the limit.

## Step 5 — Assembling

- Put each section in its own file under `src/components/sections/`.
- Wire components with his colours (CSS variables in `index.css`), real copy, and his images.
- Wrap heavy backgrounds in `React.lazy` + `Suspense`; pause/hide them on small screens if he chose phone-first.
- Respect `prefers-reduced-motion` for all big animations.
- Write `COMPONENTS.md` in the project root: each component, its source URL, license, and install command — so he can rebuild or swap later.

## Step 6 — Check before saying done

- Run `npm run build` — it must pass with no errors.
- Run `npm run dev` and look at it (screenshot via browser if available) at desktop and phone widths.
- Report: what was built, which 21st installs were used today, and the one command to run it: `npm run dev`.
