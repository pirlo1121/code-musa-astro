import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, Group, LineBasicMaterial, MathUtils, Mesh, ShaderMaterial, Vector3,
} from 'three';
import { skills } from '../data/skills';
import { frame } from '../lib/store';
import { sceneRefs } from '../lib/scene-refs';
import { Planet } from '../components/canvas/Planet';
import { StarCore } from '../components/canvas/StarCore';
import { Motes } from '../components/canvas/NebulaCloud';
import { levelRingFragment, quadVertex } from '../shaders/planet';
import { useStationVisibility } from '../hooks/useStationVisibility';
import { useBillboard } from '../hooks/useBillboard';
import { useTierConfig } from '../hooks/useQuality';
import { SKILL_SYSTEM, STATIONS } from './layout';

const INDEX = 2;
const CENTER = STATIONS[INDEX].center;
const BELT_PALETTE = ['#8a7f73', '#a8a095', '#6f6a66', '#c7b9a3'];

function orbitPosition(radius: number, angle: number, out: Vector3) {
  return out.set(Math.cos(angle) * radius, Math.sin(angle) * radius * SKILL_SYSTEM.tilt, Math.sin(angle) * radius);
}

/** Station 2 · Planetary system: one planet per skill orbiting a young sun. */
export default function SkillSystem() {
  const group = useStationVisibility(INDEX);
  const cfg = useTierConfig();
  const planetGroups = useRef<(Group | null)[]>([]);

  const orbits = useMemo(() => skills.map((skill, i) => {
    const radius = SKILL_SYSTEM.firstOrbit + i * SKILL_SYSTEM.orbitGap;
    return { skill, radius, phase: i * 2.39996, speed: 0.05 / Math.sqrt(radius / 10), seed: ((i + 1) * 0.618) % 1 };
  }), []);

  // Register focus targets for the camera rig.
  useMemo(() => {
    sceneRefs.skills = orbits.map((o) => ({ position: new Vector3(), size: o.skill.size }));
  }, [orbits]);

  const orbitLines = useMemo(() => {
    const segments = 160;
    const pts: number[] = [];
    const a = new Vector3(), b = new Vector3();
    for (const { radius } of orbits) {
      for (let s = 0; s < segments; s++) {
        orbitPosition(radius, (s / segments) * Math.PI * 2, a);
        orbitPosition(radius, ((s + 1) / segments) * Math.PI * 2, b);
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
    return geo;
  }, [orbits]);

  const orbitMat = useMemo(() => new LineBasicMaterial({
    color: new Color('#7f9bff'), transparent: true, opacity: 0.14, blending: AdditiveBlending, depthWrite: false,
  }), []);

  // Level indicator ring that sweeps around the focused planet.
  const levelMat = useMemo(() => new ShaderMaterial({
    vertexShader: quadVertex,
    fragmentShader: levelRingFragment,
    uniforms: {
      uColor: { value: new Color('#ffffff') },
      uProgress: { value: 0 },
      uOpacity: { value: 0 },
      uTime: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  }), []);
  const levelRing = useBillboard<Mesh>();
  const lastActive = useRef(-1);

  useEffect(() => () => { orbitLines.dispose(); orbitMat.dispose(); levelMat.dispose(); }, [orbitLines, orbitMat, levelMat]);

  const belt = useMemo(() => {
    const outer = orbits[orbits.length - 1].radius;
    return { radius: new Vector3(0, 0.8, 0), ring: [outer + 5, outer + 11] as [number, number] };
  }, [orbits]);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    orbits.forEach((o, i) => {
      const g = planetGroups.current[i];
      if (!g) return;
      orbitPosition(o.radius, o.phase + t * o.speed, g.position);
      sceneRefs.skills[i].position.copy(g.position).add(CENTER);
    });

    // Level ring: follows the active planet and sweeps to its level.
    const active = frame.section === INDEX ? frame.activeSkill : -1;
    if (active !== lastActive.current) {
      if (active >= 0) {
        levelMat.uniforms.uProgress.value = 0;
        levelMat.uniforms.uColor.value.set(orbits[active].skill.atmosphere);
      }
      lastActive.current = active;
    }
    const ring = levelRing.current;
    const shown = active >= 0 ? active : -1;
    if (ring && shown >= 0) {
      const o = orbits[shown];
      const g = planetGroups.current[shown];
      if (g) ring.position.copy(g.position);
      ring.scale.setScalar(o.skill.size * 5.4);
      levelMat.uniforms.uProgress.value = MathUtils.damp(levelMat.uniforms.uProgress.value, o.skill.level / 100, 2.2, dt);
    }
    levelMat.uniforms.uOpacity.value = MathUtils.damp(levelMat.uniforms.uOpacity.value, shown >= 0 ? 1 : 0, 4, dt);
    levelMat.uniforms.uTime.value = t;
    if (ring) ring.visible = levelMat.uniforms.uOpacity.value > 0.01;
  });

  return (
    <group ref={group} position={CENTER}>
      <StarCore radius={3.4} cool="#3d7bff" hot="#bfe1ff" core="#ffffff" intensity={2.6} corona="#8fc4ff" coronaScale={6} coronaIntensity={1.1} particles={Math.round(cfg.heroParticles / 4)} detail={40} />
      <lineSegments geometry={orbitLines} material={orbitMat} />
      <group rotation={[-Math.atan(SKILL_SYSTEM.tilt), 0, 0]}>
        <Motes radius={belt.radius} ring={belt.ring} count={Math.round(cfg.dust * 1.5)} palette={BELT_PALETTE} size={0.8} drift={0} seed={31} />
      </group>
      {orbits.map((o, i) => (
        <group key={o.skill.id} ref={(g) => { planetGroups.current[i] = g; }}>
          <Planet
            kind={o.skill.kind}
            palette={o.skill.palette}
            atmosphere={o.skill.atmosphere}
            size={o.skill.size}
            ring={o.skill.ring}
            seed={o.seed}
            lightPos={CENTER}
            detail={cfg.sphereDetail}
            isActive={() => frame.activeSkill === i}
          />
        </group>
      ))}
      <mesh ref={levelRing} material={levelMat} visible={false}>
        <planeGeometry args={[1, 1]} />
      </mesh>
    </group>
  );
}
