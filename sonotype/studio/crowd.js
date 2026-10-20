// Crowd Canvas (Skiper UI "Skiper 39", after zadvorsky's CodePen, with
// Open Peeps illustrations), ported to plain JavaScript without gsap.
// People walk across the bottom of the canvas, each at their own pace,
// bobbing as they go. Returns a cleanup function.

const randomRange = (min, max) => min + Math.random() * (max - min);
const randomIndex = (array) => randomRange(0, array.length) | 0;
const removeFromArray = (array, i) => array.splice(i, 1)[0];
const removeItemFromArray = (array, item) => removeFromArray(array, array.indexOf(item));
const removeRandomFromArray = (array) => removeFromArray(array, randomIndex(array));

// gsap's "power2.in" and its default "power1.out".
const power2In = (t) => t * t;
const power1Out = (t) => 1 - (1 - t) * (1 - t);

const X_DURATION = 10;
const Y_DURATION = 0.25;

export default function crowdCanvas(canvas, { src, rows = 15, cols = 7 } = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const stage = { width: 0, height: 0 };
  const allPeeps = [];
  const availablePeeps = [];
  const crowd = [];
  const img = new Image();
  let raf = 0;
  let last = 0;
  let visible = false;
  let ready = false;
  let destroyed = false;

  const createPeep = (rect) => ({
    rect,
    width: rect[2],
    height: rect[3],
    x: 0,
    y: 0,
    anchorY: 0,
    scaleX: 1,
    walk: null,
  });

  // Where a person starts and ends, as in the original resetPeep.
  const resetPeep = (peep) => {
    const direction = Math.random() > 0.5 ? 1 : -1;
    const offsetY = 100 - 250 * power2In(Math.random());
    const startY = stage.height - peep.height + offsetY;
    let startX;
    let endX;
    if (direction === 1) {
      startX = -peep.width;
      endX = stage.width;
      peep.scaleX = 1;
    } else {
      startX = stage.width + peep.width;
      endX = 0;
      peep.scaleX = -1;
    }
    peep.x = startX;
    peep.y = startY;
    peep.anchorY = startY;
    return { startX, startY, endX };
  };

  // The walk: straight across in 10 s of its own time, bobbing up 10 px
  // every quarter second, with its own speed between 0.5x and 1.5x.
  const normalWalk = (peep, { startX, startY, endX }) => ({
    startX,
    startY,
    endX,
    timeScale: randomRange(0.5, 1.5),
    time: 0,
    progress(p) {
      this.time = p * X_DURATION;
      this.apply(peep);
    },
    apply(target) {
      const t = Math.min(this.time, X_DURATION);
      target.x = this.startX + (this.endX - this.startX) * (t / X_DURATION);
      const cycle = Math.floor(t / Y_DURATION);
      const f = (t - cycle * Y_DURATION) / Y_DURATION;
      const lift = cycle % 2 === 0 ? power1Out(f) : power1Out(1 - f);
      target.y = this.startY - 10 * lift;
    },
  });

  const addPeepToCrowd = () => {
    const peep = removeRandomFromArray(availablePeeps);
    peep.walk = normalWalk(peep, resetPeep(peep));
    crowd.push(peep);
    crowd.sort((a, b) => a.anchorY - b.anchorY);
    return peep;
  };

  const removePeepFromCrowd = (peep) => {
    removeItemFromArray(crowd, peep);
    availablePeeps.push(peep);
  };

  const initCrowd = () => {
    while (availablePeeps.length) addPeepToCrowd().walk.progress(Math.random());
  };

  const createPeeps = () => {
    const { naturalWidth: width, naturalHeight: height } = img;
    const total = rows * cols;
    const rectWidth = width / rows;
    const rectHeight = height / cols;
    for (let i = 0; i < total; i++) {
      allPeeps.push(createPeep([(i % rows) * rectWidth, ((i / rows) | 0) * rectHeight, rectWidth, rectHeight]));
    }
  };

  const render = () => {
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);
    crowd.forEach((peep) => {
      ctx.save();
      ctx.translate(peep.x, peep.y);
      ctx.scale(peep.scaleX, 1);
      ctx.drawImage(img, peep.rect[0], peep.rect[1], peep.rect[2], peep.rect[3], 0, 0, peep.width, peep.height);
      ctx.restore();
    });
    ctx.restore();
  };

  const tick = (now) => {
    raf = 0;
    if (destroyed || !visible) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    [...crowd].forEach((peep) => {
      const walk = peep.walk;
      walk.time += dt * walk.timeScale;
      if (walk.time >= X_DURATION) {
        removePeepFromCrowd(peep);
        addPeepToCrowd();
      } else {
        walk.apply(peep);
      }
    });
    render();
    raf = requestAnimationFrame(tick);
  };

  const start = () => {
    if (raf || !ready || !visible || destroyed) return;
    last = 0;
    raf = requestAnimationFrame(tick);
  };

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    stage.width = canvas.clientWidth;
    stage.height = canvas.clientHeight;
    canvas.width = stage.width * dpr;
    canvas.height = stage.height * dpr;
    if (!ready) return;
    crowd.length = 0;
    availablePeeps.length = 0;
    availablePeeps.push(...allPeeps);
    initCrowd();
    render();
  };

  img.onload = () => {
    if (destroyed) return;
    createPeeps();
    ready = true;
    resize();
    start();
  };
  img.src = src;

  let lastWidth = 0;
  const resizeObserver = new ResizeObserver(() => {
    // Phones resize the viewport height as the toolbar hides; only restart
    // the crowd when the width really changes.
    if (Math.abs(canvas.clientWidth - lastWidth) < 1 && ready) return;
    lastWidth = canvas.clientWidth;
    resize();
  });
  resizeObserver.observe(canvas);

  // Only walk while someone can see it.
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start();
  });
  io.observe(canvas);

  return () => {
    destroyed = true;
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    io.disconnect();
    img.onload = null;
  };
}
