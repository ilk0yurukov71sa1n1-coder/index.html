// DitherVeil from React Bits, ported to plain JavaScript and raw WebGL2
// (the original uses React and the ogl library). The shaders, dithering and
// behaviour are kept as in the original; only the plumbing is rewritten.
// Returns a cleanup function.

const INTRO_MS_DEFAULT = 1100;

const DEFAULTS = {
  src: '',
  fit: 'contain',
  pattern: 'floyd',
  pixelSize: 2,
  levels: 2,
  palette: 'duotone',
  inkColor: '#120f17',
  paperColor: '#f4f1ea',
  contrast: 1.15,
  brightness: 0,
  revealRadius: 200,
  softness: 0.6,
  linger: 1,
  rimColor: '#a78bfa',
  rim: 0,
  reverse: false,
  wander: false,
  clickBurst: true,
  maxFps: 0, // cap for the self-drifting spotlight; 0 = every frame
  introMs: INTRO_MS_DEFAULT, // how long the print takes to spread in; 0 = at once
  onReady: null, // called once, when the full picture is first on screen
  followPointer: true, // false: the spotlight only drifts on its own
};

const ORDERED = { bayer: 0, noise: 1, lines: 2 };

const KERNELS = {
  atkinson: [
    [1, 0, 1 / 8],
    [2, 0, 1 / 8],
    [-1, 1, 1 / 8],
    [0, 1, 1 / 8],
    [1, 1, 1 / 8],
    [0, 2, 1 / 8],
  ],
  floyd: [
    [1, 0, 7 / 16],
    [-1, 1, 3 / 16],
    [0, 1, 5 / 16],
    [1, 1, 1 / 16],
  ],
};

const MASK_SCALE = 0.5;
const MAX_BURSTS = 4;
const BURST_SECONDS = 1.2;
const HOLD = 1.6;

const hexToRgb = (hex) => {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const n = parseInt(h.slice(0, 6), 16);
  return Number.isNaN(n) ? [0, 0, 0] : [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const fitScale = (w, h, iw, ih, contain) => {
  const ratio = w / h / (iw / ih);
  if (contain) return ratio > 1 ? [ratio, 1] : [1, 1 / ratio];
  return ratio > 1 ? [1, 1 / ratio] : [ratio, 1];
};

const wanderAt = (t, w, h) => [
  w * (0.5 + 0.33 * Math.sin(t * 0.53) + 0.08 * Math.sin(t * 1.31 + 0.6)),
  h * (0.5 + 0.28 * Math.sin(t * 0.71 + 1.1) + 0.07 * Math.cos(t * 1.57)),
];

const measureEdge = (context, image) => {
  const size = 32;
  context.canvas.width = size;
  context.canvas.height = size;
  context.drawImage(image, 0, 0, size, size);
  const data = context.getImageData(0, 0, size, size).data;
  const sum = [0, 0, 0];
  const squares = [0, 0, 0];
  let count = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (x > 0 && y > 0 && x < size - 1 && y < size - 1) continue;
      for (let c = 0; c < 3; c++) {
        const v = data[(y * size + x) * 4 + c] / 255;
        sum[c] += v;
        squares[c] += v * v;
      }
      count++;
    }
  }
  const matte = [sum[0] / count, sum[1] / count, sum[2] / count];
  const spread =
    matte.reduce((total, mean, c) => total + Math.sqrt(Math.max(0, squares[c] / count - mean * mean)), 0) / 3;
  return { matte, plain: spread < 0.06 };
};

let blueNoise = null;

