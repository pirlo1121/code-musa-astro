import { forwardRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Mesh, ShaderMaterial, Vector3 } from 'three';
import {
  coronaFragment, coronaVertex, flareParticlesFragment, flareParticlesVertex, starFragment, starVertex,
} from '../../shaders/star';
import { rng } from '../../assets/textures';
import { useBillboard } from '../../hooks/useBillboard';

interface StarCoreProps {
  radius: number;
  cool: string;
  hot: string;
  core: string;
  intensity?: number;
  corona?: string;
  coronaScale?: number;
  coronaIntensity?: number;
  particles?: number;
  detail?: number;
}

/**
 * A star: animated plasma sphere, ray-streaked corona billboard and
 * GPU-animated particles boiling off the surface. Reused for the hero star,
 * the sun of the skills system and the galaxy's core.
 */
export const StarCore = forwardRef<Mesh, StarCoreProps>(function StarCore(
  { radius, cool, hot, core, intensity = 2.2, corona = hot, coronaScale = 4.2, coronaIntensity = 1, particles = 0, detail = 64 },
  ref,
) {
  const surface = useMemo(() => new ShaderMaterial({
    vertexShader: starVertex,
    fragmentShader: starFragment,
    uniforms: {
      uTime: { value: 0 },
      uRadius: { value: radius },
      uCool: { value: new Color(cool) },
      uHot: { value: new Color(hot) },
      uCore: { value: new Color(core) },
      uIntensity: { value: intensity },
    },
  }), [radius, cool, hot, core, intensity]);

  const coronaMat = useMemo(() => new ShaderMaterial({
    vertexShader: coronaVertex,
    fragmentShader: coronaFragment,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new Color(corona) },
      uIntensity: { value: coronaIntensity },
      uCoreSize: { value: 1 / coronaScale },
    },
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
  }), [corona, coronaIntensity, coronaScale]);

  const particleGeo = useMemo(() => {
    if (!particles) return null;
    const rand = rng(radius * 100);
    const dirs = new Float32Array(particles * 3);
    const seeds = new Float32Array(particles);
    const d = new Vector3();
    for (let i = 0; i < particles; i++) {
      const u = rand() * 2 - 1;
      const phi = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      d.set(s * Math.cos(phi), u, s * Math.sin(phi)).toArray(dirs, i * 3);
      seeds[i] = rand();
    }
    const geo = new BufferGeometry();
    // Positions are computed in the shader; this only sizes the draw call.
    geo.setAttribute('position', new BufferAttribute(new Float32Array(particles * 3), 3));
    geo.setAttribute('aDir', new BufferAttribute(dirs, 3));
    geo.setAttribute('aSeed', new BufferAttribute(seeds, 1));
    return geo;
  }, [particles, radius]);

  const particleMat = useMemo(() => new ShaderMaterial({
    vertexShader: flareParticlesVertex,
    fragmentShader: flareParticlesFragment,
    uniforms: {
      uTime: { value: 0 },
      uRadius: { value: radius },
      uPixelRatio: { value: 1 },
      uColor: { value: new Color(hot) },
    },
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
  }), [radius, hot]);

  useEffect(() => () => { surface.dispose(); coronaMat.dispose(); particleMat.dispose(); }, [surface, coronaMat, particleMat]);
  useEffect(() => () => particleGeo?.dispose(), [particleGeo]);

  const glow = useBillboard<Mesh>();

  useFrame(({ clock, viewport }) => {
    const t = clock.elapsedTime;
    surface.uniforms.uTime.value = t;
    coronaMat.uniforms.uTime.value = t;
    particleMat.uniforms.uTime.value = t;
    particleMat.uniforms.uPixelRatio.value = viewport.dpr;
  });

  const glowSize = radius * coronaScale * 2;

  return (
    <group>
      <mesh ref={ref} material={surface}>
        <sphereGeometry args={[radius, detail, detail / 2]} />
      </mesh>
      <mesh ref={glow} material={coronaMat} renderOrder={2}>
        <planeGeometry args={[glowSize, glowSize]} />
      </mesh>
      {particleGeo && <points geometry={particleGeo} material={particleMat} frustumCulled={false} />}
    </group>
  );
});
