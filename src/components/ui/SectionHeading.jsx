import Reveal from './Reveal';

// The "01 ── Threats" label plus the big section title.
export default function SectionHeading({ index, label, title, children, id }) {
  return (
    <header className="section-heading">
      <Reveal className="kicker">
        <span className="kicker__index">{index}</span>
        <span className="kicker__rule" aria-hidden="true" />
        <span>{label}</span>
      </Reveal>
      <Reveal as="h2" className="h2" delay={80} id={id}>
        {title}
      </Reveal>
      {children ? (
        <Reveal className="lead" delay={160} style={{ marginTop: 24 }}>
          {children}
        </Reveal>
      ) : null}
    </header>
  );
}
