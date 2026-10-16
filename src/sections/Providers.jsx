import { providers } from '../config/site';
import './Providers.css';

// Infinite, CSS-only marquee of supported providers.
export default function Providers({ id }) {
  const row = [...providers, ...providers];
  return (
    <section id={id} className="providers" aria-label="Supported providers">
      <p className="providers__label mono container">Works with the models you already use</p>
      <div className="providers__track" aria-hidden="true">
        <ul>
          {row.map((p, i) => (
            <li key={`${p}-${i}`}>{p}</li>
          ))}
        </ul>
      </div>
      <ul className="sr-only">
        {providers.map((p) => <li key={p}>{p}</li>)}
      </ul>
    </section>
  );
}
