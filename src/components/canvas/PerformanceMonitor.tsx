import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { downgradeAutoTier } from '../../lib/store';

const WINDOW = 2;        // seconds per measurement
const MIN_FPS = 45;
const STRIKES = 2;       // consecutive slow windows before acting
const GRACE = 4;         // seconds ignored after start / a tier change (shader compiles)

/**
 * Watches real frame rate and, in auto mode, steps the quality tier down
 * (high → medium → low → static) when the device cannot hold it. It never
 * steps back up, so it cannot oscillate between tiers.
 */
export function PerformanceMonitor({ onDowngrade }: { onDowngrade?: () => void }) {
  const s = useRef({ grace: GRACE, elapsed: 0, frames: 0, strikes: 0 }).current;

  useFrame((_, dt) => {
    // Background tabs and huge hitches (tab switch) say nothing about the GPU.
    if (document.hidden || dt > 0.5) return;
    if (s.grace > 0) { s.grace -= dt; return; }
    s.elapsed += dt;
    s.frames++;
    if (s.elapsed < WINDOW) return;
    const fps = s.frames / s.elapsed;
    s.elapsed = 0;
    s.frames = 0;
    s.strikes = fps < MIN_FPS ? s.strikes + 1 : 0;
    if (s.strikes >= STRIKES) {
      s.strikes = 0;
      s.grace = GRACE;
      if (downgradeAutoTier()) onDowngrade?.();
    }
  });

  return null;
}
