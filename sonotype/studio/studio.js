// Scroll-driven version of the SONOTYPE stage: the visitor's own scrolling
// moves through the film and selects the text chapter. Nothing autoplays.
import scrollExpand from './scroll-expand.js';

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
const header = document.querySelector('.site-header');
const realm = document.getElementById('realm');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const mobile = window.matchMedia(MOBILE_QUERY);

const state = {
  chapter: -1,
  progress: 0,
  playPending: false,
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

// Follow the scroll without stutter: moving forward the film really plays
// (at a speed that matches the scroll), so the browser decodes it smoothly;
// only backward moves seek. Seeking every frame is what makes films judder.
let following = false;
let lastTarget = null;
let lastTargetTime = 0;
let targetSpeed = 0;
let lastSeekAt = 0;

function stepFilm() {
  if (following) return;
  following = true;
  requestAnimationFrame(followFilm);
}

function stopFollowing() {
  if (!video.paused) video.pause();
  following = false;
  lastTarget = null;
  targetSpeed = 0;
}

// Jump straight to a time; fastSeek lands on the nearest keyframe, which is
// far cheaper than decoding up to an exact frame.
function seekFilm(time, now) {
  if (video.seeking || now - lastSeekAt < 120) return;
  lastSeekAt = now;
  if (typeof video.fastSeek === 'function') video.fastSeek(time);
  else video.currentTime = time;
}

function setRate(rate) {
  if (Math.abs(video.playbackRate - rate) / rate > 0.08) video.playbackRate = rate;
}

function followFilm(now) {
  if (state.mediaFailed || video.readyState < HTMLMediaElement.HAVE_METADATA) {
    following = false;
    return;
  }
  const end = duration() - 0.05;
  const target = Math.min(state.progress * duration(), end);
  const diff = target - video.currentTime;

  if (reducedMotion.matches) {
    if (!video.paused) video.pause();
    if (Math.abs(diff) > 0.04) seekFilm(target, now);
    following = false;
    return;
  }

  // How fast the scroll is moving the target, in film seconds per second.
  if (lastTarget !== null) {
    const dt = Math.max(1, now - lastTargetTime) / 1000;
    const speed = (target - lastTarget) / dt;
    targetSpeed += (speed - targetSpeed) * 0.25;
  }
  lastTarget = target;
  lastTargetTime = now;

  if (diff > 2.5 || diff < -0.15) {
    // Too far to play through, or behind us: jump there.
    if (!video.paused) video.pause();
    seekFilm(Math.max(0, target), now);
  } else if (diff > 0.04 || targetSpeed > 0.05) {
    // Ride along with the scroll and close the small gap that is left.
    setRate(clamp(Math.max(0, targetSpeed) + diff * 4, 0.25, 16));
    if (video.paused && !state.playPending) {
      state.playPending = true;
      Promise.resolve(video.play())
        .catch(() => {})
        .finally(() => {
          state.playPending = false;
        });
    }
  } else {
    stopFollowing();
    return;
  }
  requestAnimationFrame(followFilm);
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

  // Once the film is behind us, hide its chapter controls and light the header.
  const past = window.scrollY > scrollRange() + stage.clientHeight * 0.5;
  controls.classList.toggle('is-hidden', past);
  controls.inert = past || state.menuOpen;
  // The red only fills the header area once the frame has nearly opened.
  const realmOpen = -realm.getBoundingClientRect().top / (window.innerHeight * 1.2);
  header.classList.toggle('is-over-realm', realmOpen > 0.8);
  updateTimeline();
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
  [overlay, logo, controls, realm].forEach((el) => {
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

function goToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  // The realm opens fully a little way in; land where its content shows.
  const extra = id === 'realm' ? window.innerHeight * 1.25 : 0;
  const top = el.getBoundingClientRect().top + window.scrollY + extra;
  window.scrollTo({ top, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
}

// Clicking the red silk sends a wave through it, then it settles again.
const silkImg = realm.querySelector('.scroll-expand__media');
const silkNoise = document.getElementById('silk-noise');
const silkMap = document.getElementById('silk-map');
let silkFrame = 0;

function rippleSilk() {
  if (!silkImg || !silkMap || reducedMotion.matches) return;
  cancelAnimationFrame(silkFrame);
  const start = performance.now();
  const length = 1800;
  silkImg.style.filter = 'url(#silk-ripple)';
  const step = (now) => {
    const t = Math.min(1, (now - start) / length);
    // Rises fast, then eases out like cloth coming to rest.
    const strength = Math.sin(Math.PI * Math.min(1, t * 1.6)) * (1 - t);
    const wave = Math.sin(t * Math.PI * 3) * (1 - t);
    silkMap.setAttribute('scale', (70 * Math.max(0, strength) + 18 * Math.abs(wave)).toFixed(1));
    silkNoise.setAttribute('baseFrequency', `${(0.004 + 0.002 * t).toFixed(4)} ${(0.012 - 0.004 * t).toFixed(4)}`);
    if (t < 1) {
      silkFrame = requestAnimationFrame(step);
    } else {
      silkMap.setAttribute('scale', '0');
      silkImg.style.filter = '';
    }
  };
  silkFrame = requestAnimationFrame(step);
}

realm.addEventListener('click', (e) => {
  if (e.target.closest('a, button')) return;
  if (e.target.closest('.scroll-expand__frame')) rippleSilk();
});

// Timeline: steps fade in as they arrive, and the red line fills with scroll.
const timeline = document.getElementById('timeline');
const timelineFill = timeline?.querySelector('.timeline__fill');
const timelineItems = timeline ? [...timeline.querySelectorAll('.timeline__item')] : [];

if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px' });
  timelineItems.forEach((item) => io.observe(item));
} else {
  timelineItems.forEach((item) => item.classList.add('is-in'));
}

function updateTimeline() {
  if (!timelineFill) return;
  const box = timelineFill.parentElement.getBoundingClientRect();
  const fill = clamp((window.innerHeight * 0.65 - box.top) / box.height, 0, 1);
  timelineFill.style.transform = `scaleY(${fill.toFixed(3)})`;
}

// The name scan plays only when someone clicks the name.
document.addEventListener('click', (e) => {
  const name = e.target.closest('.logo, .site-footer__name')?.querySelector('.scan-name');
  if (!name || reducedMotion.matches) return;
  name.classList.remove('is-scanning');
  void name.offsetWidth;
  name.classList.add('is-scanning');
});
document.addEventListener('animationend', (e) => {
  if (e.target.classList.contains('scan-name') && e.animationName === 'scan-ink') {
    e.target.classList.remove('is-scanning');
  }
});

document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-chapter], [data-target]');
  if (!trigger) return;
  e.preventDefault();
  const inMenu = menu.contains(trigger);
  if (trigger.dataset.target) {
    if (inMenu) closeMenu();
    goToSection(trigger.dataset.target);
    return;
  }
  const index = Number(trigger.dataset.chapter);
  if (inMenu) closeMenu({ chapter: index });
  else goToChapter(index);
});

/* ---------- Start ---------- */

video.muted = true;
video.defaultMuted = true;
video.playsInline = true;
video.controls = false;

video.addEventListener('loadedmetadata', requestUpdate);
// Never let the film run past the scroll position on its own.
video.addEventListener('ended', () => video.pause());
video.addEventListener('error', markMediaFailed);
if (video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) markMediaFailed();

window.addEventListener('scroll', requestUpdate, { passive: true });
window.addEventListener('resize', requestUpdate);
['pointerdown', 'touchstart', 'keydown', 'wheel'].forEach((type) =>
  window.addEventListener(type, primeVideo, { once: true, passive: true }),
);

// A wider resting frame on phones so the title fits inside it.
scrollExpand(
  realm,
  // A light touch of smoothing keeps the frame tight to the scroll.
  mobile.matches
    ? { useWindowScroll: true, smoothing: 0.05, startWidth: 78, startHeight: 52 }
    : { useWindowScroll: true, smoothing: 0.05 },
);
update();
