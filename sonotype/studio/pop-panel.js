// "Before you call": the File Pop Panel idea from the studio preview ilko
// sent, built for this page. When "Why work with us" ends, a PixelSwap turns
// the cover into a gallery of pages. A tap on a picture unravels it into a
// ribbon of pieces that flows into the viewer, then the page's text rises in.
import pixelSwap from './pixel-swap.js';

const IW = 960;
const IH = 640;
const GX = 64;
const GY = 43;

const clamp = (k) => (k < 0 ? 0 : k > 1 ? 1 : k);
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOut = (k) => 1 - Math.pow(1 - k, 4);

export default function popPanel(section) {
  const swapRoot = section?.querySelector('.pop__swap');
  if (!swapRoot) return;
  const app = section.querySelector('.pop__app');
  const hint = section.querySelector('.pop__hint');
  const viewer = section.querySelector('.pop__viewer');
  const vname = section.querySelector('.pop__vname');
  const vimg = section.querySelector('.pop__vimg');
  const vcan = vimg.querySelector('canvas');
  const vctx = vcan.getContext('2d');
  const fx = section.querySelector('.pop__fx');
  const fctx = fx.getContext('2d');
  const docs = [...section.querySelectorAll('.pop__doc')];
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const swap = pixelSwap(swapRoot, { pattern: 'center', pixelSize: 44, duration: 520, pixelDuration: 380, randomness: 0.25, bounce: 0.25, trigger: 'none', onComplete: (open) => open && spread() });
  section.querySelector('.pop__open').addEventListener('click', () => swap?.set(true));
  // The swap plays once on its own as the section comes into view.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      swap?.set(true);
    }, { threshold: 0.55 });
    io.observe(swapRoot);
  }

  // Each picture becomes a 960x640 "master" and a grid of sampled colours.
  const items = [...section.querySelectorAll('.pop__thumb')].map((el) => ({ el, img: el.querySelector('img'), key: el.dataset.open, master: null, cells: null }));
  const prepare = (it) => {
    if (it.master || !it.img.complete || !it.img.naturalWidth) return Boolean(it.master);
    const m = document.createElement('canvas');
    m.width = IW;
    m.height = IH;
    const c = m.getContext('2d');
    const { naturalWidth: w, naturalHeight: h } = it.img;
    const k = Math.max(IW / w, IH / h);
    c.drawImage(it.img, (IW - w * k) / 2, 0, w * k, h * k);
    const data = c.getImageData(0, 0, IW, IH).data;
    const cells = [];
    for (let gy = 0; gy < GY; gy++)
      for (let gx = 0; gx < GX; gx++) {
        const px = Math.floor(((gx + 0.5) * IW) / GX);
        const py = Math.floor(((gy + 0.5) * IH) / GY);
        const o = (py * IW + px) * 4;
        cells.push(`rgb(${data[o]},${data[o + 1]},${data[o + 2]})`);
      }
    it.master = m;
    it.cells = cells;
    return true;
  };

  const sizeFx = () => {
    const r = app.getBoundingClientRect();
    const d = Math.min(window.devicePixelRatio || 1, 2);
    fx.width = Math.round(r.width * d);
    fx.height = Math.round(r.height * d);
    fctx.setTransform(d, 0, 0, d, 0, 0);
  };
  const rel = (el) => {
    const a = el.getBoundingClientRect();
    const b = app.getBoundingClientRect();
    return { left: a.left - b.left, top: a.top - b.top, width: a.width, height: a.height };
  };

  let raf = 0;
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    fctx.clearRect(0, 0, fx.width, fx.height);
    items.forEach((it) => it.el.classList.remove('is-ghost'));
  };
  const run = (step) => {
    const t0 = performance.now();
    const f = (now) => {
      raf = step(now - t0) ? 0 : requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
  };

  const showDoc = (it) => {
    docs.forEach((d) => (d.hidden = d.dataset.doc !== it.key));
    vname.textContent = it.el.querySelector('.pop__tname').textContent;
    hint.hidden = true;
    viewer.hidden = false;
    vimg.classList.remove('is-arrived');
    viewer.classList.add('is-pre');
    vctx.clearRect(0, 0, IW, IH);
  };
  // When the picture lands: a light sweep, then the page's text rises in.
  const arrive = (it) => {
    viewer.classList.remove('is-pre');
    void vimg.offsetWidth;
    vimg.classList.add('is-arrived');
    const doc = docs.find((d) => d.dataset.doc === it.key);
    if (reduce || !doc?.animate) return;
    [...doc.children].forEach((el) => {
      const parts = el.matches('ol, ul, dl, .speed__rows') ? [...el.children] : [el];
      parts.forEach((p, i) =>
        p.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 160 + i * 60, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }),
      );
    });
  };

  const dissolve = (it) => {
    sizeFx();
    const tr = rel(it.img);
    const vr = rel(vcan);
    const st = tr.width / GX;
    const sth = tr.height / GY;
    const se = vr.width / GX;
    const DUR = 760;
    const bend = -Math.min(70, Math.abs(vr.top - tr.top) * 0.4 + 30);
    const parts = [];
    for (let i = 0; i < GX * GY; i++) {
      const gx = i % GX;
      const gy = Math.floor(i / GX);
      const sx = tr.left + gx * st;
      const sy = tr.top + gy * sth;
      const ex = vr.left + gx * se;
      const ey = vr.top + gy * se;
      parts.push({ sx, sy, ex, ey, cx: (sx + ex) / 2 + (Math.random() - 0.5) * 24, cy: (sy + ey) / 2 + bend + (Math.random() - 0.5) * 24, d: (gx / GX) * 340 + (gy / GY) * 60 + Math.random() * 50, c: it.cells[i] });
    }
    it.el.classList.add('is-ghost');
    const FADE = 220;
    const END = 340 + 60 + 50 + DUR;
    let landed = false;
    run((t) => {
      fctx.globalCompositeOperation = 'destination-out';
      fctx.fillStyle = 'rgba(0,0,0,.42)';
      fctx.fillRect(0, 0, fx.width, fx.height);
      fctx.globalCompositeOperation = 'source-over';
      const fin = clamp((t - (END - FADE)) / FADE);
      fctx.globalAlpha = 1 - fin;
      for (const p of parts) {
        const k = ease(clamp((t - p.d) / DUR));
        if (k >= 1 && fin > 0) continue;
        const u = 1 - k;
        const x = u * u * p.sx + 2 * u * k * p.cx + k * k * p.ex;
        const y = u * u * p.sy + 2 * u * k * p.cy + k * k * p.ey;
        const s = st + (se - st) * k;
        fctx.fillStyle = p.c;
        fctx.fillRect(x, y, s + 0.6, s + 0.6);
      }
      fctx.globalAlpha = 1;
      vctx.clearRect(0, 0, IW, IH);
      if (fin > 0) {
        vctx.globalAlpha = easeOut(fin);
        vctx.drawImage(it.master, 0, 0);
        vctx.globalAlpha = 1;
        if (!landed) {
          landed = true;
          arrive(it);
        }
      }
      if (t >= END) {
        fctx.clearRect(0, 0, fx.width, fx.height);
        vctx.drawImage(it.master, 0, 0);
        it.el.classList.remove('is-ghost');
        return true;
      }
      return false;
    });
  };

  const open = (it) => {
    stop();
    items.forEach((o) => o.el.toggleAttribute('aria-current', o === it));
    showDoc(it);
    const ready = prepare(it);
    if (reduce || !ready) {
      if (ready) vctx.drawImage(it.master, 0, 0);
      arrive(it);
      return;
    }
    dissolve(it);
    // On a phone the viewer sits under the pictures: bring it up once it lands.
    const r = viewer.getBoundingClientRect();
    if (r.top > window.innerHeight * 0.75) setTimeout(() => viewer.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }), 900);
  };
  items.forEach((it) => {
    it.img.addEventListener('load', () => prepare(it), { once: true });
    it.el.addEventListener('click', () => open(it));
  });
  section.querySelector('.pop__close').addEventListener('click', () => {
    stop();
    viewer.hidden = true;
    hint.hidden = false;
    items.forEach((o) => o.el.removeAttribute('aria-current'));
  });

  // The pictures start as a stacked pile and spread out one after another.
  function spread() {
    if (reduce || !items[0]?.el.animate) return;
    const first = items[0].el.getBoundingClientRect();
    items.forEach((it, i) => {
      const r = it.el.getBoundingClientRect();
      const rot = (i % 2 ? 1 : -1) * (3 + ((i * 7) % 9));
      it.el.style.zIndex = String(items.length - i);
      it.el.animate(
        [
          { transform: `translate(${first.left - r.left}px,${first.top - r.top}px) rotate(${rot}deg) scale(.92)`, opacity: i < 4 ? 1 : 0 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 680, delay: 120 + i * 80, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' },
      ).onfinish = () => (it.el.style.zIndex = '');
    });
  }
}
