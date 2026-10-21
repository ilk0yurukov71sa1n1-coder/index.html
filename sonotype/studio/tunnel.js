// Perspective tunnel (after the 21st.dev PerspectiveTunnelHero), rebuilt
// without React or framer-motion. Picture cards fly out of the distance
// toward the visitor as the page scrolls; it follows the normal page scroll
// instead of taking over the mouse wheel. Only transform and opacity change,
// so the browser moves the cards without repainting them.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerpRange = (v, a, b) => clamp((v - a) / (b - a), 0, 1);

// Opacity along a card's own flight: fade in, hold, fade out near the viewer.
const fade = (t) => (t < 0.18 ? t / 0.18 : t > 0.82 ? Math.max(0, 1 - (t - 0.82) / 0.16) : 1);

export default function tunnel(root, options = {}) {
  const track = root.querySelector('.tunnel__track');
  const stage = root.querySelector('.tunnel__stage');
  const center = root.querySelector('.tunnel__center');
  const hint = root.querySelector('.tunnel__hint');
  const cards = [...root.querySelectorAll('.tunnel__card')];
  if (!track || !stage || !cards.length) return () => {};

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !window.CSS?.supports?.('transform-style', 'preserve-3d')) {
    root.classList.add('tunnel--static');
    cards.forEach((card) => {
      const img = card.querySelector('img[data-src]');
      if (!img) return;
      img.loading = 'lazy';
      img.src = img.dataset.src;
    });
    return () => {};
  }
  root.classList.add('tunnel--live');

  const n = cards.length;
  // Share of the scroll each card is in flight. Shorter on phones, so fewer
  // cards share the small screen at once.
  const spanFor = () => (window.innerWidth < 768 ? 0.28 : 0.36);
  let span = spanFor();
  // Golden-angle spread around the centre, as in the original.
  const layout = cards.map((_, i) => {
    const angle = i * 137.5 * (Math.PI / 180);
    return {
      cos: Math.cos(angle),
      sin: Math.sin(angle),
      rx: 0.28 + (i % 3) * 0.08,
      ry: 0.26 + (i % 2) * 0.09,
      rot: (i % 2 === 0 ? 1 : -1) * (3 + (i % 5) * 2),
    };
  });

  const fine = window.matchMedia('(pointer: fine)');
  let w = 0;
  let h = 0;
  let mobile = false;
  let current = 0;
  let target = 0;
  let px = 0;
  let py = 0;
  let pxTarget = 0;
  let pyTarget = 0;
  let raf = 0;
  let inView = false;

  const measure = () => {
    w = stage.clientWidth;
    h = stage.clientHeight;
    mobile = w < 768;
    span = spanFor();
    const cardW = mobile ? clamp(w * 0.4, 130, 190) : clamp(w * 0.18, 190, 280);
    root.style.setProperty('--tunnel-card', `${Math.round(cardW)}px`);
    stage.style.perspective = mobile ? '900px' : '1200px';
  };

  const readProgress = () => {
    const rect = track.getBoundingClientRect();
    const run = Math.max(1, rect.height - h);
    return clamp(-rect.top / run, 0, 1);
  };

  const apply = (p) => {
    const far = mobile ? -1200 : -1700;
    const near = mobile ? 320 : 480;
    const pan = mobile || !fine.matches ? 0 : 40;
    for (let i = 0; i < n; i++) {
      const c = layout[i];
      const start = (i / n) * (1 - span);
      const t = lerpRange(p, start, start + span);
      const o = fade(t);
      const el = cards[i];
      if (o <= 0.001) {
        if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden';
        continue;
      }
      if (el.style.visibility !== 'visible') el.style.visibility = 'visible';
      const z = far + (near - far) * t;
      const x = c.cos * w * c.rx - px * pan;
      const y = c.sin * h * c.ry - py * pan;
      el.style.opacity = o.toFixed(3);
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) rotateZ(${c.rot}deg)`;
    }
    if (center) {
      const scale = p < 0.5 ? 0.82 + 0.36 * p : 1 + 0.5 * (p - 0.5);
      const op = p < 0.1 ? 0.35 + 6.5 * p : p > 0.88 ? Math.max(0, 1 - (p - 0.88) / 0.12) : 1;
      center.style.opacity = op.toFixed(3);
      center.style.transform = `scale(${scale.toFixed(3)})`;
    }
    if (hint) hint.style.opacity = (1 - lerpRange(p, 0, 0.08)).toFixed(3);
  };

  const tick = () => {
    raf = 0;
    current += (target - current) * 0.18;
    px += (pxTarget - px) * 0.08;
    py += (pyTarget - py) * 0.08;
    const settled = Math.abs(target - current) < 0.0005 && Math.abs(pxTarget - px) < 0.002 && Math.abs(pyTarget - py) < 0.002;
    if (settled) {
      current = target;
      px = pxTarget;
      py = pyTarget;
    }
    apply(current);
    if (!settled && inView) raf = requestAnimationFrame(tick);
  };
  const kick = () => {
    if (!raf && inView) raf = requestAnimationFrame(tick);
  };

  const onScroll = () => {
    if (!inView) return;
    target = readProgress();
    kick();
  };
  const onResize = () => {
    measure();
    target = readProgress();
    current = target;
    apply(current);
  };

  // The pictures load as the tunnel comes near (lazy loading in the browser
  // can't see cards that sit far back in 3D, so it would never load them).
  const pictures = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    pictures.disconnect();
    cards.forEach((card) => {
      const img = card.querySelector('img[data-src]');
      if (img) img.src = img.dataset.src;
    });
  }, { rootMargin: '1500px 0px' });
  pictures.observe(track);

  const io = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView) {
      target = readProgress();
      current = target;
      apply(current);
    }
  });
  io.observe(track);

  measure();
  target = current = readProgress();
  apply(current);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);

  return () => {
    cancelAnimationFrame(raf);
    io.disconnect();
    pictures.disconnect();
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
  };
}
