import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, Group, LineBasicMaterial, ShaderMaterial, Vector3,
} from 'three';
import { frame } from '../lib/store';
import { sceneRefs } from '../lib/scene-refs';
import { hashString, rng } from '../assets/textures';
import { glowPointsFragment, glowPointsVertex } from '../shaders/particles';
import { Planet, type PlanetLook } from '../components/canvas/Planet';
import { StarCore } from '../components/canvas/StarCore';
import { NebulaCloud } from '../components/canvas/NebulaCloud';
import { Hologram } from '../components/canvas/Hologram';
import { useStationVisibility } from '../hooks/useStationVisibility';
import { useTierConfig } from '../hooks/useQuality';
import { GALAXY, STATIONS } from './layout';
import type { ProjectBody } from './types';
import type { PlanetKind } from '../data/skills';

const INDEX = 3;
const CENTER = STATIONS[INDEX].center;
const ARMS = 3;
const ARM_NEBULA = ['#ff5fa8', '#5f8dff', '#b36bff'];
const ARM_NEBULA_RADIUS = new Vector3(GALAXY.radius * 0.55, 2.5, GALAXY.radius * 0.55);

function gaussian(rand: () => number) {
  return (rand() + rand() + rand() + rand() - 2) / 2;
}

/** Every project gets a deterministic, unique planet derived from its id. */
function planetFor(project: ProjectBody): PlanetLook & { tint: string; moons: number } {
  const h = hashString(project.id);
  const h2 = hashString(project.id + 'b');
  const h3 = hashString(project.id + 'c');
  const kinds: PlanetKind[] = ['rocky', 'gas', 'ocean'];
  const hue = h * 360;
  const hsl = (dh: number, s: number, l: number) => new Color().setHSL(((hue + dh) % 360) / 360, s, l).getStyle();
  return {
    kind: kinds[Math.floor(h2 * 3)],
    palette: [hsl(0, 0.55, 0.12), hsl(0, 0.65, 0.5), hsl(35, 0.75, 0.82)],
    atmosphere: hsl(-10, 0.9, 0.65),
    tint: hsl(-10, 0.9, 0.72),
    size: 1.7 + h3 * 1.3,
    ring: h3 > 0.62,
    seed: h,
    moons: Math.floor(h2 * 10) % 3,
  };
}

function useGalaxyStars(count: number) {
  return useMemo(() => {
    const rand = rng(2024);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const core = new Color('#ffd9a8');
    const arm = new Color('#8fb2ff');
    const hii = new Color('#ff6fb0');
    const c = new Color();
    const R = GALAXY.radius;
    for (let i = 0; i < count; i++) {
      const bulge = rand() < 0.16;
      let x: number, y: number, z: number, t: number;
      if (bulge) {
        const r = R * 0.16 * Math.sqrt(rand());
        const a = rand() * Math.PI * 2;
        x = Math.cos(a) * r; z = Math.sin(a) * r; y = gaussian(rand) * r * 0.6;
        t = r / R;
      } else {
        t = Math.pow(rand(), 1.4);
        const r = R * (0.08 + t * 0.92);
        const armAngle = ((i % ARMS) / ARMS) * Math.PI * 2;
        const a = armAngle + t * 3.4 + gaussian(rand) * (0.42 - t * 0.18);
        x = Math.cos(a) * r; z = Math.sin(a) * r;
        y = gaussian(rand) * (1.2 + (1 - t) * 3.5);
      }
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      const nebula = !bulge && rand() < 0.04;
      c.copy(core).lerp(arm, Math.min(1, t * 1.4));
      if (nebula) c.copy(hii);
      c.multiplyScalar((nebula ? 2.2 : 0.7) + rand() * 0.6 + (1 - t) * 0.6);
      c.toArray(col, i * 3);
      size[i] = (nebula ? 2.2 : 0.6 + rand() * 1.2) * (bulge ? 1.3 : 1);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new BufferAttribute(col, 3));
    geo.setAttribute('aSize', new BufferAttribute(size, 1));
    return geo;
  }, [count]);
}

