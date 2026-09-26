import { Vector3 } from 'three';

// World-space values shared between scene components within the Canvas.
// Kept apart from store.ts so the DOM bundle never imports three.js.

export const sceneRefs = {
  /** What the camera is looking at (depth-of-field autofocus). */
  focusPoint: new Vector3(),
  /** Camera velocity in world units / second (motion streaks). */
  velocity: new Vector3(),
};
