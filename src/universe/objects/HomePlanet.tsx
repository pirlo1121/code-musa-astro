// About: a habitable world with oceans, clouds, city lights on the night
// side, and a small moon.

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Group } from 'three';
import { useWorld } from '../context';
import { KEY_STAR } from '../world';
import { Planet } from './Planet';

const EARTH: [string, string, string] = ['#0a2a5c', '#3d7a3a', '#c9b98a'];
const MOON: [string, string, string] = ['#5a5a62', '#8a8a92', '#c8c8d0'];

export function HomePlanet() {
  const world = useWorld();
  const moon = useRef<Group>(null);

  useFrame((state) => {
    const a = state.clock.elapsedTime * 0.04 + 1.2;
    moon.current?.position.set(Math.cos(a) * 30, Math.sin(a) * 6, Math.sin(a) * 30);
  });

  return (
    <group position={world.homePlanet}>
      <Planet radius={14} kind="terrestrial" colors={EARTH} atmosphere="#5fb4ff" light={KEY_STAR} seed={1.7} spin={0.015} tilt={0.4} cityLights />
      <group ref={moon}>
        <Planet radius={2.2} kind="ice" colors={MOON} atmosphere="#20242c" light={KEY_STAR} seed={8.1} spin={0.01} tilt={0} />
      </group>
    </group>
  );
}