const getBlueNoise = () => {
  if (blueNoise) return blueNoise;
  const size = 64;
  const n = size * size;
  const wrap = size - 1;
  const taps = [];
  for (let dy = -6; dy <= 6; dy++) {
    for (let dx = -6; dx <= 6; dx++) taps.push(dx, dy, Math.exp(-(dx * dx + dy * dy) / 4.5));
  }
  const energy = new Float32Array(n);
  const on = new Uint8Array(n);
  const splat = (i, sign) => {
    const x = i % size;
    const y = (i - x) / size;
    for (let k = 0; k < taps.length; k += 3) {
      energy[((y + taps[k + 1]) & wrap) * size + ((x + taps[k]) & wrap)] += sign * taps[k + 2];
    }
  };
  const find = (state, highest) => {
    let best = 0;
    let value = highest ? -Infinity : Infinity;
    for (let i = 0; i < n; i++) {
      if (on[i] !== state) continue;
      if (highest ? energy[i] > value : energy[i] < value) {
        value = energy[i];
        best = i;
      }
    }
    return best;
  };
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const initial = Math.round(n * 0.1);
  for (let placed = 0; placed < initial; ) {
    const i = Math.floor(random() * n);
    if (on[i]) continue;
    on[i] = 1;
    splat(i, 1);
    placed++;
  }
  for (let guard = 0; guard < n; guard++) {
    const cluster = find(1, true);
    on[cluster] = 0;
    splat(cluster, -1);
    const gap = find(0, false);
    on[gap] = 1;
    splat(gap, 1);
    if (gap === cluster) break;
  }
  const seedOn = on.slice();
  const seedEnergy = energy.slice();
  const rank = new Uint16Array(n);
  for (let r = initial - 1; r >= 0; r--) {
    const cluster = find(1, true);
    on[cluster] = 0;
    splat(cluster, -1);
    rank[cluster] = r;
  }
  on.set(seedOn);
  energy.set(seedEnergy);
  for (let r = initial; r < n; r++) {
    const gap = find(0, false);
    on[gap] = 1;
    splat(gap, 1);
    rank[gap] = r;
  }
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const v = Math.floor((rank[i] / n) * 256);
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  blueNoise = data;
  return data;
};

const diffuse = (pixels, cols, rows, kernel, levels, rgb, grade) => {
  const channels = rgb ? 3 : 1;
  const values = new Float32Array(cols * rows * channels);
  for (let i = 0; i < cols * rows; i++) {
    const r = pixels[i * 4] / 255;
    const g = pixels[i * 4 + 1] / 255;
    const b = pixels[i * 4 + 2] / 255;
    if (rgb) {
      values[i * 3] = grade(r);
      values[i * 3 + 1] = grade(g);
      values[i * 3 + 2] = grade(b);
    } else {
      values[i] = grade(0.2126 * r + 0.7152 * g + 0.0722 * b);
    }
  }
  const steps = levels - 1;
  const out = new Uint8Array(cols * rows * 4);
  for (let y = 0; y < rows; y++) {
    const dir = y & 1 ? -1 : 1;
    for (let i = 0; i < cols; i++) {
      const x = dir > 0 ? i : cols - 1 - i;
      const p = y * cols + x;
      for (let c = 0; c < channels; c++) {
        const old = values[p * channels + c];
        const q = Math.min(steps, Math.max(0, Math.round(old * steps))) / steps;
        const err = old - q;
        const byte = Math.round(q * 255);
        if (rgb) out[p * 4 + c] = byte;
        else out[p * 4] = out[p * 4 + 1] = out[p * 4 + 2] = byte;
        for (let k = 0; k < kernel.length; k++) {
          const nx = x + kernel[k][0] * dir;
          const ny = y + kernel[k][1];
          if (nx < 0 || nx >= cols || ny >= rows) continue;
          values[(ny * cols + nx) * channels + c] += err * kernel[k][2];
        }
      }
      out[p * 4 + 3] = 255;
    }
  }
  return out;
};

const vertex = `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const maskFragment = `#version 300 es
precision highp float;

uniform sampler2D tPrev;
uniform vec2 uSize;
uniform vec2 uFrom;
uniform vec2 uTo;
uniform float uRadius;
uniform float uSoftness;
uniform float uStrength;
uniform float uFade;
uniform float uHold;

in vec2 vUv;
out vec4 fragColor;

float strokeDistance(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 0.0001), 0.0, 1.0);
  return length(p - a - ab * h);
}

void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uSize;
  float trail = max(texture(tPrev, vUv).r - uFade, 0.0);
  float band = max(uRadius * uSoftness, 1.0) * uHold;
  float d = strokeDistance(p, uFrom, uTo);
  trail = max(trail, clamp((uRadius - d) / band, 0.0, 1.0) * uStrength);
  fragColor = vec4(trail, 0.0, 0.0, 1.0);
}
`;

const viewFragment = `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D tImage;
uniform sampler2D tMask;
uniform sampler2D tNoise;
uniform sampler2D tDiffused;
uniform vec2 uResolution;
uniform vec2 uCover;
uniform float uLod;
uniform float uCell;
uniform int uPattern;
uniform int uPalette;
uniform float uLevels;
uniform vec3 uInk;
uniform vec3 uPaper;
uniform vec3 uRimColor;
uniform float uRim;
uniform float uContrast;
uniform float uBrightness;
uniform float uReverse;
uniform float uIntro;
uniform float uHold;
uniform vec3 uMatte;
uniform float uKey;
uniform vec2 uSize;
uniform vec4 uBursts[4];
uniform float uBurstWidth;

