import shaderScene from './shaderScene';

// Light on the floor of a shallow pool, in two warm tones. The cursor drops a stone: rings travel out and bend the light as they pass.
const FRAG = `
uniform vec3 uLight; uniform vec3 uTone; uniform vec3 uBg;
uniform float uScale; uniform float uSharp; uniform float uSpeed;
void main(){
  float asp = uRes.x / uRes.y;
  vec2 pos = gl_FragCoord.xy / uRes.y;
  vec2 m = uMouse * vec2(asp, 1.0);
  vec2 rel = pos - m;
  float d = length(rel);
  float inf = exp(-d * 2.6 / uReach) * uHover * uMouseK;
  float ring = sin(d * 38.0 - uTime * 3.2 * uSpeed) * inf;
  vec2 warped = pos * uScale + normalize(rel + 1e-5) * ring * 0.18;
  vec2 p = mod(warped * 6.28318, 6.28318) - 250.0;
  float t = uTime * 0.5 * uSpeed + 23.0;
  float c = 0.0;
  vec2 q = p;
  float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - 3.5 / float(n + 1));
    q = p + vec2(cos(tt - q.x) + sin(tt + q.y), sin(tt - q.y) + cos(tt + q.x));
    c += 1.0 / length(vec2(p.x / (sin(q.x + tt) / inten), p.y / (cos(q.y + tt) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  float lightv = pow(clamp(c / 1.17, 0.0, 1.0), uSharp * 1.4);
  vec3 col = mix(uBg, uTone, smoothstep(0.0, 0.5, lightv) * 0.6);
  col = mix(col, uLight, smoothstep(0.3, 1.0, lightv) * 0.9);
  col *= mix(0.55, 1.0, smoothstep(0.95, 0.15, length(gl_FragCoord.xy / uRes - 0.5)));
  gl_FragColor = vec4(col, 1.0);
}`;
export default shaderScene(FRAG, {
  uLight: ['light', 'c'], uTone: ['tone', 'c'], uBg: ['background', 'c'],
  uScale: ['scale', 'f'], uSharp: ['sharpness', 'f'], uSpeed: ['speed', 'f'],
}, { light: '#e7d9c9', tone: '#7d1d20', background: '#0b0909', scale: 0.6, sharpness: 7, speed: 1 });
