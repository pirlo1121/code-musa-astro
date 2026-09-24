// Projects: one spiral galaxy per project. Every star's orbit is computed in
// the vertex shader (log-spiral arms + rotation over time), so thousands of
// animated stars cost zero CPU per frame and a single draw call per galaxy.

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Sphere, Vector3 } from 'three';
import { ui } from '../../scroll/store';
import { useQuality, useUi, useWorld } from '../context';
import { Glow } from './Glow';
import { useShader } from '../shaders/useShader';

const RADIUS = 34;

const vertexShader = /* glsl */ `
attribute float aR;
attribute float aTheta;
attribute float aSize;
attribute vec3 aColor;
uniform float uTime;
uniform float uSpin;
uniform float uScale;
uniform float uRadius;
varying vec3 vColor;
varying float vAlpha;

void main() {
  // Inner stars orbit faster; the phase offset is bounded so arms never wind up
  float theta = aTheta + uTime * uSpin * (1.0 + 0.6 * (1.0 - aR));
  float r = aR * uRadius;
  vec3 p = vec3(cos(theta) * r, 0.0, sin(theta) * r) + position * uRadius;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float px = aSize * uScale / max(-mv.z, 0.001);
  gl_PointSize = clamp(px, 1.0, 14.0);
  vAlpha = clamp(px, 0.2, 1.0);
  vColor = aColor;
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor, a * a * vAlpha);
}
`;

function gaussian() {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
}

function buildGalaxy(count: number, seed: number) {
  const arms = 2 + (seed % 3);
  const twist = 3.2 + (seed % 5) * 0.6;
  const hue = (seed * 0.137) % 1;
  const armColor = new Color().setHSL(0.55 + hue * 0.25, 0.7, 0.62);
  const coreColor = new Color('#ffd9a8');
  const hii = new Color('#ff7ac8');

  const offsets = new Float32Array(count * 3);
  const radii = new Float32Array(count);
  const thetas = new Float32Array(count);
  const sizes = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const c = new Color();

  for (let i = 0; i < count; i++) {
    const bulge = Math.random() < 0.18;
    const r = bulge ? Math.pow(Math.random(), 2) * 0.22 : 0.08 + Math.pow(Math.random(), 1.4) * 0.92;
    const arm = i % arms;
    const spread = bulge ? Math.PI * 2 * Math.random() : gaussian() * (0.35 + 0.25 * r);
    radii[i] = r;
    thetas[i] = (arm / arms) * Math.PI * 2 + r * twist + spread;
    const scatter = bulge ? 0.09 : 0.04 * (1 - r) + 0.012;
    offsets[i * 3] = gaussian() * scatter;
    offsets[i * 3 + 1] = gaussian() * scatter * (bulge ? 0.8 : 0.45);
    offsets[i * 3 + 2] = gaussian() * scatter;

    c.copy(coreColor).lerp(armColor, Math.min(r * 1.6, 1));
    if (!bulge && Math.random() < 0.03) c.copy(hii);
    const bright = bulge ? 1.6 : 0.7 + Math.random() * 0.9;
    c.multiplyScalar(bright);
    colors.set([c.r, c.g, c.b], i * 3);
    sizes[i] = (bulge ? 0.32 : 0.2) + Math.pow(Math.random(), 4) * 0.9;
  }

  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(offsets, 3));
  g.setAttribute('aR', new BufferAttribute(radii, 1));
  g.setAttribute('aTheta', new BufferAttribute(thetas, 1));
  g.setAttribute('aSize', new BufferAttribute(sizes, 1));
  g.setAttribute('aColor', new BufferAttribute(colors, 3));
  // Positions are computed on the GPU; give culling the real extent
  g.boundingSphere = new Sphere(new Vector3(), RADIUS * 1.2);
  return { geometry: g, coreColor: `#${armColor.clone().lerp(coreColor, 0.7).getHexString()}` };
}

function Galaxy({ index, position, visible }: { index: number; position: Vector3; visible: boolean }) {
  const { galaxyPoints } = useQuality();
  const { geometry, coreColor } = useMemo(() => buildGalaxy(galaxyPoints, index + 1), [galaxyPoints, index]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useShader(
    () => ({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSpin: { value: 0.05 + (index % 3) * 0.015 },
        uScale: { value: 1 },
        uRadius: { value: RADIUS },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
    [index],
  );
  const { uniforms } = material;

  useFrame((state) => {
    const fov = (((state.camera as { fov?: number }).fov ?? 50) * Math.PI) / 180;
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uScale.value = (state.size.height * state.viewport.dpr * 0.5) / Math.tan(fov / 2);
  });

  const tilt = useMemo(() => [0.35 + (index % 3) * 0.2, index * 0.9, (index % 2 ? -1 : 1) * 0.25] as const, [index]);

  return (
    <group position={position} rotation={[tilt[0], tilt[1], tilt[2]]} visible={visible}>
      <points geometry={geometry} material={material} />
      <Glow size={RADIUS * 0.4} color={coreColor} intensity={0.7} />
    </group>
  );
}

export default function ProjectGalaxies() {
  const world = useWorld();
  const first = world.ranges.projects[0];
  const stop = useUi((s) => s.stop);

  return (
    <>
      {world.galaxies.map((g, i) => (
        <group key={i}>
          <Galaxy index={i} position={g} visible={Math.abs(stop - (first + i)) <= 3} />
          <mesh
            position={g}
            visible={false}
            onClick={(e) => {
              e.stopPropagation();
              ui.getState().goTo(first + i);
            }}
          >
            <sphereGeometry args={[RADIUS * 0.6, 12, 8]} />
          </mesh>
        </group>
      ))}
    </>
  );
}
