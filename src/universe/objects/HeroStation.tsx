// Hero: an orbital station (rotating habitat ring, solar wings, beacons)
// in front of a banded gas giant.

import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Group, InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import { useWorld } from '../context';
import { KEY_STAR } from '../world';
import { Planet } from './Planet';

const GIANT_COLORS: [string, string, string] = ['#1c2350', '#5b6fb8', '#c9b6ff'];

const hull = new MeshStandardMaterial({ color: '#b9c2d6', metalness: 0.55, roughness: 0.38 });
const dark = new MeshStandardMaterial({ color: '#2a3144', metalness: 0.6, roughness: 0.5 });
const panel = new MeshStandardMaterial({ color: '#15254a', metalness: 0.8, roughness: 0.25, emissive: '#0b1a3a', emissiveIntensity: 0.4 });
const windowMat = new MeshStandardMaterial({ color: '#000000', emissive: '#9fd8ff', emissiveIntensity: 3 });

export function HeroStation() {
  const world = useWorld();
  const ring = useRef<Group>(null);
  const station = useRef<Group>(null);
  const windows = useRef<InstancedMesh>(null);

  const WINDOW_COUNT = 48;
  useLayoutEffect(() => {
    const dummy = new Object3D();
    for (let i = 0; i < WINDOW_COUNT; i++) {
      const a = (i / WINDOW_COUNT) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * 3.2, Math.sin(a) * 3.2, 0.3);
      dummy.rotation.set(0, 0, a);
      dummy.updateMatrix();
      windows.current!.setMatrixAt(i, dummy.matrix);
    }
    windows.current!.instanceMatrix.needsUpdate = true;
  }, []);

  const beaconMat = useMemo(
    () => new MeshStandardMaterial({ color: '#000000', emissive: '#ff4040', emissiveIntensity: 4 }),
    [],
  );

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    if (ring.current) ring.current.rotation.z += dt * 0.12;
    if (station.current) station.current.rotation.y = Math.sin(t * 0.05) * 0.25 - 0.5;
    beaconMat.emissiveIntensity = Math.pow(Math.max(Math.sin(t * 2.4), 0), 12) * 8;
  });

  return (
    <>
      <group position={world.heroStation}>
        <group ref={station} rotation={[0.35, -0.5, 0.15]}>
          {/* Hub and axis */}
          <mesh material={hull}>
            <cylinderGeometry args={[0.55, 0.55, 3.6, 24]} />
          </mesh>
          <mesh material={dark} position={[0, 2.1, 0]}>
            <sphereGeometry args={[0.7, 24, 16]} />
          </mesh>
          <mesh material={dark} position={[0, -2.2, 0]}>
            <cylinderGeometry args={[0.25, 0.45, 0.8, 16]} />
          </mesh>

          {/* Rotating habitat ring */}
          <group ref={ring} rotation={[Math.PI / 2, 0, 0]}>
            <mesh material={hull}>
              <torusGeometry args={[3.2, 0.28, 16, 96]} />
            </mesh>
            {[0, 1, 2, 3].map((i) => (
              <mesh key={i} material={dark} rotation={[0, 0, (i * Math.PI) / 2]}>
                <boxGeometry args={[6.4, 0.08, 0.08]} />
              </mesh>
            ))}
            <instancedMesh ref={windows} args={[undefined, windowMat, WINDOW_COUNT]}>
              <boxGeometry args={[0.18, 0.06, 0.04]} />
            </instancedMesh>
          </group>

          {/* Solar wings */}
          {[-1, 1].map((side) => (
            <group key={side} position={[0, 1.2 * side, 0]} rotation={[0, 0, Math.PI / 2]}>
              <mesh material={dark} position={[0, side * 3.4, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 5, 8]} />
              </mesh>
              {[0, 1, 2].map((j) => (
                <mesh key={j} material={panel} position={[0, side * (2 + j * 1.35), 0]}>
                  <boxGeometry args={[1.6, 1.2, 0.04]} />
                </mesh>
              ))}
            </group>
          ))}

          {/* Beacons */}
          {[[0, 2.85, 0], [0, -2.65, 0], [3.2, 0, 0]].map((p, i) => (
            <mesh key={i} position={p as [number, number, number]} material={beaconMat}>
              <sphereGeometry args={[0.06, 8, 8]} />
            </mesh>
          ))}
        </group>
      </group>

      <group position={world.heroGiant}>
        <Planet radius={60} kind="gas" colors={GIANT_COLORS} atmosphere="#8ea2ff" light={KEY_STAR} seed={3.3} spin={0.004} tilt={0.18} />
      </group>
    </>
  );
}
