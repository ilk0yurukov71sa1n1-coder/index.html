import shaderScene from './shaderScene';

// Stacked rock layers seen in cross-section, each edge a fine line. The layers drift sideways at different speeds, and the cursor pushes them up into a dome.
const FRAG = `
uniform vec3 uInk; uniform vec3 uAccent; uniform vec3 uBg;
uniform float uLayers; uniform float uWave; uniform float uWidth; uniform float uSpeed;
float hash1(float n){ return fract(sin(n * 91.3458) * 47453.5453); }
void main(){
  float asp = uRes.x / uRes.y;
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 pos = vec2(uv.x * asp, uv.y);
  float t = uTime * 0.06 * uSpeed;
  vec2 m = uMouse * vec2(asp, 1.0);
  vec2 rel = pos - m;
  float dome = exp(-dot(rel * vec2(0.7, 1.0), rel * vec2(0.7, 1.0)) / (0.07 * uReach * uReach)) * uHover * uMouseK;
  float f = uv.y * uLayers;
  float id0 = floor(f);
  float best = 9.0; float bid = id0;
  for (int j = -3; j <= 3; j++) {
    float id = id0 + float(j);
    float speed = 0.4 + hash1(id) * 0.9;
    float edge = id + (noise(vec2(pos.x * 1.6 + t * speed + id * 3.1, id * 0.7)) - 0.5) * uWave + dome * 5.5 * (1.0 - id / uLayers * 0.5);
    float d = abs(f - edge);
    if (d < best) { best = d; bid = id; }
  }
  float px = uLayers / uRes.y;
  float line = 1.0 - smoothstep(uWidth * px * 0.5, uWidth * px * 0.5 + px * 1.2, best);
  float fill = 0.5 + 0.5 * hash1(floor(f - 0.0) + 7.0);
  vec3 col = uBg + uInk * 0.035 * hash1(bid * 1.7);
  col = mix(col, uInk, line * 0.7);
  col = mix(col, uAccent, line * dome * 0.9);
  col *= mix(0.6, 1.0, smoothstep(0.95, 0.2, length(uv - 0.5)));
  gl_FragColor = vec4(col, 1.0);
}`;
export default shaderScene(FRAG, {
  uInk: ['ink', 'c'], uAccent: ['accent', 'c'], uBg: ['background', 'c'],
  uLayers: ['layers', 'f'], uWave: ['wave', 'f'], uWidth: ['width', 'f'], uSpeed: ['speed', 'f'],
}, { ink: '#b9b0a4', accent: '#d2494d', background: '#0c0b0a', layers: 26, wave: 2.4, width: 1.2, speed: 1 });
