import { providers } from '../config/site';
import LogoLoop from '../components/reactbits/LogoLoop';
import './Providers.css';

const logos = providers.map((p) => ({
  node: <span className="providers__name">{p}</span>,
  title: p,
  ariaLabel: p,
  hoverColor: '#7d1d20',
}));

// Supported providers on a draggable React Bits LogoLoop.
export default function Providers({ id }) {
  return (
    <section id={id} className="providers" aria-label="Supported providers">
      <p className="providers__label mono container">Live with OpenAI, Anthropic and any OpenAI-compatible API today. Native Cohere, Azure and Bedrock coming next</p>
      <LogoLoop
        logos={logos}
        speed={46}
        hoverSpeed={12}
        direction="left"
        logoHeight={22}
        gap={56}
        focus={0.35}
        muted={0.35}
        scaleOnHover
        fadeOut
        fadeOutWidth={0.14}
        ariaLabel="AI providers Rollcfluence Shield works with"
        className="providers__loop"
      />
    </section>
  );
}
