const CHAPTERS = 3;
const FALLBACK_DURATION = 24;
const MOBILE_QUERY = '(max-width: 768px)';

const video = document.getElementById('film');
const panels = [...document.querySelectorAll('[data-panel]')];
const overlay = document.querySelector('.overlay');
const logo = document.querySelector('.logo');
const controls = document.querySelector('.story-controls');
const segments = [...document.querySelectorAll('.segment')];
const fills = segments.map((s) => s.querySelector('.segment__fill'));
const playToggle = document.querySelector('.play-toggle');
const primaryLinks = [...document.querySelectorAll('.nav-links a[data-primary]')];
const hamburger = document.querySelector('.hamburger');
const menu = document.getElementById('mobile-menu');
const menuFocusables = [...menu.querySelectorAll('a')];

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const mobile = window.matchMedia(MOBILE_QUERY);

const state = {
  manualPause: false,
  menuOpen: false,
  motionOptIn: false,
  mediaFailed: false,
  autoplayBlocked: false,
  playPending: false,
  pendingSeek: null,
  chapter: 0,
  progress: 0,
  menuReturnFocus: null,
  savedOverflow: '',
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function duration() {
  const d = video.duration;
  return Number.isFinite(d) && d > 0 ? d : FALLBACK_DURATION;
}

function motionAllowed() {
  return !reducedMotion.matches || state.motionOptIn;
}

function playbackAllowed() {
  return (
    !state.manualPause &&
    !state.menuOpen &&
    !state.mediaFailed &&
    !document.hidden &&
    motionAllowed()
  );
}

/* ---------- Playback ---------- */

function tryPlay() {
  if (!playbackAllowed() || state.playPending || !video.paused) return;
  state.playPending = true;
  let attempt;
  try {
    attempt = video.play();
  } catch (err) {
    state.playPending = false;
    handlePlayError(err);
    return;
  }
  Promise.resolve(attempt)
    .then(() => {
      state.playPending = false;
      state.autoplayBlocked = false;
      // Conditions may have changed while the request was pending.
      if (!playbackAllowed()) video.pause();
      renderToggle();
    })
    .catch((err) => {
      state.playPending = false;
      handlePlayError(err);
    });
}

function handlePlayError(err) {
  const name = err && err.name;
  if (name === 'NotAllowedError') {
    state.autoplayBlocked = true;
  } else if (name === 'NotSupportedError') {
    markMediaFailed();
  }
  // AbortError: a pause or seek interrupted play; nothing to do.
  renderToggle();
}

function pauseFilm() {
  if (!video.paused) video.pause();
}

function markMediaFailed() {
  if (state.mediaFailed) return;
  state.mediaFailed = true;
  state.pendingSeek = null;
  playToggle.disabled = true;
  playToggle.setAttribute('aria-label', 'Cinematic video unavailable');
  playToggle.title = 'Cinematic video unavailable';
  playToggle.classList.add('is-paused');
}

function renderToggle() {
  if (state.mediaFailed) return;
  const playing = !video.paused || state.playPending;
  const label = playing ? 'Pause cinematic story' : 'Play cinematic story';
  playToggle.classList.toggle('is-paused', !playing);
  playToggle.setAttribute('aria-label', label);
  playToggle.title = label;
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
    playToggle.focus({ preventScroll: true });
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

function renderProgress() {
  fills.forEach((fill, i) => {
    fill.style.transform = `scaleX(${clamp(state.progress * CHAPTERS - i, 0, 1)})`;
  });
}

function syncFromVideo() {
  if (state.pendingSeek !== null) return;
  state.progress = clamp(video.currentTime / duration(), 0, 1);
  setChapter(Math.min(CHAPTERS - 1, Math.floor(state.progress * CHAPTERS)));
  renderProgress();
}

function goToChapter(index) {
  state.progress = index / CHAPTERS;
  setChapter(index);
  renderProgress();
  if (state.mediaFailed) return;

  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    state.pendingSeek = null;
    video.currentTime = (duration() * index) / CHAPTERS;
  } else {
    state.pendingSeek = index;
  }
  tryPlay();
}

function applyPendingSeek() {
  if (state.pendingSeek === null) return;
  const index = state.pendingSeek;
  state.pendingSeek = null;
  video.currentTime = (duration() * index) / CHAPTERS;
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
  pauseFilm();

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
  else tryPlay();
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

/* ---------- Chapter links and buttons ---------- */

document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-chapter]');
  if (!trigger) return;
  e.preventDefault();
  const index = Number(trigger.dataset.chapter);
  if (menu.contains(trigger)) closeMenu({ chapter: index });
  else goToChapter(index);
});

playToggle.addEventListener('click', () => {
  if (state.mediaFailed) return;
  const playing = !video.paused || state.playPending;
  if (playing) {
    state.manualPause = true;
    pauseFilm();
  } else {
    state.manualPause = false;
    if (!motionAllowed()) {
      state.motionOptIn = true;
      document.documentElement.classList.add('motion-ok');
    }
    tryPlay();
  }
  renderToggle();
});

/* ---------- Video events ---------- */

video.muted = true;
video.defaultMuted = true;
video.loop = true;
video.playsInline = true;
video.controls = false;

video.addEventListener('loadedmetadata', () => {
  applyPendingSeek();
  syncFromVideo();
});
video.addEventListener('timeupdate', syncFromVideo);
video.addEventListener('seeked', syncFromVideo);
video.addEventListener('play', renderToggle);
video.addEventListener('pause', renderToggle);
video.addEventListener('error', markMediaFailed);

// Retry after an autoplay-policy block on the visitor's first ordinary gesture.
const retryOnGesture = (e) => {
  if (!state.autoplayBlocked || e.target.closest?.('.play-toggle')) return;
  tryPlay();
};
document.addEventListener('pointerdown', retryOnGesture, true);
document.addEventListener('keydown', retryOnGesture, true);

/* ---------- Page visibility and motion preference ---------- */

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseFilm();
  else tryPlay();
});
window.addEventListener('pagehide', pauseFilm);
window.addEventListener('pageshow', () => tryPlay());

reducedMotion.addEventListener('change', () => {
  state.motionOptIn = false;
  document.documentElement.classList.remove('motion-ok');
  if (motionAllowed()) tryPlay();
  else pauseFilm();
  renderToggle();
});

/* ---------- Start ---------- */

function init() {
  // Failures that happened before these listeners existed.
  if (video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
    markMediaFailed();
  }

  setChapter(-1);
  setChapter(0);
  renderProgress();

  if (!motionAllowed()) {
    video.autoplay = false;
    pauseFilm();
  } else {
    tryPlay();
  }
  renderToggle();
}

init();
