import shaderScene from './shaderScene';

// Thin bright veins running through dark stone, drawn from a warped noise field. The cursor drags the veins toward it and brightens the ones it touches.
const FRAG = `
uniform vec3 uVein; uniform vec3 uGlow; uniform vec3 uBg;
uniform float uScale; uniform float uSharp; uniform float uWarp; uniform float uSpeed;
void main(){
  float asp = uRes.x / uRes.y;
  vec2 pos = gl_FragCoord.xy / uRes.y;
  vec2 m = uMouse * vec2(asp, 1.0);
  vec2 rel = pos - m;
  float inf = exp(-dot(rel, rel) / (0.06 * uReach * uReach)) * uHover * uMouseK;
  vec2 p = (pos - rel * inf * 0.45) * uScale;
  float t = uTime * 0.05 * uSpeed;
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + uWarp * q + vec2(1.7, 9.2) + t * 0.5), fbm(p + uWarp * q + vec2(8.3, 2.8) - t * 0.4));
  float f = fbm(p + uWarp * r);
  float ridge = 1.0 - abs(f * 2.0 - 1.0);
  float vein = pow(ridge, uSharp);
  float fine = pow(1.0 - abs(fbm(p * 2.4 + r * 2.0) * 2.0 - 1.0), uSharp * 1.6);
  vec3 col = uBg;
  col = mix(col, uVein, vein * 0.9 + fine * 0.25);
  col = mix(col, uGlow, vein * inf * 0.9);
  col *= mix(0.55, 1.0, smoothstep(0.95, 0.15, length(gl_FragCoord.xy / uRes - 0.5)));
  gl_FragColor = vec4(col, 1.0);
}`;
export default shaderScene(FRAG, {
  uVein: ['vein', 'c'], uGlow: ['glow', 'c'], uBg: ['background', 'c'],
  uScale: ['scale', 'f'], uSharp: ['sharpness', 'f'], uWarp: ['warp', 'f'], uSpeed: ['speed', 'f'],
}, { vein: '#cfc6ba', glow: '#d2494d', background: '#0b0a09', scale: 2.4, sharpness: 70, warp: 2.2, speed: 1 });
