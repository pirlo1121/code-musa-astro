import { CatmullRomCurve3, Vector3 } from 'three';
import { STATIONS } from '../scenes/layout';

// Two control points per station (arrive, depart) give 2N points and 2N − 1
// segments, matching the scroll director's `u` parameter one to one:
// even segments are the slow dolly while parked, odd ones are the flights.
// CatmullRomCurve3.getPoint maps t uniformly per control-point segment, so
// segment k is exactly t ∈ [k, k+1] / (2N − 1).

const camPoints: Vector3[] = [];
const lookPoints: Vector3[] = [];
const frames: { x: number; y: number }[] = [];

for (const s of STATIONS) {
  camPoints.push(s.camArrive, s.camDepart);
  // A tiny offset keeps centripetal parametrisation away from coincident points.
  lookPoints.push(s.center, s.center.clone().add(new Vector3(0, 0.25, 0)));
  frames.push({ x: s.frameX, y: s.frameY }, { x: s.frameX, y: s.frameY });
}

const camCurve = new CatmullRomCurve3(camPoints, false, 'centripetal');
const lookCurve = new CatmullRomCurve3(lookPoints, false, 'centripetal');

export const SEGMENTS = camPoints.length - 1;

/** Flights ease in and out so the camera decelerates into every object. */
function easeFlight(t: number): number {
  const smooth = t * t * t * (t * (t * 6 - 15) + 10);
  return t + (smooth - t) * 0.85;
}

function shape(u: number): { t: number; seg: number; f: number } {
  const clamped = Math.min(Math.max(u, 0), SEGMENTS);
  const seg = Math.min(Math.floor(clamped), SEGMENTS - 1);
  let f = clamped - seg;
  if (seg % 2 === 1) f = easeFlight(f);
  return { t: (seg + f) / SEGMENTS, seg, f };
}

export function sampleCameraPath(u: number, outPos: Vector3, outLook: Vector3): { frameX: number; frameY: number } {
  const { t, seg, f } = shape(u);
  camCurve.getPoint(t, outPos);
  lookCurve.getPoint(t, outLook);
  const a = frames[seg];
  const b = frames[seg + 1];
  return { frameX: a.x + (b.x - a.x) * f, frameY: a.y + (b.y - a.y) * f };
}
