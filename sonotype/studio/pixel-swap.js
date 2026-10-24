// PixelSwap from React Bits (JS + CSS variant), ported to vanilla JS.
// The engine follows the original component: a grid of pixels springs in,
// in the chosen pattern, and the growing pixels are the clip-path of the
// layer being revealed. Options mirror its props. The root holds two
// children with the class pixel-swap__layer: the first shown at rest, the
// second built in pixel by pixel.
const MAX_PIXELS = 600;
const STEP = 1 / 240;
const PATTERNS = ['pointer', 'random', 'center', 'edges', 'left-to-right', 'right-to-left', 'top-to-bottom', 'bottom-to-top', 'diagonal', 'spiral'];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const smoothstep = (edge0, edge1, value) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const hash = (index) => {
  let h = Math.imul(index + 1, 0x27d4eb2d);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const round = (value) => Math.round(value * 10) / 10;

const buildGrid = (width, height, pixelSize, gap) => {
  let size = pixelSize;
  let columns = Math.max(1, Math.ceil((width + gap) / (size + gap)));
  let rows = Math.max(1, Math.ceil((height + gap) / (size + gap)));
  if (columns * rows > MAX_PIXELS) {
    size = Math.ceil(size * Math.sqrt((columns * rows) / MAX_PIXELS));
    columns = Math.max(1, Math.ceil((width + gap) / (size + gap)));
    rows = Math.max(1, Math.ceil((height + gap) / (size + gap)));
  }
  const stride = size + gap;
  const startX = (width - (columns * stride - gap)) / 2;
  const startY = (height - (rows * stride - gap)) / 2;
  const count = columns * rows;
  const cx = new Float32Array(count);
  const cy = new Float32Array(count);
  const gx = new Float32Array(count);
  const gy = new Float32Array(count);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const index = row * columns + column;
      cx[index] = startX + column * stride + size / 2;
      cy[index] = startY + row * stride + size / 2;
      gx[index] = columns > 1 ? column / (columns - 1) : 0.5;
      gy[index] = rows > 1 ? row / (rows - 1) : 0.5;
    }
  }
  return { count, size, stride, gap, width, height, cx, cy, gx, gy };
};

const orderOf = (grid, index, pattern, point) => {
  const x = grid.gx[index];
  const y = grid.gy[index];
  if (pattern === 'random') return hash(index + 11);
  if (pattern === 'center') return Math.hypot(x - 0.5, y - 0.5) / Math.SQRT1_2;
  if (pattern === 'edges') return 1 - Math.min(x, 1 - x, y, 1 - y) * 2;
  if (pattern === 'left-to-right') return x;
  if (pattern === 'right-to-left') return 1 - x;
  if (pattern === 'top-to-bottom') return y;
  if (pattern === 'bottom-to-top') return 1 - y;
  if (pattern === 'diagonal') return (x + y) / 2;
  if (pattern === 'spiral') {
    const angle = (Math.atan2(y - 0.5, x - 0.5) + Math.PI) / (Math.PI * 2);
    return (angle + Math.hypot(x - 0.5, y - 0.5) / Math.SQRT1_2) / 2;
  }
  const px = point ? point.x : grid.width / 2;
  const py = point ? point.y : grid.height / 2;
  const reach = Math.max(
    Math.hypot(px, py),
    Math.hypot(grid.width - px, py),
    Math.hypot(px, grid.height - py),
    Math.hypot(grid.width - px, grid.height - py),
    1,
  );
  return Math.hypot(grid.cx[index] - px, grid.cy[index] - py) / reach;
};

