// The camera flies along two Catmull-Rom splines built from the keyframes:
// one for its position, one for the point it looks at. Splitting them lets
// the camera frame an object while it glides past it, instead of always
// staring down the path's tangent.
//
// The scroll coordinate `s` is damped here (not the camera position), so the
// camera always stays on the path, even when a nav click jumps ten stops.

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { CatmullRomCurve3, MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { frame } from '../scroll/store';
import { useWorld } from './context';

const pos = new Vector3();
const look = new Vector3();
const right = new Vector3();
const up = new Vector3();
const prev = new Vector3();
const vel = new Vector3();

export function CameraRig() {
  const world = useWorld();
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);

  const { posCurve, lookCurve, dynamic, last } = useMemo(() => {
    const k = world.keyframes;
    return {
      // Curves hold references to the keyframe vectors, so dynamic keyframes
      // (orbiting planets) are picked up without rebuilding anything.
      posCurve: new CatmullRomCurve3(k.map((f) => f.pos), false, 'centripetal'),
      lookCurve: new CatmullRomCurve3(k.map((f) => f.look), false, 'centripetal'),
      dynamic: k.filter((f) => f.update),
      last: k.length - 1,
    };
  }, [world]);

  const rig = useRef({ s: frame.s, init: false, px: 0, py: 0, roll: 0, fov: 50, speed: 0 });

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const time = state.clock.elapsedTime;
    const r = rig.current;
    const reduced = frame.reducedMotion;

    for (const kf of dynamic) kf.update!(time);

    // Reduced motion: cut between stops instead of flying
    if (!r.init || reduced) {
      r.s = reduced ? Math.round(frame.s) : frame.s;
    } else {
      r.s = MathUtils.damp(r.s, frame.s, 3.2, dt);
    }
    const t = MathUtils.clamp(r.s / last, 0, 1);

    posCurve.getPoint(t, pos);
    lookCurve.getPoint(t, look);

    // Portrait screens are narrow: back the camera off so subjects still fit
    const aspect = size.width / size.height;
    if (aspect < 1) pos.sub(look).multiplyScalar(1 + (1 / aspect - 1) * 0.4).add(look);

    // Pointer parallax + a slow idle drift, scaled by distance to the subject
    r.px = MathUtils.damp(r.px, frame.px, 2.5, dt);
    r.py = MathUtils.damp(r.py, frame.py, 2.5, dt);
    camera.position.copy(pos);
    camera.lookAt(look);
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const reach = pos.distanceTo(look) * 0.035;
    const driftX = reduced ? 0 : Math.sin(time * 0.13) * 0.35;
    const driftY = reduced ? 0 : Math.sin(time * 0.17 + 1.3) * 0.25;
    camera.position
      .addScaledVector(right, (r.px * 0.9 + driftX) * reach)
      .addScaledVector(up, (-r.py * 0.6 + driftY) * reach);
    camera.lookAt(look);

    // Velocity drives FOV kick, banking and the warp effects
    if (!r.init) prev.copy(camera.position);
    vel.copy(camera.position).sub(prev).divideScalar(Math.max(dt, 1e-3));
    prev.copy(camera.position);
    r.init = true;
    r.speed = MathUtils.damp(r.speed, reduced ? 0 : vel.length(), 5, dt);
    frame.speed = r.speed;
    frame.camVel[0] = vel.x;
    frame.camVel[1] = vel.y;
    frame.camVel[2] = vel.z;

    const lateral = vel.dot(right);
    r.roll = MathUtils.damp(r.roll, reduced ? 0 : MathUtils.clamp(-lateral * 0.0015, -0.12, 0.12), 3, dt);
    camera.rotateZ(r.roll);

    const baseFov = aspect < 1 ? 62 : 50;
    const kick = reduced ? 0 : Math.min(r.speed * 0.045, 12);
    r.fov = MathUtils.damp(r.fov, baseFov + kick, 4, dt);
    camera.fov = r.fov;
    camera.updateProjectionMatrix();

    // Shift the subject away from the text panel by skewing the projection:
    // right on landscape screens, up on portrait ones.
    const k0 = Math.floor(r.s);
    const k1 = Math.min(k0 + 1, last);
    const shift = MathUtils.lerp(world.keyframes[k0].shift, world.keyframes[k1].shift, r.s - k0);
    const e = camera.projectionMatrix.elements;
    if (aspect >= 1) {
      e[8] = -shift * MathUtils.smoothstep(aspect, 0.95, 1.45);
    } else {
      // Text panels always sit at the bottom on portrait: lift every subject
      e[9] = -Math.max(shift, 0.28) * 1.1;
    }
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  });

  return null;
}
