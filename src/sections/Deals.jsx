import { lazy, Suspense } from 'react';
import { localDeal } from '../config/site';
import { copy } from '../services/copy';
import SectionHeading from '../components/ui/SectionHeading';
import Reveal from '../components/ui/Reveal';
import LazyMount from '../components/ui/LazyMount';
import './Deals.css';

const LineWaves = lazy(() => import('../components/reactbits/LineWaves'));

// Real starting prices from the services page, summed one by one and compared with the bundle price.
const [page, assistant, both] = copy.en.offers.items;
const kitItems = copy.en.design.items.filter((d) => !d.featured);
const kit = copy.en.design.items.find((d) => d.featured);
const kitApart = kitItems.reduce((n, d) => n + d.price, 0);

const DEALS = [
  { apart: page.price + assistant.price, apartMonthly: page.monthly + assistant.monthly, together: both.price, monthly: both.monthly },
  { apart: kitApart, together: kit.price },
  { apart: page.price + assistant.price + kitApart, apartMonthly: page.monthly + assistant.monthly, together: both.price + kit.price, monthly: both.monthly },
];

const isSmall = typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;
const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasWebGL2 = (() => {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
})();

const loc = () => (typeof document !== 'undefined' && document.documentElement.lang) || 'en';
const euro = (n) => `€${n.toLocaleString(loc())}`;

export default function Deals({ id }) {
  const t = localDeal;
  return (
    <section id={id} className="section deals">
      {hasWebGL2 && !isSmall && !reduce && (
        <LazyMount className="deals__waves" aria-hidden="true">
          <Suspense fallback={null}>
            <LineWaves
              color1="#7d1d20"
              color2="#b0323a"
              color3="#4f1012"
              lightMode
              speed={0.18}
              lineCount={56}
              lineWidth={1.1}
              glow={0.4}
              highlight={0.8}
              warpIntensity={0.9}
              rotation={-28}
              mouseInfluence={1.4}
              opacity={0.3}
              maxDevicePixelRatio={1.5}
            />
          </Suspense>
        </LazyMount>
      )}
      <div className="container deals__inner">
        <SectionHeading index={t.index} label={t.label} title={t.title}>
          {t.body}
        </SectionHeading>

        <div className="deals__grid">
          {DEALS.map((d, i) => {
            const copyFor = t.deals[i];
            const saveSetup = d.apart - d.together;
            const saveYear = d.monthly ? (d.apartMonthly - d.monthly) * 12 : 0;
            return (
              <Reveal key={copyFor.title} as="article" className={`deals__card${i === 2 ? ' deals__card--best' : ''}`} delay={80 + i * 80}>
                <h3>{copyFor.title}</h3>
                <p className="deals__note">{copyFor.note}</p>
                <dl className="deals__rows">
                  <div>
                    <dt>{t.oneByOne}</dt>
                    <dd>
                      {euro(d.apart)} {d.monthly ? t.atSetup : t.once}
                      {d.monthly ? <> <span>+ {euro(d.apartMonthly)} {t.perMonth}</span></> : null}
                    </dd>
                  </div>
                  <div className="deals__together">
                    <dt>{t.together}</dt>
                    <dd>
                      <span><strong>{euro(d.together)}</strong> {d.monthly ? t.atSetup : t.once}</span>
                      {d.monthly ? <> <span>+ {euro(d.monthly)} {t.perMonth}</span></> : null}
                    </dd>
                  </div>
                </dl>
                <p className="deals__save">
                  <span className="mono">{t.save}</span>
                  <span><strong>{euro(saveSetup)}</strong> {t.atSetup}</span>
                  {saveYear ? <> <span>+ <strong>{euro(saveYear)}</strong> {t.perYear}</span></> : null}
                </p>
              </Reveal>
            );
          })}
        </div>

        <div className="deals__foot">
          <a className="btn btn--primary" href="/services#offers">
            {t.cta} <span className="btn__arrow" aria-hidden="true">→</span>
          </a>
          <p>{t.foot}</p>
        </div>
      </div>
    </section>
  );
}
