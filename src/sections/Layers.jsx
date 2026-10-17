import { useEffect, useRef } from 'react';
import { layers } from '../config/site';
import '@fontsource/playfair-display/latin-400-italic.css';
import '@fontsource/playfair-display/cyrillic-400-italic.css';
import './Layers.css';

const SPOTLIGHT_R = 260;

// Cursor spotlight: a dark top layer, and the red layer underneath shows
// through a soft circle that trails the cursor. The circle is a CSS mask
// moved with custom properties, so nothing re-renders while it moves.
// Without a mouse (phones), the circle drifts slowly on its own.
export default function Layers({ id }) {
  const root = useRef(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const mouse = { x: -999, y: -999, active: false };
    const smooth = { x: -999, y: -999 };
    let raf = 0;
    let visible = false;

    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      if (!mouse.active) Object.assign(smooth, { x: mouse.x, y: mouse.y });
      mouse.active = true;
    };
    const onLeave = () => {
      mouse.active = false;
    };

    const tick = (t) => {
      raf = 0;
      if (!visible) return;
      let tx = mouse.x;
      let ty = mouse.y;
      if (!mouse.active) {
        const w = el.clientWidth;
        const h = el.clientHeight;
        tx = w * (0.5 + 0.28 * Math.cos(t / 3200));
        ty = h * (0.55 + 0.18 * Math.sin(t / 2300));
        if (smooth.x < -900) Object.assign(smooth, { x: tx, y: ty });
      }
      smooth.x += (tx - smooth.x) * 0.1;
      smooth.y += (ty - smooth.y) * 0.1;
      el.style.setProperty('--x', `${smooth.x}px`);
      el.style.setProperty('--y', `${smooth.y}px`);
      if (!reduce || mouse.active) raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) {
        el.classList.add('is-in');
        start();
      }
    });
    io.observe(el);
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') onMove(e);
      start();
    });
    el.addEventListener('pointerleave', onLeave);
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
