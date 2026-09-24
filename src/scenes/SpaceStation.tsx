import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, InstancedMesh, Matrix4, MeshStandardMaterial,
  Object3D, Points, ShaderMaterial, Vector3,
} from 'three';
import { getHullTextures } from '../assets/textures';
import { beaconFragment, beaconVertex, beamFragment, beamVertex } from '../shaders/station';
import { useStationVisibility } from '../hooks/useStationVisibility';
import { STATIONS } from './layout';

const INDEX = 4;
const RING_RADIUS = 13;
const SHUTTLES = 5;

const BEACONS: [number, number, number, string][] = [
  [0, 16, 0, '#ff3b3b'], [0, -16, 0, '#ff3b3b'],
  [RING_RADIUS + 1.4, 0, 0, '#3bff8a'], [-RING_RADIUS - 1.4, 0, 0, '#3bff8a'],
  [0, 0, RING_RADIUS + 1.4, '#ffffff'], [0, 0, -RING_RADIUS - 1.4, '#ffffff'],
  [11, 14.2, 0, '#ffd23b'], [-11, 14.2, 0, '#ffd23b'], [11, -14.2, 0, '#ffd23b'], [-11, -14.2, 0, '#ffd23b'],
];

/**
 * Station 4 · Orbital station: rotating habitat ring with lit windows,
 * solar arrays, blinking beacons, a docking beam and shuttle traffic.
 * The only station using lit (PBR) materials, so it carries its own lights.
 */
