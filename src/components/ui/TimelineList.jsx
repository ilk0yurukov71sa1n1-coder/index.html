import Reveal from './Reveal';
import './TimelineList.css';

// Phone version of the history timeline: one calm vertical list instead of
// the pinned sideways scroll, which is too cramped on a narrow screen.
export default function TimelineList({ id, label, title, periodLabel, items, imageUrl, imageAlt = '' }) {
  return (
    <section id={id} className="tll">
      {label ? <p className="tll__label">{label}</p> : null}
      <h2 className="tll__title">{title}</h2>
      {periodLabel ? <p className="tll__period">{periodLabel}</p> : null}
      {imageUrl ? (
        <div className="tll__image">
          <img src={imageUrl} alt={imageAlt} loading="lazy" decoding="async" />
        </div>
      ) : null}
      <ol className="tll__list">
        {items.map((item) => (
          <Reveal as="li" key={item.id} className="tll__item">
            {item.date ? <p className="tll__date">{item.date}</p> : null}
            {item.stat ? <p className="tll__stat">{item.stat}</p> : null}
            <h3 className="tll__heading">{item.heading}</h3>
            <p className="tll__desc">{item.content}</p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
