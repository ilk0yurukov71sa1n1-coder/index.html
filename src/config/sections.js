// ─────────────────────────────────────────────────────────────
// Page order. To add a section: create src/sections/MySection.jsx,
// import it here and add one line to the list. To hide one,
// comment its line out. To reorder, move the lines.
// ─────────────────────────────────────────────────────────────
import Hero from '../sections/Hero';
import Providers from '../sections/Providers';
import Threats from '../sections/Threats';
import Research from '../sections/Research';
import Cost from '../sections/Cost';
import Console from '../sections/Console';
import Why from '../sections/Why';
import Start from '../sections/Start';
import Trust from '../sections/Trust';
import Savings from '../sections/Savings';
import Statement from '../sections/Statement';
import HowItWorks from '../sections/HowItWorks';
import Network from '../sections/Network';
import Features from '../sections/Features';
import Pricing from '../sections/Pricing';
import Faq from '../sections/Faq';
import Compare from '../sections/Compare';
import Story from '../sections/Story';
import Social from '../sections/Social';
import Access from '../sections/Access';

export const sections = [
  { id: 'top', Component: Hero }, //               DitherVeil logo panel
  { id: 'providers', Component: Providers }, //    provider marquee
  { id: 'threats', Component: Threats }, //        PaperCrumple demo
  { id: 'research', Component: Research }, //    cited studies
  { id: 'cost', Component: Cost }, //            Ferrofluid dark band
  { id: 'console', Component: Console }, //        ScrollExpand dashboard
  { id: 'statement', Component: Statement }, //    MaskedHeading
  { id: 'why', Component: Why }, //              SwarmCursor
  { id: 'how', Component: HowItWorks }, //         code diff
  { id: 'start', Component: Start }, //          plain-language steps
  { id: 'network', Component: Network }, //        dotted globe
  { id: 'features', Component: Features }, //      bento grid
  { id: 'trust', Component: Trust }, //          why trust us
  { id: 'savings', Component: Savings }, //      cost calculator
  { id: 'compare', Component: Compare }, //      options table + real bills
  { id: 'pricing', Component: Pricing },
  { id: 'faq', Component: Faq },
  { id: 'story', Component: Story }, //          why we started
  { id: 'instagram', Component: Social }, //    Instagram + QR
  { id: 'access', Component: Access }, //          FlyingButton + signup form
];
