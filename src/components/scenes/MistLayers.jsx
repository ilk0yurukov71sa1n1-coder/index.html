import { useScene, rawColor } from './useScene';

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAG = `
uniform float uTime; uniform vec2 uRes; uniform vec3 uA; uniform vec3 uB; uniform vec3 uBg;
uniform float uLayers; uniform float uScale; uniform float uContrast; uniform float uGrain;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; } return v; }
void main(){
  vec2 uv = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  vec3 col = uBg;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    if (fi >= uLayers) break;
    float depth = fi / max(uLayers - 1.0, 1.0);
    float z = mix(0.6, 1.8, depth);
    vec2 p = uv * uScale * z + vec2(uTime * (0.03 + 0.02 * depth), -uTime * 0.012 * z) + fi * 7.3;
    float n = fbm(p + fbm(p * 0.6 + uTime * 0.02));
    float m = smoothstep(0.38, 0.72, n);
    vec3 tint = mix(uA, uB, depth);
    col = mix(col, tint, m * (0.95 - depth * 0.3) * uContrast);
  }
  float vig = smoothstep(1.25, 0.2, length(uv));
  col *= mix(0.55, 1.0, vig);
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.04 * uGrain;
  gl_FragColor = vec4(col, 1.0);
}`;

const MistLayers = ({ colorA = '#7d1d20', colorB = '#4a403b', background = '#0b0909', layers = 4, scale = 1.6, contrast = 0.8, grain = 0.6, speed = 1, className = '', style }) => {
  const { hostRef, propsRef } = useScene(({ THREE, scene, camera, props }) => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() }, uBg: { value: new THREE.Color() }, uLayers: { value: 4 }, uScale: { value: 1.6 }, uContrast: { value: 1 }, uGrain: { value: 0.6 } },
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
    camera.position.z = 1;
    return {
      resize(w, h) { mat.uniforms.uRes.value.set(w, h); },
      update(t) {
        const p = props.current; const u = mat.uniforms;
        u.uTime.value = t; u.uLayers.value = p.layers; u.uScale.value = p.scale; u.uContrast.value = p.contrast; u.uGrain.value = p.grain;
        u.uA.value.copy(rawColor(THREE, p.colorA, '#7d1d20')); u.uB.value.copy(rawColor(THREE, p.colorB, '#4a403b')); u.uBg.value.copy(rawColor(THREE, p.background, '#0b0909'));
      },
    };
  }, []);
  propsRef.current = { colorA, colorB, background, layers, scale, contrast, grain, speed };
  return <div ref={hostRef} className={`scene-host${className ? ` ${className}` : ''}`} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background, ...style }} />;
};
export default MistLayers;
