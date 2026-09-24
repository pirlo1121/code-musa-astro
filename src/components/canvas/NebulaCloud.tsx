import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, InstancedBufferAttribute, InstancedBufferGeometry,
  PlaneGeometry, ShaderMaterial, Vector3,
} from 'three';
import { nebulaFragment, nebulaVertex, glowPointsFragment, glowPointsVertex } from '../../shaders/particles';
import { getNebulaPuffTexture, rng } from '../../assets/textures';

interface NebulaProps {
  position: Vector3;
  radius: Vector3;
  count: number;
  palette: string[];
  scale: [number, number];
  seed?: number;
  intensity?: number;
  /** Distance at which puffs start dissolving as the camera approaches. */
  near?: number;
}

function gaussian(rand: () => number) {
  return (rand() + rand() + rand() + rand() - 2) / 2;
}

/**
 * Volumetric-looking cloud built from instanced, camera-facing puffs — one
 * draw call regardless of count. Additive layering of a noise texture gives
 * depth; per-puff rotation and a two-sample churn in the shader keep it
 * moving organically; puffs dissolve as the camera enters them.
 */
export function NebulaCloud({ position, radius, count, palette, scale, seed = 1, intensity = 1, near = 4 }: NebulaProps) {
  const geometry = useMemo(() => {
    const rand = rng(seed);
    const quad = new PlaneGeometry(1, 1);
    const geo = new InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('uv', quad.getAttribute('uv'));

    const offsets = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const rots = new Float32Array(count);
    const seeds = new Float32Array(count);
    const color = new Color();
    for (let i = 0; i < count; i++) {
      offsets[i * 3] = gaussian(rand) * radius.x;
      offsets[i * 3 + 1] = gaussian(rand) * radius.y;
      offsets[i * 3 + 2] = gaussian(rand) * radius.z;
      scales[i] = scale[0] + rand() * (scale[1] - scale[0]);
      color.set(palette[Math.floor(rand() * palette.length)]).multiplyScalar(0.55 + rand() * 0.6);
      color.toArray(colors, i * 3);
      rots[i] = rand() * Math.PI * 2;
      seeds[i] = rand();
    }
    geo.setAttribute('aOffset', new InstancedBufferAttribute(offsets, 3));
    geo.setAttribute('aScale', new InstancedBufferAttribute(scales, 1));
    geo.setAttribute('aColor', new InstancedBufferAttribute(colors, 3));
    geo.setAttribute('aRot', new InstancedBufferAttribute(rots, 1));
    geo.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1));
    geo.instanceCount = count;
    return geo;
  }, [count, seed, radius, palette, scale]);

  const material = useMemo(() => new ShaderMaterial({
    vertexShader: nebulaVertex,
    fragmentShader: nebulaFragment,
    uniforms: {
      uMap: { value: getNebulaPuffTexture() },
      uTime: { value: 0 },
      uIntensity: { value: intensity },
      uNear: { value: near },
    },
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
  }), [intensity, near]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock }) => { material.uniforms.uTime.value = clock.elapsedTime; });

  return <mesh position={position} geometry={geometry} material={material} frustumCulled={false} />;
}

interface MotesProps {
  position?: Vector3;
  radius: Vector3;
  count: number;
  palette: string[];
  size?: number;
  drift?: number;
  seed?: number;
  /** Distribute on a flat annulus [inner, outer] instead of an ellipsoid (asteroid belts). */
  ring?: [number, number];
}

/** Floating glowing particles (dust lit by the nebula, young stars). */
export function Motes({ position, radius, count, palette, size = 1, drift = 1.2, seed = 3, ring }: MotesProps) {
  const geometry = useMemo(() => {
    const rand = rng(seed);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const color = new Color();
    for (let i = 0; i < count; i++) {
      if (ring) {
        const angle = rand() * Math.PI * 2;
        const r = ring[0] + (ring[1] - ring[0]) * (rand() + rand()) / 2;
        pos[i * 3] = Math.cos(angle) * r;
        pos[i * 3 + 1] = gaussian(rand) * radius.y;
        pos[i * 3 + 2] = Math.sin(angle) * r;
      } else {
        pos[i * 3] = gaussian(rand) * radius.x;
        pos[i * 3 + 1] = gaussian(rand) * radius.y;
        pos[i * 3 + 2] = gaussian(rand) * radius.z;
      }
      const star = rand() > 0.97;
      color.set(palette[Math.floor(rand() * palette.length)]).multiplyScalar(star ? 3 : 0.7 + rand());
      color.toArray(col, i * 3);
      sizes[i] = (star ? 3 : 0.6 + rand() * 1.2) * size;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new BufferAttribute(col, 3));
    geo.setAttribute('aSize', new BufferAttribute(sizes, 1));
    return geo;
  }, [count, radius, palette, size, seed, ring]);

  const material = useMemo(() => new ShaderMaterial({
    vertexShader: glowPointsVertex,
    fragmentShader: glowPointsFragment,
    uniforms: { uPixelRatio: { value: 1 }, uSizeScale: { value: 1 }, uTime: { value: 0 }, uDrift: { value: drift } },
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
  }), [drift]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock, viewport }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uPixelRatio.value = viewport.dpr;
  });

  return <points position={position} geometry={geometry} material={material} frustumCulled={false} />;
}
