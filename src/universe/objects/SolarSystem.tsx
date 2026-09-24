// Skills: a star and one orbiting planet per technology. Planet positions
// come from skillPlanetPosition() — the same function the camera keyframes
// use — so the camera tracks each planet exactly. Clicking a planet scrolls
// the page to its stop, keeping URL, history and panels in sync.

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Group, Vector3 } from 'three';
import { skills } from '../../data/skills';
import { ui } from '../../scroll/store';
import { useQuality, useWorld } from '../context';
import { fbm } from '../shaders/noise';
import { orbitSpeed, skillPlanetPosition, SUN, SUN_RADIUS } from '../world';
import { Glow } from './Glow';
import { Planet } from './Planet';
import { useShader } from '../shaders/useShader';

const sunVertex = /* glsl */ `
varying vec3 vObj;
varying vec3 vNormalV;
void main() {
  vObj = position;
  vNormalV = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const sunFragment = /* glsl */ `
${fbm}
uniform float uTime;
varying vec3 vObj;
varying vec3 vNormalV;
void main() {
  vec3 p = normalize(vObj);
  float n = fbm(p * 4.0 + vec3(0.0, uTime * 0.04, 0.0));
  float cells = fbm(p * 12.0 - vec3(uTime * 0.03));
  float heat = 0.6 + 0.4 * n + 0.25 * cells;
  vec3 col = mix(vec3(1.0, 0.35, 0.05), vec3(1.0, 0.85, 0.5), heat) * (2.2 + heat * 2.0);
  float limb = pow(max(vNormalV.z, 0.0), 0.4);
  gl_FragColor = vec4(col * (0.55 + 0.45 * limb), 1.0);
}
`;

function Orbits() {
  const geometry = useMemo(() => {
    const pts: number[] = [];
    const a = new Vector3();
    const b = new Vector3();
    const SEG = 128;
    skills.forEach((_, i) => {
      // Sample the actual orbit function so the lines match the planets
      const period = (Math.PI * 2) / orbitSpeed(i);
      for (let s = 0; s < SEG; s++) {
        skillPlanetPosition(i, (s / SEG) * period, a);
        skillPlanetPosition(i, ((s + 1) / SEG) * period, b);
        pts.push(a.x - SUN.x, a.y - SUN.y, a.z - SUN.z, b.x - SUN.x, b.y - SUN.y, b.z - SUN.z);
      }
    });
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#6f8fd8" transparent opacity={0.16} blending={AdditiveBlending} depthWrite={false} />
    </lineSegments>
  );
}

export default function SolarSystem() {
  const world = useWorld();
  const planets = useRef<(Group | null)[]>([]);
  const introStop = world.ranges.skills[0];
  const quality = useQuality();
  const sun = useShader(
    () => ({
      vertexShader: sunVertex,
      fragmentShader: sunFragment,
      uniforms: { uTime: { value: 0 } },
      defines: { FBM_OCTAVES: quality.fbmOctaves },
    }),
    [quality.fbmOctaves],
  );
  const sunUniforms = sun.uniforms;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    sunUniforms.uTime.value = t;
    planets.current.forEach((g, i) => g && skillPlanetPosition(i, t, g.position));
  });

  const setCursor = (c: string) => () => {
    document.body.style.cursor = c;
  };
  useEffect(() => () => setCursor('')(), []);

  return (
    <>
      <group position={SUN}>
        <mesh material={sun}>
          <sphereGeometry args={[SUN_RADIUS, 64, 48]} />
        </mesh>
        <Glow size={SUN_RADIUS * 7} color="#ff9a4a" intensity={1.2} rays={1} />
        <Orbits />
      </group>

      {skills.map((skill, i) => (
        <group key={skill.id} ref={(g) => void (planets.current[i] = g)}>
          <Planet
            radius={skill.radius}
            kind={skill.kind}
            colors={skill.colors}
            atmosphere={skill.atmosphere}
            light={SUN}
            seed={i * 4.13}
            spin={0.08}
            tilt={0.2 + i * 0.07}
            rings={skill.rings}
          />
          {/* Invisible, generous hit sphere: small planets are easy to click */}
          <mesh
            visible={false}
            onClick={(e) => {
              e.stopPropagation();
              ui.getState().goTo(introStop + 1 + i);
            }}
            onPointerOver={setCursor('pointer')}
            onPointerOut={setCursor('')}
          >
            <sphereGeometry args={[skill.radius * 1.8, 12, 8]} />
          </mesh>
        </group>
      ))}
    </>
  );
}
