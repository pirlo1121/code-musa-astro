import { Vector3 } from 'three';

// World-space values shared between scene components within the Canvas.
// Kept apart from store.ts so the DOM bundle never imports three.js.

export interface FocusTarget {
  position: Vector3;
  size: number;
}

export const sceneRefs = {
  /** Live positions of the focusable planets, written by their systems each frame. */
  skills: [] as FocusTarget[],
  projects: [] as FocusTarget[],
  /** What the camera is looking at (depth-of-field autofocus). */
  focusPoint: new Vector3(),
  /** Camera velocity in world units / second (motion streaks). */
  velocity: new Vector3(),
};
