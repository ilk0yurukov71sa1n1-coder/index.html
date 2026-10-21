// Scroll-driven version of the SONOTYPE stage: the visitor's own scrolling
// moves through the film and selects the text chapter. Nothing autoplays.
import scrollExpand from './scroll-expand.js';
import ditherVeil from './dither-veil.js';
import crowdCanvas from './crowd.js';
import patternWaves from './pattern-waves.js';
import circularCarousel from './circular-carousel.js';
import tunnel from './tunnel.js';
import deals from './deals.js';
import discount from './discount.js';
import setupLanguage from './i18n.js';

const CHAPTERS = 3;
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

/* ---------- Film ---------- */

// The film follows the scroll frame by frame, so each chapter lines up with
// the same moment of the film every time. The studio cut has its colours
// baked in and a keyframe every 4 frames, so any seek lands at once. The
// shown time eases toward the scroll position, and a new seek is only asked
// for once the last one has landed, so seeks never pile up.
const FILM_EASE = 0.2;
let filmShown = -1;
let filmLoop = 0;

function filmDuration() {
  const d = video.duration;
  return Number.isFinite(d) && d > 0 ? d : 0;
}

function stepFilm() {
  if (!filmLoop) filmLoop = requestAnimationFrame(followFilm);
}

function followFilm() {
  filmLoop = 0;
  const d = filmDuration();
  if (state.mediaFailed || !d || video.readyState < HTMLMediaElement.HAVE_METADATA) return;
  if (!video.paused) video.pause();
  // Never exactly 0: Safari can skip repainting a seek to 0 on a paused video,
  // which left the film on a late frame after scrolling back to the top.
  const target = Math.max(0.001, Math.min(state.progress * d, d - 0.04));
  if (filmShown < 0 || reducedMotion.matches) filmShown = target;
  else filmShown += (target - filmShown) * FILM_EASE;
  if (Math.abs(target - filmShown) < 0.004) filmShown = target;
  // Mid-glide a near frame is enough; once settled, land on the exact frame.
  const slack = filmShown === target ? 0.002 : 0.012;
  if (!video.seeking && Math.abs(video.currentTime - filmShown) > slack) video.currentTime = filmShown;
  // Keep easing until the film has caught up with the scroll.
  if (filmShown !== target || video.seeking) filmLoop = requestAnimationFrame(followFilm);
}

