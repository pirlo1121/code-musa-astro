import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Object3D } from 'three';

/** Keeps an object facing the camera (glows, flares, UI rings). */
export function useBillboard<T extends Object3D>() {
  const ref = useRef<T>(null);
  useFrame(({ camera }) => {
    ref.current?.quaternion.copy(camera.quaternion);
  });
  return ref;
}
