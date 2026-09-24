import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Group, ShaderMaterial, SpriteMaterial, Vector3 } from 'three';
import { starsFragment, starsVertex } from '../../shaders/particles';
import { getDistantGalaxyTexture, rng } from '../../assets/textures';

// Stellar temperature palette, blue giants to red dwarfs, with realistic-ish weights.
const STAR_COLORS: [string, number][] = [
  ['#9bb0ff', 0.08], ['#b5c7ff', 0.14], ['#e4ebff', 0.26], ['#fff6ec', 0.26],
  ['#ffe2b8', 0.14], ['#ffc78a', 0.08], ['#ff9f6b', 0.04],
];

const RADIUS = 900;

/**
 * Stars and far galaxies at "infinity". The group follows the camera, so
 * they never get closer — which is what makes the planets feel near.
 * About 35% of stars are packed along a tilted band: a Milky Way.
 */
export function Starfield({ count }: { count: number }) {
  const group = useRef<Group>(null);

  const geometry = useMemo(() => {
    const rand = rng(1234);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const bandNormal = new Vector3(0.3, 1, -0.2).normalize();
    const bandA = new Vector3().crossVectors(bandNormal, new Vector3(1, 0, 0)).normalize();
    const bandB = new Vector3().crossVectors(bandNormal, bandA);
    const dir = new Vector3();
    const color = new Color();
    const cumulative = STAR_COLORS.reduce<number[]>((acc, [, w]) => [...acc, (acc.at(-1) ?? 0) + w], []);

    for (let i = 0; i < count; i++) {
      if (rand() < 0.35) {
        const angle = rand() * Math.PI * 2;
        const spread = (rand() + rand() + rand() - 1.5) * 0.16;
        dir.copy(bandA).multiplyScalar(Math.cos(angle)).addScaledVector(bandB, Math.sin(angle)).addScaledVector(bandNormal, spread).normalize();
      } else {
        const u = rand() * 2 - 1;
        const phi = rand() * Math.PI * 2;
        const s = Math.sqrt(1 - u * u);
        dir.set(s * Math.cos(phi), u, s * Math.sin(phi));
      }
      dir.multiplyScalar(RADIUS).toArray(positions, i * 3);

      const pick = rand();
      const idx = cumulative.findIndex((c) => pick <= c);
      color.set(STAR_COLORS[idx === -1 ? 3 : idx][0]);
      const bright = rand();
      const intensity = bright > 0.985 ? 2.6 : 0.55 + rand() * 0.7;
      color.multiplyScalar(intensity).toArray(colors, i * 3);
      sizes[i] = bright > 0.985 ? 3.5 + rand() * 2.5 : 1 + rand() * rand() * 2.4;
      phases[i] = rand();
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new BufferAttribute(phases, 1));
    return geo;
  }, [count]);

  const material = useMemo(() => new ShaderMaterial({
    vertexShader: starsVertex,
    fragmentShader: starsFragment,
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
  }), []);

  const galaxies = useMemo(() => {
    const rand = rng(99);
    return Array.from({ length: 6 }, (_, i) => {
      const u = rand() * 1.6 - 0.8;
      const phi = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const position = new Vector3(s * Math.cos(phi), u, s * Math.sin(phi)).multiplyScalar(RADIUS * 0.95);
      const mat = new SpriteMaterial({
        map: getDistantGalaxyTexture(i % 3),
        blending: AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.55 + rand() * 0.35,
        rotation: rand() * Math.PI * 2,
      });
      return { position, scale: 26 + rand() * 30, material: mat };
    });
  }, []);

  useEffect(() => () => {
    geometry.dispose();
  }, [geometry]);
  useEffect(() => () => {
    material.dispose();
    galaxies.forEach((g) => g.material.dispose());
  }, [material, galaxies]);

  useFrame(({ camera, clock, viewport }) => {
    group.current?.position.copy(camera.position);
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uPixelRatio.value = viewport.dpr;
  });

  return (
    <group ref={group}>
      <points geometry={geometry} material={material} frustumCulled={false} renderOrder={-10} />
      {galaxies.map((g, i) => (
        <sprite key={i} position={g.position} scale={[g.scale, g.scale, 1]} material={g.material} renderOrder={-9} />
      ))}
    </group>
  );
}
