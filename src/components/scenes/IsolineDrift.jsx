import shaderScene from './shaderScene';

// Map-style contour lines of a slowly warping field. The cursor raises a hill under it, so new contour rings grow around the pointer and fade as it leaves. Every fifth line is an index line, thicker and in the accent colour.
const FRAG = `
uniform vec3 uInk; uniform vec3 uAccent; uniform vec3 uBg;
uniform float uLevels; uniform float uScale; uniform float uWidth; uniform float uWarp; uniform float uSpeed;
float field(vec2 p, float t){
  vec2 q = vec2(fbm(p + vec2(0.0, t * 0.6)), fbm(p + vec2(5.2, 1.3) - t * 0.4));
  return fbm(p + uWarp * q + t * 0.15);
}
void main(){
  vec2 pos = gl_FragCoord.xy / uRes.y;
  vec2 m = uMouse * vec2(uRes.x / uRes.y, 1.0);
  float d = length(pos - m);
  float inf = exp(-d * d / (0.09 * uReach * uReach)) * uHover * uMouseK;
  vec2 uv = (pos - uMouseV * inf * 0.35) * uScale;
  float t = uTime * 0.12 * uSpeed;
  float f = (field(uv, t) + inf * 0.28) * uLevels;
  float w = fwidth(f);
  float id = floor(f);
  float edge = abs(fract(f) - 0.5);
  float px = edge / max(w, 1e-4);
  float thin = 1.0 - smoothstep(uWidth * 0.5, uWidth * 0.5 + 1.0, px);
  float index = mod(id, 5.0) < 0.5 ? 1.0 : 0.0;
  float thick = 1.0 - smoothstep(uWidth * 1.1, uWidth * 1.1 + 1.0, px);
  vec3 col = uBg;
  col = mix(col, uInk, thin * 0.55);
  col = mix(col, uAccent, thick * index);
  vec2 c = gl_FragCoord.xy / uRes - 0.5;
  col *= mix(0.6, 1.0, smoothstep(0.85, 0.15, length(c)));
  gl_FragColor = vec4(col, 1.0);
}`;
export default shaderScene(FRAG, {
  uInk: ['ink', 'c'], uAccent: ['accent', 'c'], uBg: ['background', 'c'],
  uLevels: ['levels', 'f'], uScale: ['scale', 'f'], uWidth: ['width', 'f'], uWarp: ['warp', 'f'], uSpeed: ['speed', 'f'],
}, { ink: '#bdb5a8', accent: '#b0383c', background: '#0c0b0a', levels: 28, scale: 2.2, width: 1.2, warp: 1.6, speed: 1 });
