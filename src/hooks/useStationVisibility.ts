import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import { stationDistance } from '../lib/store';

/**
 * Hides a station's whole subtree when the camera is far from it (fewer draw
 * calls and no GPU time on objects that would be a few pixels big), and
 * pre-compiles its shaders the moment it mounts so the first time it comes
 * into view does not hitch mid-flight.
 *
 * `range` is in stations: 1.6 means "visible from the middle of the previous
 * flight until the middle of the next one".
 */
export function useStationVisibility(index: number, range = 1.6) {
  const ref = useRef<Group>(null);
  const ready = useRef(false);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const group = ref.current;
    if (!group) return;
    // compile() only walks visible objects, so show the group for the call.
    group.visible = true;
    let cancelled = false;
    gl.compileAsync(group, camera, scene)
      .catch(() => {})
      .finally(() => { if (!cancelled) ready.current = true; });
    group.visible = false;
    return () => { cancelled = true; };
  }, [gl, camera, scene]);

  useFrame(() => {
    const group = ref.current;
    if (group) group.visible = ready.current && stationDistance(index) < range;
  });

  return ref;
}
