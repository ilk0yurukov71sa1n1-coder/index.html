import shaderScene from './shaderScene';

// A plain measuring grid. The cursor is a weight pressed into it: the lines bend toward the point and the cells under it grow.
const FRAG = `
uniform vec3 uInk; uniform vec3 uAccent; uniform vec3 uBg;
uniform float uCells; uniform float uWidth; uniform float uPull; uniform float uSpeed;
void main(){
  float asp = uRes.x / uRes.y;
  vec2 pos = gl_FragCoord.xy / uRes.y;
  vec2 m = uMouse * vec2(asp, 1.0);
  vec2 rel = pos - m;
  float r2 = dot(rel, rel);
  float well = exp(-r2 / (0.07 * uReach * uReach)) * uHover * uMouseK;
  // pull points toward the cursor, strongest at middle distance so the grid dips rather than tears
  vec2 g = pos + rel * well * uPull * 0.9;
  float drift = uTime * 0.02 * uSpeed;
  g += vec2(sin(pos.y * 3.0 + drift * 6.0), cos(pos.x * 3.0 - drift * 5.0)) * 0.008;
  vec2 cell = g * uCells;
  vec2 f = abs(fract(cell - 0.5) - 0.5) / fwidth(cell);
  float line = 1.0 - min(min(f.x, f.y), 1.0);
  vec2 major = abs(fract(cell / 5.0 - 0.5) - 0.5) / (fwidth(cell) / 5.0);
  float maj = 1.0 - min(min(major.x, major.y), 1.0);
  vec3 col = uBg;
  col = mix(col, uInk, line * 0.32);
  col = mix(col, uInk, maj * 0.5);
  col = mix(col, uAccent, line * well * 0.9);
  col *= mix(0.6, 1.0, smoothstep(0.95, 0.2, length(gl_FragCoord.xy / uRes - 0.5)));
  gl_FragColor = vec4(col, 1.0);
}`;
export default shaderScene(FRAG, {
  uInk: ['ink', 'c'], uAccent: ['accent', 'c'], uBg: ['background', 'c'],
  uCells: ['cells', 'f'], uWidth: ['width', 'f'], uPull: ['pull', 'f'], uSpeed: ['speed', 'f'],
}, { ink: '#b9b0a5', accent: '#d2494d', background: '#0c0b0a', cells: 22, width: 1, pull: 1.2, speed: 1 });
