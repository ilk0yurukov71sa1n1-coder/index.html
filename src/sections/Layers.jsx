import { useEffect, useRef } from 'react';
import { layers } from '../config/site';
import '@fontsource/playfair-display/latin-400-italic.css';
import '@fontsource/playfair-display/cyrillic-400-italic.css';
import './Layers.css';

const SPOTLIGHT_R = 260;

// Spotlight: a dark top layer, and the red layer underneath shows through a
// soft circle that drifts slowly on its own (no cursor effects on this site).
// The circle is a CSS mask moved with custom properties, so nothing
// re-renders while it moves.
export default function Layers({ id }) {
  const root = useRef(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const smooth = { x: -999, y: -999 };
    let raf = 0;
    let visible = false;


    let last = 0;
    const tick = (t) => {
      raf = 0;
      // Frame-rate independent easing: the same glide at 60 Hz and 120 Hz.
      const ease = 1 - Math.pow(0.9, Math.min(64, t - (last || t)) / 16.67);
      last = t;
      if (!visible) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      const tx = w * (0.5 + 0.28 * Math.cos(t / 3200));
      const ty = h * (0.55 + 0.18 * Math.sin(t / 2300));
      if (smooth.x < -900) Object.assign(smooth, { x: tx, y: ty });
      smooth.x += (tx - smooth.x) * ease;
      smooth.y += (ty - smooth.y) * ease;
      el.style.setProperty('--x', `${smooth.x}px`);
      el.style.setProperty('--y', `${smooth.y}px`);
      if (!reduce) raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      last = 0;
      if (visible) {
        el.classList.add('is-in');
        start();
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section id={id} ref={root} className="layers" style={{ '--r': `${SPOTLIGHT_R}px` }} aria-label={layers.label}>
      <div className="layers__base" />
      <div className="layers__reveal" aria-hidden="true" />
      <h2 className="layers__title">
        <span className="layers__line1">{layers.title[0]}</span>
        <span className="layers__line2">{layers.title[1]}</span>
      </h2>
      <div className="layers__left">
        <p>{layers.left}</p>
      </div>
      <div className="layers__right">
        <p>{layers.right}</p>
        <a className="layers__cta" href="#access">
          {layers.cta}
        </a>
      </div>
    </section>
  );
}
