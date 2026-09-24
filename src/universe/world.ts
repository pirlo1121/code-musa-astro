// World layout: where every astronomical object lives and where the camera
// parks for each stop. Everything is derived from the stop list, so adding a
// project or a skill extends the journey automatically.

import { Vector3 } from 'three';
import { chapterRanges, type ChapterId, type Stop } from '../data/journey';
import { skills } from '../data/skills';

export interface Keyframe {
  pos: Vector3;
  look: Vector3;
  /** Screen-space shift of the subject (0 = centred, 0.3 = pushed aside for the text panel). */
  shift: number;
  /** Recomputes pos/look for keyframes that follow a moving object. */
  update?: (time: number) => void;
}

export interface Occluder {
  center: Vector3;
  radius: number;
}

export interface World {
  stops: Stop[];
  keyframes: Keyframe[];
  ranges: Record<ChapterId, [number, number]>;
  heroStation: Vector3;
  heroGiant: Vector3;
  homePlanet: Vector3;
  galaxies: Vector3[];
  blackHole: Vector3;
  xpStars: Vector3[];
  contactStation: Vector3;
  occluders: Occluder[];
}

/** A distant star that lights the whole journey (and drives the lens flare). */
// Up-right and slightly ahead of the camera's path: planets show a lit 3/4 phase.
export const KEY_STAR = new Vector3(2200, 1100, 600);
export const SUN = new Vector3(-70, 18, -620);

// ─── Solar system ────────────────────────────────────────────────────────────
export const SUN_RADIUS = 10;
const ORBIT_BASE = 36;
const ORBIT_STEP = 11;

export function orbitRadius(i: number) {
  return ORBIT_BASE + i * ORBIT_STEP;
}

const orbitPhase = (i: number) => i * 2.39996; // golden angle: planets never line up
export const orbitSpeed = (i: number) => 0.045 * Math.pow(ORBIT_BASE / orbitRadius(i), 1.5);
const orbitTilt = (i: number) => Math.sin(i * 12.9898) * 0.06;

export function skillPlanetPosition(i: number, time: number, out: Vector3) {
  const r = orbitRadius(i);
  const a = orbitPhase(i) + orbitSpeed(i) * time;
  const tilt = orbitTilt(i);
  return out.set(
    SUN.x + Math.cos(a) * r,
    SUN.y + Math.sin(a) * r * Math.sin(tilt),
    SUN.z + Math.sin(a) * r * Math.cos(tilt),
  );
}

// ─── Layout ──────────────────────────────────────────────────────────────────
export function buildWorld(stops: Stop[], galaxyCount: number): World {
  const ranges = chapterRanges(stops);

  const heroStation = new Vector3(0, 0, 0);
  const heroGiant = new Vector3(-95, -48, -230);
  const homePlanet = new Vector3(80, -8, -300);

  const galaxyBaseZ = SUN.z - 280;
  const galaxies = Array.from({ length: Math.max(galaxyCount, 1) }, (_, k) =>
    new Vector3(k % 2 === 0 ? 55 : -50, ((k * 37) % 30) - 15, galaxyBaseZ - k * 170),
  );

  const blackHole = new Vector3(0, 12, galaxies[galaxies.length - 1].z - 260);

  const xpCount = ranges.experience[1] - ranges.experience[0] + 1;
  const xpBase = new Vector3(25, 45, blackHole.z - 280);
  const xpStars = Array.from({ length: xpCount }, (_, i) =>
    new Vector3(
      xpBase.x + (i - (xpCount - 1) / 2) * 30,
      xpBase.y + Math.sin(i * 1.7) * 12,
      xpBase.z + Math.cos(i * 1.3) * 16,
    ),
  );

  const contactStation = new Vector3(0, 0, xpBase.z - 300);

  const keyframes: Keyframe[] = stops.map((stop) => {
    switch (stop.chapter) {
      case 'hero':
        return { pos: new Vector3(2.2, 1.6, 12), look: heroStation.clone().add(new Vector3(0, 0.4, 0)), shift: 0.36 };

      case 'about':
        return {
          pos: homePlanet.clone().add(new Vector3(-16, 7, 44)),
          look: homePlanet.clone(),
          shift: 0.34,
        };

      case 'skills': {
        if (stop.item < 0) {
          return {
            pos: SUN.clone().add(new Vector3(24, 95, 185)),
            look: SUN.clone().add(new Vector3(0, -6, 0)),
            shift: 0.3,
          };
        }
        const i = stop.item;
        const radius = skills[i]?.radius ?? 2.5;
        const dist = radius * 5.2 + 7;
        const kf: Keyframe = { pos: new Vector3(), look: new Vector3(), shift: 0.34 };
        const p = new Vector3();
        const out = new Vector3();
        const tangent = new Vector3();
        // Camera sits ahead in the orbit, above the plane and slightly sunward:
        // the planet shows a lit 3/4 phase and the sun stays out of the frame.
        kf.update = (time) => {
          skillPlanetPosition(i, time, p);
          out.copy(p).sub(SUN).normalize();
          tangent.set(-out.z, 0, out.x);
          kf.look.copy(p);
          kf.pos
            .copy(p)
            .addScaledVector(out, -0.2 * dist)
            .addScaledVector(tangent, 0.85 * dist);
          kf.pos.y += 0.5 * dist;
        };
        kf.update(0);
        return kf;
      }

      case 'projects': {
        const g = galaxies[Math.max(stop.item, 0)];
        return { pos: g.clone().add(new Vector3(-10, 30, 70)), look: g.clone(), shift: 0.32 };
      }

      case 'blackhole':
        return { pos: blackHole.clone().add(new Vector3(0, 9, 78)), look: blackHole.clone().add(new Vector3(0, 4, 0)), shift: 0 };

      case 'experience': {
        const star = xpStars[Math.max(stop.item, 0)];
        return { pos: star.clone().add(new Vector3(-6, 5, 42)), look: star.clone(), shift: 0.3 };
      }

      case 'contact':
        return {
          pos: contactStation.clone().add(new Vector3(-14, 12, 72)),
          look: contactStation.clone().add(new Vector3(0, 5, 0)),
          shift: 0.34,
        };
    }
  });

  const occluders: Occluder[] = [
    { center: heroGiant, radius: 60 },
    { center: homePlanet, radius: 16 },
    { center: blackHole, radius: 8 },
  ];

  return {
    stops,
    keyframes,
    ranges,
    heroStation,
    heroGiant,
    homePlanet,
    galaxies,
    blackHole,
    xpStars,
    contactStation,
    occluders,
  };
}
