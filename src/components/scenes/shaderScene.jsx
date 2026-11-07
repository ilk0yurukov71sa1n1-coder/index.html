import { useScene, rawColor } from './useScene';

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

// Builds a full-box background from a fragment shader. `spec` maps shader uniforms to props:
// { uSpeed: ['speed', 'f'], uInk: ['ink', 'c'] }  (f = number, c = colour). The shader declares its own uniforms; uTime and uRes are always provided.
export default function shaderScene(frag, spec, defaults) {
  const NOISE = `
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; } return v; }
`;
  const fragment = `precision highp float;\nuniform float uTime; uniform vec2 uRes; uniform vec2 uMouse; uniform vec2 uMouseV; uniform float uHover; uniform float uMouseK; uniform float uReach;\nvarying vec2 vUv;\n${NOISE}\n${frag}`;
  return function Scene(props) {
    const { className = '', style } = props;
    const merged = { mouse: 1, reach: 1, ...defaults, ...props };
    const { hostRef, propsRef } = useScene(({ THREE, renderer, scene, camera, props: ref, pointer }) => {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      const uniforms = { uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uMouse: { value: new THREE.Vector2(0.5, 0.5) }, uMouseV: { value: new THREE.Vector2() }, uHover: { value: 0 }, uMouseK: { value: 1 }, uReach: { value: 1 } };
      Object.entries(spec).forEach(([u, [, t]]) => { uniforms[u] = { value: t === 'c' ? new THREE.Color() : 0 }; });
      const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: fragment, uniforms, extensions: { derivatives: true } });
      scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
      camera.position.z = 1;
      return {
        resize(w, h) { uniforms.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio()); },
        update(t) {
          uniforms.uTime.value = t;
          uniforms.uMouse.value.set(pointer.x, pointer.y);
          uniforms.uMouseV.value.set(pointer.vx, pointer.vy);
          uniforms.uHover.value = pointer.hover;
          uniforms.uMouseK.value = Number(ref.current.mouse ?? 1);
          uniforms.uReach.value = Number(ref.current.reach ?? 1);
          Object.entries(spec).forEach(([u, [prop, type]]) => {
            if (type === 'c') uniforms[u].value.copy(rawColor(THREE, ref.current[prop], '#888888'));
            else uniforms[u].value = Number(ref.current[prop]);
          });
        },
      };
    }, []);
    propsRef.current = merged;
    return <div ref={hostRef} className={className} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: merged.background, ...style }} />;
  };
}
