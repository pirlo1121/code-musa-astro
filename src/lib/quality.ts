import type { QualityTier } from './store';

/** Budgets per tier. Every particle system and effect reads its numbers here,
 *  so the whole experience scales from one table. */
export interface TierConfig {
  dpr: [number, number];
  postprocessing: boolean;
  depthOfField: boolean;
  multisampling: number;
  stars: number;
  dust: number;
  galaxyStars: number;
  nebulaPuffs: number;
  heroParticles: number;
  sphereDetail: number;
}

export const TIER_CONFIG: Record<Exclude<QualityTier, 'off'>, TierConfig> = {
  high: {
    dpr: [1, 1.75], postprocessing: true, depthOfField: true, multisampling: 0,
    stars: 9000, dust: 1400, galaxyStars: 32000, nebulaPuffs: 64, heroParticles: 1400, sphereDetail: 64,
  },
  medium: {
    dpr: [1, 1.35], postprocessing: true, depthOfField: false, multisampling: 0,
    stars: 5500, dust: 800, galaxyStars: 18000, nebulaPuffs: 40, heroParticles: 800, sphereDetail: 48,
  },
  low: {
    dpr: [0.75, 1], postprocessing: false, depthOfField: false, multisampling: 0,
    stars: 2800, dust: 350, galaxyStars: 8000, nebulaPuffs: 22, heroParticles: 350, sphereDetail: 32,
  },
};

function probeRenderer(): { webgl2: boolean; software: boolean } {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (!gl) return { webgl2: false, software: true };
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { webgl2: true, software: /swiftshader|llvmpipe|software|basic render/i.test(renderer) };
  } catch {
    return { webgl2: false, software: true };
  }
}

/** Best guess of what this device can sustain at 60 FPS. The FPS monitor
 *  corrects it downward at runtime if the guess was optimistic. */
export function detectTier(): QualityTier {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'off';

  const { webgl2, software } = probeRenderer();
  if (!webgl2 || software) return 'off';

  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const memory = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;
  const mobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;

  if (nav.connection?.saveData || memory <= 2 || cores <= 2) return 'low';
  if (mobile) return memory >= 6 && cores >= 8 ? 'medium' : 'low';
  return memory >= 8 && cores >= 8 ? 'high' : 'medium';
}