const pixelPath = (x, y, half, radius, angle) => {
  if (!angle) {
    const x0 = round(x - half);
    const x1 = round(x + half);
    const y0 = round(y - half);
    const y1 = round(y + half);
    if (radius < 0.2) return `M${x0} ${y0}H${x1}V${y1}H${x0}Z`;
    const r = round(radius);
    return `M${round(x0 + r)} ${y0}H${round(x1 - r)}A${r} ${r} 0 0 1 ${x1} ${round(y0 + r)}V${round(y1 - r)}A${r} ${r} 0 0 1 ${round(x1 - r)} ${y1}H${round(x0 + r)}A${r} ${r} 0 0 1 ${x0} ${round(y1 - r)}V${round(y0 + r)}A${r} ${r} 0 0 1 ${round(x0 + r)} ${y0}Z`;
  }
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const at = (u, v) => `${round(x + u * cos - v * sin)} ${round(y + u * sin + v * cos)}`;
  const h = half;
  if (radius < 0.2) return `M${at(-h, -h)}L${at(h, -h)}L${at(h, h)}L${at(-h, h)}Z`;
  const r = round(radius);
  const k = h - radius;
  return `M${at(-k, -h)}L${at(k, -h)}A${r} ${r} 0 0 1 ${at(h, -k)}L${at(h, k)}A${r} ${r} 0 0 1 ${at(k, h)}L${at(-k, h)}A${r} ${r} 0 0 1 ${at(-h, k)}L${at(-h, -k)}A${r} ${r} 0 0 1 ${at(-k, -h)}Z`;
};

