import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BackSide, Color, DoubleSide, Group, MathUtils, ShaderMaterial, Vector3 } from 'three';
import {
  atmosphereFragment, atmosphereVertex, planetFragment, planetVertex, ringFragment, ringVertex,
} from '../../shaders/planet';
import type { PlanetKind } from '../../data/skills';

const KIND_INDEX: Record<PlanetKind, number> = { rocky: 0, gas: 1, ocean: 2 };

export interface PlanetLook {
  kind: PlanetKind;
  palette: [string, string, string];
  atmosphere: string;
  size: number;
  ring?: boolean;
  seed: number;
}

interface PlanetProps extends PlanetLook {
  /** World position of the light source (the system's star). */
  lightPos: Vector3;
  isActive?: () => boolean;
  detail?: number;
  spin?: number;
}

/** Procedural planet: shaded surface, Fresnel atmosphere shell, optional rings. */
export function Planet({ kind, palette, atmosphere, size, ring, seed, lightPos, isActive, detail = 48, spin = 0.05 }: PlanetProps) {
  const body = useRef<Group>(null);

  const surface = useMemo(() => new ShaderMaterial({
    vertexShader: planetVertex,
    fragmentShader: planetFragment,
    uniforms: {
      uTime: { value: 0 },
      uSeed: { value: seed * 10 },
      uKind: { value: KIND_INDEX[kind] },
      uColorA: { value: new Color(palette[0]) },
      uColorB: { value: new Color(palette[1]) },
      uColorC: { value: new Color(palette[2]) },
      uAtmosphere: { value: new Color(atmosphere) },
      uLightPos: { value: lightPos },
      uActive: { value: 0 },
    },
  }), [kind, palette, atmosphere, seed, lightPos]);

  const halo = useMemo(() => new ShaderMaterial({
    vertexShader: atmosphereVertex,
    fragmentShader: atmosphereFragment,
    uniforms: {
      uColor: { value: new Color(atmosphere) },
      uLightPos: { value: lightPos },
      uIntensity: { value: 1.2 },
    },
    side: BackSide,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
  }), [atmosphere, lightPos]);

  const ringMat = useMemo(() => ring ? new ShaderMaterial({
    vertexShader: ringVertex,
    fragmentShader: ringFragment,
    uniforms: {
      uColor: { value: new Color(palette[2]) },
      uInner: { value: size * 1.45 },
      uOuter: { value: size * 2.4 },
      uSeed: { value: seed * 50 },
    },
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
  }) : null, [ring, palette, size, seed]);

  useEffect(() => () => { surface.dispose(); halo.dispose(); ringMat?.dispose(); }, [surface, halo, ringMat]);

  useFrame(({ clock }, dt) => {
    surface.uniforms.uTime.value = clock.elapsedTime;
    const active = isActive?.() ? 1 : 0;
    surface.uniforms.uActive.value = MathUtils.damp(surface.uniforms.uActive.value, active, 3, dt);
    halo.uniforms.uIntensity.value = 1.2 + surface.uniforms.uActive.value * 1.3;
    if (body.current) body.current.rotation.y += dt * spin;
  });

  return (
    <group>
      <group ref={body} rotation={[0.25 * (seed - 0.5), 0, 0.3 * seed]}>
        <mesh material={surface}>
          <sphereGeometry args={[size, detail, detail / 2]} />
        </mesh>
      </group>
      <mesh material={halo} scale={1.22}>
        <sphereGeometry args={[size, 32, 16]} />
      </mesh>
      {ringMat && (
        <mesh material={ringMat} rotation={[-Math.PI / 2 + 0.35, 0.2, 0]}>
          <ringGeometry args={[size * 1.45, size * 2.4, 96, 1]} />
        </mesh>
      )}
    </group>
  );
}
