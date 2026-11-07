import { useMemo, useState } from 'react';
import { HOBBY, INVOCATION_PER_M, PRICES_CHECKED, PRICE_SOURCES, PRO, REGIONS, estimateMonth } from '../../api/_lib/vercel-prices.js';

const FIELDS = [
  { id: 'requests', label: 'Function requests a month', help: 'Calls to your API routes and server-rendered pages.', step: 10000 },
  { id: 'avgMs', label: 'Average time per request (ms)', help: 'From your logs, or a guess: 100 to 300 ms is common.', step: 10 },
  { id: 'cpuMs', label: 'Busy CPU per request (ms, optional)', help: 'Leave empty if you do not know. We then count the whole request time as busy.', step: 5, optional: true },
  { id: 'cdnRequests', label: 'Page and file requests a month', help: 'Every page, image, script and font your visitors load.', step: 100000 },
  { id: 'kbPerRequest', label: 'Average response size (KB)', help: 'About 50 to 200 KB for a typical page with images.', step: 10 },
];

const usd = (n) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n) => Math.round(n).toLocaleString('en-US');
const LINES = [
  ['invocations', 'Function invocations', (u) => `${num(u.invocations)} × $${INVOCATION_PER_M} per million`],
  ['cpu', 'Active CPU', (u, r) => `${u.cpuHours.toFixed(1)} CPU-hours × $${r.cpu} an hour`],
  ['memory', 'Provisioned memory', (u, r) => `${u.memGbHours.toFixed(1)} GB-hours × $${r.mem}`],
  ['cdn', 'CDN requests', (u) => `${num(u.cdnRequests)}, first ${num(PRO.cdnRequests)} in the Pro plan`],
  ['transfer', 'Fast Data Transfer', (u) => `${u.transferGb.toFixed(1)} GB, first ${num(PRO.transferGb)} GB in the Pro plan`],
];
const HOBBY_NAMES = { invocations: 'function requests', cpuHours: 'CPU hours', memGbHours: 'memory hours', cdnRequests: 'page and file requests', transferGb: 'data transfer' };

export default function Bill() {
  const [v, setV] = useState({ requests: '500000', avgMs: '200', cpuMs: '', cdnRequests: '2000000', kbPerRequest: '80', memoryGb: '2', region: 'iad1' });
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const est = useMemo(
    () =>
      estimateMonth({
        requests: Number(v.requests) || 0,
        avgMs: Number(v.avgMs) || 0,
        cpuMs: v.cpuMs === '' ? null : Number(v.cpuMs),
        cdnRequests: Number(v.cdnRequests) || 0,
        kbPerRequest: Number(v.kbPerRequest) || 0,
        memoryGb: Number(v.memoryGb),
        region: v.region,
      }),
    [v]
  );
  const rate = REGIONS[est.region];

  return (
    <div className="bill">
      <header className="bill__bar">
        <a className="bill__brand" href="/">
          <img src="/logo-rc.png" alt="" width="28" height="28" />
          <span>rollcfluence shield</span>
        </a>
        <a className="btn btn--ghost btn--sm" href="/app">
          Sign in
        </a>
      </header>

      <main className="bill__main">
        <p className="bill__eyebrow">Free, nothing to sign up for</p>
        <h1>What will Vercel charge for your traffic?</h1>
        <p className="bill__lead">Type your monthly traffic and see the bill line by line, from Vercel's published prices (checked {PRICES_CHECKED}). It runs in your browser, and nothing you type is sent anywhere.</p>

        <div className="bill__grid">
          <form className="bill__form" onSubmit={(e) => e.preventDefault()}>
            {FIELDS.map((f) => (
              <label key={f.id}>
                <span>{f.label}</span>
                <input type="number" min="0" step={f.step} inputMode="numeric" value={v[f.id]} placeholder={f.optional ? 'Not sure' : '0'} onChange={set(f.id)} />
                <small>{f.help}</small>
              </label>
            ))}
            <div className="bill__pair">
              <label>
                <span>Function memory</span>
                <select value={v.memoryGb} onChange={set('memoryGb')}>
                  {[1, 2, 3, 4].map((m) => (
                    <option key={m} value={m}>
                      {m} GB{m === 2 ? ' (default)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Region</span>
                <select value={v.region} onChange={set('region')}>
                  {Object.entries(REGIONS).map(([id, r]) => (
                    <option key={id} value={id}>
                      {id} · {r.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </form>

          <section className="bill__result" aria-live="polite">
            <p className="bill__label">On Vercel Pro, a month</p>
            <p className="bill__total">{usd(est.pro.total)}</p>
            <p className="bill__sub">
              {est.pro.usage <= PRO.credit
                ? `${usd(est.pro.usage)} of usage, covered by the $${PRO.credit} credit in the $${PRO.fee} plan fee.`
                : `$${PRO.fee} plan fee, plus ${usd(est.pro.usage - PRO.credit)} of usage past the $${PRO.credit} credit.`}
            </p>
            <table className="bill__lines">
              <tbody>
                {LINES.map(([k, name, how]) => (
                  <tr key={k}>
                    <th scope="row">
                      {name}
                      <small>{how(est.usage, rate)}</small>
                    </th>
                    <td>{usd(est.lines[k])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={`bill__hobby${est.hobby.fits ? '' : ' is-over'}`}>
              {est.hobby.fits
                ? 'This fits the free Hobby plan. Hobby is for personal, non-commercial projects.'
                : `Too much for the free Hobby plan: over its ${est.hobby.over.map((k) => HOBBY_NAMES[k]).join(', ')}. Hobby pauses the project instead of billing.`}
            </p>
          </section>
        </div>

        <section className="bill__notes">
          <h2>How this is worked out</h2>
          <ul>
            <li>Compute is an upper bound. Memory is counted for each request's whole time, as if every request had its own instance. Vercel shares instances between requests, so the real bill is usually lower.</li>
            <li>If you leave busy CPU empty, the whole request time is counted as busy. Requests that mostly wait on a database or an AI model cost less than shown.</li>
            <li>
              Not included: image optimization, ISR, Blob, Edge Config, builds, extra team seats and add-ons. Hobby includes {num(HOBBY.invocations)} function requests, {HOBBY.cpuHours} CPU hours, {HOBBY.memGbHours} GB-hours of memory, {num(HOBBY.cdnRequests)} page and file requests and {HOBBY.transferGb} GB of transfer a month.
            </li>
            {est.cdnAssumed && <li>We have not read Vercel's CDN price page for {est.region} yet, so page requests and transfer use the Washington D.C. rates, the lowest.</li>}
            <li>
              Prices in US dollars, excluding VAT, from{' '}
              {PRICE_SOURCES.map((u, i) => (
                <span key={u}>
                  {i ? ', ' : ''}
                  <a href={u} rel="noopener noreferrer">
                    {u.replace('https://', '')}
                  </a>
                </span>
              ))}
              . Your Vercel invoice is the final number.
            </li>
          </ul>
        </section>

        <section className="bill__cta">
          <div>
            <h2>Want to know before the invoice does?</h2>
            <p>Shield Bill Guard counts your site's real requests, shows the most expensive routes, and emails you when a route doubles after a deploy, naming the deploy.</p>
          </div>
          <a className="btn btn--primary" href="/app#guard">
            Watch my site <span className="btn__arrow" aria-hidden="true">→</span>
          </a>
        </section>
      </main>

      <footer className="bill__foot">
        <span>© {new Date().getFullYear()} Rollcfluence</span>
        <nav aria-label="Footer">
          <a href="/">Shield</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </nav>
      </footer>
    </div>
  );
}