export default function pixelSwap(root, options = {}) {
  const layers = [...root.querySelectorAll(':scope > .pixel-swap__layer')];
  if (layers.length < 2) return null;
  const o = {
    pattern: 'pointer',
    pixelSize: 48,
    gap: 0,
    pixelRadius: 0,
    pixelScale: 0,
    pixelSpin: 0,
    duration: 400,
    pixelDuration: 350,
    randomness: 0.2,
    bounce: 0.3,
    trigger: 'click',
    onComplete: null,
    ...options,
  };
  const s = {
    pattern: PATTERNS.includes(o.pattern) ? o.pattern : 'pointer',
    pixelSize: Math.max(8, Math.round(o.pixelSize)),
    gap: Math.max(0, o.gap),
    pixelRadius: clamp(o.pixelRadius, 0, 50),
    pixelScale: clamp(o.pixelScale, 0, 0.9),
    pixelSpin: (clamp(o.pixelSpin, -360, 360) * Math.PI) / 180,
    duration: Math.max(0, o.duration),
    pixelDuration: Math.max(60, o.pixelDuration),
    randomness: clamp(o.randomness, 0, 1),
    bounce: clamp(o.bounce, 0, 1),
  };

  root.classList.add('pixel-swap');
  // Site addition: at rest the card is as tall as the face it shows (the
  // hidden face leaves the flow), and it eases between the two heights.
  let resizing = null;
  const easeHeight = (from, change) => {
    resizing?.cancel();
    change();
    const to = root.offsetHeight;
    if (Math.abs(to - from) < 1 || !root.animate) return to;
    resizing = root.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    return to;
  };
  let shown = false;
  let desired = false;
  let engine = null;

  const setLayer = (index, visible, clip) => {
    layers[index].setAttribute('data-visible', String(visible));
    layers[index].style.clipPath = clip || '';
  };
  const sync = () => {
    layers.forEach((layer, i) => layer.setAttribute('aria-hidden', String(i !== (shown ? 1 : 0))));
    layers.forEach((layer, i) => (layer.inert = i !== (shown ? 1 : 0)));
    if (o.trigger === 'click') root.setAttribute('aria-pressed', String(shown));
    root.toggleAttribute('data-active', shown);
  };
  setLayer(0, true, '');
  setLayer(1, false, '');
  sync();

  const finish = () => {
    engine.running = false;
    const target = engine.desired === 1;
    easeHeight(root.offsetHeight, () => {
      root.removeAttribute('data-swapping');
      setLayer(1, target, '');
      setLayer(0, !target, '');
    });
    shown = target;
    sync();
    o.onComplete?.(target);
  };

  const frame = (now) => {
    const grid = engine.grid;
    const { value, velocity, flipAt, target } = engine;
    const elapsed = clamp((now - engine.last) / 1000, 0, 1 / 20);
    engine.last = now;
    const omega = (Math.PI * 2) / (s.pixelDuration / 1000);
    const zeta = clamp(1 - s.bounce, 0.15, 1);
    const steps = Math.max(1, Math.ceil(elapsed / STEP));
    const dt = elapsed / steps;
    const pop = s.pixelScale;
    const half = grid.size / 2;
    const cover = grid.gap / 2 + 0.5;
    let moving = false;
    let path = '';

    for (let i = 0; i < grid.count; i++) {
      if (now >= flipAt[i] && target[i] !== engine.desired) {
        target[i] = engine.desired;
        if (target[i] === 1 && value[i] < pop) value[i] = pop;
      }
      let x = value[i];
      let v = velocity[i];
      const goal = target[i];
      for (let n = 0; n < steps; n++) {
        v += (-omega * omega * (x - goal) - 2 * zeta * omega * v) * dt;
        x += v * dt;
      }
      if (goal === 0 && x <= pop) {
        x = 0;
        v = 0;
      }
      if (Math.abs(x - goal) > 0.001 || Math.abs(v) > 0.01 || now < flipAt[i]) moving = true;
      else {
        x = goal;
        v = 0;
      }
      value[i] = x;
      velocity[i] = v;
      if (x <= 0.002) continue;
      const size = Math.min(x * 1.08, 1.25) * (half + cover * smoothstep(0.6, 0.93, x));
      const radius = Math.min(size, (s.pixelRadius / 50) * size * (1 - smoothstep(0.6, 0.93, x)));
      path += pixelPath(grid.cx[i], grid.cy[i], size, radius, s.pixelSpin * (1 - x));
    }

    setLayer(1, path !== '', path ? `path('${path}')` : '');
    if (moving) engine.raf = requestAnimationFrame(frame);
    else finish();
  };

  const launch = (to, point) => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const width = root.clientWidth;
    const height = root.clientHeight;
    if (reduce || !width || !height) return false;
    const now = performance.now();
    if (!engine?.running) {
      // Both faces take part in the layout while swapping, so the pixel grid
      // covers the taller one.
      const full = easeHeight(height, () => root.setAttribute('data-swapping', ''));
      const grid = buildGrid(width, full, s.pixelSize, s.gap);
      const start = shown ? 1 : 0;
      engine = {
        grid,
        value: new Float32Array(grid.count).fill(start),
        velocity: new Float32Array(grid.count),
        flipAt: new Float64Array(grid.count),
        target: new Uint8Array(grid.count).fill(start),
        desired: start,
        last: now,
        running: true,
        raf: engine?.raf ?? 0,
      };
    }
    engine.desired = to ? 1 : 0;
    const grid = engine.grid;
    const orders = new Float32Array(grid.count);
    let first = Infinity;
    for (let i = 0; i < grid.count; i++) {
      orders[i] = orderOf(grid, i, s.pattern, point) * (1 - s.randomness) + hash(i) * s.randomness;
      const settled = engine.target[i] === engine.desired && Math.abs(engine.value[i] - engine.desired) < 0.001;
      if (!settled) first = Math.min(first, orders[i]);
    }
    if (first === Infinity) first = 0;
    for (let i = 0; i < grid.count; i++) engine.flipAt[i] = now + Math.max(0, orders[i] - first) * s.duration;
    root.setAttribute('data-swapping', '');
    setLayer(0, true, '');
    cancelAnimationFrame(engine.raf);
    engine.raf = requestAnimationFrame(frame);
    return true;
  };

  const request = (to, point) => {
    if (!engine?.running && shown === to) return;
    if (launch(to, point)) return;
    setLayer(1, to, '');
    setLayer(0, !to, '');
    shown = to;
    sync();
    o.onComplete?.(to);
  };

  const pointOf = (event) => {
    const rect = root.getBoundingClientRect();
    if (!event || (event.detail === 0 && event.clientX === 0 && event.clientY === 0)) return null;
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const ask = (next, point) => {
    desired = next;
    request(next, point);
  };

  if (o.trigger === 'click') {
    root.setAttribute('role', 'button');
    root.tabIndex = 0;
    root.addEventListener('click', (event) => {
      // A text selection inside the card is not a tap.
      if (String(window.getSelection?.() || '').length) return;
      ask(!desired, pointOf(event));
    });
    root.addEventListener('keydown', (event) => {
      if (event.target !== root || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      ask(!desired, null);
    });
  } else if (o.trigger === 'hover') {
    root.tabIndex = 0;
    root.addEventListener('pointerenter', (e) => e.pointerType !== 'touch' && ask(true, pointOf(e)));
    root.addEventListener('pointerleave', (e) => e.pointerType !== 'touch' && ask(false, pointOf(e)));
    root.addEventListener('click', (e) => e.pointerType === 'touch' && ask(!desired, pointOf(e)));
  }

  return {
    set: (next) => ask(Boolean(next), null),
    get active() {
      return shown;
    },
  };
}
