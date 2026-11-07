import shaderScene from './shaderScene';

// Waves from three sources overlap, and only the places where they cancel are drawn, as fine lines. The cursor is a fourth source that adds its own fringes.
const FRAG = `
uniform vec3 uInk; uniform vec3 uAccent; uniform vec3 uBg;
uniform float uFreq; uniform float uWidth; uniform float uSpeed;
void main(){
  float asp = uRes.x / uRes.y;
  vec2 pos = (gl_FragCoord.xy / uRes - 0.5) * vec2(asp, 1.0);
  float t = uTime * 0.35 * uSpeed;
  vec2 s1 = vec2(-0.55 * asp * 0.7, 0.1 * sin(t * 0.3));
  vec2 s2 = vec2( 0.55 * asp * 0.7, 0.12 * cos(t * 0.25));
  vec2 s3 = vec2(0.1 * sin(t * 0.2), -0.42);
  vec2 mouse = (uMouse - 0.5) * vec2(asp, 1.0);
  float k = uFreq;
  float a = cos(length(pos - s1) * k - t) + cos(length(pos - s2) * k - t * 1.1) + cos(length(pos - s3) * k - t * 0.9);
  float dm = length(pos - mouse);
  float mAmp = uHover * uMouseK;
  float b = a + mAmp * 1.6 * cos(dm * k - t * 1.3) * exp(-dm * 1.4 / uReach);
  float w = fwidth(b);
  float line = 1.0 - smoothstep(uWidth * 0.5 * w, uWidth * 0.5 * w + w * 1.3, abs(b));
  float near = exp(-dm * dm / (0.06 * uReach * uReach)) * mAmp;
  vec3 col = mix(uBg, uInk, line * 0.75);
  col = mix(col, uAccent, line * near);
  col *= mix(0.6, 1.0, smoothstep(0.95, 0.2, length(gl_FragCoord.xy / uRes - 0.5)));
  gl_FragColor = vec4(col, 1.0);
}`;
export default shaderScene(FRAG, {
  uInk: ['ink', 'c'], uAccent: ['accent', 'c'], uBg: ['background', 'c'],
  uFreq: ['frequency', 'f'], uWidth: ['width', 'f'], uSpeed: ['speed', 'f'],
}, { ink: '#c4bbb0', accent: '#d2494d', background: '#0c0b0a', frequency: 38, width: 1.2, speed: 1 });
