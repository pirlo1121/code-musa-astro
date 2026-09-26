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

// Every nebula is approached the same way as the first one: the camera
// arrives in front of it and dollies slowly into the cloud.
const nebulaStation = (center: Vector3, side: 1 | -1, frameX: number, frameY = 0.4): Station => ({
  center,
  camArrive: center.clone().add(v(32 * side, -6, 78)),
  camDepart: center.clone().add(v(23 * side, -4, 50)),
  frameX,
  frameY,
});

export const STATIONS: Station[] = [
  // 0 · Hero — massive star, copy on the left
  { center: v(20, 8, -110), camArrive: v(0, 2, 0), camDepart: v(3, 3, -20), frameX: 0.42, frameY: 0.42 },
  // 1 · About — violet nebula, copy on the right
  nebulaStation(v(-70, 20, -300), 1, -0.38),
  // 2 · Skills — emerald nebula
  nebulaStation(v(60, -6, -480), -1, 0.3),
  // 3 · Projects — crimson nebula
  nebulaStation(v(-40, 4, -670), 1, -0.3),
  // 4 · Experience — sapphire nebula, copy on the left
  nebulaStation(v(50, 0, -860), -1, 0.42),
  // 5 · Contact — black hole, copy on the left
  { center: v(0, 0, -1060), camArrive: v(6, 3, -992), camDepart: v(2, 1, -1012), frameX: 0.4, frameY: 0.4 },
];

export const HERO = { radius: 16 };
export const NEBULA = { origin: v(0, 0, 0), radius: v(75, 34, 60) };
export const BLACK_HOLE = { radius: 7 };

export interface NebulaLook {
  outer: string[];
  inner: string[];
  motes: string[];
  starCool: string;
  starHot: string;
  /** Young stars embedded in the cloud, relative to its centre. */
  stars: Vector3[];
}

// Palettes per nebula station, keyed by station index.
export const NEBULAE: Record<number, NebulaLook> = {
  // Emission nebula: hydrogen magenta, oxygen teal, dusty blue.
  1: {
    outer: ['#6a2bd9', '#2b5bd9', '#c0268f', '#1a8aa8'],
    inner: ['#ff4fa3', '#39d5ff', '#ffb35c', '#9d6bff'],
    motes: ['#ffd1f0', '#b8f3ff', '#ffe7c2'],
    starCool: '#5fb6ff', starHot: '#d6f0ff',
    stars: [v(-12, 6, 10), v(18, -8, -14), v(-26, -4, -22)],
  },
  // Emerald: ionised oxygen greens with cyan edges.
  2: {
    outer: ['#0f7f5c', '#12609a', '#1fae7a', '#0b4a66'],
    inner: ['#4dffc0', '#b4ff6b', '#39d5ff', '#e2fff2'],
    motes: ['#d4ffe9', '#b8f3ff', '#f0ffc2'],
    starCool: '#5fffc0', starHot: '#e0fff4',
    stars: [v(14, 8, 8), v(-20, -6, -10), v(24, -2, -24)],
  },
  // Crimson: glowing hydrogen reds and ember orange.
  3: {
    outer: ['#b8321f', '#7a1838', '#c46a1c', '#5a1a5a'],
    inner: ['#ffa24d', '#ff5a4a', '#ffd88a', '#ff4f9a'],
    motes: ['#ffe0c8', '#ffc2c2', '#fff0c2'],
    starCool: '#ff9a5f', starHot: '#fff0d6',
    stars: [v(-16, 4, 12), v(20, -6, -8), v(-8, -10, -26)],
  },
  // Sapphire: reflection-nebula blues with a violet core.
  4: {
    outer: ['#1f3fc4', '#4a24b8', '#1a70b0', '#2a1878'],
    inner: ['#8fb8ff', '#c49dff', '#dff0ff', '#6be0ff'],
    motes: ['#dfe8ff', '#e6d8ff', '#c8f4ff'],
    starCool: '#7fa8ff', starHot: '#eef4ff',
    stars: [v(10, 10, 6), v(-22, -4, -12), v(18, -8, -26)],
  },
};
