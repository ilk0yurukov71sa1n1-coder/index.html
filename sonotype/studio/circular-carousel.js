// Circular Carousel (React Bits), ported to plain JavaScript with no
// dependencies. Images sit around a 3D ring that drifts, can be dragged,
// thrown, flicked with a trackpad and stepped with the keyboard.
// Returns a cleanup function; cleanup.setItems(items) swaps the images
// (a list of the same length crossfades card by card).

const photo = (id) => `https://images.unsplash.com/${id}?w=900&q=80&auto=format&fit=max&sat=-100`;

const DEFAULT_ITEMS = [
  { src: photo('photo-1506744038136-46273834b3fb'), alt: 'Mist drifting through a mountain valley', title: 'Valley', subtitle: 'Landscape' },
  { src: photo('photo-1524504388940-b1c1722653e1'), alt: 'A woman with long hair in soft studio light', title: 'Portrait', subtitle: 'Studio' },
  { src: photo('photo-1486406146926-c627a92ad1ab'), alt: 'Glass towers seen from street level', title: 'Towers', subtitle: 'Architecture' },
  { src: photo('photo-1502680390469-be75c86b636f'), alt: 'A surfer carving inside a breaking wave', title: 'Swell', subtitle: 'Ocean' },
  { src: photo('photo-1487958449943-2429e8be8625'), alt: 'An angular white building against the sky', title: 'Facade', subtitle: 'Architecture' },
  { src: photo('photo-1509631179647-0177331693ae'), alt: 'A model in striped trousers leaning on a wall', title: 'Pose', subtitle: 'Editorial' },
  { src: photo('photo-1519681393784-d120267933ba'), alt: 'The Milky Way above snowy peaks', title: 'Night', subtitle: 'Sky' },
  { src: photo('photo-1485968579580-b6d095142e6e'), alt: 'A woman in a long coat on a city street', title: 'Street', subtitle: 'Editorial' },
  { src: photo('photo-1493246507139-91e8fad9978e'), alt: 'Mountains mirrored in a still lake', title: 'Mirror', subtitle: 'Landscape' },
  { src: photo('photo-1511818966892-d7d671e672a2'), alt: 'A glass skyscraper under a cloudy sky', title: 'Glass', subtitle: 'Architecture' },
];

const PRESETS = {
  cylinder: { axis: 'y', tilt: -5, perspective: 2500, curve: 1, spread: 1, inward: false, billboard: false, backfaces: true, window: 0 },
  orbit: { axis: 'y', tilt: -16, perspective: 1500, curve: 0, spread: 1.45, inward: false, billboard: true, backfaces: false, window: 0 },
  wheel: { axis: 'x', tilt: 0, perspective: 1800, curve: 0, spread: 1, inward: false, billboard: false, backfaces: true, window: 1.7 },
  panorama: { axis: 'y', tilt: 0, perspective: 0, curve: 1, spread: 1, inward: true, billboard: false, backfaces: false, window: 0 },
};

const INTRO_LENGTH = { assemble: 1500, rise: 1400, spin: 1800, none: 0 };
const TILES = 8;
const OVERLAP = 2.5;
const DRAG_THRESHOLD = 5;
const SPRING = 118;
const SETTLE_SPEED = 9;
const CAPTION_SPACE = 76;
const SWAP_LENGTH = 700;
const SWAP_SPREAD = 420;
const TO_RAD = Math.PI / 180;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const wrap = (degrees) => ((((degrees + 180) % 360) + 360) % 360) - 180;
const easeOut = (t) => 1 - Math.pow(1 - t, 4);
const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);

const rotateX = (p, degrees) => {
  const r = degrees * TO_RAD;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
};

const rotateY = (p, degrees) => {
  const r = degrees * TO_RAD;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
};

const el = (tag, className, parent) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (parent) parent.appendChild(node);
  return node;
};

