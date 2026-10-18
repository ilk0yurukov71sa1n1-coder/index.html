import { compare, ui } from '../config/site';
import SectionHeading from '../components/ui/SectionHeading';
import Reveal from '../components/ui/Reveal';
import './Compare.css';

const Mark = ({ v }) => {
  if (v === 'yes') return <span className="cmp__mark cmp__mark--yes" aria-label={ui.yes}>✓</span>;
  if (v === 'no') return <span className="cmp__mark cmp__mark--no" aria-label={ui.no}>—</span>;
  if (v === 'partial') return <span className="cmp__mark cmp__mark--part">{ui.partly}</span>;
  return <span className="cmp__text">{v}</span>;
};

// Honest comparison of the ways to protect AI keys, plus real sourced bills.
export default function Compare({ id }) {
  const last = compare.columns.length - 1;
  return (
    <section id={id} className="section compare">
      <div className="container">
        <SectionHeading index={compare.index} label={compare.label} title={compare.title}>
          {compare.body}
        </SectionHeading>

        <p className="cmp__swipe mono" aria-hidden="true">{compare.swipe} →</p>
        <Reveal className="cmp__wrap" delay={80}>
          <table className="cmp">
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">Feature</span></th>
                {compare.columns.map((c, i) => (
                  <th key={c} scope="col" className={i === last ? 'is-us' : ''}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compare.rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">
                    {r.label}
                    {r.note ? <small>{r.note}</small> : null}
                  </th>
                  {r.values.map((v, i) => (
                    <td key={i} className={i === last ? 'is-us' : ''}><Mark v={v} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
        <p className="cmp__sources mono">
          Sources:{' '}
          {compare.sources.map((s, i) => (
            <span key={s.href}>
              {i ? ' · ' : ''}
              <a href={s.href} target="_blank" rel="noopener noreferrer">{s.label} ↗</a>
            </span>
          ))}
        </p>

        <h3 className="cmp__cases-title">{compare.casesTitle}</h3>
        <ul className="cmp__cases">
          {compare.cases.map((c, i) => (
            <Reveal as="li" key={c.amount} delay={i * 80}>
              <b>{c.amount}</b>
              <p>{c.text}</p>
              <a className="mono" href={c.href} target="_blank" rel="noopener noreferrer">{c.source} ↗</a>
            </Reveal>
          ))}
        </ul>
        <Reveal as="p" className="cmp__value" delay={120}>{compare.value}</Reveal>
      </div>
    </section>
  );
}
