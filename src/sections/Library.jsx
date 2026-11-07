import { useState } from 'react';
import { library } from '../config/site';
import SectionHeading from '../components/ui/SectionHeading';
import Reveal from '../components/ui/Reveal';
import LazyMount from '../components/ui/LazyMount';
import FlexCarousel from '../components/reactbits/FlexCarousel';
import './Library.css';

const isSmall = typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;

const items = library.papers.map((p) => ({
  src: `/media/papers/${p.id}.jpg`,
  alt: `${p.title}, ${p.venue}, ${p.year}: ${p.stat} ${p.claim}`,
  title: p.title,
  subtitle: `${p.venue} · ${p.year}`,
}));

const groupOf = (id) => library.groups.find((g) => g.id === id);

// The savings report as a stack of paper covers (FlexCarousel), the details of
// the paper in the middle, and the full sourced list underneath.
export default function Library({ id }) {
  const [active, setActive] = useState(0);
  const paper = library.papers[active];

  return (
    <section id={id} className="section library">
      <div className="container">
        <SectionHeading index={library.index} label={library.label} title={library.title}>
          {library.body}
        </SectionHeading>
      </div>

      <Reveal className="library__stage" delay={80}>
        <LazyMount className="library__carousel">
          <FlexCarousel
            items={items}
            preset="liquid"
            intro="rise"
            fit="portrait"
            cardHeight={isSmall ? 0.6 : 0.66}
            gap={isSmall ? 10 : 16}
            radius={12}
            squeeze={0.15}
            focusOnClick
            captions={false}
            onChange={(i) => setActive(i)}
          />
        </LazyMount>
      </Reveal>

      <div className="container">
        <div className="library__now" aria-live="polite">
          <p className="library__group mono">
            {String(active + 1).padStart(2, '0')} / {String(library.papers.length).padStart(2, '0')} · {groupOf(paper.group).title}
          </p>
          <p className="library__claim">
            <strong>{paper.stat}</strong> {paper.claim}
          </p>
          <p className="library__caveat">Fine print: {paper.caveat}</p>
          <a className="library__open" href={paper.href} target="_blank" rel="noopener noreferrer">
            Open the source: {paper.venue}, {paper.year} <span aria-hidden="true">↗</span>
          </a>
        </div>

        <div className="library__lists">
          {library.groups.map((g) => (
            <Reveal key={g.id} className="library__list" delay={60}>
              <h3>{g.title}</h3>
              <p className="library__note">{g.note}</p>
              <ol>
                {library.papers
                  .filter((p) => p.group === g.id)
                  .map((p) => (
                    <li key={p.id}>
                      <a href={p.href} target="_blank" rel="noopener noreferrer">
                        <span className="library__stat">{p.stat}</span>
                        <span className="library__title">{p.title}</span>
                        <span className="library__meta mono">
                          {p.kind} · {p.venue} · {p.year}
                        </span>
                      </a>
                    </li>
                  ))}
              </ol>
            </Reveal>
          ))}
        </div>

        <Reveal className="library__cta" delay={120}>
          <a className="btn btn--primary" href={library.report.href}>
            {library.report.label} <span aria-hidden="true">→</span>
          </a>
        </Reveal>
      </div>
    </section>
  );
}
