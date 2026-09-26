import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { frame, SECTION_COUNT } from '../../lib/store';
import { sceneRefs } from '../../lib/scene-refs';
import { sampleCameraPath } from '../../animations/camera-path';

const WORLD_UP = new Vector3(0, 1, 0);
const BASE_FOV = 55;

/**
 * Drives the camera from the scroll state:
 *  1. Damps the scroll parameter (inertia on top of Lenis) and samples the path.
 *  2. Adds idle drift and pointer parallax so the shot is never frozen.
 *  3. Re-aims so the object sits where the layout leaves room for the copy.
 *  4. Flies like a ship: banks into turns and widens the lens at speed.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);

  const v = useRef({
    pos: new Vector3(), look: new Vector3(), prev: new Vector3(),
    right: new Vector3(), up: new Vector3(), dir: new Vector3(),
    px: 0, py: 0, roll: 0, fov: BASE_FOV, initialized: false,
  }).current;

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const t = state.clock.elapsedTime;

    // 1 · Path ---------------------------------------------------------------
    if (!v.initialized) frame.u = frame.targetU;
    frame.u = MathUtils.damp(frame.u, frame.targetU, 2.8, dt);
    frame.section = Math.min(SECTION_COUNT - 1, Math.floor((frame.u + 0.5) / 2));
    const framing = sampleCameraPath(frame.u, v.pos, v.look);
    sceneRefs.focusPoint.copy(v.look);

    // 2 · Life: idle drift + pointer parallax ------------------------------
    v.px = MathUtils.damp(v.px, frame.pointerX, 2, dt);
    v.py = MathUtils.damp(v.py, frame.pointerY, 2, dt);
    v.dir.subVectors(v.look, v.pos);
    const distance = v.dir.length();
    v.dir.divideScalar(distance || 1);
    v.right.crossVectors(v.dir, WORLD_UP).normalize();
    v.up.crossVectors(v.right, v.dir);
    const drift = 0.5 + distance * 0.004;
    v.pos
      .addScaledVector(v.right, Math.sin(t * 0.11) * drift + v.px * 1.4)
      .addScaledVector(v.up, Math.sin(t * 0.07 + 1.3) * drift * 0.7 - v.py * 0.9);

    // 3 · Framing ------------------------------------------------------------
    const aspect = size.width / Math.max(1, size.height);
    const portrait = aspect < 0.9;
    const halfH = distance * Math.tan(MathUtils.degToRad(camera.fov / 2));
    const halfW = halfH * aspect;
    if (portrait) {
      // Copy sits in the lower half on phones: lift the object instead.
      v.look.addScaledVector(v.up, -framing.frameY * halfH);
    } else {
      v.look.addScaledVector(v.right, -framing.frameX * halfW);
    }

    camera.position.copy(v.pos);
    camera.lookAt(v.look);

    // 4 · Ship feel ------------------------------------------------------------
    // Bank against sideways motion, like a craft leaning into a turn.
    const lateral = sceneRefs.velocity.dot(v.right);
    v.roll = MathUtils.damp(v.roll, MathUtils.clamp(-lateral * 0.0022, -0.1, 0.1), 1.6, dt);
    camera.rotateZ(v.roll);
    // Open the lens slightly at cruise speed for a sense of acceleration.
    v.fov = MathUtils.damp(v.fov, BASE_FOV + Math.min(frame.speed * 0.06, 7), 1.8, dt);
    if (Math.abs(camera.fov - v.fov) > 0.01) {
      camera.fov = v.fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();

    if (v.initialized && dt > 0) {
      sceneRefs.velocity.subVectors(v.pos, v.prev).divideScalar(dt);
      frame.speed = sceneRefs.velocity.length();
    }
    v.prev.copy(v.pos);
    v.initialized = true;
  });

  return null;
}
