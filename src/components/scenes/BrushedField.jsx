import shaderScene from './shaderScene';

// A field of short strokes that lean along a slow flow. Near the cursor they turn to circle it, and the light follows the pointer. Brightness follows how each stroke faces a soft light, like brushed metal.
const FRAG = `
uniform vec3 uInk; uniform vec3 uGlint; uniform vec3 uBg;
uniform float uCells; uniform float uLength; uniform float uThick; uniform float uSwirl; uniform float uSpeed;
void main(){
  float aspect = uRes.x / uRes.y;
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 g = vec2(uv.x * aspect, uv.y) * uCells;
  vec2 cell = floor(g);
  vec2 local = fract(g) - 0.5;
  vec2 centre = (cell + 0.5) / uCells;
  float t = uTime * 0.1 * uSpeed;
  float a = fbm(centre * 2.4 + vec2(t, -t * 0.7)) * 6.2831 * uSwirl + fbm(centre * 5.0 - t) * 1.2;
  vec2 m = uMouse * vec2(aspect, 1.0);
  vec2 rel = centre - m;
  float inf = exp(-dot(rel, rel) / (0.05 * uReach * uReach)) * uHover * uMouseK;
  vec2 dir = vec2(cos(a), sin(a));
  vec2 tang = normalize(vec2(-rel.y, rel.x) + 1e-5);
  dir = normalize(mix(dir, tang * sign(dot(dir, tang) + 1e-5), clamp(inf * 1.5, 0.0, 1.0)));
  vec2 nrm = vec2(-dir.y, dir.x);
  float along = dot(local, dir);
  float across = dot(local, nrm);
  float px = 1.5 / (uRes.y / uCells);
  float len = uLength * (1.0 + inf * 0.35);
  float seg = 1.0 - smoothstep(len * 0.5 - px, len * 0.5 + px, abs(along));
  float body = 1.0 - smoothstep(uThick * 0.5 - px, uThick * 0.5 + px, abs(across));
  float s = seg * body;
  vec2 lightDir = normalize(vec2(0.6, 0.8));
  float facing = pow(abs(dot(dir, lightDir)), 3.0);
  vec2 auto = vec2(0.5 + 0.18 * sin(uTime * 0.07 * uSpeed), 0.5 + 0.14 * cos(uTime * 0.05 * uSpeed));
  vec2 d = uv - mix(auto, uMouse, uHover * uMouseK);
  float spot = exp(-dot(d, d) * mix(5.0, 9.0, uHover * uMouseK));
  vec3 stroke = mix(uInk, uGlint, clamp(facing * 1.2 * spot + facing * 0.25, 0.0, 1.0));
  vec3 col = mix(uBg, stroke, s * (0.35 + 0.65 * (0.4 + spot)));
  col *= mix(0.6, 1.0, smoothstep(0.9, 0.2, length(uv - 0.5)));
  gl_FragColor = vec4(col, 1.0);
}`;
export default shaderScene(FRAG, {
  uInk: ['ink', 'c'], uGlint: ['glint', 'c'], uBg: ['background', 'c'],
  uCells: ['cells', 'f'], uLength: ['length', 'f'], uThick: ['thickness', 'f'], uSwirl: ['swirl', 'f'], uSpeed: ['speed', 'f'],
}, { ink: '#5b524c', glint: '#f1e9e0', background: '#0c0b0a', cells: 46, length: 0.82, thickness: 0.09, swirl: 0.55, speed: 1 });
