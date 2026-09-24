// Volumetric-looking nebulae: each cloud is a few camera-facing slices of
// domain-warped fbm, offset in depth so they parallax against each other.
// All clouds are one instanced draw call. Slices fade out when the camera
// gets close, so a nebula never covers the whole screen with full-res noise.

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { AdditiveBlending, Color, InstancedBufferAttribute, InstancedBufferGeometry, PlaneGeometry, Vector3 } from 'three';
import { useQuality, useWorld } from '../context';
import { SUN } from '../world';
import { fbm } from '../shaders/noise';
import { useShader } from '../shaders/useShader';

interface Cloud {
  center: Vector3;
  scale: number;
  a: string;
  b: string;
}

const vertexShader = /* glsl */ `
attribute vec3 aCenter;
attribute float aScale;
attribute float aSeed;
attribute vec3 aColorA;
attribute vec3 aColorB;
varying vec2 vUv;
varying float vSeed;
varying vec3 vColorA;
varying vec3 vColorB;
varying float vFade;

void main() {
  vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 world = aCenter + (camRight * position.x + camUp * position.y) * aScale;
  float dist = distance(aCenter, cameraPosition);
  vFade = smoothstep(aScale * 0.35, aScale * 1.1, dist) * (1.0 - smoothstep(2200.0, 3200.0, dist));
  vUv = uv;
  vSeed = aSeed;
  vColorA = aColorA;
  vColorB = aColorB;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const fragmentShader = /* glsl */ `
${fbm}
uniform float uTime;
varying vec2 vUv;
varying float vSeed;
varying vec3 vColorA;
varying vec3 vColorB;
varying float vFade;

void main() {
  if (vFade < 0.01) discard;
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;

  vec3 q = vec3(p * 1.3, vSeed * 13.0 + uTime * 0.012);
  vec3 warp = vec3(fbm(q + vec3(0.0, 0.0, 3.1)), fbm(q + vec3(5.2, 1.3, 0.0)), 0.0);
  float n = fbm(q + warp * 1.4);

  float density = smoothstep(-0.15, 0.65, n) * pow(1.0 - r, 1.6);
  vec3 col = mix(vColorA, vColorB, smoothstep(-0.2, 0.5, warp.x));
  // Bright filaments where the warped field folds
  col += vColorB * smoothstep(0.45, 0.7, n) * 0.8;

  float alpha = density * vFade * 0.55;
  gl_FragColor = vec4(col, alpha);
}
`;

export function Nebula() {
  const quality = useQuality();
  const world = useWorld();

  const clouds = useMemo<Cloud[]>(
    () => [
      { center: new Vector3(-160, 60, -260), scale: 260, a: '#3b1d6e', b: '#c05ad8' },
      { center: new Vector3(230, 20, -420), scale: 300, a: '#0d3a5c', b: '#39c2d8' },
      { center: SUN.clone().add(new Vector3(-120, 60, -260)), scale: 380, a: '#5a1a2a', b: '#ff8a4a' },
      { center: world.galaxies[0].clone().add(new Vector3(160, -60, -200)), scale: 340, a: '#101c5a', b: '#5a7dff' },
      { center: world.blackHole.clone().add(new Vector3(-200, 40, -160)), scale: 360, a: '#3a0d10', b: '#d8573a' },
      { center: world.xpStars[0].clone().add(new Vector3(120, 80, -220)), scale: 320, a: '#24104a', b: '#9b6bff' },
      { center: world.contactStation.clone().add(new Vector3(-180, -30, -240)), scale: 340, a: '#062f3a', b: '#4be0ff' },
    ],
    [world],
  );

  const geometry = useMemo(() => {
    const slices = 3;
    const count = clouds.length * slices;
    const base = new PlaneGeometry(2, 2);
    const g = new InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute('position', base.getAttribute('position'));
    g.setAttribute('uv', base.getAttribute('uv'));
    const center = new Float32Array(count * 3);
    const scale = new Float32Array(count);
    const seed = new Float32Array(count);
    const colA = new Float32Array(count * 3);
    const colB = new Float32Array(count * 3);
    const c = new Color();
    clouds.forEach((cloud, ci) => {
      for (let s = 0; s < slices; s++) {
        const i = ci * slices + s;
        const o = new Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 0.5, Math.random() - 0.5).multiplyScalar(cloud.scale * 0.45);
        center.set([cloud.center.x + o.x, cloud.center.y + o.y, cloud.center.z + o.z], i * 3);
        scale[i] = cloud.scale * (0.7 + Math.random() * 0.5);
        seed[i] = ci * 3.7 + s * 1.3;
        colA.set(c.set(cloud.a).toArray(), i * 3);
        colB.set(c.set(cloud.b).toArray(), i * 3);
      }
    });
    g.setAttribute('aCenter', new InstancedBufferAttribute(center, 3));
    g.setAttribute('aScale', new InstancedBufferAttribute(scale, 1));
    g.setAttribute('aSeed', new InstancedBufferAttribute(seed, 1));
    g.setAttribute('aColorA', new InstancedBufferAttribute(colA, 3));
    g.setAttribute('aColorB', new InstancedBufferAttribute(colB, 3));
    g.instanceCount = count;
    return g;
  }, [clouds]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useShader(
    () => ({
      vertexShader,
      fragmentShader,
      uniforms: { uTime: { value: 0 } },
      defines: { FBM_OCTAVES: Math.min(quality.fbmOctaves, 4) },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
    [quality.fbmOctaves],
  );
  const { uniforms } = material;
  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
  });

  if (!quality.nebula) return null;

  return (
    <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={-4} />
  );
}
