// Liquid Glass, ported from ilko's Liquid Glass lab to the booking page.
// Thousands of water drops are drawn as one glassy surface: depth and
// thickness passes, an edge-keeping blur, then a composite that refracts and
// reflects the scene behind (screen-space fluid rendering).
//
// On /book it is the whole page background, and the visitor's own scrolling
// moves it; nothing plays by itself. At the top the water is an orb in front of
// the name (touch or drag through it to splash, double-click to freeze). Scroll
// down and it gathers into a drop, falls, lands, and the ring it sends out rips
// the surface open onto a world of fibres that the form sits on; scroll back up
// and it all closes and rises into the orb again. Fibres drift only as you scroll.
// A click on any empty spot punches a hole through to the other world; its torn
// rim frays into fibres, and it grows back shut in fibres of the next colour.
//
// Smoothness: the pixel ratio adapts to the frame time, rendering pauses while
// the tab is hidden or the pool is still, and the caller only starts it when
// WebGL2 with float targets is available.
import * as THREE from 'three';

const sm = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Brand backdrop: off-white, blush and oxblood instead of the lab's blue.
const LOOK = { b0: [0.957, 0.945, 0.925], b1: [1, 0.82, 0.78], b2: [0.92, 0.84, 0.84], b3: [0.86, 0.52, 0.5], ink: [0.49, 0.114, 0.125], line: 0.07, env0: [0.9, 0.86, 0.84], env1: [1, 1, 1] };

// How far down the page (0 top, 1 bottom) -> scene progress: orb, gather, fall, land, rip open.
const ROUTE = [
  [0, 0],
  [0.2, 0.7],
  [0.36, 0.8],
  [0.5, 0.88],
  [0.92, 1],
];
export const scrollQ = (s) => {
  if (s <= 0) return 0;
  for (let k = 0; k < ROUTE.length - 1; k++) {
    const [sa, qa] = ROUTE[k];
    const [sb, qb] = ROUTE[k + 1];
    if (s <= sb) return mix(qa, qb, ease((s - sa) / (sb - sa)));
  }
  return ROUTE[ROUTE.length - 1][1];
};
const Q_END = ROUTE[ROUTE.length - 1][1];

// WebGL2 with float render targets: the only setup this renders well on.
export const liquidSupported = () => {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    return Boolean(gl && gl.getExtension('EXT_color_buffer_float'));
  } catch {
    return false;
  }
};

