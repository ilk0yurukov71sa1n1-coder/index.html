import shaderScene from './shaderScene';

// A close twill weave in two tones, lit from one side like silk cloth. The cursor presses a soft dent into the cloth and the threads there catch more light.
const FRAG = `
uniform vec3 uWarp; uniform vec3 uWeft; uniform vec3 uBg;
uniform float uCells; uniform float uSheen; uniform float uSpeed;
void main(){
  float asp = uRes.x / uRes.y;
  vec2 pos = gl_FragCoord.xy / uRes.y;
  vec2 m = uMouse * vec2(asp, 1.0);
  vec2 rel = pos - m;
  float dent = exp(-dot(rel, rel) / (0.05 * uReach * uReach)) * uHover * uMouseK;
  float t = uTime * 0.03 * uSpeed;
  vec2 p = pos - rel * dent * 0.35;
  p += 0.012 * vec2(sin(pos.y * 5.0 + t * 8.0), cos(pos.x * 4.0 - t * 7.0));
  vec2 g = p * uCells;
  vec2 cell = floor(g);
  vec2 f = fract(g);
  // twill: each warp thread passes over three weft threads and under one, shifted by a step per row
  float over = step(mod(cell.x + cell.y, 4.0), 2.5);
  float warpProfile = sin(f.x * 3.14159);
  float weftProfile = sin(f.y * 3.14159);
  float gap = smoothstep(0.0, 0.12, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
  float shade = mix(weftProfile, warpProfile, over);
  vec3 base = mix(uWeft, uWarp, over);
  vec2 centre = (cell + 0.5) / uCells;
  vec2 light = vec2(0.5 * asp, 0.9);
  float facing = 0.5 + 0.5 * dot(normalize(vec2(0.6, 0.8)), normalize(vec2(f.x - 0.5, f.y - 0.5) + 1e-4));
  float lit = pow(shade, 1.6) * (0.35 + uSheen * (0.4 * facing + 0.9 * dent));
  vec3 col = uBg + base * lit * gap;
  float vig = smoothstep(0.95, 0.2, length(gl_FragCoord.xy / uRes - 0.5));
  col *= mix(0.55, 1.0, vig);
  gl_FragColor = vec4(col, 1.0);
}`;
export default shaderScene(FRAG, {
  uWarp: ['warp', 'c'], uWeft: ['weft', 'c'], uBg: ['background', 'c'],
  uCells: ['cells', 'f'], uSheen: ['sheen', 'f'], uSpeed: ['speed', 'f'],
}, { warp: '#b9a99a', weft: '#6f2a2c', background: '#0b0909', cells: 46, sheen: 1, speed: 1 });
