// ─────────────────────────────────────────────────────────────
// Page order. To add a section: create src/sections/MySection.jsx,
// import it here and add one line to the list. To hide one,
// comment its line out. To reorder, move the lines.
// ─────────────────────────────────────────────────────────────
import Hero from '../sections/Hero';
import Providers from '../sections/Providers';
import Threats from '../sections/Threats';
import Research from '../sections/Research';
import Console from '../sections/Console';
import Statement from '../sections/Statement';
import HowItWorks from '../sections/HowItWorks';
import Network from '../sections/Network';
import Features from '../sections/Features';
import Pricing from '../sections/Pricing';
import Faq from '../sections/Faq';
import Access from '../sections/Access';

export const sections = [
  { id: 'top', Component: Hero }, //               Ferrofluid panel
  { id: 'providers', Component: Providers }, //    provider marquee
  { id: 'threats', Component: Threats }, //        PaperCrumple demo
  { id: 'research', Component: Research }, //    cited studies
  { id: 'console', Component: Console }, //        ScrollExpand dashboard
  { id: 'statement', Component: Statement }, //    MaskedHeading
  { id: 'how', Component: HowItWorks }, //         code diff
  { id: 'network', Component: Network }, //        dotted globe
  { id: 'features', Component: Features }, //      bento grid
  { id: 'pricing', Component: Pricing },
  { id: 'faq', Component: Faq },
  { id: 'access', Component: Access }, //          FlyingButton + signup form
];
