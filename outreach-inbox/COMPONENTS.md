# Components and design

What Outreach Inbox looks like, where every visual piece came from, and how to update it. Rollcfluence HQ and Automation Health Check use the same system, so all three feel like one product.

## The Oxblood design system

*A private ledger at night:* warm near-black surfaces, bone-white type, and deep blood red kept for the one thing on a screen that matters (the main action, the verdict, focus). Defined once in `app/oxblood.css`, which loads after each app's own stylesheet.

| Role | Tokens |
|---|---|
| Surfaces | `--ink-0` #080606 (page) → `--ink-4` #241e1c, lines `--line` #2a2321 / `--line-strong` #3b302d |
| Type | `--bone` #ede8e0, `--bone-2` #bdb4a9, `--bone-3` #8f857b (all at least 4.5:1 on the page colour) |
| Brand red | `--oxblood` #2b0508, `--blood-deep` #5e0a10, `--blood` #9b0f18, `--blood-bright` #cf2430, `--blood-text` #ea6a66, `--blood-tint` #f2b3ad |
| Status (never the brand red) | `--ok` #7fd09c, `--warn` #e5b45c, `--crit` #ff7466, `--info` #94b6d8, always paired with a word |

**Type:** Fraunces (headlines, big numbers, the client report), Geist (everything you read), Geist Mono (timestamps, verdict stamps, codes). All three are variable fonts stored in `app/fonts/` and served by the app itself: no Google Fonts or other outside requests. Licence: SIL Open Font License 1.1 (`app/fonts/OFL-*.txt`), free for any use including client work.

**Rules the system keeps:** one moving WebGL background per screen at most; every animation switches off when macOS **Reduce motion** is on; moving backgrounds pause when the tab is hidden; screen readers always get the real words and numbers straight away (animated text is drawn for the eyes only); printouts are always on white paper.

## React Bits components

Copied unchanged from the TypeScript + plain CSS versions in the React Bits repository (`src/ts-default/`), into `components/bits/<Name>/`.
**Licence:** MIT + Commons Clause, © David Haz. Using them in this app and in client projects is allowed; selling or redistributing the components themselves is not. Each file keeps that notice at the top.
They are only used through the wrappers in `components/fx.tsx`, which apply the Oxblood colours and the rules above.

| Component | Used for | Source | Extra package | Install / update command |
|---|---|---|---|---|
| Aurora | Moving red light behind the 14-day verdict on the Dashboard | https://reactbits.dev/backgrounds/aurora | none | `npx shadcn@latest add @react-bits/Aurora-TS-CSS` |
| BlurText | Page headlines fade in from a blur | https://reactbits.dev/text-animations/blur-text | `motion` | `npx shadcn@latest add @react-bits/BlurText-TS-CSS` |
| RotatingText | Included for parity with HQ; not on a screen yet | https://reactbits.dev/text-animations/rotating-text | `motion` | `npx shadcn@latest add @react-bits/RotatingText-TS-CSS` |
| DecryptedText | The verdict stamp (PASS / KEEP GOING / FAIL) decodes into place | https://reactbits.dev/text-animations/decrypted-text | `motion` | `npx shadcn@latest add @react-bits/DecryptedText-TS-CSS` |
| CountUp | Big numbers count up | https://reactbits.dev/text-animations/count-up | `motion` | `npx shadcn@latest add @react-bits/CountUp-TS-CSS` |
| ShinyText | "Rollcfluence" in the top bar | https://reactbits.dev/text-animations/shiny-text | none | `npx shadcn@latest add @react-bits/ShinyText-TS-CSS` |
| SpotlightCard | Number cards with a glow that follows the mouse | https://reactbits.dev/components/spotlight-card | none | `npx shadcn@latest add @react-bits/SpotlightCard-TS-CSS` |
| StarBorder | Main action buttons (light travels around the border) | https://reactbits.dev/animations/star-border | none | `npx shadcn@latest add @react-bits/StarBorder-TS-CSS` |
| ClickSpark | Small red sparks where you click | https://reactbits.dev/animations/click-spark | none | `npx shadcn@latest add @react-bits/ClickSpark-TS-CSS` |

Built here (no install): tab transitions (the browser's own View Transitions + CSS).

21st.dev installs used: **0**.

**Updating a component:** run its command above from the `outreach-inbox` folder (it needs internet), move the files into `components/bits/<Name>/`, and put the licence header back at the top. The `@ts-nocheck` line keeps the app's extra-strict TypeScript settings from flagging the vendor's own code; app code that uses the component is still fully checked. Then copy the folder to the other two apps so all three stay identical.