in vec2 vUv;
out vec4 fragColor;

float bayer(vec2 cell) {
  ivec2 p = ivec2(mod(cell, 8.0));
  int v = p.x ^ p.y;
  int m = ((v & 1) << 5) | ((p.y & 1) << 4) | ((v & 2) << 2) | ((p.y & 2) << 1) | ((v & 4) >> 1) | ((p.y & 4) >> 2);
  return (float(m) + 0.5) / 64.0;
}

float blueNoise(vec2 cell) {
  return (texelFetch(tNoise, ivec2(mod(cell, 64.0)), 0).r * 255.0 + 0.5) / 256.0;
}

float engraving(vec2 cell) {
  float period = 6.0;
  float f = (mod(cell.x + cell.y, period) + 0.5) / period;
  return clamp(abs(f * 2.0 - 1.0) + (bayer(cell) - 0.5) * (2.0 / period), 0.0, 1.0);
}

vec2 imageUv(vec2 uv) {
  return (uv - 0.5) * uCover + 0.5;
}

float within(vec2 p) {
  vec2 s = step(vec2(0.0), p) * step(p, vec2(1.0));
  return s.x * s.y;
}

vec3 grade(vec3 c) {
  return pow(clamp((c - 0.5) * uContrast + 0.5 + uBrightness, 0.0, 1.0), vec3(1.6));
}

float shockwave(vec2 p) {
  float value = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 burst = uBursts[i];
    if (burst.w <= 0.0) continue;
    float offset = distance(p, burst.xy) - burst.z;
    float edge = offset > 0.0 ? offset / (uBurstWidth * 0.35) : -offset / uBurstWidth;
    value = max(value, clamp(1.0 - edge, 0.0, 1.0) * burst.w);
  }
  return value;
}

vec3 toned(vec3 c) {
  return uPalette == 1 ? grade(c) : grade(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))));
}

