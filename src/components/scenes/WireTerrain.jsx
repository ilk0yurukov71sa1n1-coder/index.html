import { useScene, toColor, rawColor } from './useScene';

const VERT = `
uniform float uTime; uniform float uHeight; uniform float uScale; uniform vec2 uM; uniform float uBump;
varying float vH; varying vec2 vUv; varying float vDepth;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; } return v; }
void main(){
  vec3 p = position;
  vec2 q = vec2(p.x, p.y - uTime) * uScale;
  float ridge = 1.0 - abs(fbm(q) * 2.0 - 1.0);
  float h = pow(ridge, 2.2) * uHeight;
  vec2 dm = p.xy - uM;
  h += uBump * uHeight * 0.9 * exp(-dot(dm, dm) / 60.0);
  p.z = h; vH = h / max(uHeight, 0.001); vUv = uv;
  vec4 mv = modelViewMatrix * vec4(p, 1.0); vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform vec3 uLine; uniform vec3 uBg; uniform float uDensity; uniform float uFade; uniform float uFar;
varying float vH; varying vec2 vUv; varying float vDepth;
void main(){
  vec2 g = vUv * uDensity;
  vec2 d = abs(fract(g - 0.5) - 0.5) / fwidth(g);
  float line = 1.0 - min(min(d.x, d.y), 1.0);
  float fog = 1.0 - smoothstep(uFar * (1.0 - uFade), uFar, vDepth);
  float lift = 0.22 + vH * 0.6;
  float a = line * fog * lift;
  gl_FragColor = vec4(mix(uBg, uLine, a), 1.0);
}`;

const WireTerrain = ({ lineColor = '#c9a59c', background = '#0e0c0b', speed = 1, height = 5, scale = 0.05, density = 90, fade = 0.7, tilt = 24, mouse = 1, className = '', style }) => {
  const { hostRef, propsRef } = useScene(({ THREE, renderer, scene, camera, props, pointer }) => {
    const geo = new THREE.PlaneGeometry(120, 120, 220, 220);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, extensions: { derivatives: true },
      uniforms: { uTime: { value: 0 }, uHeight: { value: 5 }, uScale: { value: 0.05 }, uLine: { value: new THREE.Color() }, uBg: { value: new THREE.Color() }, uDensity: { value: 90 }, uFade: { value: 0.7 }, uFar: { value: 90 }, uM: { value: new THREE.Vector2(0, 0) }, uBump: { value: 0 } },
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);
    camera.position.set(0, 7, 38);
    const ray = new THREE.Raycaster();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1);
    const hit = new THREE.Vector3();
    return {
      update(t) {
        const p = props.current;
        mat.uniforms.uTime.value = t * 2.2;
        mat.uniforms.uHeight.value = p.height; mat.uniforms.uScale.value = p.scale;
        mat.uniforms.uDensity.value = p.density; mat.uniforms.uFade.value = p.fade;
        mat.uniforms.uLine.value.copy(rawColor(THREE, p.lineColor, '#c9a59c'));
        const bg = toColor(THREE, p.background, '#0e0c0b');
        mat.uniforms.uBg.value.copy(rawColor(THREE, p.background, '#0e0c0b'));
        renderer.setClearColor(bg, 1);
        const a = (p.tilt * Math.PI) / 180;
        camera.position.set(0, 6 + p.height * 0.6, 40);
        camera.lookAt(0, 6 - Math.tan(a) * 18 + p.height * 0.2, 0);
        camera.updateMatrixWorld();
        ray.setFromCamera(new THREE.Vector2(pointer.x * 2 - 1, pointer.y * 2 - 1), camera);
        if (ray.ray.intersectPlane(ground, hit)) mat.uniforms.uM.value.set(hit.x, -hit.z);
        mat.uniforms.uBump.value = pointer.hover * (p.mouse ?? 1);
      },
    };
  }, []);
  propsRef.current = { lineColor, background, speed, height, scale, density, fade, tilt, mouse };
  return <div ref={hostRef} className={`scene-host${className ? ` ${className}` : ''}`} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background, ...style }} />;
};
export default WireTerrain;