// iOS only paints frames after a play; play muted for an instant, then hold.
function primeVideo() {
  if (state.primed || state.mediaFailed) return;
  state.primed = true;
  Promise.resolve(video.play())
    .catch(() => {})
    .finally(() => {
      video.pause();
      stepFilm();
    });
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
  updateWaves();
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
  // The header takes the tone of whatever section sits right under it.
  const under = document
    .elementFromPoint(window.innerWidth / 2, header.offsetHeight + 2)
    ?.closest('[data-tone]');
  const tone = under ? under.dataset.tone : '';
  header.classList.toggle('is-over-realm', tone === 'dark' && (under !== realm || realmOpen > 0.8));
  header.classList.toggle('is-over-light', tone === 'light');
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
  const extra = id === 'realm' ? window.innerHeight * 1.25 : -header.offsetHeight;
  const top = el.getBoundingClientRect().top + window.scrollY + extra;
  window.scrollTo({ top, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
}

// Timeline: steps fade in as they arrive, and the red line fills with scroll.
const timeline = document.getElementById('timeline');
const timelineFill = timeline?.querySelector('.timeline__fill');
const timelineItems = timeline ? [...timeline.querySelectorAll('.timeline__item')] : [];

// Steps are simply there: no fade-in as they scroll past.
timelineItems.forEach((item) => item.classList.add('is-in'));

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

// PatternWaves: one fixed layer of red silk folds on off-white behind the
// whole page after the film. Full strength around the realm frame, softer
// behind the text sections, and paused while the film or the fully opened
// realm frame covers it, so only one moving layer is drawn at a time.
const siteWaves = document.querySelector('.site-waves');
let waves = null;
function updateWaves() {
  if (!siteWaves) return;
  const filmEnd = scrollRange() + stage.clientHeight;
  const shown = window.scrollY + window.innerHeight > filmEnd;
  if (shown && !waves && !siteWaves.dataset.failed) {
    waves = patternWaves(siteWaves, {
      preset: 'silk',
      color: '#7d1d20',
      backgroundColor: '#f4f1ec',
      fade: 'edges',
      interactive: true,
      cursorSize: 50,
      cursorStrength: 0.6,
      maxFps: 30,
    });
    if (!waves) siteWaves.dataset.failed = '1';
    else motionLayers.push(waves);
  }
  siteWaves.classList.toggle('is-on', shown);
  const realmEnd = realm.offsetTop + realm.offsetHeight - window.innerHeight * 0.5;
  siteWaves.classList.toggle('is-soft', window.scrollY > realmEnd);
  // The opened frame fills the screen from edge to edge while it is pinned.
  const realmTop = realm.offsetTop - window.scrollY;
  const covered = -realmTop > window.innerHeight * 1.3 && realmTop + realm.offsetHeight > window.innerHeight * 1.05;
  const run = shown && !covered;
  if (waves && waves.running !== run) {
    waves.running = run;
    waves.update({ paused: !run });
  }
}

/* ---------- Start ---------- */

video.muted = true;
video.defaultMuted = true;
video.playsInline = true;
video.controls = false;

video.loop = false;
video.preload = 'auto';
video.addEventListener('loadedmetadata', stepFilm);
video.addEventListener('seeked', stepFilm);
// The studio cut is picked by screen width; if it ever fails, fall back to
// the original film with the colour filter on top.
const FILM_SRC = mobile.matches ? '/studio/film/film-854.mp4' : '/studio/film/film-1280.mp4';
let filmFallback = false;
video.addEventListener('error', () => {
  if (!filmFallback) {
    filmFallback = true;
    stage.classList.remove('is-baked');
    video.poster = '/media/sonotype-cinematic-poster.webp';
    video.src = '/media/sonotype-cinematic-story.mp4';
    video.load();
    return;
  }
  markMediaFailed();
});
stage.classList.add('is-baked');
video.src = FILM_SRC;

// While the page is moving, the two WebGL layers hold still on their last
// frame, so the phone spends every frame on the scroll itself. They carry on
// a moment after the scroll stops. Both are background motion, so the pause
// is barely visible, but drawing them during a scroll is what made it stutter.
const motionLayers = [];
let holdTimer = 0;
function holdLayers() {
  motionLayers.forEach((layer) => layer.hold?.(true));
  clearTimeout(holdTimer);
  holdTimer = setTimeout(() => motionLayers.forEach((layer) => layer.hold?.(false)), 180);
}
window.addEventListener('scroll', requestUpdate, { passive: true });
window.addEventListener('scroll', holdLayers, { passive: true });
// Coming back from another page (Safari's back button), re-sync the film.
window.addEventListener('pageshow', requestUpdate);
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

// Inside the realm frame: the DitherVeil picture in the page's own ink and
// paper, set up only as the realm comes near the screen.
const realmVeil = realm.querySelector('.realm__veil');
if (realmVeil && 'IntersectionObserver' in window) {
  const veilIo = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    veilIo.disconnect();
    // Like the Shield site's "Layer by layer" section: the print is the top
    // layer, and a soft spotlight that trails the cursor (or drifts on its
    // own) shows the real glass logo underneath.
    const veilSrc = mobile.matches ? '/studio/film/veil-m.jpg' : '/studio/film/veil.jpg';
    realmVeil.querySelector('.realm__fallback')?.setAttribute('src', veilSrc);
    const stop = ditherVeil(realmVeil, {
      src: veilSrc,
      fit: 'cover',
      pattern: 'floyd',
      pixelSize: 2,
      inkColor: '#7d1d20',
      paperColor: '#f4f1ec',
      revealRadius: mobile.matches ? 150 : 240,
      softness: 0.7,
      linger: 1.2,
      wander: true,
      maxFps: 30,
      // The print is there at once, and the plain picture under it stays
      // until the print has been drawn, so the frame is never empty.
      introMs: 0,
      // No cursor effects on this site: the spotlight drifts on its own.
      followPointer: false,
      clickBurst: false,
      onReady: () => realmVeil.classList.add('is-live'),
    });
    // Without WebGL2 the plain picture stays in place.
    if (stop) motionLayers.push(stop);
  }, { rootMargin: '1600px 0px' });
  veilIo.observe(realmVeil);
}

