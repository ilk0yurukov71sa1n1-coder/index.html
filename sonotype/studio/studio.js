// Scroll-driven version of the SONOTYPE stage: the visitor's own scrolling
// moves through the film and selects the text chapter. Nothing autoplays.
const CHAPTERS = 3;
const FALLBACK_DURATION = 24;
const MOBILE_QUERY = '(max-width: 768px)';

const video = document.getElementById('film');
const scroller = document.querySelector('.scroller');
const stage = document.querySelector('.stage');
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
  shownTime: 0,
  mediaFailed: false,
  primed: false,
  menuOpen: false,
  savedOverflow: '',
  ticking: false,
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function duration() {
  const d = video.duration;
  return Number.isFinite(d) && d > 0 ? d : FALLBACK_DURATION;
}

/* ---------- Film follows the scroll ---------- */

// Ease the film toward the scroll position, one seek at a time.
function stepFilm() {
  if (state.mediaFailed || video.readyState < HTMLMediaElement.HAVE_METADATA) return;
  // Stop just short of the end so the last frame stays on screen.
  const target = Math.min(state.progress * duration(), duration() - 0.05);
  const diff = target - state.shownTime;
  if (Math.abs(diff) < 1 / 48) return;
  if (video.seeking) {
    requestAnimationFrame(stepFilm);
    return;
  }
  state.shownTime = reducedMotion.matches ? target : state.shownTime + diff * 0.35;
  video.currentTime = state.shownTime;
  requestAnimationFrame(stepFilm);
}

// iOS only decodes frames after a play; play muted for an instant, then hold.
function primeVideo() {
  if (state.primed || state.mediaFailed) return;
  state.primed = true;
  const attempt = video.play();
  if (attempt && attempt.then) {
    attempt.then(() => video.pause()).catch(() => {});
  }
}

function markMediaFailed() {
  state.mediaFailed = true;
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
  stepFilm();
}

function requestUpdate() {
  if (state.ticking) return;
  state.ticking = true;
  requestAnimationFrame(update);
}

function goToChapter(index) {
  // Land a little inside the chapter so rounding never shows the previous one.
  const top = index === 0 ? 0 : ((index + 0.02) / CHAPTERS) * scrollRange();
  window.scrollTo({ top, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
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

video.muted = true;
video.defaultMuted = true;
video.playsInline = true;
video.controls = false;

video.addEventListener('loadedmetadata', () => {
  state.shownTime = video.currentTime;
  requestUpdate();
});
video.addEventListener('error', markMediaFailed);
if (video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) markMediaFailed();

window.addEventListener('scroll', requestUpdate, { passive: true });
window.addEventListener('resize', requestUpdate);
['pointerdown', 'touchstart', 'keydown', 'wheel'].forEach((type) =>
  window.addEventListener(type, primeVideo, { once: true, passive: true }),
);

update();
