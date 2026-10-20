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

// Clicking the red silk sends a ripple out from the click, then it settles.
// A small WebGL shader bends the silk photo on the GPU, so it stays smooth;
// without WebGL the whole cloth gives one soft billow instead.
const silkImg = realm.querySelector('.scroll-expand__media');
const silk = { gl: null, canvas: null, prog: null, tex: null, u: {}, failed: false, frame: 0 };

const SILK_VERT = `
attribute vec2 a;
varying vec2 v;
void main() {
  v = vec2(a.x * 0.5 + 0.5, 0.5 - a.y * 0.5);
  gl_Position = vec4(a, 0.0, 1.0);
}`;

const SILK_FRAG = `
precision mediump float;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform vec2 uScale;
uniform vec2 uOffset;
uniform vec2 uClick;
uniform float uTime;
uniform float uAmp;
varying vec2 v;
void main() {
  vec2 p = v * uRes;
  vec2 d = p - uClick;
  float r = length(d);
  float unit = max(uRes.x, uRes.y);
  float phase = r / unit * 26.0 - uTime * 11.0;
  float front = smoothstep(uTime * unit * 1.1 + 60.0, uTime * unit * 1.1 - 240.0, r);
  float env = exp(-r / unit * 2.4) * uAmp * front;
  float wave = sin(phase) * env;
  vec2 dir = r > 0.5 ? d / r : vec2(0.0);
  vec2 q = p + dir * wave * unit * 0.022;
  vec3 col = texture2D(uTex, q * uScale + uOffset).rgb;
  col *= 1.0 + cos(phase) * env * 0.2;
  gl_FragColor = vec4(col, 1.0);
}`;

function silkShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
}

// Set up WebGL once, ahead of the click (on hover or first touch).
function prepareSilk() {
  if (silk.gl || silk.failed || !silkImg || !silkImg.complete || !silkImg.naturalWidth) return silk.gl;
  try {
    const canvas = document.createElement('canvas');
    canvas.className = 'silk-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false });
    if (!gl) throw new Error('no webgl');
    const vs = silkShader(gl, gl.VERTEX_SHADER, SILK_VERT);
    const fs = silkShader(gl, gl.FRAGMENT_SHADER, SILK_FRAG);
    if (!vs || !fs) throw new Error('shader');
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, silkImg);

    ['uRes', 'uScale', 'uOffset', 'uClick', 'uTime', 'uAmp'].forEach((name) => {
      silk.u[name] = gl.getUniformLocation(prog, name);
    });
    canvas.addEventListener('webglcontextlost', () => {
      silk.gl = null;
      silk.failed = true;
      canvas.remove();
    });
    silkImg.after(canvas);
    Object.assign(silk, { gl, canvas, prog, tex });
  } catch {
    silk.failed = true;
  }
  return silk.gl;
}

function billowSilk() {
  if (!silkImg || typeof silkImg.animate !== 'function') return;
  const base = getComputedStyle(silkImg).transform;
  const start = base === 'none' ? '' : base;
  silkImg.animate(
    [
      { transform: `${start} translate3d(0, 0, 0)` },
      { transform: `${start} translate3d(0, -10px, 0) scale(1.025) skewY(-0.6deg)`, offset: 0.35 },
      { transform: `${start} translate3d(0, 4px, 0) scale(1.01) skewY(0.3deg)`, offset: 0.7 },
      { transform: `${start} translate3d(0, 0, 0)` },
    ],
    { duration: 1400, easing: 'cubic-bezier(0.37, 0, 0.25, 1)' },
  );
}

function rippleSilk(clientX, clientY) {
  if (reducedMotion.matches) return;
  const gl = prepareSilk();
  if (!gl) {
    billowSilk();
    return;
  }
  const { canvas, u } = silk;
  const frame = silkImg.parentElement;
  const box = frame.getBoundingClientRect();
  const img = silkImg.getBoundingClientRect();
  if (box.width < 1 || img.width < 1) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const w = Math.round(box.width * dpr);
  const h = Math.round(box.height * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  }

  // Map frame pixels onto the photo exactly as object-fit: cover shows it.
  const nw = silkImg.naturalWidth;
  const nh = silkImg.naturalHeight;
  const cover = Math.max(img.width / nw, img.height / nh);
  const x0 = img.left - box.left + (img.width - nw * cover) / 2;
  const y0 = img.top - box.top + (img.height - nh * cover) / 2;
  gl.uniform2f(u.uRes, box.width, box.height);
  gl.uniform2f(u.uScale, 1 / (nw * cover), 1 / (nh * cover));
  gl.uniform2f(u.uOffset, -x0 / (nw * cover), -y0 / (nh * cover));
  gl.uniform2f(u.uClick, clientX - box.left, clientY - box.top);

  cancelAnimationFrame(silk.frame);
  const start = performance.now();
  const length = 1700;
  const draw = (now) => {
    const t = Math.min(1, (now - start) / length);
    gl.uniform1f(u.uTime, (now - start) / 1000);
    gl.uniform1f(u.uAmp, Math.min(1, t * 8) * (1 - t) ** 2);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    canvas.classList.add('is-on');
    if (t < 1) silk.frame = requestAnimationFrame(draw);
    else canvas.classList.remove('is-on');
  };
  silk.frame = requestAnimationFrame(draw);
}

realm.addEventListener('pointerenter', prepareSilk);
realm.addEventListener('touchstart', prepareSilk, { passive: true });

realm.addEventListener('click', (e) => {
  if (e.target.closest('a, button')) return;
  if (e.target.closest('.scroll-expand__frame')) rippleSilk(e.clientX, e.clientY);
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
