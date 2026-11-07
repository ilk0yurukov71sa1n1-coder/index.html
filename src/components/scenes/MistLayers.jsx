import shaderScene from './shaderScene';

// Layers of slow mist in two tones. The cursor pushes the mist aside and lights the clearing, then it drifts back.
const FRAG = `
uniform vec3 uA; uniform vec3 uB; uniform vec3 uBg;
uniform float uLayers; uniform float uScale; uniform float uContrast; uniform float uGrain;
void main(){
  float asp = uRes.x / uRes.y;
  vec2 uv = (gl_FragCoord.xy / uRes - 0.5) * vec2(asp, 1.0);
  vec2 m = (uMouse - 0.5) * vec2(asp, 1.0);
  vec2 rel = uv - m;
  float inf = exp(-dot(rel, rel) / (0.1 * uReach * uReach)) * uHover * uMouseK;
  vec2 puv = uv + rel * inf * 1.1 - uMouseV * inf * 0.25;
  vec3 col = uBg;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    if (fi >= uLayers) break;
    float depth = fi / max(uLayers - 1.0, 1.0);
    float z = mix(0.6, 1.8, depth);
    vec2 p = puv * uScale * z + vec2(uTime * (0.03 + 0.02 * depth), -uTime * 0.012 * z) + fi * 7.3;
    float n = fbm(p + fbm(p * 0.6 + uTime * 0.02));
    float m2 = smoothstep(0.38, 0.72, n);
    vec3 tint = mix(uA, uB, depth);
    col = mix(col, tint, m2 * (0.95 - depth * 0.3) * uContrast);
  }
  col += uA * inf * 0.16;
  float vig = smoothstep(1.25, 0.2, length(uv));
  col *= mix(0.55, 1.0, vig);
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.04 * uGrain;
  gl_FragColor = vec4(col, 1.0);
}`;
export default shaderScene(FRAG, {
  uA: ['colorA', 'c'], uB: ['colorB', 'c'], uBg: ['background', 'c'],
  uLayers: ['layers', 'f'], uScale: ['scale', 'f'], uContrast: ['contrast', 'f'], uGrain: ['grain', 'f'],
}, { colorA: '#7d1d20', colorB: '#4a403b', background: '#0b0909', layers: 4, scale: 1.6, contrast: 0.8, grain: 0.6, speed: 1 });