/** Station 3 · Spiral galaxy; each project is a planet orbiting its core. */
export default function ProjectGalaxy({ projects }: { projects: ProjectBody[] }) {
  const group = useStationVisibility(INDEX);
  const disc = useRef<Group>(null);
  const cfg = useTierConfig();
  const size = useThree((s) => s.size);
  const starsGeo = useGalaxyStars(cfg.galaxyStars);

  const starsMat = useMemo(() => new ShaderMaterial({
    vertexShader: glowPointsVertex,
    fragmentShader: glowPointsFragment,
    uniforms: { uPixelRatio: { value: 1 }, uSizeScale: { value: 1.1 }, uTime: { value: 0 }, uDrift: { value: 0 } },
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
  }), []);

  const bodies = useMemo(() => {
    const n = Math.max(projects.length, 1);
    const gap = Math.min(GALAXY.orbitGap, (GALAXY.radius * 0.95 - GALAXY.firstOrbit) / n);
    return projects.map((p, i) => ({
      project: p,
      look: planetFor(p),
      radius: GALAXY.firstOrbit + i * gap,
      phase: i * 2.39996 + 1,
      speed: 0.035 / Math.sqrt((GALAXY.firstOrbit + i * gap) / 10),
    }));
  }, [projects]);

  useMemo(() => {
    sceneRefs.projects = bodies.map((b) => ({ position: new Vector3(), size: b.look.size }));
  }, [bodies]);

  const orbitLines = useMemo(() => {
    const segments = 180;
    const pts: number[] = [];
    for (const { radius } of bodies) {
      for (let s = 0; s < segments; s++) {
        const a0 = (s / segments) * Math.PI * 2, a1 = ((s + 1) / segments) * Math.PI * 2;
        pts.push(Math.cos(a0) * radius, 0, Math.sin(a0) * radius, Math.cos(a1) * radius, 0, Math.sin(a1) * radius);
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
    return geo;
  }, [bodies]);

  const orbitMat = useMemo(() => new LineBasicMaterial({
    color: new Color('#9fb6ff'), transparent: true, opacity: 0.1, blending: AdditiveBlending, depthWrite: false,
  }), []);

  useEffect(() => () => { starsGeo.dispose(); }, [starsGeo]);
  useEffect(() => () => { starsMat.dispose(); orbitLines.dispose(); orbitMat.dispose(); }, [starsMat, orbitLines, orbitMat]);

  const planetGroups = useRef<(Group | null)[]>([]);
  const moonGroups = useRef<(Group | null)[]>([]);

  useFrame(({ clock, viewport }, dt) => {
    const t = clock.elapsedTime;
    starsMat.uniforms.uPixelRatio.value = viewport.dpr;
    if (disc.current) disc.current.rotation.y += dt * 0.012;
    bodies.forEach((b, i) => {
      const g = planetGroups.current[i];
      if (!g) return;
      const a = b.phase + t * b.speed;
      g.position.set(Math.cos(a) * b.radius, 0, Math.sin(a) * b.radius);
      g.getWorldPosition(sceneRefs.projects[i].position);
      const moons = moonGroups.current[i];
      if (moons) moons.rotation.y = t * 0.4;
    });
  });

  const lightPos = CENTER;
  const portrait = size.width / size.height < 0.9;

  return (
    <>
      <group ref={group} position={CENTER}>
        {/* Core sits outside the tilted disc so its corona can billboard. */}
        <StarCore radius={2.6} cool="#ffb36b" hot="#fff0d0" core="#ffffff" intensity={3} corona="#ffcf8f" coronaScale={10} coronaIntensity={1.2} detail={32} />
        <group rotation={[GALAXY.tilt, 0, 0.12]}>
          <group ref={disc}>
            <points geometry={starsGeo} material={starsMat} frustumCulled={false} />
            <NebulaCloud position={new Vector3()} radius={ARM_NEBULA_RADIUS} count={Math.round(cfg.nebulaPuffs * 0.5)} palette={ARM_NEBULA} scale={[14, 30]} seed={17} intensity={0.18} near={6} />
          </group>
          <lineSegments geometry={orbitLines} material={orbitMat} />
          {bodies.map((b, i) => (
            <group key={b.project.id} ref={(g) => { planetGroups.current[i] = g; }}>
              <Planet {...b.look} lightPos={lightPos} detail={cfg.sphereDetail} isActive={() => frame.activeProject === i} spin={0.08} />
              {b.look.moons > 0 && cfg.sphereDetail > 32 && (
                <group ref={(g) => { moonGroups.current[i] = g; }}>
                  {Array.from({ length: b.look.moons }, (_, m) => (
                    <group key={m} position={[Math.cos(m * 2.5) * b.look.size * (2.6 + m), 0.4 * m, Math.sin(m * 2.5) * b.look.size * (2.6 + m)]}>
                      <Planet kind="rocky" palette={['#2a2a2e', '#8d8a86', '#e8e2d8']} atmosphere="#9aa6b8" size={b.look.size * 0.22} seed={b.look.seed + m * 0.3} lightPos={lightPos} detail={16} />
                    </group>
                  ))}
                </group>
              )}
            </group>
          ))}
        </group>
      </group>
      {!portrait && (
        <Hologram
          getTarget={() => {
            const i = frame.section === INDEX ? frame.activeProject : -1;
            const b = bodies[i];
            if (!b) return null;
            return { key: b.project.id, position: sceneRefs.projects[i].position, size: b.look.size, image: b.project.image, tint: b.look.tint };
          }}
        />
      )}
    </>
  );
}
