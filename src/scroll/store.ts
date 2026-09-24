// State shared by the scroll runtime (Astro <script>) and the 3D island.
//
// `frame` holds per-frame values: a plain mutable object read inside
// useFrame, so scrolling never triggers React renders.
// `ui` holds discrete values (current stop, quality tier) that React
// components subscribe to.
//
// Both bundles import this module; the instances are pinned on globalThis so
// they stay shared even if the bundler ever duplicates the module.

import { createStore, type StoreApi } from 'zustand/vanilla';

export type Tier = 'low' | 'mid' | 'high';

export interface FrameState {
  /** Journey coordinate: stop index, fractional while travelling. */
  s: number;
  /** Pointer in NDC (-1..1), 0 on touch devices. */
  px: number;
  py: number;
  /** Camera speed in world units / s (written by the camera rig). */
  speed: number;
  camVel: [number, number, number];
  reducedMotion: boolean;
}

export interface UiState {
  stop: number;
  tier: Tier;
  goTo: (stop: number) => void;
}

interface Shared {
  frame: FrameState;
  ui: StoreApi<UiState>;
}

const g = globalThis as typeof globalThis & { __journey?: Shared };

g.__journey ??= {
  frame: { s: 0, px: 0, py: 0, speed: 0, camVel: [0, 0, 0], reducedMotion: false },
  ui: createStore<UiState>(() => ({ stop: 0, tier: 'mid', goTo: () => {} })),
};

export const frame = g.__journey.frame;
export const ui = g.__journey.ui;