export function createLiquid(canvas, { text = '', font = 'system-ui, sans-serif', touchable = () => true } = {}) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PHONE = Math.min(innerWidth, innerHeight) < 600;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  const N = PHONE ? 1500 : 2700;
  const PR_R = PHONE ? 0.17 : 0.14;
  const PR_MAX = Math.min(devicePixelRatio || 1, PHONE ? 1.5 : 1.35);
  let PR = PR_MAX;
  renderer.setPixelRatio(PR);
  renderer.setClearColor(0, 0);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);

  const CU = { uB0: { value: V3() }, uB1: { value: V3() }, uB2: { value: V3() }, uB3: { value: V3() }, uInk: { value: V3() }, uEnv0: { value: V3() }, uEnv1: { value: V3() }, uLine: { value: 0.08 }, uT: { value: 0 } };
  CU.uB0.value.fromArray(LOOK.b0);
  CU.uB1.value.fromArray(LOOK.b1);
  CU.uB2.value.fromArray(LOOK.b2);
  CU.uB3.value.fromArray(LOOK.b3);
  CU.uInk.value.fromArray(LOOK.ink);
  CU.uEnv0.value.fromArray(LOOK.env0);
  CU.uEnv1.value.fromArray(LOOK.env1);
  CU.uLine.value = LOOK.line;

  const SKYF = `vec3 skyC(vec3 d){
  float y = d.y;
  vec3 c = mix(uB0*1.02, mix(uB0, uB2, .35), smoothstep(0., .9, y));
  float a = atan(d.z, d.x);
  float w1 = .5 + .5*sin(a*2. + uT*.05 + y*2.); float w2 = .5 + .5*sin(a*3. - 1. - uT*.04 + y*3.);
  c = mix(c, uB1, .55*pow(w1, 3.)*smoothstep(-.1, .5, y));
  c = mix(c, uB3, .5*pow(w2, 4.)*smoothstep(-.1, .6, y));
  c = mix(c, uB0, smoothstep(.15, -.05, y)*.6);
  return c;
}`;
  const disposables = [];
  const keep = (x) => (disposables.push(x), x);

  const bgScene = new THREE.Scene();
  const sky = new THREE.Mesh(
    keep(new THREE.SphereGeometry(90, 40, 20)),
    keep(
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: CU,
        vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.); }',
        fragmentShader: ['uniform vec3 uB0, uB1, uB2, uB3, uInk, uEnv0, uEnv1; uniform float uLine, uT; varying vec3 vD;', SKYF, 'void main(){ gl_FragColor = vec4(skyC(normalize(vD)), 1.); }'].join('\n'),
      })
    )
  );
  sky.renderOrder = -1;
  bgScene.add(sky);

  // The floor: a shallow pool with tiles under a thin sheet of water that ripples where drops land.
  const RIP = [];
  for (let r0 = 0; r0 < 12; r0++) RIP.push(new THREE.Vector4(0, 0, -99, 0));
  const floorMat = keep(
    new THREE.ShaderMaterial({
      uniforms: Object.assign({ uRip: { value: RIP }, uCamP: { value: V3() } }, CU),
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
      fragmentShader: [
        'uniform vec3 uB0, uB1, uB2, uB3, uInk, uEnv0, uEnv1, uCamP; uniform float uLine, uT; uniform vec4 uRip[12]; varying vec3 vW;',
        SKYF,
        `void main(){
  vec2 p = vW.xz; vec2 gsum = vec2(0.); float hsum = 0.;
  for (int i = 0; i < 12; i++){ vec4 r = uRip[i]; float age = uT - r.z; if (age < 0. || age > 4.) continue;
    vec2 d = p - r.xy; float L = length(d) + 1e-4; float x = L - age*2.2;
    float env = exp(-x*x*1.6)*exp(-age*.9)*r.w/(1. + L*.6);
    float ph = x*9.; hsum += sin(ph)*env; gsum += d/L*cos(ph)*9.*env; }
  vec2 q = p + gsum*.012;
  vec2 g = abs(fract(q) - .5); float fw = fwidth(q.x)*1.2;
  float ln = 1. - smoothstep(0., fw + .01, min(g.x, g.y));
  vec2 g5 = abs(fract(q/5.) - .5)*5.; float ln5 = 1. - smoothstep(0., fw*1.5 + .02, min(g5.x, g5.y));
  vec2 ck = floor(q); float chk = mod(ck.x + ck.y, 2.);
  vec3 c = mix(uB0, uB2, .18 + .1*sin(q.x*.3 + q.y*.2)); c = mix(c, mix(uB1, uB3, .5 + .5*sin(ck.x*.7 + ck.y*.4)), .13*chk);
  c = mix(c, uInk, ln*uLine*.9 + ln5*uLine*1.4);
  vec3 V = normalize(vW - uCamP); vec3 n = normalize(vec3(-gsum.x*.06, 1., -gsum.y*.06));
  vec3 R = reflect(V, n); float F = .04 + .96*pow(1. - max(dot(-V, n), 0.), 5.);
  c = mix(c, skyC(R), F*.9);
  c += uEnv1*max(hsum, 0.)*.12;
  float fog = smoothstep(18., 70., length(vW - uCamP));
  c = mix(c, skyC(normalize(vec3(V.x, .02, V.z))), fog);
  gl_FragColor = vec4(c, 1.);
}`,
      ].join('\n'),
    })
  );
  const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(220, 220)), floorMat);
  floor.rotation.x = -Math.PI / 2;
  bgScene.add(floor);

  // The salon name stands behind the water, so the water visibly bends it.
  const tcv = document.createElement('canvas');
  tcv.width = 2048;
  tcv.height = 512;
  const ttex = keep(new THREE.CanvasTexture(tcv));
  const drawText = () => {
    const c = tcv.getContext('2d');
    c.clearRect(0, 0, 2048, 512);
    c.fillStyle = '#fff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    let fs = 300;
    c.font = `600 ${fs}px ${font}`;
    const w = c.measureText(text).width;
    if (w > 1960) {
      fs *= 1960 / w;
      c.font = `600 ${fs}px ${font}`;
    }
    c.fillText(text, 1024, 270);
    ttex.needsUpdate = true;
  };
  drawText();
  document.fonts?.ready?.then(drawText);
  const textMat = keep(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: Object.assign({ tT: { value: ttex } }, CU),
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.); }',
      fragmentShader: 'uniform sampler2D tT; uniform vec3 uInk; varying vec2 vUv; void main(){ float a = texture2D(tT, vUv).a; gl_FragColor = vec4(uInk, a*.92); }',
    })
  );
  const textMesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(12, 3)), textMat);
  textMesh.position.set(0, 2.5, -5.5);
  bgScene.add(textMesh);

  // ---------- render targets ----------
  const FT = THREE.FloatType;
  const rt = (type, filter, depth) => keep(new THREE.WebGLRenderTarget(4, 4, { type, format: THREE.RGBAFormat, minFilter: filter, magFilter: filter, depthBuffer: !!depth, stencilBuffer: false }));
  const bgRT = rt(THREE.UnsignedByteType, THREE.LinearFilter, true);
  bgRT.depthTexture = keep(new THREE.DepthTexture(4, 4));
  bgRT.depthTexture.type = THREE.UnsignedIntType;
  const wRT = rt(FT, THREE.NearestFilter, true);
  const bA = rt(FT, THREE.NearestFilter);
  const bB = rt(FT, THREE.NearestFilter);
  const thRT = rt(THREE.HalfFloatType, THREE.LinearFilter);

  // ---------- water drops ----------
  const geo = keep(new THREE.BufferGeometry());
  const aPos = new Float32Array(N * 3);
  const aSize = new Float32Array(N);
  const aIce = new Float32Array(N);
  const aVel = new Float32Array(N * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(aPos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aIce', new THREE.BufferAttribute(aIce, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aVel', new THREE.BufferAttribute(aVel, 3).setUsage(THREE.DynamicDrawUsage));
  geo.boundingSphere = new THREE.Sphere(V3(0, 0, 0), 1e4);
  const PU = { uR: { value: PR_R }, uScale: { value: 500 }, uProj: { value: new THREE.Matrix4() } };
  const VSP = `attribute float aSize, aIce; attribute vec3 aVel; uniform float uR, uScale; varying vec3 vV; varying float vRad, vIce; varying vec2 vSv;
void main(){
  vec4 mv = modelViewMatrix*vec4(position, 1.); vV = mv.xyz; vRad = uR*aSize; vIce = aIce;
  vec4 c0 = projectionMatrix*mv, c1 = projectionMatrix*(mv + vec4(mat3(viewMatrix)*aVel*.1, 0.));
  vSv = c1.xy/c1.w - c0.xy/c0.w;
  gl_Position = c0; gl_PointSize = aSize > 0.001 && mv.z < -.15 ? 2.*vRad*uScale/-mv.z : 0.;
}`;
  const depthMat = keep(
    new THREE.ShaderMaterial({
      uniforms: PU,
      vertexShader: VSP,
      fragmentShader: `uniform float uR, uScale; uniform mat4 uProj; varying vec3 vV; varying float vRad, vIce; varying vec2 vSv;
void main(){ vec2 c = gl_PointCoord*2. - 1.; c.y = -c.y; float r2 = dot(c, c); if (r2 > 1.) discard;
  vec3 p = vV + vec3(c*vRad, sqrt(1. - r2)*vRad);
  vec4 cl = uProj*vec4(p, 1.); gl_FragDepthEXT = cl.z/cl.w*.5 + .5;
  gl_FragColor = vec4(-p.z, 0., 0., 1.); }`,
    })
  );
  const thickMat = keep(
    new THREE.ShaderMaterial({
      uniforms: PU,
      vertexShader: VSP,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneFactor,
      fragmentShader: `uniform float uR, uScale; varying vec3 vV; varying float vRad, vIce; varying vec2 vSv;
void main(){ vec2 c = gl_PointCoord*2. - 1.; float r2 = dot(c, c); if (r2 > 1.) discard;
  float t = sqrt(1. - r2)*vRad*2.;
  gl_FragColor = vec4(t, t*vIce, t*vSv.x, t*vSv.y); }`,
    })
  );
  const wScene = new THREE.Scene();
  const tScene = new THREE.Scene();
  const ptsD = new THREE.Points(geo, depthMat);
  const ptsT = new THREE.Points(geo, thickMat);
  ptsD.frustumCulled = ptsT.frustumCulled = false;
  wScene.add(ptsD);
  tScene.add(ptsT);

  // Click holes: x, y (screen, height = 1), start time, colour index. Each click takes the next colour.
  const PAL_RGB = [
    [0.69, 0.2, 0.23],
    [0.49, 0.11, 0.13],
    [0.82, 0.5, 0.52],
    [0.2, 0.09, 0.09],
    [0.7, 0.53, 0.33],
  ];
  const PAL = PAL_RGB.map((c) => V3().fromArray(c));
  const PUNCH = [];
  for (let k = 0; k < 6; k++) PUNCH.push(new THREE.Vector4(0, 0, -99, 0));
  let punchI = 0;
  let colorI = 0;
  let lastPunch = -9;
  const fibTo = V3().fromArray(PAL_RGB[0]);
  // ---------- full-screen passes ----------
  const fsScene = new THREE.Scene();
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const fsQuad = new THREE.Mesh(keep(new THREE.PlaneGeometry(2, 2)));
  fsQuad.frustumCulled = false;
  fsScene.add(fsQuad);
  const FSV = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
  // Depth smoothing that keeps edges: neighbours only blend in when they sit at a similar depth.
  const blurMat = keep(
    new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: { tD: { value: null }, uDir: { value: new THREE.Vector2() }, uR: PU.uR, uScale: PU.uScale },
      vertexShader: FSV,
      fragmentShader: `uniform sampler2D tD; uniform vec2 uDir; uniform float uR, uScale; varying vec2 vUv;
void main(){ float d = texture2D(tD, vUv).r; if (d <= 0.){ gl_FragColor = vec4(0.); return; }
  float rpx = clamp(uR*uScale/d*2.2, 1., 60.); float st = rpx/8.;
  float sum = 0., ws = 0.; float rng = uR*6.;
  for (int i = -8; i <= 8; i++){ float fi = float(i); float s = texture2D(tD, vUv + uDir*fi*st).r; if (s <= 0.) continue;
    float dz = (s - d)/rng; float w = exp(-fi*fi/24.)*exp(-dz*dz); sum += s*w; ws += w; }
  gl_FragColor = vec4(sum/ws, 0., 0., 1.); }`,
    })
  );
  const compMat = keep(
    new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: Object.assign(
        {
          tBg: { value: bgRT.texture },
          tBgD: { value: bgRT.depthTexture },
          tW: { value: null },
          tTh: { value: thRT.texture },
          uPx: { value: new THREE.Vector2() },
          uTanF: { value: 1 },
          uAsp: { value: 1 },
          uNear: { value: 0.1 },
          uFar: { value: 200 },
          uVI: { value: new THREE.Matrix4() },
          uVM: { value: new THREE.Matrix4() },
          uTint: { value: V3(1, 1, 1) },
          uRip: { value: new THREE.Vector4() },
          uHole: { value: 0 },
          uTouch: { value: new THREE.Vector4() },
          uP: { value: PUNCH },
          uPal: { value: PAL },
          uFib: { value: V3().fromArray(PAL_RGB[0]) },
          uScr: { value: 0 },
        },
        CU
      ),
      vertexShader: FSV,
      fragmentShader: [
        'uniform sampler2D tBg, tBgD, tW, tTh; uniform vec2 uPx; uniform float uTanF, uAsp, uNear, uFar, uHole; uniform mat4 uVI, uVM; uniform vec3 uTint;',
        'uniform vec3 uB0, uB1, uB2, uB3, uInk, uEnv0, uEnv1; uniform float uLine, uT; uniform vec4 uRip, uTouch; varying vec2 vUv;',
        'uniform vec4 uP[6]; uniform vec3 uPal[5]; uniform vec3 uFib; uniform float uScr;',
        SKYF,
        `float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
float hash3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7)))*43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3. - 2.*f); return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
vec3 vp(vec2 uv, float d){ vec2 n = uv*2. - 1.; return vec3(n.x*uTanF*uAsp, n.y*uTanF, -1.)*d; }
float linD(float z){ float n = z*2. - 1.; return 2.*uNear*uFar/(uFar + uNear - n*(uFar - uNear)); }
vec3 env(vec3 r){
  vec3 c = r.y > 0. ? skyC(r) : mix(mix(uB0, uB2, .18)*.92, skyC(vec3(r.x, .02, r.z)), .15);
  c *= 1. - .55*exp(-abs(r.y + .05)*7.);
  c = mix(c, uInk*.6 + uB2*.2, .25*smoothstep(-.1, -.6, r.y));
  vec3 L1 = normalize(vec3(-.45, .75, .45)), L2 = normalize(vec3(.7, .25, -.5));
  c += vec3(1.)*pow(max(dot(r, L1), 0.), 120.)*2.6 + vec3(1.)*pow(max(dot(r, L1), 0.), 10.)*.2;
  c += uEnv1*pow(max(dot(r, L2), 0.), 50.)*.7;
  return c;
}
float ease3(float t){ return t < .5 ? 4.*t*t*t : 1. - pow(-2.*t + 2., 3.)/2.; }
float wav(vec2 q, vec2 fd){ vec2 pp = vec2(-fd.y, fd.x); vec2 c = vec2(dot(q, fd)*5., dot(q, pp)*16.); return vn(c)*.65 + vn(c*2.03 + 7.)*.35; }
vec3 bgAt(vec2 uv){ return texture2D(tBg, clamp(uv, .001, .999)).rgb; }
// Woven fibres: two crossing layers of thin, slightly wavy strands of varied weight.
// Fibres: long, curving strands that start and stop, in three loose layers, like brushed silk.
float fibres(vec2 p){
  float a = 0.;
  for (int k = 0; k < 3; k++){
    float fk = float(k); float an = .38 - fk*.55;
    vec2 q = mat2(cos(an), -sin(an), sin(an), cos(an))*p;
    q.x += uScr*(.5 - fk*.28);
    float wv = vn(vec2(q.x*2.1 + fk*11., q.y*1.3 + fk*5.))*1.5 + vn(vec2(q.x*5.3 + fk*3., q.y*2.7))*.5;
    float y = q.y*(30. - fk*7.) + wv*3.;
    float id = floor(y); float f = abs(fract(y) - .5); float w = .03 + .09*hash(vec2(id, fk));
    float run = smoothstep(.3, .7, vn(vec2(q.x*1.4 + id*3.17, id*.61 + fk)));
    a += smoothstep(w, 0., f)*run*(.45 + .55*hash(vec2(id, fk + 3.)))*(1. - fk*.25);
  }
  return a;
}
vec3 fibreWorld(vec2 p, vec3 tint){
  float a = fibres(p);
  vec3 c = mix(uB0, uB2, .25 + .2*vn(p*1.3 + uScr*.2));
  return mix(c, tint, clamp(a*.42, 0., .7));
}
// Torn edge: the radius wobbles with fine noise around the circle, so the rim looks ripped, not cut.
float tornX(vec2 d, float R){ float an = atan(d.y, d.x); float t = vn(vec2(an*7.6 + R*3., 1.))*.55 + vn(vec2(an*31., 5.))*.3 + vn(vec2(an*95., 9.))*.15; return length(d) - R*(1. + (t - .5)*.42); }
// Loose strands sticking out of a torn rim, pointing away from the centre.
float rimStrands(vec2 d, float x){ float an = atan(d.y, d.x); float g = an*9.55 + vn(vec2(length(d)*18., an*2.))*.5; float st = abs(fract(g) - .5); float len = .4 + .6*hash(vec2(floor(g), 4.)); return smoothstep(.14, 0., st)*exp(-max(x, 0.)*30./len)*step(-.004, x); }
void main(){
  vec2 uv = vUv; vec2 s = (uv - .5)*vec2(uAsp, 1.);
  vec2 rp = s - uRip.xy; float rr = length(rp); vec2 off = vec2(0.); float ringL = 0.;
  if (uRip.w > 0.){ float x = rr - uRip.z; float en = smoothstep(.015, -.01, x)*exp(x*5.)*smoothstep(0., .05, rr);
    off += rp/max(rr, 1e-4)*sin(x*65.)*en*.014*uRip.w; ringL = cos(x*65.)*en*uRip.w; }
  if (uTouch.w > 0.){ vec2 tp = s - uTouch.xy; float tr = length(tp); float tx = tr - uTouch.z; off += tp/max(tr, 1e-4)*sin(tx*90.)*exp(-tx*tx*900.)*.006*uTouch.w; }
  vec2 uvB = uv + off/vec2(uAsp, 1.);
  vec3 back = bgAt(uvB) + uEnv1*ringL*.12;
  vec3 col = back;
  float d = texture2D(tW, uv).r;
  vec4 th = texture2D(tTh, uv);
  float sceneD = linD(texture2D(tBgD, uv).r);
  float edgeA = smoothstep(.02, .22, th.r);
  if (d > 0. && d < sceneD + .05 && edgeA > 0.){
    vec3 P = vp(uv, d);
    float dR = texture2D(tW, uv + vec2(uPx.x, 0.)).r, dL = texture2D(tW, uv - vec2(uPx.x, 0.)).r;
    float dU = texture2D(tW, uv + vec2(0., uPx.y)).r, dD = texture2D(tW, uv - vec2(0., uPx.y)).r;
    vec3 ddx = (dR > 0. && (abs(dR - d) < abs(dL - d) || dL <= 0.)) ? vp(uv + vec2(uPx.x, 0.), dR) - P : P - vp(uv - vec2(uPx.x, 0.), dL > 0. ? dL : d);
    vec3 ddy = (dU > 0. && (abs(dU - d) < abs(dD - d) || dD <= 0.)) ? vp(uv + vec2(0., uPx.y), dU) - P : P - vp(uv - vec2(0., uPx.y), dD > 0. ? dD : d);
    vec3 n = normalize(cross(ddx, ddy));
    if (n.z < 0.) n = -n;
    vec2 sv = th.ba/max(th.r, 1e-3); float sp = length(sv); vec2 fd = sp > 1e-4 ? sv/sp : vec2(1., 0.);
    vec2 sc = s*3.;
    float t1 = fract(uT*.6), t2 = fract(uT*.6 + .5), bw = abs(t1 - .5)*2.;
    vec2 q1 = sc - sv*t1*14., q2 = sc - sv*t2*14. + .37; float ep = .01;
    float a1 = wav(q1, fd), a2 = wav(q2, fd);
    vec2 g1 = vec2(wav(q1 + vec2(ep, 0.), fd) - a1, wav(q1 + vec2(0., ep), fd) - a1)/ep;
    vec2 g2 = vec2(wav(q2 + vec2(ep, 0.), fd) - a2, wav(q2 + vec2(0., ep), fd) - a2)/ep;
    float fa = .006*(.3 + min(sp*25., 1.));
    n = normalize(n + vec3(-mix(g1, g2, bw)*fa, 0.));
    float thick = th.r; float ice = clamp(th.g/max(th.r, 1e-4), 0., 1.);
    vec3 Pw = (uVI*vec4(P, 1.)).xyz;
    float cid = 0., edge = 1.;
    if (ice > .01){
      vec3 cp = Pw*7.; vec3 ci = floor(cp); float d1 = 9., d2 = 9.;
      for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){ vec3 o = vec3(float(x), float(y), float(z)); vec3 r = o + vec3(hash3(ci + o), hash3(ci + o + 3.1), hash3(ci + o + 7.7)) - fract(cp); float dd = dot(r, r); if (dd < d1){ d2 = d1; d1 = dd; cid = hash3(ci + o + 1.3); } else if (dd < d2) d2 = dd; }
      edge = sqrt(d2) - sqrt(d1);
      n = normalize(mix(n, normalize(n + (vec3(hash(vec2(cid, 1.)), hash(vec2(cid, 2.)), 0.) - .5)*.9), ice));
    }
    vec2 ro = n.xy*(.035 + .05*min(thick, 2.5))*mix(1., .7, ice);
    vec3 refr = vec3(bgAt(uvB - ro).r, bgAt(uvB - ro*1.04).g, bgAt(uvB - ro*1.08).b);
    if (ice > .01){ vec3 fr = refr; float o = .012; fr += bgAt(uvB - ro + vec2(o, o*.6)) + bgAt(uvB - ro + vec2(-o*.7, o)) + bgAt(uvB - ro + vec2(-o, -o*.5)) + bgAt(uvB - ro + vec2(o*.4, -o)); fr /= 5.;
      refr = mix(refr, mix(fr, vec3(.97, .95, .95), .4) + vec3(1., .9, .9)*smoothstep(.07, 0., edge)*.5, ice); }
    refr *= mix(vec3(1.), uTint*vec3(.97, .93, .93), clamp(thick*.3, 0., .8));
    refr *= 1. - .45*pow(1. - clamp(n.z, 0., 1.), 1.6);
    vec3 V = normalize(P); vec3 Rv = reflect(V, n); vec3 Rw = normalize(mat3(uVI)*Rv);
    float F = .02 + .98*pow(1. - clamp(dot(-V, n), 0., 1.), 5.);
    vec3 wc = mix(refr, env(Rw), clamp(.04 + F*1.3, 0., 1.));
    vec3 Lw = normalize(vec3(-.45, .75, .45)); vec3 Lv = mat3(uVM)*Lw;
    wc += vec3(1.)*pow(max(dot(normalize(Lv - V), n), 0.), 400.)*1.4;
    wc += uEnv1*.12*(1. - n.z)*(1. - ice);
    if (ice > .01){ float spk = pow(max(sin(uT*2.3 + cid*40.), 0.), 30.)*step(.82, cid); wc += vec3(1.)*spk*ice*1.4; }
    col = mix(back, wc, edgeA);
  }
  // The rip: once the drop lands, its ring tears the surface open onto the fibres.
  vec3 fw = fibreWorld(s, uFib);
  float m = 0.; vec3 rimC = vec3(0.); float rimA = 0.; float glowA = 0.;
  if (uHole > 0.){
    float x = tornX(rp, uHole);
    m = smoothstep(.005, -.005, x);
    float glow = exp(-x*x*2600.);
    float a = rimStrands(rp, x)*.85 + glow*.3; rimC += uFib*a; rimA += a; glowA += glow*.4;
  }
  col = mix(col, fw, m);
  // Clicks: each hole opens fast, holds, then grows back shut in strands of its new colour.
  for (int i = 0; i < 6; i++){
    vec4 h = uP[i]; float age = uT - h.z; if (age < 0. || age > 3.6) continue;
    vec3 hc = uPal[int(h.w)];
    vec2 d = s - h.xy; float Rm = .13;
    float R = Rm*(age < .8 ? ease3(min(age/.22, 1.)) : 1. - ease3(clamp((age - .8)/1.6, 0., 1.)));
    float x = tornX(d, max(R, 1e-4));
    float inside = R > 1e-3 ? smoothstep(.004, -.004, x) : 0.;
    // Inside: a deep hole in the new colour, its own fibres glinting at the bottom.
    float dl = length(d);
    vec3 deep = mix(hc*.6, hc*.12 + vec3(.03, .012, .014), smoothstep(R, 0., dl)*.8);
    deep += hc*fibres(d*3.2 + h.xy*7.)*.55 + vec3(1.)*fibres(d*3.2 + h.xy*7.)*.06;
    col = mix(col, deep, inside);
    float a = rimStrands(d, x)*(R > 1e-3 ? 1. : 0.); rimC += hc*a; rimA += a; glowA += exp(-x*x*4000.)*(R > 1e-3 ? .3 : 0.);
    // Regrowth: as it closes, strands of the new colour knit across the ring it leaves, then settle in.
    float scar = smoothstep(.006, -.006, tornX(d, Rm)) * (1. - inside) * step(.8, age) * (1. - smoothstep(2.4, 3.6, age));
    float b = clamp(fibres(d*2.6 + h.xy*3.)*1.3, 0., 1.)*scar*.9; rimC += hc*b; rimA += b;
  }
  col = mix(col, rimC/max(rimA, 1e-4), clamp(rimA, 0., 1.)*.92) + uEnv1*clamp(glowA, 0., 1.)*.25;
  gl_FragColor = vec4(col, 1.);
}`,
      ].join('\n'),
    })
  );

  // ---------- size ----------
  let W = 1;
  let H = 1;
  let ASP = 1;
  const resize = () => {
    W = canvas.clientWidth || innerWidth;
    H = canvas.clientHeight || innerHeight;
    ASP = W / H;
    renderer.setPixelRatio(PR);
    renderer.setSize(W, H, false);
    camera.aspect = ASP;
    camera.updateProjectionMatrix();
    const w = Math.round(W * PR);
    const h = Math.round(H * PR);
    [bgRT, wRT, bA, bB, thRT].forEach((t) => t.setSize(w, h));
    compMat.uniforms.uPx.value.set(1 / w, 1 / h);
  };
  resize();
  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);

  // ---------- particles ----------
  const ORB = [0, 2.2, 0];
  const ORB_R = 1.15;
  const px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N);
  const vx = new Float32Array(N), vy = new Float32Array(N), vz = new Float32Array(N);
  const rad = new Float32Array(N), ux = new Float32Array(N), uy = new Float32Array(N), uz = new Float32Array(N);
  const kk = new Float32Array(N), free = new Float32Array(N), ice = new Float32Array(N), iceT = new Float32Array(N), grp = new Int16Array(N), sz = new Float32Array(N);
  const tgx = new Float32Array(N), tgy = new Float32Array(N), tgz = new Float32Array(N);
  const rnd = Math.random;
  for (let i = 0; i < N; i++) {
    const yy = 1 - (2 * (i + 0.5)) / N;
    const rr0 = Math.sqrt(1 - yy * yy);
    const th0 = i * 2.39996;
    ux[i] = Math.cos(th0) * rr0;
    uy[i] = yy;
    uz[i] = Math.sin(th0) * rr0;
    const rq = Math.cbrt(0.15 + 0.85 * rnd()) * ORB_R * 0.9;
    px[i] = ORB[0] + ux[i] * rq;
    py[i] = ORB[1] + uy[i] * rq;
    pz[i] = ORB[2] + uz[i] * rq;
    rad[i] = rq / ORB_R;
    kk[i] = 1;
    grp[i] = -1;
    sz[i] = 1;
  }
  let iceBlobs = [];
  let ripI = 0;
  let T = 0;
  let lastRip = -9;
  const punch = (x, y) => {
    colorI = (colorI + 1) % PAL.length;
    PUNCH[punchI].set(x, y, T, colorI);
    punchI = (punchI + 1) % PUNCH.length;
    lastPunch = T;
    fibTo.copy(PAL[colorI]);
  };
  const addRipple = (x, z, amp) => {
    lastRip = T;
    RIP[ripI].set(x, z, T, amp);
    ripI = (ripI + 1) % RIP.length;
  };

  // ---------- input: touch, splash and freeze along the ray under the finger ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const ptr = { on: false, down: false, sx: 0, sy: 0, vx: 0, vy: 0, o: V3(), d: V3() };
  let lastTap = { t: 0, x: 0, y: 0 };
  const touchFx = { x: 0, y: 0, t: -9 };
  let lastMove = 0;
  const setRay = (cx, cy) => {
    ndc.set((cx / W) * 2 - 1, -(cy / H) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    ptr.o.copy(ray.ray.origin);
    ptr.d.copy(ray.ray.direction);
  };
  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const freezeAt = (cx, cy) => {
    setRay(cx, cy);
    const o = ptr.o;
    const d = ptr.d;
    let best = -1;
    let bt = 1e9;
    for (let i = 0; i < N; i++) {
      if (sz[i] < 0.3) continue;
      const ex = px[i] - o.x, ey = py[i] - o.y, ez = pz[i] - o.z;
      const t = ex * d.x + ey * d.y + ez * d.z;
      if (t < 0.3) continue;
      const qx = ex - d.x * t, qy = ey - d.y * t, qz = ez - d.z * t;
      if (Math.sqrt(qx * qx + qy * qy + qz * qz) < 0.02 * t + 0.25 && t < bt) {
        bt = t;
        best = i;
      }
    }
    if (best < 0) return;
    const hx = px[best], hy = py[best], hz = pz[best], R = 0.75;
    let n = 0;
    for (let j = 0; j < N; j++) {
      const dd = Math.hypot(px[j] - hx, py[j] - hy, pz[j] - hz);
      if (dd < R && ice[j] < 0.5) {
        iceT[j] = T - (dd / R) * 0.3;
        vx[j] = vy[j] = vz[j] = 0;
        n++;
      }
    }
    if (n) iceBlobs.push({ x: hx, y: hy, z: hz, r: R * 0.8, t: T });
  };
  const onMove = (e) => {
    const [x, y] = local(e);
    const now = performance.now();
    const dt = Math.max(8, now - lastMove) / 1000;
    if (ptr.on) {
      ptr.vx = mix(ptr.vx, (x - ptr.sx) / H / dt, 0.5);
      ptr.vy = mix(ptr.vy, -(y - ptr.sy) / H / dt, 0.5);
    }
    ptr.sx = x;
    ptr.sy = y;
    ptr.on = true;
    lastMove = now;
  };
  const onDown = (e) => {
    const [x, y] = local(e);
    ptr.sx = x;
    ptr.sy = y;
    ptr.vx = ptr.vy = 0;
    ptr.on = true;
    ptr.down = true;
    lastMove = performance.now();
    touchFx.x = (x - W / 2) / H;
    touchFx.y = (H / 2 - y) / H;
    touchFx.t = T;
    punch(touchFx.x, touchFx.y);
    if (e.pointerType !== 'mouse') {
      const now = performance.now();
      if (now - lastTap.t < 320 && Math.hypot(x - lastTap.x, y - lastTap.y) < 40) {
        freezeAt(x, y);
        lastTap.t = 0;
      } else lastTap = { t: now, x, y };
    }
  };
  const onUp = () => (ptr.down = false);
  const onLeave = () => {
    ptr.down = false;
    ptr.on = false;
  };
  const onDbl = (e) => freezeAt(...local(e));
  // The canvas sits behind the page, so the page passes the pointer on, but only
  // where the caller says the water shows through (never over buttons or forms).
  const onIn = (e) => {
    if (!touchable(e)) return onLeave();
    onMove(e);
    kick();
  };
  const onInDown = (e) => touchable(e) && onDown(e);
  const onInDbl = (e) => touchable(e) && onDbl(e);
  addEventListener('pointermove', onIn, { passive: true });
  addEventListener('pointerdown', onInDown, { passive: true });
  addEventListener('pointerup', onUp, { passive: true });
  addEventListener('pointercancel', onLeave, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave, { passive: true });
  addEventListener('dblclick', onInDbl);

  // ---------- physics: each drop rides toward its target and gets knocked loose by touch ----------
  const camRight = V3();
  const camUp = V3();
  const dropC = [0, 5, 0];
  let burstDone = false;
  const physics = (q, dt) => {
    const drop = q >= 0.76;
    const impact = q > 0.88;
    const touchR = 0.55;
    let pvx = ptr.vx, pvy = ptr.vy, pv = Math.hypot(pvx, pvy);
    if (pv > 4) {
      pvx *= 4 / pv;
      pvy *= 4 / pv;
      pv = 4;
    }
    const o = ptr.o, d = ptr.d;
    const tilt = 0.35, ct = Math.cos(tilt), stl = Math.sin(tilt);
    for (let i = 0; i < N; i++) {
      if (iceT[i] > 0 && ice[i] >= 0.5) {
        vx[i] = vy[i] = vz[i] = 0;
        continue;
      }
      const g = impact ? 30 : drop ? 20 : 0;
      const fresh = g !== grp[i];
      if (fresh) {
        grp[i] = g;
        kk[i] = 0.06;
      }
      let tx, ty, tz;
      if (g === 0) {
        // The orb turns on a tilted axis, faster near its core, so it visibly swirls.
        const r = rad[i] * ORB_R;
        const a = Math.atan2(uz[i], ux[i]) + T * (1.6 - rad[i] * 0.8);
        const hr = Math.hypot(ux[i], uz[i]);
        const lx = Math.cos(a) * hr * r, ly = uy[i] * r, lz = Math.sin(a) * hr * r;
        tx = ORB[0] + lx;
        ty = ORB[1] + ly * ct - lz * stl;
        tz = ORB[2] + ly * stl + lz * ct;
      } else if (g === 20) {
        const r2 = rad[i] * 0.55, a2 = Math.atan2(uz[i], ux[i]) + T * 2, hr2 = Math.hypot(ux[i], uz[i]);
        tx = dropC[0] + Math.cos(a2) * hr2 * r2;
        ty = dropC[1] + uy[i] * r2;
        tz = dropC[2] + Math.sin(a2) * hr2 * r2;
      } else {
        tx = px[i];
        ty = py[i];
        tz = pz[i];
      }
      if (fresh) {
        tgx[i] = tx;
        tgy[i] = ty;
        tgz[i] = tz;
      }
      let tvx = (tx - tgx[i]) / dt, tvy = (ty - tgy[i]) / dt, tvz = (tz - tgz[i]) / dt;
      tgx[i] = tx;
      tgy[i] = ty;
      tgz[i] = tz;
      if (Math.abs(tvx) + Math.abs(tvy) + Math.abs(tvz) > 60) tvx = tvy = tvz = 0;
      let ax, ay, az;
      if (free[i] > 0 || impact) {
        free[i] -= dt;
        ax = 0;
        ay = -9;
        az = 0;
        const dr = Math.exp(-dt * 0.5);
        vx[i] *= dr;
        vy[i] *= dr;
        vz[i] *= dr;
        if (free[i] <= 0 && !impact) kk[i] = 0.05;
        if (py[i] < 0.05 && vy[i] < 0) {
          py[i] = 0.05;
          if (vy[i] < -2 && rnd() < 0.08) addRipple(px[i], pz[i], 0.5);
          vy[i] *= -0.25;
          vx[i] *= 0.7;
          vz[i] *= 0.7;
        }
      } else {
        kk[i] = Math.min(1, kk[i] + dt * 0.8);
        const K = 60 * kk[i] * kk[i] + 1.2, Dm = 2 * Math.sqrt(K) * 0.85;
        ax = (tx - px[i]) * K + (tvx - vx[i]) * Dm;
        ay = (ty - py[i]) * K + (tvy - vy[i]) * Dm;
        az = (tz - pz[i]) * K + (tvz - vz[i]) * Dm;
      }
      vx[i] += ax * dt;
      vy[i] += ay * dt;
      vz[i] += az * dt;
      if (ptr.on) {
        const ex = px[i] - o.x, ey = py[i] - o.y, ez = pz[i] - o.z;
        const t = ex * d.x + ey * d.y + ez * d.z;
        if (t > 0.2) {
          const qx = ex - d.x * t, qy = ey - d.y * t, qz = ez - d.z * t;
          const dist = Math.sqrt(qx * qx + qy * qy + qz * qz), rr3 = touchR * (0.5 + t * 0.08);
          if (dist < rr3) {
            let fo = 1 - dist / rr3;
            fo *= fo;
            const pk = ptr.down ? 1 : 0.5, sc = t * 0.9;
            const mvx = (camRight.x * pvx + camUp.x * pvy) * sc, mvy = (camRight.y * pvx + camUp.y * pvy) * sc, mvz = (camRight.z * pvx + camUp.z * pvy) * sc;
            const inv = dist > 1e-4 ? 1 / dist : 0, push = (ptr.down ? 3 : 0.8) * fo * pk;
            vx[i] += mvx * fo * pk * 0.4 + qx * inv * push;
            vy[i] += mvy * fo * pk * 0.4 + qy * inv * push;
            vz[i] += mvz * fo * pk * 0.4 + qz * inv * push;
            if (pv * fo * pk > 0.35 || (ptr.down && fo > 0.35)) free[i] = Math.max(free[i], 0.3 + rnd() * 0.5);
          }
        }
      }
      px[i] += vx[i] * dt;
      py[i] += vy[i] * dt;
      pz[i] += vz[i] * dt;
      for (const ib of iceBlobs) {
        const bx = px[i] - ib.x, by = py[i] - ib.y, bz = pz[i] - ib.z, bl = Math.sqrt(bx * bx + by * by + bz * bz);
        if (bl < ib.r && bl > 1e-5) {
          const nx = bx / bl, ny = by / bl, nz = bz / bl;
          px[i] = ib.x + nx * ib.r;
          py[i] = ib.y + ny * ib.r;
          pz[i] = ib.z + nz * ib.r;
          const vn = vx[i] * nx + vy[i] * ny + vz[i] * nz;
          if (vn < 0) {
            vx[i] -= vn * nx;
            vy[i] -= vn * ny;
            vz[i] -= vn * nz;
          }
        }
      }
      sz[i] += (1 - sz[i]) * Math.min(1, dt * 12);
    }
  };

  // ---------- camera: in front of the orb (seen high in the screen, behind the hero), up to the drop, down to the pool ----------
  const KEYS = [
    [0, [0, 2.5, 6], [0, 1.45, 0], 0, 44],
    [0.7, [-1.5, 3.4, 6.5], [0, 3, 0], -0.04, 48],
    [0.78, [0, 4.8, 8], [0, 5, 0], 0, 46],
    [0.86, [0.5, 2.6, 6], [0, 1.2, 0], 0, 46],
    [0.9, [0, 1.6, 3.4], [0, 0.1, 0], 0, 50],
    [1, [0, 0.5, 0.9], [0, 0, 0], 0, 56],
  ];
  const camAt = (q, P, L) => {
    let k = 0;
    while (k < KEYS.length - 2 && q > KEYS[k + 1][0]) k++;
    const a = KEYS[k], b = KEYS[k + 1];
    let t = Math.max(0, Math.min(1, (q - a[0]) / (b[0] - a[0])));
    t = t * t * t * (t * (t * 6 - 15) + 10);
    P.set(mix(a[1][0], b[1][0], t), mix(a[1][1], b[1][1], t), mix(a[1][2], b[1][2], t));
    L.set(mix(a[2][0], b[2][0], t), mix(a[2][1], b[2][1], t), mix(a[2][2], b[2][2], t));
    // Tall screens see less from side to side, so the camera stands further back.
    const far = ASP < 1 ? mix(1.75, 1, Math.max(0, Math.min(1, (ASP - 0.45) / 0.55))) : 1;
    if (far > 1) {
      P.sub(L).multiplyScalar(far).add(L);
      if (P.y < 0.4) P.y = 0.4;
    }
    return [mix(a[3], b[3], t), mix(a[4], b[4], t)];
  };
  const cP = V3(), cL = V3(), fwd = V3(), projV = V3();
  // Scroll sets the target; the scene eases toward it, so a flick feels smooth, never jumpy.
  const readQ = () => scrollQ(scrollY / Math.max(innerHeight * 0.6, document.documentElement.scrollHeight - innerHeight));
  let qT = reduce ? 0 : readQ();
  let qS = qT;
  camAt(qS, cP, cL);
  const camS = cP.clone(), lookS = cL.clone();
  let rollS = 0, fovS = 44, mxS = 0, myS = 0;
  let scrX = 0, scrY = 0;
  let still = 0;

  // ---------- frame ----------
  let raf = 0;
  let last = performance.now();
  let perfT = 0, perfN = 0;
  let visible = true;
  let finished = false;
  const fibDone = () => Math.abs(compMat.uniforms.uFib.value.x - fibTo.x) + Math.abs(compMat.uniforms.uFib.value.y - fibTo.y) + Math.abs(compMat.uniforms.uFib.value.z - fibTo.z) < 0.004;
  const draw = (q) => {
    for (let m = 0; m < N; m++) {
      const m3 = m * 3;
      aPos[m3] = px[m];
      aPos[m3 + 1] = py[m];
      aPos[m3 + 2] = pz[m];
      aVel[m3] = vx[m];
      aVel[m3 + 1] = vy[m];
      aVel[m3 + 2] = vz[m];
      aSize[m] = sz[m] * (1 - sm(0.9, 0.97, q)) * (1 + 0.12 * ice[m]);
      aIce[m] = ice[m];
    }
    geo.attributes.position.needsUpdate = geo.attributes.aSize.needsUpdate = geo.attributes.aIce.needsUpdate = geo.attributes.aVel.needsUpdate = true;
    const maxR = Math.hypot(ASP / 2 + Math.abs(scrX), 0.5 + Math.abs(scrY)) + 0.05;
    const hole = Math.pow(sm(0.9, 1, q), 1.3) * maxR * 1.35;
    // Once the fibres cover the whole screen, the water passes are not seen: skip them.
    const covered = hole > maxR * 1.3;
    if (!covered) {
    floorMat.uniforms.uCamP.value.copy(camera.position);
    PU.uProj.value.copy(camera.projectionMatrix);
    PU.uScale.value = (H * PR) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    renderer.setRenderTarget(bgRT);
    renderer.clear();
    renderer.render(bgScene, camera);
    renderer.setRenderTarget(wRT);
    renderer.clear();
    renderer.render(wScene, camera);
    renderer.setRenderTarget(thRT);
    renderer.clear();
    renderer.render(tScene, camera);
    fsQuad.material = blurMat;
    const bu = blurMat.uniforms;
    bu.tD.value = wRT.texture;
    bu.uDir.value.set(1 / bA.width, 0);
    renderer.setRenderTarget(bA);
    renderer.render(fsScene, fsCam);
    bu.tD.value = bA.texture;
    bu.uDir.value.set(0, 1 / bA.height);
    renderer.setRenderTarget(bB);
    renderer.render(fsScene, fsCam);
    bu.tD.value = bB.texture;
    bu.uDir.value.set(0.7 / bA.width, 0.7 / bA.height);
    renderer.setRenderTarget(bA);
    renderer.render(fsScene, fsCam);
    bu.tD.value = bA.texture;
    bu.uDir.value.set(0.7 / bA.width, -0.7 / bA.height);
    renderer.setRenderTarget(bB);
    renderer.render(fsScene, fsCam);
    }
    const cu = compMat.uniforms;
    fsQuad.material = compMat;
    cu.tW.value = bB.texture;
    cu.uTanF.value = Math.tan((camera.fov * Math.PI) / 360);
    cu.uAsp.value = ASP;
    cu.uNear.value = camera.near;
    cu.uFar.value = camera.far;
    cu.uVI.value.copy(camera.matrixWorld);
    cu.uVM.value.copy(camera.matrixWorldInverse);
    const ripOn = q > 0.88 ? 1 : 0;
    cu.uRip.value.set(scrX, scrY, sm(0.88, 1, q) * maxR * 1.3 + 0.02, ripOn * (1 - sm(0.97, 1, q) * 0.5));
    cu.uHole.value = hole;
    cu.uScr.value = scrollY / Math.max(1, H);
    cu.uFib.value.lerp(fibTo, 0.08);
    const ta = T - touchFx.t;
    cu.uTouch.value.set(touchFx.x, touchFx.y, ta * 0.35, ta < 1.6 && !reduce ? 1 - ta / 1.6 : 0);
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(fsScene, fsCam);
  };
  const step = (dt) => {
    T += dt;
    CU.uT.value = T;
    qS += (qT - qS) * (1 - Math.exp(-dt * 5));
    if (Math.abs(qT - qS) < 1e-4) qS = qT;
    const q = qS;
    const rf = camAt(q, cP, cL);
    if (ptr.on && !ptr.down) {
      mxS += (ptr.sx / W - 0.5 - mxS) * 0.05;
      myS += (ptr.sy / H - 0.5 - myS) * 0.05;
    }
    const kc = 1 - Math.exp(-dt * 6);
    camS.lerp(cP, kc);
    lookS.lerp(cL, kc);
    rollS += (rf[0] - rollS) * kc;
    fovS += (rf[1] - fovS) * kc;
    camera.position.copy(camS);
    camera.position.x += mxS * 0.6;
    camera.position.y -= myS * 0.4;
    camera.up.set(0, 1, 0);
    fwd.subVectors(lookS, camera.position).normalize();
    if (Math.abs(fwd.y) > 0.97) camera.up.set(0, 0, -1);
    camera.lookAt(lookS);
    camera.rotateZ(rollS);
    if (camera.position.y < 0.25) camera.position.y = 0.25;
    camera.fov = fovS;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    camRight.setFromMatrixColumn(camera.matrixWorld, 0);
    camUp.setFromMatrixColumn(camera.matrixWorld, 1);
    if (ptr.on) setRay(ptr.sx, ptr.sy);

    // Ice forms quickly, holds about four seconds, then melts back into the flow.
    for (let i = 0; i < N; i++) {
      if (iceT[i] <= 0) continue;
      const hold = T - iceT[i] < 4.2;
      ice[i] = hold ? Math.min(1, ice[i] + dt * 5) : Math.max(0, ice[i] - dt * 0.8);
      if (!hold && ice[i] < 0.5 && free[i] <= 0 && kk[i] >= 1) {
        free[i] = 0.5;
        kk[i] = 0.05;
      }
      if (!hold && ice[i] === 0) iceT[i] = 0;
    }
    iceBlobs = iceBlobs.filter((b) => T - b.t < 4.6);

    const fall = sm(0.845, 0.88, q);
    dropC[1] = mix(5, 0.45, fall * fall);
    const steps = Math.max(1, Math.min(3, Math.ceil(dt / (1 / 80))));
    for (let s = 0; s < steps; s++) physics(q, dt / steps);
    ptr.vx *= Math.exp(-dt * 10);
    ptr.vy *= Math.exp(-dt * 10);

    // The drop lands: a crown of water, a few drops bouncing up, and rings across the pool.
    // Scrolling back above the landing lets it land again next time.
    if (q < 0.87) burstDone = false;
    if (q > 0.88 && !burstDone) {
      burstDone = true;
      addRipple(0, 0, 1.6);
      addRipple(0, 0, 1.1);
      RIP[(ripI + RIP.length - 1) % RIP.length].z = T + 0.35;
      for (let j = 0; j < N; j++) {
        const ddx = px[j] - dropC[0], ddz = pz[j] - dropC[2], dl = Math.hypot(ddx, ddz) + 1e-4, k = 1.5 + rnd() * 2.5;
        vx[j] = (ddx / dl) * k;
        vz[j] = (ddz / dl) * k;
        vy[j] = 1.5 + rnd() * 3;
        py[j] = Math.max(py[j], 0.1);
      }
      for (let j2 = 0; j2 < 60; j2++) {
        const jj = (rnd() * N) | 0;
        px[jj] = (rnd() - 0.5) * 0.1;
        pz[jj] = (rnd() - 0.5) * 0.1;
        py[jj] = 0.2;
        vx[jj] = (rnd() - 0.5) * 0.3;
        vz[jj] = (rnd() - 0.5) * 0.3;
        vy[jj] = 4.5 + rnd() * 1.5;
      }
      projV.set(0, 0.1, 0).project(camera);
      scrX = projV.x * 0.5 * ASP;
      scrY = projV.y * 0.5;
    }
    return q;
  };
  const frame = (now) => {
    raf = 0;
    const dt = Math.min(0.05, Math.max(1 / 240, (now - last) / 1000));
    last = now;
    const q = step(dt);
    // Keep frames under budget: lower the pixel ratio when slow, raise it back when fast.
    perfT += dt;
    perfN++;
    if (perfT > 1.2) {
      const avg = perfT / perfN;
      perfT = 0;
      perfN = 0;
      if (avg > 0.026 && PR > 0.6) {
        PR = Math.max(0.6, PR - 0.15);
        resize();
      } else if (avg < 0.014 && PR < PR_MAX) {
        PR = Math.min(PR_MAX, PR + 0.1);
        resize();
      }
    }
    draw(q);
    // Over the still pool (no drops, no rings, no touch) there is nothing to move: rest until the next scroll.
    still = q >= Q_END - 1e-3 && q === qT && !ptr.down && T - lastRip > 4.6 && T - lastPunch > 3.8 && fibDone() ? still + dt : 0;
    if (visible && !reduce && still < 0.5) raf = requestAnimationFrame(frame);
  };
  const kick = () => {
    if (!raf && !finished && visible) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };

  // Settle the water where the page is, so the first frame is already a swirling ball (or the pool).
  for (let k = 0; k < 90; k++) step(1 / 60);
  draw(qS);

  // Scrolling is the only thing that moves the scene along, and the fibres with it.
  const onScroll = () => {
    qT = readQ();
    // Reduced motion keeps one still frame of the orb.
    if (!reduce) kick();
  };
  addEventListener('scroll', onScroll, { passive: true });
  const onVis = () => {
    visible = !document.hidden;
    if (visible) kick();
  };
  document.addEventListener('visibilitychange', onVis);
  if (!reduce) kick();

  return {
    dispose() {
      finished = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVis);
      removeEventListener('pointermove', onIn);
      removeEventListener('pointerdown', onInDown);
      removeEventListener('pointerup', onUp);
      removeEventListener('pointercancel', onLeave);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      removeEventListener('dblclick', onInDbl);
      disposables.forEach((x) => x.dispose?.());
      renderer.dispose();
      renderer.forceContextLoss?.();
    },
  };
}
