// Quality tiers. The initial tier is a cheap heuristic (no GPU benchmark
// download); PerformanceMonitor then steps it down at runtime if the frame
// rate cannot hold.

import type { Tier } from '../scroll/store';

export interface Quality {
  dpr: [number, number];
  /** Multiplier on star / particle counts. */
  particles: number;
  galaxyPoints: number;
  nebula: boolean;
  skyResolution: number;
  fbmOctaves: number;
  multisampling: number;
  comets: boolean;
}

export const QUALITY: Record<Tier, Quality> = {
  low: {
    dpr: [1, 1],
    particles: 0.35,
    galaxyPoints: 6000,
    nebula: false,
    skyResolution: 512,
    fbmOctaves: 3,
    multisampling: 0,
    comets: false,
  },
  mid: {
    dpr: [1, 1.5],
    particles: 0.65,
    galaxyPoints: 12000,
    nebula: true,
    skyResolution: 1024,
    fbmOctaves: 4,
    multisampling: 0,
    comets: true,
  },
  high: {
    dpr: [1, 2],
    particles: 1,
    galaxyPoints: 20000,
    nebula: true,
    skyResolution: 1024,
    fbmOctaves: 5,
    multisampling: 4,
    comets: true,
  },
};

export function initialTier(): Tier {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  const touch = window.matchMedia('(pointer: coarse)').matches;
  if (touch) return cores >= 8 && memory >= 6 ? 'mid' : 'low';
  if (cores >= 8 && memory >= 8) return 'high';
  return cores >= 4 ? 'mid' : 'low';
}

export const lowerTier = (t: Tier): Tier => (t === 'high' ? 'mid' : 'low');
