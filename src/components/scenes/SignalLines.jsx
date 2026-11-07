import shaderScene from './shaderScene';

// Rows of fine horizontal lines, each one lifted by a slow signal, like a printed oscilloscope trace. The cursor sends a ripple through the rows it crosses.
const FRAG = `
uniform vec3 uInk; uniform vec3 uAccent; uniform vec3 uBg;
uniform float uRows; uniform float uAmp; uniform float uWidth; uniform float uSpeed;
float lift(float x, float row, float t, vec2 m, float aspect){
  float h = noise(vec2(x * 2.2 + t, row * 0.35)) + 0.5 * noise(vec2(x * 5.0 - t * 1.3, row * 0.9 + 3.0));
  h = (h - 0.6) * 1.4;
  float dx = x * aspect - m.x;
  float rowY = row / uRows;
  float dy = rowY - m.y;
  float d = sqrt(dx * dx + dy * dy * 4.0);
  float wave = sin(d * 28.0 - uTime * 4.0 * uSpeed) * exp(-d * 3.2 / uReach) * uHover * uMouseK;
  return h * uAmp + wave * uAmp * 1.1;
}
void main(){
  float aspect = uRes.x / uRes.y;
  vec2 uv = gl_FragCoord.xy / uRes;
  float t = uTime * 0.12 * uSpeed;
  vec2 m = vec2(uMouse.x * aspect, uMouse.y);
  float base = uv.y * uRows;
  float px = uRows / uRes.y;
  float best = 9.0;
  float near = 0.0;
  for (int j = -4; j <= 4; j++) {
    float row = floor(base) + float(j);
    float envelope = smoothstep(-0.05, 0.25, row / uRows) * smoothstep(1.05, 0.7, row / uRows);
    float y = row + lift(uv.x, row, t, m, aspect) * envelope;
    float d = abs(base - y);
    if (d < best) { best = d; near = row; }
  }
  float line = 1.0 - smoothstep(uWidth * px * 0.5, uWidth * px * 0.5 + px * 1.2, best);
  float mark = step(0.5, fract(near / 8.0 + 0.0625)) * 0.0;
  float idx = mod(near, 8.0) < 0.5 ? 1.0 : 0.0;
  vec3 col = mix(uBg, mix(uInk, uAccent, idx), line * (0.5 + 0.5 * idx));
  col *= mix(0.6, 1.0, smoothstep(0.95, 0.2, length(uv - 0.5)));
  gl_FragColor = vec4(col, 1.0);
}`;
export default shaderScene(FRAG, {
  uInk: ['ink', 'c'], uAccent: ['accent', 'c'], uBg: ['background', 'c'],
  uRows: ['rows', 'f'], uAmp: ['amplitude', 'f'], uWidth: ['width', 'f'], uSpeed: ['speed', 'f'],
}, { ink: '#c9c1b6', accent: '#b0383c', background: '#0c0b0a', rows: 46, amplitude: 3.2, width: 1.3, speed: 1 });
