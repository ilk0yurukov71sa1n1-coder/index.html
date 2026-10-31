# Components

| Component | Source | Licence | Used in |
|---|---|---|---|
| Ferrofluid | React Bits (JS + CSS), https://reactbits.dev | React Bits licence (reactbits.dev) | Cost band background (dark section) |
| PaperCrumple | React Bits (JS + CSS), needs `three` | React Bits licence (reactbits.dev) | Threats demo (crumple the leaked key) |
| ScrollExpand | React Bits (JS + CSS) | React Bits licence (reactbits.dev) | Console reveal |
| MaskedHeading | React Bits (JS + CSS), needs `gsap` | React Bits licence (reactbits.dev) | "Zero keys exposed." statement |
| FlyingButton | React Bits (JS + CSS) | React Bits licence (reactbits.dev) | Early access CTA |
| EdgeGlobe | In-house (`src/components/ui/EdgeGlobe.jsx`), built on `three` | Ours | Edge network section. Free stand-in for the React Bits Pro Globe |
| GhostFibers | React Bits (`src/components/reactbits/GhostFibers.jsx`) | React Bits licence (reactbits.dev) | Fixed site-wide background in logo oxblood |
| DitherVeil | React Bits (`src/components/reactbits/DitherVeil.jsx`, uses `ogl`) | React Bits licence (reactbits.dev) | Hero panel: the RC glass logo photo, dithered in oxblood, revealed by the cursor |
| SwarmCursor | React Bits (`src/components/reactbits/SwarmCursor.jsx`) | React Bits licence (reactbits.dev) | "Why teams start" section, oxblood swarm behind the cards |
| DodgeField | React Bits (`src/components/reactbits/DodgeField.jsx`, uses `motion`) | React Bits licence (reactbits.dev) | Cost band: the leaked key that dodges and ends "Key revoked" |
| LatticeLoader | React Bits (`src/components/reactbits/LatticeLoader.jsx`) | React Bits licence (reactbits.dev) | Signup form and chat helper sending states |
| SpringCheck | React Bits (`src/components/reactbits/SpringCheck.jsx`, uses `motion` + `@hugeicons/core-free-icons`) | React Bits licence (reactbits.dev) | "Get started" setup checklist |
| SpecularButton | React Bits (`src/components/reactbits/SpecularButton.jsx`, WebGL2) | React Bits licence (reactbits.dev) | Hero primary CTA and the "This is only the beginning" CTA, oxblood glass |
| OptionWheel | React Bits (`src/components/reactbits/OptionWheel.jsx`) | React Bits licence (reactbits.dev) | Signup form: "What do you want Shield to do first?" goal picker |
| LogoLoop | React Bits (`src/components/reactbits/LogoLoop.jsx`) | React Bits licence (reactbits.dev) | Providers strip under the hero |
| Timeline | 21st.dev (Hyperiux), ported from TSX/Tailwind to `src/components/ui/Timeline.jsx` + plain CSS, uses `gsap` | 21st.dev component licence | History section: 2022 to today on top, goals underneath |
| CrystalizedBall | React Bits (`src/components/reactbits/CrystalizedBall.jsx`, uses `ogl`) | React Bits licence (reactbits.dev) | Vision band ("This is only the beginning") |
| FlexCarousel | React Bits (`src/components/reactbits/FlexCarousel.jsx`, uses `ogl`) | React Bits licence (reactbits.dev) | Savings report section: a stack of paper covers (`public/media/papers/`, made by `design-src/library/covers.mjs`) |

Component files in `src/components/reactbits/` are kept exactly as delivered so they can be swapped or updated. All brand styling happens through props and section CSS.
