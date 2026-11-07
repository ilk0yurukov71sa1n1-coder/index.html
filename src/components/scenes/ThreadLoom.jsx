import shaderScene from './shaderScene';

// Fine vertical threads that sway on a slow current. The cursor pushes the threads apart like a hand in a curtain, and a few cross threads catch light where they bend.
const FRAG = `
uniform vec3 uInk; uniform vec3 uAccent; uniform vec3 uBg;
uniform float uThreads; uniform float uSway; uniform float uWidth; uniform float uSpeed;
float tpos(float id, float y, float t, float aspect){
  float rest = id / uThreads;
  float sway = (noise(vec2(id * 0.13, y * 1.6 + t)) + 0.5 * noise(vec2(id * 0.31 + 4.0, y * 3.1 - t)) - 0.75) * uSway;
  float dy = y - uMouse.y;
  float reach = 0.2 * uReach;
  float fall = exp(-dy * dy / (reach * reach));
  float s = (rest - uMouse.x) * aspect;
  float spread = 0.45 * s * exp(-s * s / (0.06 * uReach * uReach)) * fall * uHover * uMouseK / aspect;
  return rest + sway * 3.0 / uThreads + spread;
}
void main(){
  float aspect = uRes.x / uRes.y;
  vec2 uv = gl_FragCoord.xy / uRes;
  float t = uTime * 0.1 * uSpeed;
  float id0 = floor(uv.x * uThreads + 0.5);
  float d = 9.0; float nid = id0;
  for (int j = -6; j <= 6; j++) {
    float id = id0 + float(j);
    float dd = abs(uv.x - tpos(id, uv.y, t, aspect)) * uThreads;
    if (dd < d) { d = dd; nid = id; }
  }
  float dy = uv.y - uMouse.y;
  float fall = exp(-dy * dy / (0.04 * uReach * uReach)) * uHover * uMouseK;
  float px = uThreads / uRes.x;
  float line = 1.0 - smoothstep(uWidth * px * 0.5, uWidth * px * 0.5 + px * 1.3, d);
  float lit = smoothstep(0.55, 0.95, noise(vec2(nid * 0.9, uv.y * 3.0 - t * 2.0))) + fall * 0.5;
  vec3 col = mix(uBg, mix(uInk, uAccent, clamp(lit, 0.0, 1.0)), line * (0.35 + 0.65 * clamp(lit + 0.3, 0.0, 1.0)));
  col *= mix(0.6, 1.0, smoothstep(0.95, 0.2, length(uv - 0.5)));
  gl_FragColor = vec4(col, 1.0);
}`;
export default shaderScene(FRAG, {
  uInk: ['ink', 'c'], uAccent: ['accent', 'c'], uBg: ['background', 'c'],
  uThreads: ['threads', 'f'], uSway: ['sway', 'f'], uWidth: ['width', 'f'], uSpeed: ['speed', 'f'],
}, { ink: '#a39a90', accent: '#c4474b', background: '#0c0b0a', threads: 120, sway: 0.5, width: 1.1, speed: 1 });
