import { faq } from '../config/site';
import SectionHeading from '../components/ui/SectionHeading';
import Reveal from '../components/ui/Reveal';
import './Faq.css';

export default function Faq({ id }) {
  return (
    <section id={id} className="section faq">
      <div className="container faq__grid">
        <SectionHeading index={faq.index} label={faq.label} title={faq.title} />
        <div className="faq__list">
          {faq.items.map((item, i) => (
            <Reveal key={item.q} delay={i * 50}>
              <details>
                <summary>
                  {item.q}
                  <span className="faq__icon" aria-hidden="true" />
                </summary>
                <p>{item.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
