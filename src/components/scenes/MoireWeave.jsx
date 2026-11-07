import shaderScene from './shaderScene';

// Two sets of very fine lines laid over each other with a slight difference. The moire bands that appear drift on their own, and the cursor acts like a lens that bends the lines under it.
const FRAG = `
uniform vec3 uInk; uniform vec3 uTone; uniform vec3 uBg;
uniform float uFreq; uniform float uDetune; uniform float uBend; uniform float uSpeed; uniform float uSoft;
float lines(vec2 p, float ang, float freq, float t){
  vec2 d = vec2(cos(ang), sin(ang));
  float v = dot(p, d) * freq + t;
  float s = abs(fract(v) - 0.5);
  float w = fwidth(v);
  return 1.0 - smoothstep(0.18 - w, 0.18 + w, s);
}
void main(){
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime * 0.05 * uSpeed;
  vec2 warp = vec2(fbm(p * 1.6 + t), fbm(p * 1.6 + 9.1 - t)) - 0.5;
  vec2 mp = (uMouse - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  vec2 rel = p - mp;
  float inf = exp(-dot(rel, rel) / (0.07 * uReach * uReach)) * uHover * uMouseK;
  vec2 q = p + warp * uBend + rel * inf * 0.6 + uMouseV * inf * 0.2;
  float a = lines(q, 0.0 + sin(t) * 0.05, uFreq, t * 3.0);
  float b = lines(q * (1.0 + uDetune), 0.07 + cos(t * 0.8) * 0.05, uFreq, -t * 2.0);
  float m = a * b;
  float band = clamp(a + b - 1.0, 0.0, 1.0);
  float glow = smoothstep(0.0, 1.0, fbm(q * 2.0 + t) * 1.4);
  vec3 col = uBg;
  col = mix(col, uTone, (a * 0.18 + b * 0.18) * (0.4 + glow * 0.6));
  col = mix(col, uInk, m * (0.55 + glow * 0.45));
  col *= mix(0.55, 1.0, smoothstep(0.95, 0.15, length(p)));
  gl_FragColor = vec4(col, 1.0);
}`;
export default shaderScene(FRAG, {
  uInk: ['ink', 'c'], uTone: ['tone', 'c'], uBg: ['background', 'c'],
  uFreq: ['frequency', 'f'], uDetune: ['detune', 'f'], uBend: ['bend', 'f'], uSpeed: ['speed', 'f'], uSoft: ['soft', 'f'],
}, { ink: '#d9d0c5', tone: '#7d1d20', background: '#0b0a09', frequency: 90, detune: 0.012, bend: 0.35, speed: 1, soft: 1 });
