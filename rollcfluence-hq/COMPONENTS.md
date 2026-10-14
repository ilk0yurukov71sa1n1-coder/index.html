# Components

Visual components used in HQ, where they came from, and how to update them.

All React Bits components are copied unchanged from the TypeScript + plain CSS versions in the React Bits repository (`src/ts-default/`), into `components/bits/<Name>/`.
**License:** MIT + Commons Clause, © David Haz. Using them in HQ and in client projects is allowed; selling or redistributing the components themselves is not. Each file keeps that notice at the top.
They are wrapped in `components/fx.tsx`, which applies the Rollcfluence colours, turns effects off when macOS "Reduce motion" is on, and pauses the background when the tab is hidden.

| Component | Used for | Source | Extra package | Install / update command |
|---|---|---|---|---|
| Aurora | Moving background on Today (one WebGL background per screen) | https://reactbits.dev/backgrounds/aurora | none | `npx shadcn@latest add @react-bits/Aurora-TS-CSS` |
| BlurText | Page headlines fade in from a blur | https://reactbits.dev/text-animations/blur-text | `motion` | `npx shadcn@latest add @react-bits/BlurText-TS-CSS` |
| ShinyText | "Rollcfluence HQ" in the sidebar | https://reactbits.dev/text-animations/shiny-text | none | `npx shadcn@latest add @react-bits/ShinyText-TS-CSS` |
| SpotlightCard | Stat cards with a glow that follows the mouse | https://reactbits.dev/components/spotlight-card | none | `npx shadcn@latest add @react-bits/SpotlightCard-TS-CSS` |
| CountUp | Big numbers count up | https://reactbits.dev/text-animations/count-up | `motion` | `npx shadcn@latest add @react-bits/CountUp-TS-CSS` |
| StarBorder | Main action buttons (light travels around the border) | https://reactbits.dev/animations/star-border | none | `npx shadcn@latest add @react-bits/StarBorder-TS-CSS` |
| ClickSpark | Sparks where you click | https://reactbits.dev/animations/click-spark | none | `npx shadcn@latest add @react-bits/ClickSpark-TS-CSS` |

Built for HQ (no install): the Cmd+K command palette and shortcuts (`components/CommandPalette.tsx`), page transitions (browser view transitions + CSS), staggered list fade-ins (CSS).

21st.dev installs used: **0**.

**Updating a component:** run its command above from the `rollcfluence-hq` folder (it needs internet), move the files into `components/bits/<Name>/`, and put the license header back at the top. The `@ts-nocheck` line keeps HQ's extra-strict TypeScript settings from flagging the vendor's own code; HQ code that uses the component is still fully checked.
