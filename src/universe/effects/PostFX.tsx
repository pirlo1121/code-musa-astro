// Post-processing chain. HDR half-float buffers so emissive values above 1
// bloom; ACES tone mapping at the end (the renderer itself runs flat).
// Order matters: CinematicEffect re-samples the raw frame, so it runs first
// and bloom is added on top of the lensed/blurred image.
//
// Ambient occlusion is intentionally absent: in open space almost nothing
// occludes anything, so SSAO would cost a full-screen depth pass for no
// visible gain outside the two stations.

import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing';
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import { HalfFloatType, MathUtils, Vector3 } from 'three';
import { frame } from '../../scroll/store';
import { useQuality, useWorld } from '../context';
import { HORIZON } from '../objects/BlackHole';
import { KEY_STAR, SUN, SUN_RADIUS } from '../world';
import { CinematicEffect } from './CinematicEffect';

const ndc = new Vector3();
const edge = new Vector3();
const right = new Vector3();
const toSource = new Vector3();
const toCenter = new Vector3();

function segmentHitsSphere(from: Vector3, to: Vector3, center: Vector3, radius: number) {
  toSource.copy(to).sub(from);
  const len = toSource.length();
  toSource.divideScalar(len);
  toCenter.copy(center).sub(from);
  const t = MathUtils.clamp(toCenter.dot(toSource), 0, len);
  return toCenter.addScaledVector(toSource, -t).lengthSq() < radius * radius;
}

export function PostFX() {
  const quality = useQuality();
  const world = useWorld();
  const cinematic = useMemo(() => new CinematicEffect(), []);
  const smoothed = useMemo(() => ({ warp: 0, flare: 0 }), []);

  useFrame((state, dt) => {
    const cam = state.camera;
    const aspect = state.size.width / state.size.height;
    cinematic.aspect.value = aspect;

    // Warp grows with camera speed
    const targetWarp = frame.reducedMotion ? 0 : MathUtils.smoothstep(frame.speed, 25, 220);
    smoothed.warp = MathUtils.damp(smoothed.warp, targetWarp, 6, dt);
    cinematic.warp.value = smoothed.warp;

    // Black hole lensing, in screen space
    const hole = world.blackHole;
    const dist = cam.position.distanceTo(hole);
    ndc.copy(hole).project(cam);
    if (dist < 1100 && ndc.z < 1 && Math.abs(ndc.x) < 1.6 && Math.abs(ndc.y) < 1.6) {
      right.set(1, 0, 0).applyQuaternion(cam.quaternion);
      edge.copy(hole).addScaledVector(right, HORIZON).project(cam);
      const radius = Math.hypot((edge.x - ndc.x) * 0.5 * aspect, (edge.y - ndc.y) * 0.5);
      cinematic.hole.value.set(ndc.x * 0.5 + 0.5, ndc.y * 0.5 + 0.5, radius);
    } else {
      cinematic.hole.value.z = 0;
    }

    // Lens flare from the sun (near the solar system) or the distant key star
    let best = 0;
    let bx = 0;
    let by = 0;
    for (const [source, reach, body] of [
      [SUN, 1400, SUN_RADIUS],
      [KEY_STAR, Infinity, 0],
    ] as const) {
      const d = cam.position.distanceTo(source);
      if (d > reach) continue;
      ndc.copy(source).project(cam);
      if (ndc.z > 1) continue;
      const onScreen = 1 - MathUtils.smoothstep(Math.max(Math.abs(ndc.x), Math.abs(ndc.y)), 0.75, 1.15);
      if (onScreen <= 0) continue;
      const occluded = world.occluders.some((o) => segmentHitsSphere(cam.position, source, o.center, o.radius));
      if (occluded) continue;
      const near = reach === Infinity ? 0.55 : 1 - MathUtils.smoothstep(d, body * 30, reach);
      const strength = onScreen * near;
      if (strength > best) {
        best = strength;
        bx = ndc.x * 0.5 + 0.5;
        by = ndc.y * 0.5 + 0.5;
      }
    }
    smoothed.flare = MathUtils.damp(smoothed.flare, best, 5, dt);
    if (best > 0) cinematic.flare.value.set(bx, by, smoothed.flare);
    else cinematic.flare.value.z = smoothed.flare > 0.01 ? smoothed.flare : 0;
  });

  return (
    <EffectComposer multisampling={quality.multisampling} frameBufferType={HalfFloatType} enableNormalPass={false}>
      <primitive object={cinematic} dispose={null} />
      <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.9} luminanceSmoothing={0.25} radius={0.72} />
      <Vignette offset={0.28} darkness={0.72} />
      <Noise opacity={0.028} blendFunction={BlendFunction.OVERLAY} premultiply />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
