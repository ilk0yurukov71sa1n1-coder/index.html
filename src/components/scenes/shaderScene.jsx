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
  const fragment = `precision highp float;\nuniform float uTime; uniform vec2 uRes;\nvarying vec2 vUv;\n${NOISE}\n${frag}`;
  return function Scene(props) {
    const { className = '', style } = props;
    const merged = { ...defaults, ...props };
    const { hostRef, propsRef } = useScene(({ THREE, renderer, scene, camera, props: ref }) => {
      const uniforms = { uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } };
      Object.entries(spec).forEach(([u, [, t]]) => { uniforms[u] = { value: t === 'c' ? new THREE.Color() : 0 }; });
      const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: fragment, uniforms, extensions: { derivatives: true } });
      scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
      camera.position.z = 1;
      return {
        resize(w, h) { uniforms.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio()); },
        update(t) {
          uniforms.uTime.value = t;
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
