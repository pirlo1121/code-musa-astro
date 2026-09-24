// Procedural planet: surface from 3D noise on the sphere (no UV seams, no
// textures to download), soft terminator, ocean specular, optional city
// lights on the night side, fresnel atmosphere and a back-face halo.
// Three LOD levels share one material.

import { Detailed } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { forwardRef, useEffect, useMemo } from 'react';
import {
  AdditiveBlending,
  BackSide,
  Color,
  DoubleSide,
  Group,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import type { PlanetKind } from '../../data/skills';
import { useQuality } from '../context';
import { fbm } from '../shaders/noise';
import { useShader } from '../shaders/useShader';

const KIND: Record<PlanetKind, number> = { terrestrial: 0, gas: 1, lava: 2, ice: 3 };

const surfaceVertex = /* glsl */ `
varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vNormalW;
void main() {
  vObj = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const surfaceFragment = /* glsl */ `
${fbm}
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
uniform vec3 uAtmo;
uniform vec3 uLight;
uniform float uKind;
uniform float uSeed;
uniform float uTime;
uniform float uCity;
varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vNormalW;

void main() {
  vec3 p = normalize(vObj) + uSeed;
  vec3 N = normalize(vNormalW);
  vec3 L = normalize(uLight - vWorld);
  vec3 V = normalize(cameraPosition - vWorld);
  float ndl = dot(N, L);

  vec3 albedo;
  vec3 emissive = vec3(0.0);
  float spec = 0.0;

  if (uKind < 0.5) {
    // Terrestrial: oceans, land, mountains, drifting clouds
    float h = fbm(p * 2.2);
    float land = smoothstep(0.02, 0.08, h);
    vec3 ground = mix(uB, uC, smoothstep(0.12, 0.4, h));
    albedo = mix(uA, ground, land);
    spec = (1.0 - land) * 0.7;
    float clouds = smoothstep(0.1, 0.55, fbm(p * 3.5 + vec3(uTime * 0.012, 0.0, uTime * 0.006) + 11.0));
    albedo = mix(albedo, vec3(0.95), clouds * 0.75);
    spec *= 1.0 - clouds;
    float night = smoothstep(0.05, -0.25, ndl);
    float cities = step(0.62, fbm(p * 26.0)) * land * (1.0 - clouds);
    emissive += vec3(1.0, 0.62, 0.3) * cities * night * uCity * 2.2;
  } else if (uKind < 1.5) {
    // Gas giant: turbulent latitude bands
    float lat = normalize(vObj).y;
    float turb = fbm(vec3(p.x * 2.0, lat * 10.0, p.z * 2.0) + vec3(uTime * 0.015, 0.0, 0.0));
    float bands = sin(lat * 16.0 + turb * 2.6) * 0.5 + 0.5;
    albedo = mix(uA, uB, bands);
    albedo = mix(albedo, uC, smoothstep(0.35, 0.8, fbm(p * 5.0 + turb)));
  } else if (uKind < 2.5) {
    // Lava: dark crust with glowing cracks
    float h = fbm(p * 2.6);
    float cracks = 1.0 - smoothstep(0.0, 0.07, abs(fbm(p * 4.5 + h)));
    albedo = mix(uA, uB, smoothstep(-0.3, 0.4, h));
    float pulse = 0.8 + 0.2 * sin(uTime * 1.3 + h * 8.0);
    emissive += uC * cracks * 3.0 * pulse;
  } else {
    // Ice: pale plains with blue fissures
    float h = fbm(p * 3.0);
    albedo = mix(uA, uC, smoothstep(-0.25, 0.35, h));
    float fissures = 1.0 - smoothstep(0.0, 0.05, abs(fbm(p * 6.0)));
    albedo = mix(albedo, uB, fissures * 0.7);
    spec = 0.35;
  }

  float diffuse = smoothstep(-0.12, 1.0, ndl);
  vec3 H = normalize(L + V);
  float specular = pow(max(dot(N, H), 0.0), 48.0) * spec * step(0.0, ndl);
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);

  vec3 col = albedo * (diffuse * 1.25 + 0.012) + specular * vec3(1.0, 0.95, 0.85) + emissive;
  col += uAtmo * fresnel * smoothstep(-0.35, 0.6, ndl) * 1.3;
  gl_FragColor = vec4(col, 1.0);
}
`;

const haloVertex = /* glsl */ `
varying vec3 vNormalV;
varying vec3 vNormalW;
varying vec3 vWorld;
void main() {
  vNormalV = normalize(normalMatrix * normal);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const haloFragment = /* glsl */ `
uniform vec3 uAtmo;
uniform vec3 uLight;
varying vec3 vNormalV;
varying vec3 vNormalW;
varying vec3 vWorld;
void main() {
  // Only back faces render. Their view-space normal goes from z = 0 at the
  // halo's silhouette to z ≈ -0.5 at the planet's limb (halo = 1.16 × radius),
  // so -z is a glow that peaks at the limb and fades outward.
  float limb = pow(smoothstep(0.0, 0.5, -vNormalV.z), 2.2);
  float lit = smoothstep(-0.4, 0.5, dot(normalize(vNormalW), normalize(uLight - vWorld)));
  float a = limb * lit * 0.9;
  gl_FragColor = vec4(uAtmo * 1.4, a);
}
`;

const ringVertex = /* glsl */ `
varying vec3 vLocal;
void main() {
  vLocal = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const ringFragment = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform float uInner;
uniform float uOuter;
varying vec3 vLocal;
void main() {
  float r = (length(vLocal.xy) - uInner) / (uOuter - uInner);
  float bands = 0.5 + 0.5 * sin(r * 70.0) * sin(r * 23.0 + 1.3);
  float gap = smoothstep(0.52, 0.55, r) * smoothstep(0.6, 0.57, r);
  float a = smoothstep(0.0, 0.08, r) * smoothstep(1.0, 0.85, r) * (0.35 + 0.5 * bands) * (1.0 - gap * 0.9);
  gl_FragColor = vec4(mix(uA, uB, bands) * 0.9, a * 0.8);
}
`;

export interface PlanetProps {
  radius: number;
  kind: PlanetKind;
  colors: [string, string, string];
  atmosphere: string;
  light: Vector3;
  seed?: number;
  spin?: number;
  tilt?: number;
  cityLights?: boolean;
  rings?: boolean;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}

export const Planet = forwardRef<Group, PlanetProps>(function Planet(
  { radius, kind, colors, atmosphere, light, seed = 0, spin = 0.03, tilt = 0.3, cityLights, rings, onClick },
  ref,
) {
  const quality = useQuality();

  const geometries = useMemo(
    () => [new SphereGeometry(1, 96, 64), new SphereGeometry(1, 48, 32), new SphereGeometry(1, 20, 14)],
    [],
  );
  const haloGeometry = useMemo(() => new SphereGeometry(1, 48, 32), []);

  const surface = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: surfaceVertex,
        fragmentShader: surfaceFragment,
        defines: { FBM_OCTAVES: quality.fbmOctaves },
        uniforms: {
          uA: { value: new Color(colors[0]) },
          uB: { value: new Color(colors[1]) },
          uC: { value: new Color(colors[2]) },
          uAtmo: { value: new Color(atmosphere) },
          uLight: { value: light },
          uKind: { value: KIND[kind] },
          uSeed: { value: seed },
          uTime: { value: 0 },
          uCity: { value: cityLights ? 1 : 0 },
        },
      }),
    [colors, atmosphere, light, kind, seed, cityLights, quality.fbmOctaves],
  );

  useEffect(
    () => () => {
      surface.dispose();
    },
    [surface],
  );
  useEffect(
    () => () => {
      geometries.forEach((g) => g.dispose());
      haloGeometry.dispose();
    },
    [geometries, haloGeometry],
  );

  const halo = useShader(
    () => ({
      vertexShader: haloVertex,
      fragmentShader: haloFragment,
      uniforms: { uAtmo: { value: new Color(atmosphere) }, uLight: { value: light } },
      side: BackSide,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
    [atmosphere, light],
  );
  const ring = useShader(
    () => ({
      vertexShader: ringVertex,
      fragmentShader: ringFragment,
      uniforms: {
        uA: { value: new Color(colors[1]) },
        uB: { value: new Color(colors[2]) },
        uInner: { value: radius * 1.4 },
        uOuter: { value: radius * 2.3 },
      },
      side: DoubleSide,
      transparent: true,
      depthWrite: false,
    }),
    [colors, radius],
  );

  const spinner = useMemo(() => new Group(), []);

  useFrame((state, dt) => {
    surface.uniforms.uTime.value = state.clock.elapsedTime;
    spinner.rotation.y += spin * dt;
  });

  return (
    <group ref={ref}>
      <group rotation={[0, 0, tilt]}>
        <primitive object={spinner}>
          <Detailed distances={[0, radius * 25, radius * 80]} scale={radius}>
            {geometries.map((g, i) => (
              <mesh key={i} geometry={g} material={surface} onClick={onClick} />
            ))}
          </Detailed>
        </primitive>
        <mesh geometry={haloGeometry} material={halo} scale={radius * 1.16} />
        {rings && (
          <mesh rotation={[-Math.PI / 2 + 0.15, 0, 0]} material={ring}>
            <ringGeometry args={[radius * 1.4, radius * 2.3, 128, 1]} />
          </mesh>
        )}
      </group>
    </group>
  );
});
