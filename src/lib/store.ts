import { detectTier } from './quality';

// Shared state between the DOM (GSAP ScrollTrigger) and the WebGL scene.
//
// Two kinds of state live here, on purpose separated:
//  - `frame`: mutable values written by scroll/pointer handlers and read inside
//    useFrame every tick. Never triggers React renders — that is what keeps
//    scrolling at 60 FPS.
//  - quality: rare, discrete changes that *should* re-render React (swap
//    post-processing, particle counts…). Exposed as a tiny external store for
//    useSyncExternalStore and plain DOM listeners.

export const SECTION_COUNT = 6;

export const frame = {
  /** Camera-path parameter set by the scroll director, in [0, 2·SECTION_COUNT − 1].
   *  Segment 2i = parked at station i, segment 2i+1 = flight from i to i+1. */
  targetU: 0,
  /** Damped copy of targetU, owned by the camera rig. */
  u: 0,
  /** Section the camera is currently closest to (from the damped value). */
  section: 0,
  activeSkill: -1,
  activeProject: -1,
  /** Normalized pointer, −1…1. */
  pointerX: 0,
  pointerY: 0,
  /** Camera speed in world units / second, for motion streaks. */
  speed: 0,
};

/** Distance, in stations, between the camera and station `index`. */
export function stationDistance(index: number): number {
  return Math.abs(frame.u / 2 - index);
}

// ---------------------------------------------------------------------------
// Quality

export type QualityTier = 'high' | 'medium' | 'low' | 'off';
export type QualityPref = 'auto' | QualityTier;

const TIERS: QualityTier[] = ['high', 'medium', 'low', 'off'];
const STORAGE_KEY = 'space-quality';

interface QualityState {
  pref: QualityPref;
  /** Tier chosen by auto mode (initial detection, then lowered by the FPS monitor). */
  auto: QualityTier;
}

let quality: QualityState | null = null;
const listeners = new Set<() => void>();

/** Detection runs lazily on first access, so the React island and the page
 *  scripts (hydrated in no guaranteed order) always agree on the tier. */
function ensureQuality(): QualityState {
  if (!quality) {
    let pref: QualityPref = 'auto';
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as QualityPref | null;
      if (saved && (saved === 'auto' || TIERS.includes(saved as QualityTier))) pref = saved;
    } catch {}
    quality = { pref, auto: detectTier() };
    document.documentElement.dataset.quality = effectiveTier(quality);
  }
  return quality;
}

export function getQuality(): QualityState {
  return ensureQuality();
}

export function effectiveTier(q: QualityState = ensureQuality()): QualityTier {
  return q.pref === 'auto' ? q.auto : q.pref;
}

export function subscribeQuality(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setQuality(next: QualityState) {
  const prev = ensureQuality();
  if (next.pref === prev.pref && next.auto === prev.auto) return;
  quality = next;
  document.documentElement.dataset.quality = effectiveTier(next);
  listeners.forEach((fn) => fn());
}

export function setQualityPref(pref: QualityPref) {
  try { localStorage.setItem(STORAGE_KEY, pref); } catch {}
  setQuality({ ...ensureQuality(), pref });
}

/** Called by the FPS monitor. Only ever steps down, so it cannot oscillate. */
export function downgradeAutoTier(): boolean {
  const q = ensureQuality();
  if (q.pref !== 'auto') return false;
  const next = TIERS[TIERS.indexOf(q.auto) + 1];
  if (!next) return false;
  setQuality({ ...q, auto: next });
  return true;
}
