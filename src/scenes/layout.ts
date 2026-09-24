import { Vector3 } from 'three';

// World layout of the journey. The camera flies down −Z, swinging left and
// right so every object is framed against empty space rather than the next
// destination. Each station is where the camera "parks" while its HTML
// section is on screen.

export interface Station {
  /** Where the object lives. */
  center: Vector3;
  /** Camera position when the section starts / ends (slow dolly between them). */
  camArrive: Vector3;
  camDepart: Vector3;
  /** Where the object should sit on screen, as a fraction of the half-width
   *  (landscape) or half-height (portrait). Leaves room for the HTML copy. */
  frameX: number;
  frameY: number;
}

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

export const STATIONS: Station[] = [
  // 0 · Hero — massive star, copy on the left
  { center: v(20, 8, -110), camArrive: v(0, 2, 0), camDepart: v(3, 3, -20), frameX: 0.42, frameY: 0.42 },
  // 1 · About — nebula, copy on the right
  { center: v(-70, 20, -300), camArrive: v(-38, 14, -222), camDepart: v(-47, 16, -250), frameX: -0.38, frameY: 0.4 },
  // 2 · Skills — planetary system
  { center: v(60, -6, -470), camArrive: v(72, 24, -404), camDepart: v(66, 17, -418), frameX: 0.28, frameY: 0.35 },
  // 3 · Projects — spiral galaxy
  { center: v(-40, 4, -680), camArrive: v(-14, 42, -592), camDepart: v(-22, 34, -612), frameX: 0.3, frameY: 0.35 },
  // 4 · Experience — space station
  { center: v(50, 0, -860), camArrive: v(19, 9, -820), camDepart: v(25, 6, -832), frameX: 0.48, frameY: 0.4 },
  // 5 · Contact — wormhole
  { center: v(0, 0, -1060), camArrive: v(6, 3, -992), camDepart: v(2, 1, -1012), frameX: 0.4, frameY: 0.4 },
];

export const HERO = { radius: 16 };
export const NEBULA = { radius: v(75, 34, 60) };
export const SKILL_SYSTEM = { firstOrbit: 9, orbitGap: 5.4, tilt: 0.18 };
export const GALAXY = { radius: 72, tilt: -0.42, firstOrbit: 16, orbitGap: 8 };
export const PORTAL = { radius: 13 };
