import shaderScene from './shaderScene';

// A survey grid of small tick marks. Each one points along a slow drift; near the cursor they all turn to face it and stretch, like iron filings.
const FRAG = `
uniform vec3 uInk; uniform vec3 uAccent; uniform vec3 uBg;
uniform float uCells; uniform float uLength; uniform float uThick; uniform float uSpeed;
void main(){
  float aspect = uRes.x / uRes.y;
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 g = vec2(uv.x * aspect, uv.y) * uCells;
  vec2 cell = floor(g);
  vec2 local = fract(g) - 0.5;
  vec2 centre = (cell + 0.5) / uCells;
  vec2 m = uMouse * vec2(aspect, 1.0);
  vec2 rel = m - centre;
  float dist = length(rel);
  float inf = exp(-dist * dist / (0.09 * uReach * uReach)) * uHover * uMouseK;
  float t = uTime * 0.08 * uSpeed;
  float a = fbm(centre * 2.0 + vec2(t, -t)) * 6.2831;
  vec2 drift = vec2(cos(a), sin(a));
  vec2 toward = rel / max(dist, 1e-4);
  vec2 dir = normalize(mix(drift, toward, clamp(inf * 1.6, 0.0, 1.0)) + 1e-5);
  vec2 nrm = vec2(-dir.y, dir.x);
  float along = dot(local, dir);
  float across = dot(local, nrm);
  float px = 1.5 / (uRes.y / uCells);
  float len = uLength * (1.0 + inf * 0.9);
  float seg = 1.0 - smoothstep(len * 0.5 - px, len * 0.5 + px, abs(along));
  float body = 1.0 - smoothstep(uThick * 0.5 - px, uThick * 0.5 + px, abs(across));
  float s = seg * body;
  float tip = smoothstep(len * 0.18, len * 0.5, along) * s;
  vec3 col = mix(uBg, mix(uInk, uAccent, clamp(inf * 1.3, 0.0, 1.0)), s * (0.45 + 0.55 * inf));
  col = mix(col, uAccent, tip * 0.5 * clamp(inf * 1.5, 0.0, 1.0));
  col *= mix(0.6, 1.0, smoothstep(0.95, 0.2, length(uv - 0.5)));
  gl_FragColor = vec4(col, 1.0);
}`;
export default shaderScene(FRAG, {
  uInk: ['ink', 'c'], uAccent: ['accent', 'c'], uBg: ['background', 'c'],
  uCells: ['cells', 'f'], uLength: ['length', 'f'], uThick: ['thickness', 'f'], uSpeed: ['speed', 'f'],
}, { ink: '#7a7068', accent: '#d2494d', background: '#0c0b0a', cells: 38, length: 0.5, thickness: 0.07, speed: 1 });
