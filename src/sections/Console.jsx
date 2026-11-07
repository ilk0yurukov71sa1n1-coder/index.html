import { console_ as copy } from '../config/site';
import ScrollExpand from '../components/reactbits/ScrollExpand';
import SectionHeading from '../components/ui/SectionHeading';
import './Console.css';

export default function Console({ id }) {
  return (
    <section id={id} className="console">
      <div className="container console__head">
        <SectionHeading index={copy.index} label={copy.label} title={copy.title} />
      </div>
      <ScrollExpand
        src="/media/console.png"
        alt="The Rollcfluence Shield console: requests, blocked threats, spend and latency"
        scrollHint={copy.scrollHint}
        startWidth={58}
        startHeight={56}
        startRadius={20}
        endRadius={0}
        mediaZoom={1.18}
        scrollDistance={1.2}
        holdDistance={0.4}
        overlayScrim={0.9}
        useWindowScroll
      >
        <div className="console__overlay container">
          <h3>{copy.overlayTitle}</h3>
          <p>{copy.overlayBody}</p>
        </div>
      </ScrollExpand>
    </section>
  );
}
