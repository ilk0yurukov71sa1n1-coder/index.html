// ScrollExpand from React Bits (JS + CSS variant), ported to vanilla JS.
// The logic and defaults follow the original component; options mirror its props.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0 || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
};

export default function scrollExpand(root, options = {}) {
  const c = {
    startWidth: 42,
    startHeight: 58,
    startRadius: 24,
    endRadius: 0,
    mediaZoom: 1.35,
    scrollDistance: 1.2,
    holdDistance: 0.35,
    smoothing: 0.1,
    overlayScrim: 0.45,
    useWindowScroll: false,
    enabled: true,
    ...options,
  };

  const track = root.querySelector('.scroll-expand__track');
  const stage = root.querySelector('.scroll-expand__stage');
  const frame = root.querySelector('.scroll-expand__frame');
  const media = root.querySelector('.scroll-expand__media');
  const title = root.querySelector('.scroll-expand__title');
  const overlay = root.querySelector('.scroll-expand__overlay');
  const scrim = root.querySelector('.scroll-expand__scrim');
  const hint = root.querySelector('.scroll-expand__hint');
  if (!track || !stage || !frame || !media) return () => {};
  if (!c.useWindowScroll) root.classList.add('scroll-expand--scroller');

  const applyProgress = (p) => {
    const e = smoothstep(0, 1, p);

    const w = c.startWidth + (100 - c.startWidth) * e;
    const h = c.startHeight + (100 - c.startHeight) * e;
    const ix = Math.max(0, (100 - w) / 2);
    const iy = Math.max(0, (100 - h) / 2);
    const r = c.startRadius + (c.endRadius - c.startRadius) * e;
    frame.style.clipPath = `inset(${iy}% ${ix}% ${iy}% ${ix}% round ${r}px)`;

    media.style.transform = `scale(${c.mediaZoom + (1 - c.mediaZoom) * e})`;

    if (scrim) scrim.style.opacity = `${c.overlayScrim * e}`;

    if (title) {
      const out = smoothstep(0.4, 0.88, p);
      title.style.opacity = `${1 - out}`;
      title.style.transform = `translate3d(0, ${-28 * out}px, 0) scale(${1 + 0.06 * out})`;
    }

    if (hint) {
      const gone = smoothstep(0, 0.12, p);
      hint.style.opacity = `${1 - gone}`;
      hint.style.transform = `translate3d(0, ${8 * gone}px, 0)`;
    }

    if (overlay) {
      const inn = smoothstep(0.68, 1, p);
      overlay.style.opacity = `${inn}`;
      overlay.style.transform = `translate3d(0, ${18 * (1 - inn)}px, 0)`;
    }
  };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let raf = 0;
  let current = 0;
  let target = 0;
  let stageH = 0;
  let running = false;

  // On phones the address bar slides in and out while scrolling, which
  // changes innerHeight. The tallest viewport height stays put, so the frame
  // (and the picture inside it) is not resized on every slide.
  let probe = null;
  const viewportHeight = () => {
    if (!probe && window.CSS?.supports?.('height', '100lvh')) {
      probe = document.createElement('div');
      probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100lvh;visibility:hidden;pointer-events:none';
      document.body.appendChild(probe);
    }
    return probe?.offsetHeight || window.innerHeight;
  };

  const measure = () => {
    stageH = c.useWindowScroll ? viewportHeight() : root.clientHeight;
    if (stageH <= 0) return;
    stage.style.height = `${stageH}px`;
    track.style.height = `${stageH * (1 + Math.max(0, c.scrollDistance) + Math.max(0, c.holdDistance))}px`;

    const w = root.clientWidth || stageH;
    stage.style.setProperty('--se-title-size', `${clamp(w * 0.075, 20, 84)}px`);
  };

  const readProgress = () => {
    if (!c.enabled) return 1;
    const span = stageH * Math.max(0.01, c.scrollDistance);
    if (c.useWindowScroll) {
      const top = track.getBoundingClientRect().top;
      return clamp(-top / span, 0, 1);
    }
    return clamp(root.scrollTop / span, 0, 1);
  };

  const tick = () => {
    const k = c.smoothing <= 0 ? 1 : 1 - Math.exp(-1 / (60 * c.smoothing));
    current += (target - current) * k;
    if (Math.abs(target - current) < 0.0004) {
      current = target;
      running = false;
    }
    applyProgress(current);
    raf = running ? requestAnimationFrame(tick) : 0;
  };

  const kick = () => {
    if (running) return;
    running = true;
    if (!raf) raf = requestAnimationFrame(tick);
  };

  const onScroll = () => {
    target = readProgress();
    if (c.smoothing <= 0 || reduceMotion) {
      current = target;
      applyProgress(current);
      return;
    }
    kick();
  };

  const onResize = () => {
    measure();
    target = readProgress();
    current = target;
    applyProgress(current);
  };

  measure();
  target = readProgress();
  current = target;
  applyProgress(current);

  const scroller = c.useWindowScroll ? window : root;
  scroller.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  const ro = new ResizeObserver(onResize);
  ro.observe(root);

  return () => {
    if (raf) cancelAnimationFrame(raf);
    scroller.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    ro.disconnect();
    probe?.remove();
  };
}
