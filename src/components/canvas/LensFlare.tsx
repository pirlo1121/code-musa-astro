import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, MathUtils, Mesh, Object3D, PerspectiveCamera, ShaderMaterial, Vector3 } from 'three';
import { flareFragment } from '../../shaders/hologram';
import { quadVertex } from '../../shaders/planet';
import { stationDistance } from '../../lib/store';

// Ghosts along the line from the light through the screen centre. `t` is
// the position on that line (0 = on the light, 1 = mirrored across centre),
// sizes are fractions of the half view height.
const ELEMENTS = [
  { t: 0, shape: 2, w: 3.2, h: 0.1, color: '#7fb0ff', opacity: 0.45 },
  { t: 0, shape: 0, w: 0.45, h: 0.45, color: '#ffd8a8', opacity: 0.22 },
  { t: 0.32, shape: 3, w: 0.05, h: 0.05, color: '#72ffd0', opacity: 0.1 },
  { t: 0.5, shape: 0, w: 0.025, h: 0.025, color: '#ffae70', opacity: 0.18 },
  { t: 0.66, shape: 1, w: 0.14, h: 0.14, color: '#8fa6ff', opacity: 0.07 },
  { t: 0.82, shape: 3, w: 0.08, h: 0.08, color: '#c08bff', opacity: 0.07 },
  { t: 1.15, shape: 0, w: 0.18, h: 0.18, color: '#4e7bff', opacity: 0.04 },
];

const DISTANCE = 1; // in front of the camera, well past the near plane

/** Cinematic anamorphic lens flare for a light source, drawn procedurally. */
export function LensFlare({ source, station }: { source: RefObject<Object3D | null>; station: number }) {
  const meshes = useRef<(Mesh | null)[]>([]);
  const strength = useRef(0);
  const world = useMemo(() => new Vector3(), []);
  const ndc = useMemo(() => new Vector3(), []);

  const materials = useMemo(() => ELEMENTS.map((e) => new ShaderMaterial({
    vertexShader: quadVertex,
    fragmentShader: flareFragment,
    uniforms: { uColor: { value: new Color(e.color) }, uOpacity: { value: 0 }, uShape: { value: e.shape } },
    blending: AdditiveBlending,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  })), []);

  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  useFrame(({ camera }, dt) => {
    const cam = camera as PerspectiveCamera;
    const src = source.current;
    let target = 0;
    if (src && stationDistance(station) < 1.2) {
      src.getWorldPosition(world);
      ndc.copy(world).project(cam);
      if (ndc.z < 1 && ndc.z > -1) {
        const edge = Math.max(Math.abs(ndc.x), Math.abs(ndc.y));
        target = (1 - MathUtils.smoothstep(edge, 0.75, 1.25)) * (1 - MathUtils.smoothstep(stationDistance(station), 0.4, 1.1));
      }
    }
    strength.current = MathUtils.damp(strength.current, target, 5, dt);

    const halfH = Math.tan(MathUtils.degToRad(cam.fov / 2)) * DISTANCE;
    const halfW = halfH * cam.aspect;
    ELEMENTS.forEach((e, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      mesh.visible = strength.current > 0.01;
      if (!mesh.visible) return;
      const k = 1 - 2 * e.t;
      mesh.position.set(ndc.x * k * halfW, ndc.y * k * halfH, -DISTANCE).applyMatrix4(cam.matrixWorld);
      mesh.quaternion.copy(cam.quaternion);
      mesh.scale.set(e.w * halfH, e.h * halfH, 1);
      materials[i].uniforms.uOpacity.value = e.opacity * strength.current;
    });
  });

  return (
    <>
      {ELEMENTS.map((_, i) => (
        <mesh key={i} ref={(m) => { meshes.current[i] = m; }} material={materials[i]} renderOrder={1000} frustumCulled={false}>
          <planeGeometry args={[2, 2]} />
        </mesh>
      ))}
    </>
  );
}
