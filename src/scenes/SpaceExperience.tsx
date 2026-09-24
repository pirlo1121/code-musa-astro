import { lazy, Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useQualityTier } from '../hooks/useQuality';
import { TIER_CONFIG } from '../lib/quality';
import { CameraRig } from '../components/canvas/CameraRig';
import { Starfield } from '../components/canvas/Starfield';
import { SpaceDust } from '../components/canvas/SpaceDust';
import { NebulaCloud } from '../components/canvas/NebulaCloud';
import { PerformanceMonitor } from '../components/canvas/PerformanceMonitor';
import HeroStar from './HeroStar';
import type { ProjectBody } from './types';

// The hero ships in the first chunk; every other station is code-split and
// fetched while the visitor is still reading the hero.
const NebulaScene = lazy(() => import('./NebulaScene'));
const SkillSystem = lazy(() => import('./SkillSystem'));
const ProjectGalaxy = lazy(() => import('./ProjectGalaxy'));
const SpaceStation = lazy(() => import('./SpaceStation'));
const Wormhole = lazy(() => import('./Wormhole'));
// Post-processing is the single heaviest dependency; tiers without it never download it.
const Effects = lazy(() => import('../components/canvas/Effects'));

// Faint haze between stations so the flights never cross truly empty space.
const HAZE = [
  { position: new Vector3(40, -30, -190), radius: new Vector3(80, 30, 60), palette: ['#3b2a8f', '#1d4f8f'] },
  { position: new Vector3(-10, 30, -560), radius: new Vector3(90, 35, 70), palette: ['#8f2a6b', '#2a3b8f'] },
  { position: new Vector3(30, -20, -960), radius: new Vector3(80, 30, 60), palette: ['#1d6f8f', '#4b2a8f'] },
];
const HAZE_SCALE: [number, number] = [60, 120];

interface Props {
  projects: ProjectBody[];
}

export default function SpaceExperience({ projects }: Props) {
  const tier = useQualityTier();
  const [ready, setReady] = useState(false);
  const [mountRest, setMountRest] = useState(false);

  // Mount the remaining stations once the hero has painted and the main
  // thread is idle, so their chunks and shader compiles never block first paint.
  useEffect(() => {
    if (!ready) return;
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
    const id = idle(() => setMountRest(true));
    return () => (window.cancelIdleCallback ?? window.clearTimeout)(id as number);
  }, [ready]);

  useEffect(() => {
    document.documentElement.classList.toggle('space-ready', ready && tier !== 'off');
  }, [ready, tier]);

  if (tier === 'off') return null;
  const cfg = TIER_CONFIG[tier];

  return (
    <Canvas
      // Remount on tier change: antialiasing is fixed at context creation.
      key={tier}
      className="space-canvas"
      aria-hidden="true"
      dpr={cfg.dpr}
      gl={{
        antialias: !cfg.postprocessing,
        alpha: false,
        stencil: false,
        powerPreference: 'high-performance',
      }}
      // With post-processing, tone mapping runs once in the composer instead.
      flat={cfg.postprocessing}
      camera={{ fov: 55, near: 0.1, far: 3000, position: [0, 2, 0] }}
      onCreated={() => requestAnimationFrame(() => setReady(true))}
    >
      <color attach="background" args={['#02030a']} />
      <CameraRig />
      <Starfield count={cfg.stars} />
      <SpaceDust count={cfg.dust} />
      {HAZE.map((h, i) => (
        <NebulaCloud key={i} position={h.position} radius={h.radius} count={Math.round(cfg.nebulaPuffs / 4)} palette={h.palette} scale={HAZE_SCALE} seed={40 + i} intensity={0.12} near={20} />
      ))}
      <HeroStar />
      {mountRest && (
        <Suspense fallback={null}>
          <NebulaScene />
          <SkillSystem />
          <ProjectGalaxy projects={projects} />
          <SpaceStation />
          <Wormhole />
        </Suspense>
      )}
      {cfg.postprocessing && (
        <Suspense fallback={null}>
          <Effects depthOfField={cfg.depthOfField} />
        </Suspense>
      )}
      <PerformanceMonitor onDowngrade={() => window.dispatchEvent(new CustomEvent('space:downgrade'))} />
    </Canvas>
  );
}
