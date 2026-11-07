import shaderScene from './shaderScene';

// Magnetic field lines between slow-moving poles, like iron filings under glass. The cursor is one of the poles: the lines reconnect around it as you move.
const FRAG = `
uniform vec3 uInk; uniform vec3 uAccent; uniform vec3 uBg;
uniform float uLines; uniform float uWidth; uniform float uSpeed;
float ang(vec2 p, vec2 c){ vec2 d = p - c; return atan(d.y, d.x); }
void main(){
  float asp = uRes.x / uRes.y;
  vec2 pos = (gl_FragCoord.xy / uRes - 0.5) * vec2(asp, 1.0);
  float t = uTime * 0.12 * uSpeed;
  vec2 mouse = (uMouse - 0.5) * vec2(asp, 1.0);
  vec2 auto = vec2(0.28 * asp * sin(t * 1.1), 0.22 * cos(t * 0.9));
  vec2 pm = mix(auto, mouse, uHover * uMouseK);
  vec2 p1 = vec2(-0.42 * asp * 0.8 + 0.08 * sin(t * 0.7), 0.1 * cos(t * 0.5) - 0.05);
  vec2 p2 = vec2( 0.42 * asp * 0.8 + 0.06 * cos(t * 0.6), -0.12 + 0.08 * sin(t * 0.8));
  vec2 p3 = vec2(0.05 * sin(t * 0.4), 0.34 + 0.05 * cos(t * 0.9));
  // stream function of two positive and two negative poles: contours of it are field lines
  float psi = ang(pos, pm) - ang(pos, p1) + ang(pos, p2) - ang(pos, p3);
  float v = psi / 6.28318 * uLines;
  float w = min(fwidth(v), fwidth(fract(v + 0.5)));
  float e = abs(fract(v) - 0.5);
  float line = 1.0 - smoothstep(uWidth * 0.5 * w * 0.5, uWidth * 0.5 * w * 0.5 + w * 1.2, 0.5 - e);
  float near = exp(-dot(pos - pm, pos - pm) / (0.05 * uReach * uReach));
  vec3 col = uBg;
  col = mix(col, uInk, line * (0.5 + 0.2 * near));
  col = mix(col, uAccent, line * near * uHover * uMouseK);
  col *= mix(0.6, 1.0, smoothstep(0.95, 0.2, length(gl_FragCoord.xy / uRes - 0.5)));
  gl_FragColor = vec4(col, 1.0);
}`;
export default shaderScene(FRAG, {
  uInk: ['ink', 'c'], uAccent: ['accent', 'c'], uBg: ['background', 'c'],
  uLines: ['lines', 'f'], uWidth: ['width', 'f'], uSpeed: ['speed', 'f'],
}, { ink: '#b4aba0', accent: '#d2494d', background: '#0c0b0a', lines: 28, width: 1.4, speed: 1 });
