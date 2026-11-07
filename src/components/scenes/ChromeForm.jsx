import { useScene, toColor } from './useScene';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const ChromeForm = ({ tint = '#d9d6d2', background = '#0d0c0c', roughness = 0.12, speed = 1, scale = 1, form = 'knot', exposure = 1, mouse = 1, className = '', style }) => {
  const { hostRef, propsRef } = useScene(({ THREE, renderer, scene, camera, props, pointer }) => {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: 0.12 });
    const group = new THREE.Group();
    scene.add(group);
    const makeGeo = (kind) =>
      kind === 'torus' ? new THREE.TorusGeometry(1, 0.38, 96, 220)
      : kind === 'sphere' ? new THREE.IcosahedronGeometry(1.25, 24)
      : new THREE.TorusKnotGeometry(0.95, 0.32, 380, 48, 2, 3);
    let kind = null;
    let mesh = null;
    camera.position.set(0, 0, 6);
    return {
      update(t) {
        const p = props.current;
        if (kind !== p.form) {
          kind = p.form;
          if (mesh) { group.remove(mesh); mesh.geometry.dispose(); }
          mesh = new THREE.Mesh(makeGeo(kind), mat);
          group.add(mesh);
        }
        mat.color.copy(toColor(THREE, p.tint, '#d9d6d2'));
        mat.roughness = p.roughness;
        renderer.toneMappingExposure = p.exposure;
        renderer.setClearColor(toColor(THREE, p.background, '#0d0c0c'), 1);
        group.scale.setScalar(p.scale);
        // the form turns to face the pointer, and a little more when it moves fast
        const lean = (p.mouse ?? 1) * pointer.hover;
        group.rotation.y = t * 0.25 + (pointer.x - 0.5) * 1.6 * lean;
        group.rotation.x = Math.sin(t * 0.18) * 0.35 + 0.2 - (pointer.y - 0.5) * 1.1 * lean + pointer.vy * 0.4 * lean;
        group.position.x = (pointer.x - 0.5) * 0.5 * lean;
        group.position.y = (pointer.y - 0.5) * 0.35 * lean;
      },
      dispose() { env.dispose(); pmrem.dispose(); },
    };
  }, []);
  propsRef.current = { tint, background, roughness, speed, scale, form, exposure, mouse };
  return <div ref={hostRef} className={`scene-host${className ? ` ${className}` : ''}`} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background, ...style }} />;
};
export default ChromeForm;
