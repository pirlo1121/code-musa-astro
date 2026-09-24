import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { frame, SECTION_COUNT } from '../../lib/store';
import { sceneRefs, type FocusTarget } from '../../lib/scene-refs';
import { sampleCameraPath } from '../../animations/camera-path';
import { STATIONS } from '../../scenes/layout';

const WORLD_UP = new Vector3(0, 1, 0);
const SKILLS = 2;
const PROJECTS = 3;

/**
 * Drives the camera from the scroll state:
 *  1. Damps the scroll parameter (inertia on top of Lenis) and samples the path.
 *  2. While a skill/project step is active, blends toward a close-up of that
 *     planet — beside it along its orbit, so it is lit as a half phase.
 *  3. Adds idle drift and pointer parallax so the shot is never frozen.
 *  4. Re-aims so the object sits where the layout leaves room for the copy.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);

  const v = useRef({
    pathPos: new Vector3(), pathLook: new Vector3(),
    focusCam: new Vector3(), focusLook: new Vector3(),
    wantCam: new Vector3(), wantLook: new Vector3(),
    pos: new Vector3(), look: new Vector3(), prev: new Vector3(),
    right: new Vector3(), up: new Vector3(), dir: new Vector3(),
    radial: new Vector3(), tangent: new Vector3(), toStation: new Vector3(),
    focusWeight: 0, focusReady: false, lastFocus: null as FocusTarget | null, lastStation: SKILLS,
    lastFrameX: 0.3, lastFrameY: 0,
    px: 0, py: 0, initialized: false,
  }).current;

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const t = state.clock.elapsedTime;

    // 1 · Path ---------------------------------------------------------------
    if (!v.initialized) frame.u = frame.targetU;
    frame.u = MathUtils.damp(frame.u, frame.targetU, 2.8, dt);
    frame.section = Math.min(SECTION_COUNT - 1, Math.floor((frame.u + 0.5) / 2));
    const framing = sampleCameraPath(frame.u, v.pathPos, v.pathLook);

    // 2 · Focus on the active planet ---------------------------------------
    let target: FocusTarget | null = null;
    let station = SKILLS;
    if (frame.section === SKILLS && frame.activeSkill >= 0) target = sceneRefs.skills[frame.activeSkill] ?? null;
    if (frame.section === PROJECTS && frame.activeProject >= 0) {
      target = sceneRefs.projects[frame.activeProject] ?? null;
      station = PROJECTS;
    }
    if (target) { v.lastFocus = target; v.lastStation = station; }
    v.focusWeight = MathUtils.damp(v.focusWeight, target ? 1 : 0, 2.2, dt);

    const focus = v.lastFocus;
    if (focus && v.focusWeight > 0.001) {
      const center = STATIONS[v.lastStation].center;
      v.radial.subVectors(focus.position, center).setY(0).normalize();
      v.tangent.crossVectors(WORLD_UP, v.radial);
      v.toStation.subVectors(STATIONS[v.lastStation].camDepart, center);
      if (v.tangent.dot(v.toStation) < 0) v.tangent.negate();
      const isProject = v.lastStation === PROJECTS;
      // Portrait screens are narrow: back off so the planet and its rings fit.
      const portraitScale = size.width / Math.max(1, size.height) < 0.9 ? 1.8 : 1;
      const dist = (focus.size * (isProject ? 4.2 : 5.2) + (isProject ? 10 : 6)) * portraitScale;
      v.wantCam.copy(focus.position)
        .addScaledVector(v.radial, dist * 0.3)
        .addScaledVector(v.tangent, dist * 0.88)
        .addScaledVector(WORLD_UP, dist * 0.34);
      v.wantLook.copy(focus.position);
      if (!v.focusReady) {
        v.focusCam.copy(v.wantCam);
        v.focusLook.copy(v.wantLook);
        v.focusReady = true;
      } else {
        v.focusCam.lerp(v.wantCam, 1 - Math.exp(-2.6 * dt));
        v.focusLook.lerp(v.wantLook, 1 - Math.exp(-3.2 * dt));
      }
      v.lastFrameX = isProject ? 0.34 : 0.3;
      v.lastFrameY = isProject ? -0.18 : 0;
    } else if (v.focusWeight <= 0.001) {
      v.focusReady = false;
    }

    const w = v.focusWeight;
    v.pos.lerpVectors(v.pathPos, v.focusCam, w);
    v.look.lerpVectors(v.pathLook, v.focusLook, w);
    sceneRefs.focusPoint.copy(v.look);

    // 3 · Life: idle drift + pointer parallax ------------------------------
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

    // 4 · Framing ------------------------------------------------------------
    const aspect = size.width / Math.max(1, size.height);
    const portrait = aspect < 0.9;
    const halfH = distance * Math.tan(MathUtils.degToRad(camera.fov / 2));
    const halfW = halfH * aspect;
    const fx = MathUtils.lerp(framing.frameX, v.lastFrameX, w);
    const fy = MathUtils.lerp(0, v.lastFrameY, w);
    if (portrait) {
      // Copy sits in the lower half on phones: lift the object instead.
      const lift = MathUtils.lerp(framing.frameY, 0.3, w);
      v.look.addScaledVector(v.up, -lift * halfH);
    } else {
      v.look.addScaledVector(v.right, -fx * halfW).addScaledVector(v.up, -fy * halfH);
    }

    camera.position.copy(v.pos);
    camera.lookAt(v.look);
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