vec3 quantize(vec3 v, float t) {
  float steps = max(uLevels - 1.0, 1.0);
  vec3 s = v * steps;
  vec3 base = floor(s);
  return min(base + step(vec3(t), s - base), vec3(steps)) / steps;
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  vec2 cell = floor(px / uCell);
  vec2 center = (cell + 0.5) * uCell;
  vec2 cellUv = vec2(center.x / uResolution.x, 1.0 - center.y / uResolution.y);

  vec2 sampleUv = imageUv(cellUv);
  float framed = within(sampleUv);
  vec3 level;
  if (uPattern == 3) {
    level = texelFetch(tDiffused, ivec2(cell), 0).rgb;
  } else {
    vec3 c = mix(uMatte, textureLod(tImage, sampleUv, uLod).rgb, framed);
    float t = uPattern == 1 ? blueNoise(cell) : (uPattern == 2 ? engraving(cell) : bayer(cell));
    level = quantize(toned(c), t);
  }

  vec3 color = mix(uInk, mix(uInk, uPaper, level), max(framed, uKey));
  vec3 backdrop = mix(uInk, uPaper, toned(uMatte));
  vec2 photoUv = imageUv(vUv);
  vec3 raw = texture(tImage, photoUv).rgb;
  float plain = uKey * (1.0 - smoothstep(0.05, 0.22, distance(raw, uMatte)));
  vec3 photo = mix(mix(uInk, backdrop, uKey), mix(raw, backdrop, plain), within(photoUv));

  vec2 point = vec2(cellUv.x, 1.0 - cellUv.y) * uSize;
  float mask = max(clamp(texture(tMask, cellUv).r * uHold, 0.0, 1.0), shockwave(point));
  float shown = mix(mask, 1.0 - mask, uReverse);
  float order = bayer(cell.yx);
  float low = order * (1.0 - uRim);
  color = mix(color, uRimColor, step(low, shown) * step(0.001, uRim));
  color = mix(color, photo, step(low + uRim, shown));

  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
  float spread = length((cellUv - 0.5) * aspect) / length(aspect * 0.5);
  float appear = step(spread * 0.72 + bayer(cell + vec2(3.0, 5.0)) * 0.28, uIntro * 1.001);
  fragColor = vec4(mix(uInk, color, appear), 1.0);
}
`;

/* ---------- Minimal WebGL2 plumbing (stands in for ogl) ---------- */

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(log || 'shader');
  }
  return shader;
}

function createProgram(gl, fragment, uniforms) {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.bindAttribLocation(program, 0, 'position');
  gl.bindAttribLocation(program, 1, 'uv');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('link');

  const setters = [];
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  let unit = 0;
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    const name = info.name.replace(/\[0\]$/, '');
    const location = gl.getUniformLocation(program, info.name);
    const slot = uniforms[name];
    if (!slot) continue;
    switch (info.type) {
      case gl.SAMPLER_2D: {
        const u = unit++;
        setters.push(() => {
          gl.activeTexture(gl.TEXTURE0 + u);
          gl.bindTexture(gl.TEXTURE_2D, slot.value.texture);
          gl.uniform1i(location, u);
        });
        break;
      }
      case gl.INT:
        setters.push(() => gl.uniform1i(location, slot.value));
        break;
      case gl.FLOAT:
        setters.push(() => gl.uniform1f(location, slot.value));
        break;
      case gl.FLOAT_VEC2:
        setters.push(() => gl.uniform2fv(location, slot.value));
        break;
      case gl.FLOAT_VEC3:
        setters.push(() => gl.uniform3fv(location, slot.value));
        break;
      case gl.FLOAT_VEC4:
        setters.push(() => gl.uniform4fv(location, slot.value));
        break;
      default:
        break;
    }
  }
  return {
    use() {
      gl.useProgram(program);
      setters.forEach((set) => set());
    },
    program,
  };
}

// A texture holder shaped like ogl's: set image/width/height, flag needsUpdate.
function createTexture(gl, { flipY = true, minFilter = gl.LINEAR, magFilter = gl.LINEAR, mipmaps = false } = {}) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  if (mipmaps) gl.generateMipmap(gl.TEXTURE_2D);
  const holder = {
    texture,
    image: null,
    width: 1,
    height: 1,
    needsUpdate: false,
    upload() {
      if (!holder.needsUpdate || !holder.image) return;
      holder.needsUpdate = false;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      if (ArrayBuffer.isView(holder.image)) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, holder.width, holder.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, holder.image);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, holder.image);
      }
      if (mipmaps) gl.generateMipmap(gl.TEXTURE_2D);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    },
  };
  return holder;
}

/* ---------- The component ---------- */

export default function ditherVeil(container, options = {}) {
  const s = { ...DEFAULTS, ...options };
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false });
  if (!gl) return null;
  container.appendChild(canvas);

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const floatMask = !!gl.getExtension('EXT_color_buffer_float');

  // Full-screen triangle, as ogl's Triangle.
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const positions = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positions);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const uvs = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvs);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 2, 0, 0, 2]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);

  const dataTexture = () => createTexture(gl, { flipY: false, minFilter: gl.NEAREST, magFilter: gl.NEAREST });
  const imageTexture = createTexture(gl, { minFilter: gl.LINEAR_MIPMAP_LINEAR, magFilter: gl.LINEAR, mipmaps: true });
  const noiseTexture = dataTexture();
  const diffusedTexture = dataTexture();

  const createMask = (w, h) => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    if (floatMask) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const buffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { buffer, texture: { texture }, width: w, height: h };
  };
  const destroyMask = (target) => {
    gl.deleteFramebuffer(target.buffer);
    gl.deleteTexture(target.texture.texture);
  };
  let masks = [createMask(2, 2), createMask(2, 2)];

  const maskUniforms = {
    tPrev: { value: masks[0].texture },
    uSize: { value: [1, 1] },
    uFrom: { value: [0, 0] },
    uTo: { value: [0, 0] },
    uRadius: { value: 1 },
    uSoftness: { value: 0.5 },
    uStrength: { value: 0 },
    uFade: { value: 1 },
    uHold: { value: HOLD },
  };
  const viewUniforms = {
    tImage: { value: imageTexture },
    tMask: { value: masks[0].texture },
    tNoise: { value: noiseTexture },
    tDiffused: { value: diffusedTexture },
    uResolution: { value: [1, 1] },
    uCover: { value: [1, 1] },
    uLod: { value: 0 },
    uCell: { value: 3 },
    uPattern: { value: 0 },
    uPalette: { value: 0 },
    uLevels: { value: 2 },
    uInk: { value: [0, 0, 0] },
    uPaper: { value: [1, 1, 1] },
    uRimColor: { value: [1, 1, 1] },
    uRim: { value: 0 },
    uContrast: { value: 1 },
    uBrightness: { value: 0 },
    uReverse: { value: 0 },
    uIntro: { value: 0 },
    uHold: { value: HOLD },
    uMatte: { value: [0, 0, 0] },
    uKey: { value: 0 },
    uSize: { value: [1, 1] },
    uBursts: { value: new Float32Array(MAX_BURSTS * 4) },
    uBurstWidth: { value: 60 },
  };

  let maskProgram;
  let viewProgram;
  try {
    maskProgram = createProgram(gl, maskFragment, maskUniforms);
    viewProgram = createProgram(gl, viewFragment, viewUniforms);
  } catch {
    canvas.remove();
    return null;
  }

  const draw = (prog, target) => {
    [imageTexture, noiseTexture, diffusedTexture].forEach((t) => t.upload());
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.buffer : null);
    gl.viewport(0, 0, target ? target.width : canvas.width, target ? target.height : canvas.height);
    gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(vao);
    prog.use();
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const sampler = document.createElement('canvas');
  const samplerContext = sampler.getContext('2d', { willReadFrequently: true });

  let image = null;
  let introStart = 0;
  let diffusedKey = '';
  let diffusionBlocked = false;
  let width = 1;
  let height = 1;
  let visible = true;
  let raf = 0;
  let last = performance.now();
  let trailUntil = 0;
  let presence = 0;
  let drift = 0;
  let destroyed = false;
  const pointer = { x: 0, y: 0, inside: false, fresh: true, placed: false };
  const brush = { x: 0, y: 0, px: 0, py: 0 };
  const bursts = [];

  const layout = () => {
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    viewUniforms.uResolution.value = [canvas.width, canvas.height];
    maskUniforms.uSize.value = [width, height];
    viewUniforms.uSize.value = [width, height];
    const mw = Math.max(2, Math.round(width * MASK_SCALE));
    const mh = Math.max(2, Math.round(height * MASK_SCALE));
    if (mw !== masks[0].width || mh !== masks[0].height) {
      masks.forEach(destroyMask);
      masks = [createMask(mw, mh), createMask(mw, mh)];
    }
    if (!pointer.placed) {
      pointer.x = width / 2;
      pointer.y = height / 2;
    }
  };

  const updateDiffusion = (cell) => {
    if (!image || !samplerContext) return;
    const cols = Math.ceil(canvas.width / cell);
    const rows = Math.ceil(canvas.height / cell);
    const key = [s.pattern, s.levels, s.palette, s.contrast, s.brightness, s.fit, cols, rows, canvas.width, canvas.height].join('|');
    if (key === diffusedKey) return;
    diffusedKey = key;
    const [cx, cy] = viewUniforms.uCover.value;
    const iw = image.naturalWidth;
    const ih = image.naturalHeight;
    sampler.width = cols;
    sampler.height = rows;
    samplerContext.imageSmoothingEnabled = true;
    samplerContext.imageSmoothingQuality = 'high';
    const [mr, mg, mb] = viewUniforms.uMatte.value;
    samplerContext.fillStyle = `rgb(${mr * 255}, ${mg * 255}, ${mb * 255})`;
    samplerContext.fillRect(0, 0, cols, rows);
    const sx = (0.5 - 0.5 * cx) * iw;
    const sy = (0.5 - 0.5 * cy) * ih;
    const sw = ((cols * cell) / canvas.width) * cx * iw;
    const sh = ((rows * cell) / canvas.height) * cy * ih;
    const x0 = Math.max(sx, 0);
    const y0 = Math.max(sy, 0);
    const x1 = Math.min(sx + sw, iw);
    const y1 = Math.min(sy + sh, ih);
    if (x1 > x0 && y1 > y0) {
      samplerContext.drawImage(
        image,
        x0,
        y0,
        x1 - x0,
        y1 - y0,
        ((x0 - sx) / sw) * cols,
        ((y0 - sy) / sh) * rows,
        ((x1 - x0) / sw) * cols,
        ((y1 - y0) / sh) * rows,
      );
    }
    const grade = (v) => Math.pow(Math.min(1, Math.max(0, (v - 0.5) * s.contrast + 0.5 + s.brightness)), 1.6);
    const pixels = samplerContext.getImageData(0, 0, cols, rows).data;
    diffusedTexture.image = diffuse(pixels, cols, rows, KERNELS[s.pattern], s.levels, s.palette === 'rgb', grade);
    diffusedTexture.width = cols;
    diffusedTexture.height = rows;
    diffusedTexture.needsUpdate = true;
  };

  let drawnAt = 0;
  let held = false;
  // Until the picture is fully on screen, a scroll doesn't freeze it.
  let ready = false;
  const frame = (now) => {
    raf = 0;
    if (destroyed || (held && ready) || gl.isContextLost()) return;
    // A spotlight drifting on its own looks the same at a lower rate; one
    // that follows a finger or cursor gets every frame.
    if (s.maxFps > 0 && !pointer.inside && bursts.length === 0 && now - drawnAt < 1000 / s.maxFps - 4) {
      raf = requestAnimationFrame(frame);
      return;
    }
    drawnAt = now;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;

    const wanderOn = s.wander && !reducedMotion;
    let targetX = pointer.x;
    let targetY = pointer.y;
    if (!pointer.inside && wanderOn) {
      drift = Math.min(1, drift + dt / 1.2);
      const [wx, wy] = wanderAt(now / 1000, width, height);
      const k = drift * drift * (3 - 2 * drift);
      targetX += (wx - targetX) * k;
      targetY += (wy - targetY) * k;
    } else {
      drift = 0;
    }

    presence += ((pointer.inside || wanderOn ? 1 : 0) - presence) * (1 - Math.exp(-dt / 0.16));

    if (pointer.fresh) {
      brush.x = brush.px = targetX;
      brush.y = brush.py = targetY;
      pointer.fresh = false;
    } else {
      const follow = 1 - Math.exp(-dt / 0.035);
      brush.x += (targetX - brush.x) * follow;
      brush.y += (targetY - brush.y) * follow;
    }

    const burstData = viewUniforms.uBursts.value;
    burstData.fill(0);
    for (let i = bursts.length - 1; i >= 0; i--) {
      if ((now - bursts[i].start) / 1000 >= BURST_SECONDS) bursts.splice(i, 1);
    }
    bursts.forEach((b, i) => {
      const k = Math.max(0, (now - b.start) / 1000 / BURST_SECONDS);
      const reach = Math.hypot(Math.max(b.x, width - b.x), Math.max(b.y, height - b.y)) + viewUniforms.uBurstWidth.value;
      burstData[i * 4] = b.x;
      burstData[i * 4 + 1] = b.y;
      burstData[i * 4 + 2] = reach * Math.sin((k * Math.PI) / 2);
      burstData[i * 4 + 3] = 1 - k * k * k;
    });

    if (presence > 0.002) trailUntil = now + s.linger * 1000 + 150;

    const minFade = floatMask ? 0 : 1.5 / 255;
    const fade = s.linger > 0 ? dt / s.linger : 1;
    maskUniforms.tPrev.value = masks[0].texture;
    maskUniforms.uFrom.value = [brush.px, brush.py];
    maskUniforms.uTo.value = [brush.x, brush.y];
    maskUniforms.uRadius.value = s.revealRadius * (0.45 + 0.55 * presence);
    maskUniforms.uSoftness.value = s.softness;
    maskUniforms.uStrength.value = presence;
    maskUniforms.uFade.value = Math.max(fade, minFade);
    viewUniforms.uBurstWidth.value = Math.max(60, s.revealRadius * 0.9);
    draw(maskProgram, masks[1]);
    masks.reverse();
    brush.px = brush.x;
    brush.py = brush.y;

    const cell = Math.max(1, Math.round(s.pixelSize * dpr));
    if (image) {
      viewUniforms.uCover.value = fitScale(canvas.width, canvas.height, image.naturalWidth, image.naturalHeight, s.fit === 'contain');
    }
    let patternIndex = ORDERED[s.pattern] ?? 0;
    if (KERNELS[s.pattern]) {
      patternIndex = 0;
      if (image && !diffusionBlocked) {
        try {
          updateDiffusion(cell);
          patternIndex = 3;
        } catch {
          diffusionBlocked = true;
        }
      }
    }
    if (patternIndex === 1 && noiseTexture.width !== 64) {
      noiseTexture.image = getBlueNoise();
      noiseTexture.width = 64;
      noiseTexture.height = 64;
      noiseTexture.needsUpdate = true;
    }

    const texelsPerPixel = image ? (viewUniforms.uCover.value[0] * image.naturalWidth) / canvas.width : 1;
    viewUniforms.tMask.value = masks[0].texture;
    viewUniforms.uCell.value = cell;
    viewUniforms.uLod.value = Math.log2(Math.max(cell * texelsPerPixel, 1));
    viewUniforms.uPattern.value = patternIndex;
    viewUniforms.uPalette.value = s.palette === 'rgb' ? 1 : 0;
    viewUniforms.uLevels.value = Math.max(2, Math.round(s.levels));
    viewUniforms.uInk.value = hexToRgb(s.inkColor);
    viewUniforms.uPaper.value = hexToRgb(s.paperColor);
    viewUniforms.uRimColor.value = hexToRgb(s.rimColor);
    viewUniforms.uRim.value = Math.min(Math.max(s.rim, 0), 0.95);
    viewUniforms.uContrast.value = s.contrast;
    viewUniforms.uBrightness.value = s.brightness;
    viewUniforms.uReverse.value = s.reverse ? 1 : 0;
    const intro = image ? (s.introMs > 0 ? Math.min(1, (now - introStart) / s.introMs) : 1) : 0;
    viewUniforms.uIntro.value = 1 - Math.pow(1 - intro, 2);
    draw(viewProgram, null);
    if (!ready && intro >= 1) {
      ready = true;
      s.onReady?.();
    }

    const busy = pointer.inside || wanderOn || presence > 0.002 || bursts.length > 0 || now < trailUntil || (image && intro < 1);
    if (busy && visible) raf = requestAnimationFrame(frame);
  };

  const wake = () => {
    if (raf || !visible || destroyed || (held && ready)) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  img.onload = () => {
    image = img;
    imageTexture.image = img;
    imageTexture.needsUpdate = true;
    try {
      if (samplerContext) {
        const edge = measureEdge(samplerContext, img);
        viewUniforms.uMatte.value = edge.matte;
        viewUniforms.uKey.value = edge.plain ? 1 : 0;
      }
    } catch {
      /* A photo without CORS still shows, just without the matte. */
    }
    introStart = performance.now();
    wake();
  };
  img.src = s.src;

  const locate = (e) => {
    const rect = container.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
    pointer.placed = true;
  };
  const onMove = (e) => {
    locate(e);
    if (!pointer.inside) {
      pointer.inside = true;
      pointer.fresh = true;
    }
    wake();
  };
  const onLeave = () => {
    pointer.inside = false;
    wake();
  };
  const onDown = (e) => {
    onMove(e);
    if (!s.clickBurst || (e.pointerType === 'mouse' && e.button !== 0)) return;
    bursts.push({ x: pointer.x, y: pointer.y, start: performance.now() });
    if (bursts.length > MAX_BURSTS) bursts.shift();
  };
  if (s.followPointer) {
    container.addEventListener('pointermove', onMove, { passive: true });
    container.addEventListener('pointerenter', onMove, { passive: true });
    container.addEventListener('pointerdown', onDown, { passive: true });
    container.addEventListener('pointerleave', onLeave, { passive: true });
    container.addEventListener('pointercancel', onLeave, { passive: true });
  }

  const resizeObserver = new ResizeObserver(() => {
    layout();
    diffusedKey = '';
    wake();
  });
  resizeObserver.observe(container);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    wake();
  });
  intersectionObserver.observe(container);

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    cancelAnimationFrame(raf);
    raf = 0;
  });

  layout();
  wake();

  const stop = () => {
    destroyed = true;
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    img.onload = null;
    container.removeEventListener('pointermove', onMove);
    container.removeEventListener('pointerenter', onMove);
    container.removeEventListener('pointerdown', onDown);
    container.removeEventListener('pointerleave', onLeave);
    container.removeEventListener('pointercancel', onLeave);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    canvas.remove();
  };
  // Freeze on the current picture (while the page scrolls) and carry on after.
  stop.hold = (value) => {
    if (held === Boolean(value)) return;
    held = Boolean(value);
    if (held) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else {
      last = performance.now();
      wake();
    }
  };
  return stop;
}
