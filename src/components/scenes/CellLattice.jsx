import shaderScene from './shaderScene';

// A field of cells whose borders are drawn as fine lines. Cell centres wander slowly; near the cursor they crowd toward it and the borders light up.
const FRAG = `
uniform vec3 uInk; uniform vec3 uAccent; uniform vec3 uBg;
uniform float uScale; uniform float uWidth; uniform float uWander; uniform float uSpeed;
vec2 h2(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
void main(){
  float asp = uRes.x / uRes.y;
  vec2 pos = gl_FragCoord.xy / uRes.y;
  vec2 m = uMouse * vec2(asp, 1.0);
  vec2 p = pos * uScale;
  vec2 mp = m * uScale;
  vec2 i = floor(p);
  float t = uTime * 0.25 * uSpeed;
  float d1 = 9.0, d2 = 9.0;
  vec2 c1 = vec2(0.0);
  for (int y = -2; y <= 2; y++) {
    for (int x = -2; x <= 2; x++) {
      vec2 n = i + vec2(float(x), float(y));
      vec2 r = h2(n);
      vec2 pt = n + 0.5 + (0.5 * uWander) * sin(t + 6.2831 * r);
      vec2 toM = mp - pt;
      float near = exp(-dot(toM, toM) / (1.8 * uReach * uReach)) * uHover * uMouseK;
      pt += toM * near * 0.55;
      float d = length(p - pt);
      if (d < d1) { d2 = d1; d1 = d; c1 = n; } else if (d < d2) { d2 = d; }
    }
  }
  float edge = d2 - d1;
  float w = fwidth(p.x) * uWidth;
  float line = 1.0 - smoothstep(w * 0.6, w * 1.6, edge);
  float lit = exp(-dot(pos - m, pos - m) / (0.08 * uReach * uReach)) * uHover * uMouseK;
  vec3 col = uBg;
  col = mix(col, uInk, line * 0.55);
  col = mix(col, uAccent, line * lit);
  col += uAccent * 0.025 * h2(c1).x * (1.0 + lit * 3.0);
  col *= mix(0.6, 1.0, smoothstep(0.95, 0.2, length(gl_FragCoord.xy / uRes - 0.5)));
  gl_FragColor = vec4(col, 1.0);
}`;
export default shaderScene(FRAG, {
  uInk: ['ink', 'c'], uAccent: ['accent', 'c'], uBg: ['background', 'c'],
  uScale: ['scale', 'f'], uWidth: ['width', 'f'], uWander: ['wander', 'f'], uSpeed: ['speed', 'f'],
}, { ink: '#a79e93', accent: '#d2494d', background: '#0c0b0a', scale: 9, width: 1, wander: 0.8, speed: 1 });
