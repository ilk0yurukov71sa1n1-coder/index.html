// Scroll-driven version of the cinematic stage: the visitor's own scrolling
// moves the camera over the RC photo and selects the text chapter.
const CHAPTERS = 3;
const ASPECT = 16 / 9;
// Logo centre in the composed stage image, as a fraction of its width/height.
const FOCUS = { x: 781 / 1600, y: 485 / 900 };
const MOBILE_QUERY = '(max-width: 768px)';

const scroller = document.querySelector('.scroller');
const stage = document.querySelector('.stage');
const frame = document.querySelector('.frame');
const img = document.querySelector('.frame__img');
const panels = [...document.querySelectorAll('[data-panel]')];
const overlay = document.querySelector('.overlay');
const logo = document.querySelector('.logo');
const controls = document.querySelector('.story-controls');
const segments = [...document.querySelectorAll('.segment')];
const fills = segments.map((s) => s.querySelector('.segment__fill'));
const primaryLinks = [...document.querySelectorAll('.nav-links a[data-primary]')];
const hamburger = document.querySelector('.hamburger');
const menu = document.getElementById('mobile-menu');
const menuFocusables = [...menu.querySelectorAll('a')];

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const mobile = window.matchMedia(MOBILE_QUERY);

const state = {
  chapter: -1,
  progress: 0,
  menuOpen: false,
  menuReturnFocus: null,
  savedOverflow: '',
  frameW: 0,
  frameH: 0,
  ticking: false,
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const smooth = (a) => {
  a = clamp(a, 0, 1);
  return a * a * (3 - 2 * a);
};

/* ---------- Camera ---------- */

// Same path as the 24-second film: push in, drift between layers, pull back.
function camera(p) {
  const t = p * 3;
  if (t < 1) {
    const k = smooth(t);
    return { z: 1 + 0.7 * k, x: 0.5 + (FOCUS.x - 0.5) * k, y: 0.5 + (FOCUS.y - 0.5) * k };
  }
  if (t < 2) {
    const k = t - 1;
    return {
      z: 1.7 + 0.6 * smooth(k),
      x: FOCUS.x + Math.sin(k * Math.PI * 2) * 0.021,
      y: FOCUS.y - Math.sin(k * Math.PI) * 0.02,
    };
  }
  const k = smooth(t - 2);
  return { z: 2.3 - 1.3 * k, x: FOCUS.x + (0.5 - FOCUS.x) * k, y: FOCUS.y + (0.5 - FOCUS.y) * k };
}

function layoutFrame() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  // Cover the stage with a 16:9 frame.
  let fw = w;
  let fh = w / ASPECT;
  if (fh < h) {
    fh = h;
    fw = h * ASPECT;
  }
  state.frameW = fw;
  state.frameH = fh;
  frame.style.width = `${fw}px`;
  frame.style.height = `${fh}px`;
  frame.style.marginLeft = `${-fw / 2}px`;
  frame.style.marginTop = `${-fh / 2}px`;
}

function renderCamera() {
  const { z, x, y } = camera(state.progress);
  const span = 1 / z;
  const x0 = clamp(x - span / 2, 0, 1 - span);
  const y0 = clamp(y - span / 2, 0, 1 - span);
  img.style.transform = `translate3d(${-x0 * z * state.frameW}px, ${-y0 * z * state.frameH}px, 0) scale(${z})`;
}

/* ---------- Chapters ---------- */

function setChapter(index) {
  if (index === state.chapter) return;
  const focused = document.activeElement;
  state.chapter = index;

  panels.forEach((panel, i) => {
    const active = i === index;
    panel.classList.toggle('is-active', active);
    if (active) {
      panel.removeAttribute('aria-hidden');
      panel.inert = false;
    } else {
      panel.setAttribute('aria-hidden', 'true');
      panel.inert = true;
    }
  });

  if (focused && panels.some((p, i) => i !== index && p.contains(focused))) {
    segments[index].focus({ preventScroll: true });
  }

  segments.forEach((s, i) => {
    if (i === index) s.setAttribute('aria-current', 'step');
    else s.removeAttribute('aria-current');
  });

  primaryLinks.forEach((a) => {
    const current = Number(a.dataset.chapter) === index;
    a.classList.toggle('is-current', current);
    if (current) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
}

function scrollRange() {
  return Math.max(1, scroller.offsetHeight - stage.clientHeight);
}

function update() {
  state.ticking = false;
  state.progress = clamp(window.scrollY / scrollRange(), 0, 1);
  setChapter(Math.min(CHAPTERS - 1, Math.floor(state.progress * CHAPTERS)));
  fills.forEach((fill, i) => {
    fill.style.transform = `scaleX(${clamp(state.progress * CHAPTERS - i, 0, 1)})`;
  });
  renderCamera();
}

function requestUpdate() {
  if (state.ticking) return;
  state.ticking = true;
  requestAnimationFrame(update);
}

function goToChapter(index) {
  // Land a little inside the chapter so rounding never shows the previous one.
  const target = ((index + 0.02) / CHAPTERS) * scrollRange();
  window.scrollTo({ top: index === 0 ? 0 : target, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
}

/* ---------- Mobile menu ---------- */

function setBackgroundInert(value) {
  [overlay, logo, controls].forEach((el) => {
    el.inert = value;
  });
}

function openMenu() {
  if (state.menuOpen) return;
  state.menuOpen = true;
  state.menuReturnFocus = document.activeElement;
  state.savedOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  menu.inert = false;
  menu.removeAttribute('aria-hidden');
  menu.classList.add('is-open');
  hamburger.setAttribute('aria-expanded', 'true');
  hamburger.setAttribute('aria-label', 'Close menu');
  setBackgroundInert(true);
  menuFocusables[0].focus({ preventScroll: true });
}

function closeMenu({ chapter = null, restoreFocus = true } = {}) {
  if (!state.menuOpen) return;
  state.menuOpen = false;
  document.body.style.overflow = state.savedOverflow;
  menu.classList.remove('is-open');
  menu.setAttribute('aria-hidden', 'true');
  menu.inert = true;
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.setAttribute('aria-label', 'Open menu');
  setBackgroundInert(false);
  if (restoreFocus) hamburger.focus({ preventScroll: true });
  if (chapter !== null) goToChapter(chapter);
}

hamburger.addEventListener('click', () => {
  if (state.menuOpen) closeMenu();
  else openMenu();
});

document.addEventListener('keydown', (e) => {
  if (!state.menuOpen) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    closeMenu();
    return;
  }
  if (e.key !== 'Tab') return;
  const cycle = [...menuFocusables, hamburger];
  const pos = cycle.indexOf(document.activeElement);
  e.preventDefault();
  const next = e.shiftKey
    ? cycle[(pos <= 0 ? cycle.length : pos) - 1]
    : cycle[(pos + 1) % cycle.length];
  next.focus({ preventScroll: true });
});

mobile.addEventListener('change', (e) => {
  if (!e.matches && state.menuOpen) closeMenu({ restoreFocus: false });
});

document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-chapter]');
  if (!trigger) return;
  e.preventDefault();
  const index = Number(trigger.dataset.chapter);
  if (menu.contains(trigger)) closeMenu({ chapter: index });
  else goToChapter(index);
});

/* ---------- Start ---------- */

window.addEventListener('scroll', requestUpdate, { passive: true });
window.addEventListener('resize', () => {
  layoutFrame();
  requestUpdate();
});

layoutFrame();
update();
