import shaderScene from './shaderScene';

// Liquid metal drops raymarched in real 3D. Four drops orbit each other and the cursor is a fifth: it pulls the others toward it, merges with them and lets go in a string, like mercury on glass.
const FRAG = `
uniform vec3 uTint; uniform vec3 uAccent; uniform vec3 uBg;
uniform float uSize; uniform float uMerge; uniform float uSpeed;
vec3 centres[4];
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
vec3 mpos; float mrad;
float map(vec3 p){
  float d = 9.0;
  for (int i = 0; i < 4; i++) d = smin(d, length(p - centres[i]) - uSize * (0.55 + 0.1 * float(i)), uMerge);
  d = smin(d, length(p - mpos) - mrad, uMerge * 1.3);
  return d;
}
vec3 env(vec3 r){
  float up = r.y * 0.5 + 0.5;
  vec3 c = mix(vec3(0.03, 0.025, 0.025), vec3(0.55, 0.5, 0.46), smoothstep(0.1, 1.0, up));
  float strip = smoothstep(0.82, 0.95, sin(r.x * 3.0 + 0.6) * 0.5 + 0.5) * smoothstep(0.1, 0.5, r.y);
  float side = smoothstep(0.88, 0.97, dot(r, normalize(vec3(-0.7, 0.3, 0.5))));
  c += vec3(1.0, 0.96, 0.9) * (strip * 0.9 + side * 1.2);
  c = mix(c, uAccent * 1.6, smoothstep(0.0, -0.8, r.y) * 0.6);
  return c;
}
void main(){
  float asp = uRes.x / uRes.y;
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime * 0.35 * uSpeed;
  vec2 ma = (uMouse - 0.5) * vec2(asp, 1.0) * 2.6;
  vec2 auto = vec2(1.4 * sin(t * 0.7), 0.7 * cos(t * 0.9));
  vec2 mw = mix(auto, ma, uHover * uMouseK);
  mpos = vec3(mw, 0.0);
  mrad = uSize * 0.7;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec3 c = vec3(1.5 * sin(t * (0.6 + 0.17 * fi) + fi * 1.9), 0.8 * cos(t * (0.5 + 0.13 * fi) + fi * 2.3), 0.5 * sin(t * 0.4 + fi));
    vec3 toM = mpos - c;
    float pull = exp(-dot(toM.xy, toM.xy) / (1.5 * uReach * uReach)) * uHover * uMouseK;
    centres[i] = c + toM * pull * 0.55;
  }
  vec3 ro = vec3(0.0, 0.0, 4.2);
  vec3 rd = normalize(vec3(uv, -1.5));
  float tt = 0.0; bool hit = false;
  for (int i = 0; i < 56; i++) {
    float d = map(ro + rd * tt);
    if (d < 0.002) { hit = true; break; }
    tt += d;
    if (tt > 9.0) break;
  }
  vec3 col = uBg;
  if (hit) {
    vec3 p = ro + rd * tt;
    vec2 e = vec2(0.003, 0.0);
    vec3 n = normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy), map(p + e.yyx) - map(p - e.yyx)));
    vec3 r = reflect(rd, n);
    float fres = pow(1.0 - max(dot(-rd, n), 0.0), 3.0);
    col = env(r) * uTint * (0.75 + 0.5 * fres);
  } else {
    col += uAccent * 0.05 * exp(-dot(uv - mw / 2.6, uv - mw / 2.6) * 6.0) * uHover * uMouseK;
  }
  col *= mix(0.65, 1.0, smoothstep(0.95, 0.2, length(gl_FragCoord.xy / uRes - 0.5)));
  gl_FragColor = vec4(col, 1.0);
}`;
export default shaderScene(FRAG, {
  uTint: ['tint', 'c'], uAccent: ['accent', 'c'], uBg: ['background', 'c'],
  uSize: ['size', 'f'], uMerge: ['merge', 'f'], uSpeed: ['speed', 'f'],
}, { tint: '#e4ded6', accent: '#8a2226', background: '#0b0a0a', size: 0.55, merge: 0.55, speed: 1 });