// Timeline as a turning ring: one step at a time at the front, with its date,
// title and words written large underneath. The plain list stays for
// screen readers and as the fallback.
let refreshNote = () => {};
// The savings are worked out from the offer prices before the language
// setup reads the page; their numbers carry no words, so they are redrawn
// in the chosen language's number format on every switch.
const dealsEl = document.getElementById('deals');
const refreshDeals = (dealsEl && deals(dealsEl)) || (() => {});
const refreshCode = discount(document.getElementById('offers'));
// Language first, before the ring and the crowd add their own nodes.
setupLanguage(() => {
  refreshNote();
  refreshDeals();
  refreshCode();
});

const ring = timeline?.querySelector('.timeline__ring');
const note = timeline?.querySelector('.timeline__note');
if (ring && note && timelineItems.length) {
  const pictures = [
    '/studio/work/shield-dashboard.jpg',
    '/studio/work/services-page.jpg',
    '/studio/film/still-a.jpg',
    '/studio/film/still-b.jpg',
    '/studio/work/shield-site.jpg',
  ];
  // Read live from the list, so the words follow the chosen language.
  const steps = timelineItems.map((item, i) => ({
    get date() { return item.querySelector('.timeline__date').textContent; },
    get heading() { return item.querySelector('.timeline__heading').textContent; },
    get text() { return item.querySelector('.timeline__text').textContent; },
    goal: item.classList.contains('timeline__item--goal'),
    src: pictures[i % pictures.length],
  }));
  let current = 0;
  const [noteDate, noteHeading, noteText] = ['date', 'heading', 'text'].map((k) =>
    note.querySelector(`.timeline__note-${k}`),
  );
  const showStep = (index) => {
    current = index;
    const step = steps[index];
    if (!step) return;
    note.classList.remove('is-shown');
    noteDate.textContent = step.date;
    noteHeading.textContent = step.heading;
    noteText.textContent = step.text;
    note.classList.toggle('is-goal', step.goal);
    void note.offsetWidth;
    note.classList.add('is-shown');
  };
  const stop = circularCarousel(ring, {
    items: steps.map((s) => ({ src: s.src, alt: '', title: s.heading, subtitle: s.date })),
    label: 'Timeline',
    preset: 'cylinder',
    intro: 'rise',
    cardWidth: 230,
    aspectRatio: 0.8,
    autoplay: 'step',
    interval: 4,
    depthFade: 0.6,
    fadeColor: '#1f0507',
    captions: false,
    onChange: showStep,
  });
  if (stop) {
    refreshNote = () => showStep(current);
    timeline.classList.add('has-ring');
    showStep(0);
  }
}

// Why us and what the price includes, as a tunnel of picture cards.
const tunnelEl = document.getElementById('why');
if (tunnelEl) tunnel(tunnelEl);

// The walking crowd before the footer.
const crowdEl = document.querySelector('.crowd__canvas');
if (crowdEl) {
  crowdCanvas(crowdEl, {
    src: 'https://cdn.21st.dev/assets/localized/abdb8990a7bef8c2f5af3e45f0a3c969c4b0603fba8be92e81347de4ea4e1ed7.png',
    rows: 15,
    cols: 7,
  });
}
