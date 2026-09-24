// The WebGL universe: one persistent canvas for the whole journey.
// Background layers are always mounted; each chapter's objects are lazy
// chunks mounted by <ChapterGate> only near their stops.

import { PerformanceMonitor } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { lazy, useEffect, useMemo } from 'react';
import { buildStops, type JourneyCounts } from '../data/journey';
import { frame, ui } from '../scroll/store';
import { Comets } from './background/Comets';
import { Nebula } from './background/Nebula';
import { SkyDome } from './background/SkyDome';
import { SpaceDust } from './background/SpaceDust';
import { Starfield } from './background/Starfield';
import { CameraRig } from './CameraRig';
import { ChapterGate } from './ChapterGate';
import { useQuality, useUi, WorldContext } from './context';
import { PostFX } from './effects/PostFX';
import { Glow } from './objects/Glow';
import { initialTier, lowerTier, QUALITY } from './quality';
import { buildWorld, KEY_STAR } from './world';

const chapters = {
  hero: () => import('./objects/HeroStation').then((m) => ({ default: m.HeroStation })),
  about: () => import('./objects/HomePlanet').then((m) => ({ default: m.HomePlanet })),
  skills: () => import('./objects/SolarSystem'),
  projects: () => import('./objects/ProjectGalaxies'),
  blackhole: () => import('./objects/BlackHole'),
  experience: () => import('./objects/Constellation'),
  contact: () => import('./objects/ContactStation'),
};

// Decide the tier before the first render so nothing is built twice
ui.setState({ tier: initialTier() });

const HeroStation = lazy(chapters.hero);
const HomePlanet = lazy(chapters.about);
const SolarSystem = lazy(chapters.skills);
const ProjectGalaxies = lazy(chapters.projects);
const BlackHole = lazy(chapters.blackhole);
const Constellation = lazy(chapters.experience);
const ContactStation = lazy(chapters.contact);

export interface SceneProps {
  counts: JourneyCounts;
  galaxies: { id: string; name: string }[];
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.08} color="#8fa6ff" />
      <directionalLight position={KEY_STAR.clone().normalize().multiplyScalar(100)} intensity={2.6} color="#fff1dc" />
      <Glow position={KEY_STAR} size={90} color="#fff0d8" intensity={1.4} rays={0.6} />
    </>
  );
}

function Universe() {
  const quality = useQuality();
  return (
    <>
      <CameraRig />
      <Lights />

      <SkyDome />
      <Starfield />
      <Nebula />
      <SpaceDust />
      <Comets />

      <ChapterGate chapter="hero"><HeroStation /></ChapterGate>
      <ChapterGate chapter="about"><HomePlanet /></ChapterGate>
      <ChapterGate chapter="skills"><SolarSystem /></ChapterGate>
      <ChapterGate chapter="projects"><ProjectGalaxies /></ChapterGate>
      <ChapterGate chapter="blackhole" margin={3}><BlackHole /></ChapterGate>
      <ChapterGate chapter="experience"><Constellation /></ChapterGate>
      <ChapterGate chapter="contact"><ContactStation /></ChapterGate>

      <PostFX key={quality.multisampling} />
    </>
  );
}

export default function Scene({ counts }: SceneProps) {
  const stops = useMemo(() => buildStops(counts), [counts]);
  const world = useMemo(() => buildWorld(stops, counts.projects), [stops, counts.projects]);
  const tier = useUi((s) => s.tier);

  useEffect(() => {
    // Warm the chunk cache for every chapter once the first frame is out
    const id = window.setTimeout(() => Object.values(chapters).forEach((load) => load()), 2500);
    return () => window.clearTimeout(id);
  }, []);

  const first = world.keyframes[Math.round(frame.s)] ?? world.keyframes[0];

  return (
    <Canvas
      flat
      dpr={QUALITY[tier].dpr}
      gl={{ antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' }}
      camera={{ fov: 50, near: 0.5, far: 6000, position: first.pos.toArray() }}
      onCreated={(state) => {
        if (import.meta.env.DEV) (window as unknown as { __r3f: unknown }).__r3f = state;
        requestAnimationFrame(() => document.documentElement.classList.add('universe-ready'));
      }}
    >
      <WorldContext.Provider value={world}>
        <PerformanceMonitor
          flipflops={2}
          onDecline={() => ui.setState((s) => ({ tier: lowerTier(s.tier) }))}
        />
        <Universe />
      </WorldContext.Provider>
    </Canvas>
  );
}