export default function circularCarousel(container, options = {}) {
  if (!container) return null;
  const {
    items,
    preset = 'cylinder',
    intro = 'rise',
    cardWidth = 220,
    aspectRatio = 1,
    gap = 25,
    curve,
    tilt,
    perspective,
    autoplay = 'drift',
    speed = 14,
    interval = 3,
    direction = 'left',
    draggable = true,
    momentum = 0.6,
    snap = true,
    pauseOnHover = true,
    focusOnClick = true,
    parallax = 0.3,
    stretch = 0.5,
    depthFade = 0.55,
    fadeColor = '#000000',
    innerShade = 0.6,
    cornerRadius = 12,
    captions = false,
    onChange,
    onItemClick,
    className = '',
    label: regionLabel = 'Image carousel',
  } = options;

  let list = items && items.length ? items : DEFAULT_ITEMS;
  const count = list.length;
  const shape = PRESETS[preset] ? preset : 'cylinder';
  const layout = PRESETS[shape];
  const axis = layout.axis;
  const tiltValue = tilt ?? layout.tilt;
  const curveValue = layout.billboard ? 0 : clamp(curve ?? layout.curve, 0, 1);
  const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  const cardW = Math.max(40, cardWidth);
  const cardH = cardW / clamp(aspectRatio, 0.2, 5);
  const along = axis === 'x' ? cardH : cardW;
  const step = 360 / count;

  const radius = (() => {
    const n = Math.max(count, 3);
    const pitch = (along + gap) * layout.spread;
    const chord = pitch / (2 * Math.sin(Math.PI / n));
    const arc = (n * pitch) / (2 * Math.PI);
    return Math.max(chord + (arc - chord) * curveValue, along * 0.6);
  })();

  const tiles = (() => {
    const total = curveValue > 0.001 ? TILES : 1;
    const length = along / total;
    const bend = curveValue > 0.001 ? radius / curveValue : 0;
    return Array.from({ length: total }, (_, index) => {
      const start = index * length - (index > 0 ? OVERLAP / 2 : 0);
      const end = (index + 1) * length + (index < total - 1 ? OVERLAP / 2 : 0);
      const center = (start + end) / 2 - along / 2;
      const alpha = bend ? center / bend : 0;
      const shift = bend ? bend * Math.sin(alpha) : center;
      const sink = bend ? bend * (1 - Math.cos(alpha)) : 0;
      const depth = layout.inward ? sink : -sink;
      const turn = ((layout.inward ? -alpha : alpha) * 180) / Math.PI;
      const move =
        axis === 'x'
          ? `translate3d(0px, ${shift}px, ${depth}px) rotateX(${-turn}deg)`
          : `translate3d(${shift}px, 0px, ${depth}px) rotateY(${turn}deg)`;
      return { index, total, start, end, size: end - start, move };
    });
  })();

  const makeSettings = () => {
    const reduced = Boolean(motionQuery?.matches);
    return {
      count,
      step,
      radius,
      layout,
      axis,
      tilt: tiltValue,
      perspective: layout.inward ? radius : (perspective ?? layout.perspective),
      cardW,
      cardH,
      intro: reduced ? 'none' : intro in INTRO_LENGTH ? intro : 'rise',
      autoplay: reduced ? 'off' : autoplay,
      speed,
      interval: Math.max(0.5, interval),
      draggable,
      momentum: clamp(momentum, 0, 1),
      snap,
      pauseOnHover,
      parallax: reduced ? 0 : clamp(parallax, 0, 1),
      stretch: reduced ? 0 : clamp(stretch, 0, 1),
      depthFade: clamp(depthFade, 0, 1),
      captions,
      reduced,
    };
  };
  let settings = makeSettings();

  const dragSign = layout.inward ? -1 : 1;
  const directionSign = (direction === 'right' ? 1 : -1) * dragSign;

  const state = {
    angle: 0,
    velocity: 0,
    target: null,
    dir: directionSign,
    press: null,
    drag: false,
    hover: false,
    pointer: { inside: false, x: 0, y: 0 },
    yaw: 0,
    pitch: 0,
    intro: null,
    introDone: false,
    holdUntil: 0,
    stepAt: 0,
    suppressClick: false,
    wheelTimer: 0,
    fit: 1,
    shift: 0,
    drop: 0,
    last: 0,
  };
  let ready = false;
  let active = 0;
  let destroyed = false;

  /* ---------- DOM ---------- */

  const root = el('div', `circular-carousel ${className}`.trim());
  root.style.setProperty('--cc-fade', fadeColor);
  root.style.setProperty('--cc-radius', `${Math.max(0, cornerRadius)}px`);
  root.style.setProperty('--cc-inner', (1 - clamp(innerShade, 0, 1)).toFixed(3));
  root.setAttribute('role', 'region');
  root.setAttribute('aria-roledescription', 'carousel');
  root.setAttribute('aria-label', regionLabel);
  root.tabIndex = 0;
  root.dataset.axis = axis;
  root.dataset.shape = shape;
  if (draggable) root.setAttribute('data-draggable', '');

  const view = el('div', 'circular-carousel__view', root);
  const stage = el('div', 'circular-carousel__stage', view);
  const camera = el('div', 'circular-carousel__camera', stage);
  const ring = el('div', 'circular-carousel__ring', camera);

  const cards = [];
  // Per card, every photo element (front and back tiles), for image swaps.
  const cardPhotos = [];

  const buildTile = (card, item, tile, back, index) => {
    const strip = back ? tile.total - 1 - tile.index : tile.index;
    const first = strip === 0;
    const last = strip === tile.total - 1;
    const r = 'var(--cc-radius)';
    const frameRadius =
      axis === 'x'
        ? `${first ? r : 0} ${first ? r : 0} ${last ? r : 0} ${last ? r : 0}`
        : `${first ? r : 0} ${last ? r : 0} ${last ? r : 0} ${first ? r : 0}`;
    const offset = back ? along - tile.end : tile.start;
    const size = tile.size;
    const box =
      axis === 'x'
        ? { left: -cardW / 2, top: -size / 2, width: cardW, height: size }
        : { left: -size / 2, top: -cardH / 2, width: size, height: cardH };
    const photoBox =
      axis === 'x'
        ? { left: 0, top: -offset, width: cardW, height: cardH }
        : { left: -offset, top: 0, width: cardW, height: cardH };
    const flip = axis === 'x' ? ' rotateX(180deg)' : ' rotateY(180deg)';

    const tileEl = el('div', 'circular-carousel__tile', card);
    Object.assign(tileEl.style, {
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      transform: tile.move + (back ? flip : ''),
    });
    tileEl.setAttribute('aria-hidden', 'true');

    const frameEl = el('div', 'circular-carousel__frame', tileEl);
    frameEl.style.height = `${axis === 'x' ? size : cardH}px`;
    frameEl.style.borderRadius = frameRadius;

    const img = el('img', 'circular-carousel__photo', frameEl);
    img.src = item.src;
    img.alt = '';
    img.draggable = false;
    img.decoding = 'async';
    const photoStyle = {
      left: `${photoBox.left}px`,
      top: `${photoBox.top}px`,
      width: `${photoBox.width}px`,
      height: `${photoBox.height}px`,
    };
    Object.assign(img.style, photoStyle);
    cardPhotos[index].push({ img, frame: frameEl, style: photoStyle });

    if (back) el('div', 'circular-carousel__inner', frameEl);
    el('div', 'circular-carousel__shade', frameEl);
  };

  list.forEach((item, index) => {
    const card = el('div', 'circular-carousel__card', ring);
    card.dataset.ccIndex = String(index);
    card.setAttribute('role', 'group');
    card.setAttribute('aria-roledescription', 'slide');
    card.setAttribute('aria-label', `${item.title || item.alt || `Image ${index + 1}`}, ${index + 1} of ${count}`);
    cards.push(card);
    cardPhotos.push([]);
    tiles.forEach((tile) => buildTile(card, item, tile, false, index));
    if (layout.backfaces) tiles.forEach((tile) => buildTile(card, item, tile, true, index));
  });

  let caption = null;
  let titleEl = null;
  let reels = [];
  if (captions) {
    caption = el('div', 'circular-carousel__caption', root);
    caption.setAttribute('aria-hidden', 'true');
    titleEl = el('span', 'circular-carousel__title', caption);
    const countEl = el('span', 'circular-carousel__count', caption);
    const digits = el('span', 'circular-carousel__digits', countEl);
    const places = Math.max(2, String(count).length);
    for (let i = 0; i < places; i++) {
      const digit = el('span', 'circular-carousel__digit', digits);
      const reel = el('span', 'circular-carousel__reel', digit);
      for (let n = 0; n < 10; n++) el('span', '', reel).textContent = String(n);
      reels.push(reel);
    }
    el('span', 'circular-carousel__slash', countEl).textContent = '/';
    el('span', '', countEl).textContent = String(count).padStart(2, '0');
  }
  const live = el('div', 'circular-carousel__live', root);
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');

  const renderCaption = () => {
    const current = list[active] || list[0];
    const label = current ? current.title || current.alt || `Image ${active + 1}` : '';
    live.textContent = `${label}, ${active + 1} of ${count}`;
    if (!caption || !current) return;
    // A fresh element replays the title's entrance, like React's key change.
    const fresh = el('span', 'circular-carousel__title');
    fresh.textContent = current.title || current.alt || '';
    if (current.subtitle) el('span', 'circular-carousel__subtitle', fresh).textContent = current.subtitle;
    titleEl.replaceWith(fresh);
    titleEl = fresh;
    const value = String(active + 1).padStart(reels.length, '0');
    reels.forEach((reel, i) => {
      reel.style.transform = `translateY(${-Number(value[i]) * 10}%)`;
    });
  };
  renderCaption();

  container.appendChild(root);

  /* ---------- Motion ---------- */

  let raf = 0;
  let visible = true;
  const nearest = (angle) => Math.round(angle / settings.step) * settings.step;

  const measure = () => {
    const s = settings;
    const rect = root.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const room = s.captions ? CAPTION_SPACE : 0;
    const width = rect.width * 0.94;
    const height = (rect.height - room) * 0.92;
    const P = s.perspective;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    if (s.layout.inward) {
      minX = -width / 2;
      maxX = width / 2;
      minY = -s.cardH / 2;
      maxY = s.cardH / 2;
    } else {
      const corners = [
        [-s.cardW / 2, -s.cardH / 2],
        [s.cardW / 2, -s.cardH / 2],
        [-s.cardW / 2, s.cardH / 2],
        [s.cardW / 2, s.cardH / 2],
      ];
      const limit = s.layout.window ? s.layout.window * s.step : 180;
      for (let a = -limit; a <= limit; a += limit / 24) {
        for (const [cx, cy] of corners) {
          let p;
          if (s.axis === 'x') {
            p = rotateY(rotateX([cx, cy, s.radius], -a), s.tilt);
          } else if (s.layout.billboard) {
            const c = rotateY([0, 0, s.radius], a);
            p = rotateX([c[0] + cx, cy, c[2]], s.tilt);
          } else {
            p = rotateX(rotateY([cx, cy, s.radius], a), s.tilt);
          }
          p = [p[0], p[1], p[2] - s.radius];
          if (p[2] >= P * 0.95) continue;
          const k = P / (P - p[2]);
          minX = Math.min(minX, p[0] * k);
          maxX = Math.max(maxX, p[0] * k);
          minY = Math.min(minY, p[1] * k);
          maxY = Math.max(maxY, p[1] * k);
        }
      }
    }
    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    const fit = Math.min(1, width / spanX, height / spanY);
    state.fit = fit;
    state.shift = -((minY + maxY) / 2) * fit - room / 2;
    state.drop = s.axis === 'x' ? (rect.width / fit) * 0.55 + s.cardW : (rect.height / fit) * 0.55 + s.cardH;
    stage.style.perspective = `${P}px`;
    stage.style.transform = `translate3d(0, ${state.shift}px, 0) scale(${fit})`;
  };

  const introCard = (elapsed, landing) => {
    if (!state.intro) return { radius: 1, lift: 0 };
    const type = state.intro.type;
    const reach = Math.abs(wrap(landing + state.angle));
    if (type === 'assemble') {
      const delay = (reach / 180) * 420;
      const p = easeOut(clamp((elapsed - delay) / 1080, 0, 1));
      return { radius: 1 + 0.6 * (1 - p), lift: 0 };
    }
    if (type === 'rise') {
      const delay = (reach / 180) * 480;
      const p = easeOutQuint(clamp((elapsed - delay) / 900, 0, 1));
      return { radius: 1, lift: (1 - p) * state.drop };
    }
    if (type === 'spin') {
      const p = easeOut(clamp(elapsed / INTRO_LENGTH.spin, 0, 1));
      return { radius: 1 + 0.28 * (1 - p), lift: 0 };
    }
    return { radius: 1, lift: 0 };
  };

  const advance = (s, dt, now) => {
    if (!state.introDone && ready) {
      if (!state.intro) {
        if (s.intro === 'none') state.introDone = true;
        else state.intro = { type: s.intro, start: now };
      }
      if (state.intro && now - state.intro.start >= INTRO_LENGTH[state.intro.type]) {
        state.intro = null;
        state.introDone = true;
      }
    }

    const paused = (s.pauseOnHover && state.hover) || state.drag || now < state.holdUntil;
    const cruise = s.autoplay === 'drift' && !paused && !state.intro ? s.speed * state.dir : 0;
    let busy = Boolean(state.intro) || state.drag;

    if (state.drag || state.intro) {
      state.velocity = state.drag ? state.velocity : 0;
    } else if (state.target !== null) {
      let remaining = dt;
      const damping = 2 * Math.sqrt(SPRING);
      while (remaining > 0) {
        const h = Math.min(remaining, 1 / 240);
        const accel = SPRING * (state.target - state.angle) - damping * state.velocity;
        state.velocity += accel * h;
        state.angle += state.velocity * h;
        remaining -= h;
      }
      if (Math.abs(state.target - state.angle) < 0.004 && Math.abs(state.velocity) < 0.03) {
        state.angle = state.target;
        state.velocity = 0;
        state.target = null;
      }
      busy = true;
    } else {
      const tau = 0.18 + s.momentum * 1.5;
      state.velocity += (cruise - state.velocity) * (1 - Math.exp(-dt / tau));
      state.angle += state.velocity * dt;
      if (cruise === 0 && s.snap && Math.abs(state.velocity) < SETTLE_SPEED) {
        state.target = nearest(state.angle);
      }
      busy = busy || cruise !== 0 || Math.abs(state.velocity) > 0.01 || state.target !== null;
    }

    if (s.autoplay === 'step' && !paused && !state.intro && state.introDone) {
      if (!state.stepAt) state.stepAt = now + s.interval * 1000;
      if (now >= state.stepAt) {
        state.target = (state.target ?? nearest(state.angle)) + s.step * state.dir;
        state.stepAt = now + s.interval * 1000;
      }
      busy = true;
    } else {
      state.stepAt = 0;
    }

    if (now < state.holdUntil) busy = true;

    const ease = 1 - Math.exp(-dt / 0.35);
    const aimYaw = state.pointer.inside ? state.pointer.x * s.parallax * 9 : 0;
    const aimPitch = state.pointer.inside ? -state.pointer.y * s.parallax * 6 : 0;
    state.yaw += (aimYaw - state.yaw) * ease;
    state.pitch += (aimPitch - state.pitch) * ease;
    if (Math.abs(aimYaw - state.yaw) > 0.01 || Math.abs(aimPitch - state.pitch) > 0.01) busy = true;

    return busy;
  };

  const render = (s, now) => {
    const elapsed = state.intro ? now - state.intro.start : 0;
    const swell = 1 + s.stretch * 0.12 * Math.min(1, Math.abs(state.velocity) / 420);
    let spinOffset = 0;
    if (state.intro?.type === 'spin') {
      const p = easeOut(clamp(elapsed / INTRO_LENGTH.spin, 0, 1));
      spinOffset = -300 * state.dir * (1 - p);
    } else if (state.intro?.type === 'assemble') {
      const p = easeOut(clamp(elapsed / INTRO_LENGTH.assemble, 0, 1));
      spinOffset = -32 * state.dir * (1 - p);
    }
    const angle = state.angle + spinOffset;
    const R = s.radius * swell;

    if (s.axis === 'x') {
      camera.style.transform = `translate3d(0, 0, ${-R}px) rotateY(${s.tilt + state.yaw}deg) rotateX(${state.pitch}deg)`;
      ring.style.transform = `rotateX(${-angle}deg)`;
    } else if (s.layout.inward) {
      camera.style.transform = `translate3d(0, 0, ${s.perspective - 1}px) rotateX(${s.tilt + state.pitch}deg) rotateY(${state.yaw}deg)`;
      ring.style.transform = `rotateY(${angle}deg)`;
    } else {
      camera.style.transform = `translate3d(0, 0, ${-R}px) rotateX(${s.tilt + state.pitch}deg) rotateY(${state.yaw}deg)`;
      ring.style.transform = `rotateY(${angle}deg)`;
    }

    for (let index = 0; index < s.count; index++) {
      const card = cards[index];
      if (!card) continue;
      const base = index * s.step;
      const mod = introCard(elapsed, base);
      const r = R * mod.radius;
      let transform;
      if (s.axis === 'x') {
        transform = `rotateX(${-base}deg) translateZ(${r}px)`;
      } else if (s.layout.inward) {
        transform = `rotateY(${base}deg) translateZ(${-r}px)`;
      } else {
        transform = `rotateY(${base}deg) translateZ(${r}px)`;
        if (s.layout.billboard) transform += ` rotateY(${-(base + angle)}deg)`;
      }
      if (mod.lift) transform += s.axis === 'x' ? ` translateX(${mod.lift}px)` : ` translateY(${mod.lift}px)`;
      card.style.transform = transform;

      const world = wrap(base + angle);
      const facing = Math.cos(world * TO_RAD);
      if (s.layout.inward) card.style.visibility = Math.abs(world) > 86 ? 'hidden' : '';
      const fade = s.depthFade * Math.pow((1 - facing) / 2, 1.25);
      card.style.setProperty('--cc-depth', fade.toFixed(3));
    }

    const index = ((Math.round(-state.angle / s.step) % s.count) + s.count) % s.count || 0;
    if (index !== active) {
      active = index;
      renderCaption();
      onChange?.(index);
    }
  };

  const frame = (now) => {
    raf = 0;
    if (destroyed) return;
    const s = settings;
    const dt = state.last ? Math.min((now - state.last) / 1000, 0.05) : 1 / 60;
    state.last = now;
    const busy = advance(s, dt, now);
    render(s, now);
    if (busy && visible && !document.hidden) raf = requestAnimationFrame(frame);
    else state.last = 0;
  };

  const wake = () => {
    if (!raf && visible && !document.hidden && !destroyed) raf = requestAnimationFrame(frame);
  };

  const onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
      state.last = 0;
    } else wake();
  };

  const resize = new ResizeObserver(() => {
    measure();
    wake();
  });
  resize.observe(root);

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) wake();
    else {
      cancelAnimationFrame(raf);
      raf = 0;
      state.last = 0;
    }
  });
  io.observe(root);

  const onMotionChange = () => {
    settings = makeSettings();
    measure();
    wake();
  };
  motionQuery?.addEventListener?.('change', onMotionChange);

  /* ---------- Input ---------- */

  const focusIndex = (index) => {
    let target = -index * settings.step;
    target += 360 * Math.round((state.angle - target) / 360);
    state.target = target;
    state.holdUntil = performance.now() + 2800;
    wake();
  };

  const stepBy = (delta) => {
    const s = settings;
    const base = state.target ?? Math.round(state.angle / s.step) * s.step;
    state.target = base - delta * s.step * (s.layout.inward ? -1 : 1);
    state.holdUntil = performance.now() + 2800;
    wake();
  };

  const setDragging = (on) => {
    if (on) root.setAttribute('data-dragging', '');
    else root.removeAttribute('data-dragging');
  };

  const updatePointer = (event) => {
    const rect = root.getBoundingClientRect();
    state.pointer.x = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
    state.pointer.y = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
  };

  const onWheel = (event) => {
    const s = settings;
    if (!s.draggable) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : 0;
    if (!delta) return;
    event.preventDefault();
    const perPixel = 180 / (Math.PI * s.radius * state.fit);
    state.target = null;
    state.angle -= delta * perPixel * (s.layout.inward ? -1 : 1);
    state.velocity = -delta * perPixel * (s.layout.inward ? -1 : 1) * 30;
    state.holdUntil = performance.now() + 1600;
    clearTimeout(state.wheelTimer);
    state.wheelTimer = setTimeout(() => {
      if (settings.snap) state.target = nearest(state.angle + state.velocity * 0.12);
      wake();
    }, 140);
    wake();
  };

  const onPointerDown = (event) => {
    state.suppressClick = false;
    if (!draggable || event.button !== 0) return;
    state.press = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      angle: state.angle,
      moved: false,
      origin: 0,
      samples: [{ time: performance.now(), angle: state.angle }],
    };
  };

  const onPointerMove = (event) => {
    if (event.pointerType === 'mouse') {
      state.pointer.inside = true;
      updatePointer(event);
    }
    const press = state.press;
    if (!press || press.id !== event.pointerId) {
      wake();
      return;
    }
    const s = settings;
    const delta = s.axis === 'x' ? event.clientY - press.y : event.clientX - press.x;
    const cross = s.axis === 'x' ? event.clientX - press.x : event.clientY - press.y;
    if (!press.moved) {
      if (Math.abs(delta) < DRAG_THRESHOLD) return;
      if (Math.abs(cross) > Math.abs(delta) * 1.2 && event.pointerType !== 'mouse') {
        state.press = null;
        return;
      }
      press.moved = true;
      press.origin = delta;
      state.drag = true;
      state.target = null;
      state.velocity = 0;
      setDragging(true);
      try {
        root.setPointerCapture(event.pointerId);
      } catch {}
    }
    const perPixel = 180 / (Math.PI * s.radius * state.fit);
    state.angle = press.angle + (delta - press.origin) * perPixel * (s.layout.inward ? -1 : 1);
    const now = performance.now();
    press.samples.push({ time: now, angle: state.angle });
    while (press.samples.length > 2 && now - press.samples[0].time > 110) press.samples.shift();
    wake();
  };

  const releasePointer = (event) => {
    const press = state.press;
    if (!press || press.id !== event.pointerId) return;
    state.press = null;
    if (!press.moved) return;
    state.drag = false;
    setDragging(false);
    state.suppressClick = true;
    const s = settings;
    const first = press.samples[0];
    const last = press.samples[press.samples.length - 1];
    const span = (last.time - first.time) / 1000;
    const velocity = span > 0.008 ? clamp((last.angle - first.angle) / span, -1400, 1400) : 0;
    state.velocity = velocity;
    if (Math.abs(velocity) > 60) state.dir = Math.sign(velocity);
    const coasting = s.autoplay === 'drift' && !(s.pauseOnHover && state.hover && event.pointerType === 'mouse');
    if (s.snap && !coasting) {
      const tau = 0.18 + s.momentum * 1.5;
      state.target = Math.round((state.angle + velocity * tau * 0.55) / s.step) * s.step;
    }
    wake();
  };

  const onPointerEnter = (event) => {
    if (event.pointerType !== 'mouse') return;
    state.hover = true;
    wake();
  };

  const onPointerLeave = (event) => {
    if (event.pointerType === 'mouse') {
      state.hover = false;
      state.pointer.inside = false;
    }
    wake();
  };

  const onClick = (event) => {
    if (state.suppressClick) {
      state.suppressClick = false;
      return;
    }
    const card = event.target.closest?.('[data-cc-index]');
    if (!card) return;
    const index = Number(card.getAttribute('data-cc-index'));
    if (focusOnClick) focusIndex(index);
    onItemClick?.(list[index], index);
  };

  const onKeyDown = (event) => {
    const forward = axis === 'x' ? 'ArrowDown' : 'ArrowRight';
    const backward = axis === 'x' ? 'ArrowUp' : 'ArrowLeft';
    if (event.key === forward) stepBy(1);
    else if (event.key === backward) stepBy(-1);
    else if (event.key === 'Home') focusIndex(0);
    else if (event.key === 'End') focusIndex(count - 1);
    else if (event.key === 'Enter' || event.key === ' ') onItemClick?.(list[active], active);
    else return;
    event.preventDefault();
  };

  root.addEventListener('wheel', onWheel, { passive: false });
  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerup', releasePointer);
  root.addEventListener('pointercancel', releasePointer);
  root.addEventListener('pointerenter', onPointerEnter);
  root.addEventListener('pointerleave', onPointerLeave);
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKeyDown);
  document.addEventListener('visibilitychange', onVisibility);

  measure();
  render(settings, performance.now());
  wake();

  /* ---------- Loading and image swaps ---------- */

  const preload = (sources) => {
    const load = (src) =>
      new Promise((resolve) => {
        const image = new Image();
        image.decoding = 'async';
        image.onload = () => (image.decode ? image.decode().then(resolve, resolve) : resolve());
        image.onerror = resolve;
        image.src = src;
      });
    const timeout = new Promise((resolve) => setTimeout(resolve, 2400));
    return Promise.race([Promise.all(sources.slice(0, 16).map(load)), timeout]);
  };

  preload(list.map((item) => item.src)).then(() => {
    if (destroyed) return;
    state.introDone = false;
    state.intro = null;
    ready = true;
    root.setAttribute('data-ready', '');
    wake();
  });

  let swapToken = 0;
  const setItems = (next) => {
    if (!next || next.length !== count) return false;
    const token = ++swapToken;
    preload(next.map((item) => item.src)).then(() => {
      if (destroyed || token !== swapToken) return;
      const previous = list;
      list = next;
      next.forEach((item, index) => {
        const delay = (Math.abs(wrap(index * settings.step + state.angle)) / 180) * SWAP_SPREAD;
        cards[index].setAttribute('aria-label', `${item.title || item.alt || `Image ${index + 1}`}, ${index + 1} of ${count}`);
        cardPhotos[index].forEach(({ img, frame: frameEl, style }) => {
          frameEl.querySelectorAll('.circular-carousel__photo--leaving').forEach((n) => n.remove());
          if (!settings.reduced && previous[index].src !== item.src) {
            const gone = el('img', 'circular-carousel__photo circular-carousel__photo--leaving');
            gone.src = previous[index].src;
            gone.alt = '';
            gone.draggable = false;
            gone.decoding = 'async';
            Object.assign(gone.style, style, { animationDelay: `${Math.round(delay)}ms` });
            img.after(gone);
            setTimeout(() => gone.remove(), SWAP_LENGTH + SWAP_SPREAD + 80);
          }
          img.src = item.src;
        });
      });
      renderCaption();
      wake();
    });
    return true;
  };

  const cleanup = () => {
    destroyed = true;
    cancelAnimationFrame(raf);
    resize.disconnect();
    io.disconnect();
    clearTimeout(state.wheelTimer);
    root.removeEventListener('wheel', onWheel);
    document.removeEventListener('visibilitychange', onVisibility);
    motionQuery?.removeEventListener?.('change', onMotionChange);
    root.remove();
  };
  cleanup.setItems = setItems;
  cleanup.focus = focusIndex;
  cleanup.root = root;
  return cleanup;
}