export default function SpaceStation() {
  const group = useStationVisibility(INDEX);
  const ring = useRef<Group>(null);
  const radar = useRef<Group>(null);
  const shuttles = useRef<InstancedMesh>(null);
  const engines = useRef<Points>(null);

  const materials = useMemo(() => {
    const { map, emissive } = getHullTextures();
    return {
      hull: new MeshStandardMaterial({ color: '#b9c0cc', metalness: 0.35, roughness: 0.42 }),
      dark: new MeshStandardMaterial({ color: '#3a3f4a', metalness: 0.5, roughness: 0.5 }),
      habitat: new MeshStandardMaterial({
        map, emissiveMap: emissive, emissive: new Color('#ffffff'), emissiveIntensity: 2.2, metalness: 0.3, roughness: 0.5,
      }),
      panel: new MeshStandardMaterial({
        color: '#1a2d7a', emissive: new Color('#0b1a55'), emissiveIntensity: 0.6, metalness: 0.85, roughness: 0.22, side: DoubleSide,
      }),
      glow: new MeshStandardMaterial({ color: '#000000', emissive: new Color('#7fd8ff'), emissiveIntensity: 3 }),
    };
  }, []);

  const beacons = useMemo(() => {
    const pos = new Float32Array(BEACONS.length * 3);
    const col = new Float32Array(BEACONS.length * 3);
    const phase = new Float32Array(BEACONS.length);
    const c = new Color();
    BEACONS.forEach(([x, y, z, color], i) => {
      pos.set([x, y, z], i * 3);
      c.set(color).toArray(col, i * 3);
      phase[i] = (i % 4) * 0.25;
    });
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new BufferAttribute(col, 3));
    geo.setAttribute('aPhase', new BufferAttribute(phase, 1));
    const mat = new ShaderMaterial({
      vertexShader: beaconVertex, fragmentShader: beaconFragment,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
      blending: AdditiveBlending, transparent: true, depthWrite: false,
    });
    return { geo, mat };
  }, []);

  const beam = useMemo(() => new ShaderMaterial({
    vertexShader: beamVertex, fragmentShader: beamFragment,
    uniforms: { uTime: { value: 0 }, uColor: { value: new Color('#6fd6ff') } },
    blending: AdditiveBlending, transparent: true, depthWrite: false, side: DoubleSide,
  }), []);

  const engineGeo = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(SHUTTLES * 3), 3));
    geo.setAttribute('aColor', new BufferAttribute(new Float32Array(SHUTTLES * 3).fill(0).map((_, i) => [1.4, 2.2, 3][i % 3]), 3));
    geo.setAttribute('aPhase', new BufferAttribute(new Float32Array(SHUTTLES).fill(-1), 1));
    return geo;
  }, []);

  useEffect(() => () => {
    Object.values(materials).forEach((m) => m.dispose());
    beacons.geo.dispose(); beacons.mat.dispose(); beam.dispose(); engineGeo.dispose();
  }, [materials, beacons, beam, engineGeo]);

  const tmp = useMemo(() => ({ o: new Object3D(), m: new Matrix4(), p: new Vector3(), next: new Vector3() }), []);

  useFrame(({ clock, viewport }, dt) => {
    const t = clock.elapsedTime;
    if (ring.current) ring.current.rotation.y += dt * 0.06;
    if (radar.current) radar.current.rotation.y += dt * 0.8;
    beacons.mat.uniforms.uTime.value = t;
    beacons.mat.uniforms.uPixelRatio.value = viewport.dpr;
    beam.uniforms.uTime.value = t;

    // Shuttles fly tilted elliptical loops around the station.
    const inst = shuttles.current;
    const eng = engines.current;
    if (inst && eng) {
      const positions = eng.geometry.getAttribute('position') as BufferAttribute;
      for (let i = 0; i < SHUTTLES; i++) {
        const speed = 0.12 + i * 0.03;
        const path = (a: number, out: Vector3) => out.set(
          Math.cos(a) * (22 + i * 4),
          Math.sin(a * 2) * 3 + (i - 2) * 3,
          Math.sin(a) * (16 + i * 3),
        );
        const a = t * speed + i * 1.7;
        path(a, tmp.p);
        path(a + 0.02, tmp.next);
        tmp.o.position.copy(tmp.p);
        tmp.o.lookAt(tmp.next);
        tmp.o.updateMatrix();
        inst.setMatrixAt(i, tmp.o.matrix);
        // Engine glow just behind the hull.
        tmp.p.sub(tmp.next.sub(tmp.o.position).normalize().multiplyScalar(0.9));
        positions.setXYZ(i, tmp.p.x, tmp.p.y, tmp.p.z);
      }
      inst.instanceMatrix.needsUpdate = true;
      positions.needsUpdate = true;
    }
  });

  return (
    <>
      <ambientLight intensity={0.25} color="#8fa4ff" />
      {/* Distant sun: light comes from the upper left of the station. */}
      <directionalLight position={[-1, 0.7, 0.9]} intensity={2.6} color="#ffe6cc" />

      <group ref={group} position={STATIONS[INDEX].center} rotation={[0.25, -0.5, 0.18]}>
        <pointLight intensity={60} distance={45} decay={2} color="#ffb870" />

        {/* Spine and modules */}
        <mesh material={materials.hull}>
          <cylinderGeometry args={[1.3, 1.3, 30, 24]} />
        </mesh>
        {[-8, 0, 8].map((y) => (
          <mesh key={y} position={[0, y, 0]} material={materials.dark}>
            <cylinderGeometry args={[3, 3, 3.6, 32]} />
          </mesh>
        ))}
        {[-8, 8].map((y) => (
          <mesh key={`g${y}`} position={[0, y, 0]} material={materials.glow}>
            <torusGeometry args={[3.05, 0.12, 8, 48]} />
          </mesh>
        ))}

        {/* Rotating habitat ring with spokes */}
        <group ref={ring}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.habitat}>
            <torusGeometry args={[RING_RADIUS, 1.4, 20, 128]} />
          </mesh>
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} rotation={[0, (k * Math.PI) / 2, Math.PI / 2]} position={[Math.cos((k * Math.PI) / 2) * RING_RADIUS / 2, 0, -Math.sin((k * Math.PI) / 2) * RING_RADIUS / 2]} material={materials.hull}>
              <cylinderGeometry args={[0.3, 0.3, RING_RADIUS, 8]} />
            </mesh>
          ))}
        </group>

        {/* Solar arrays */}
        {[14.2, -14.2].map((y) => (
          <group key={y} position={[0, y, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]} material={materials.hull}>
              <cylinderGeometry args={[0.25, 0.25, 22, 8]} />
            </mesh>
            {[-6.5, 6.5].map((x) => (
              <mesh key={x} position={[x, 0, 0]} rotation={[0.3, 0, 0]} material={materials.panel}>
                <boxGeometry args={[8, 0.08, 3.6]} />
              </mesh>
            ))}
          </group>
        ))}

        {/* Radar dish */}
        <group ref={radar} position={[0, 15.5, 0]}>
          <mesh position={[1.2, 0.6, 0]} rotation={[0, 0, -0.9]} material={materials.hull}>
            <coneGeometry args={[1.4, 0.6, 24, 1, true]} />
          </mesh>
        </group>

        {/* Docking beam */}
        <mesh position={[0, -21, 0]} material={beam}>
          <cylinderGeometry args={[0.6, 3.2, 12, 32, 1, true]} />
        </mesh>

        <points geometry={beacons.geo} material={beacons.mat} frustumCulled={false} />

        <instancedMesh ref={shuttles} args={[undefined, undefined, SHUTTLES]} material={materials.hull} frustumCulled={false}>
          <boxGeometry args={[0.7, 0.45, 1.8]} />
        </instancedMesh>
        <points ref={engines} geometry={engineGeo} material={beacons.mat} frustumCulled={false} />
      </group>
    </>
  );
}
