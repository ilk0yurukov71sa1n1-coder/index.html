import { statement } from '../config/site';
import MaskedHeading from '../components/reactbits/MaskedHeading';
import Reveal from '../components/ui/Reveal';
import './Statement.css';

// Full-width brand statement: the glass-knot veins show through the letters.
export default function Statement({ id }) {
  return (
    <section id={id} className="section statement" aria-label={statement.text}>
      <div className="container">
        <MaskedHeading
          text={statement.text}
          tag="h2"
          src="/media/glass-veins.jpg"
          reveal="scale"
          trigger="view"
          outline
          outlineColor="rgba(79, 16, 18, 0.22)"
          fillScale={1.3}
          parallax={30}
          drift={16}
          brightness={1.05}
          saturation={1.1}
          align="left"
          weight={650}
          tracking={-0.05}
          lineHeight={0.98}
          textScale={0.15}
        />
        <Reveal as="p" className="statement__caption lead" delay={200}>
          {statement.caption}
        </Reveal>
      </div>
    </section>
  );
}
