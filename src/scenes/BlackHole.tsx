import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, ShaderMaterial } from 'three';
import { diskFragment, haloFragment, inflowFragment, inflowVertex, localVertex, photonRingFragment } from '../shaders/blackhole';
import { rng } from '../assets/textures';
import { useStationVisibility } from '../hooks/useStationVisibility';
import { useBillboard } from '../hooks/useBillboard';
import { useTierConfig } from '../hooks/useQuality';
import { BLACK_HOLE, STATIONS } from './layout';

const INDEX = 5;
const HOT = '#fff4e0';
const WARM = '#ffa040';
const COOL = '#8a1f0a';

/**
 * Station 5 · Black hole: a pitch-black shadow that occludes everything
 * behind it, a tilted accretion disc, the far side of the disc lensed into
 * arcs around the shadow, and a thin photon ring. The screen-space lensing
 * lives in Effects (LensingEffect) and is keyed to this station.
 */
export default function BlackHole() {
  const group = useStationVisibility(INDEX, 1.8);
  const facing = useBillboard<Group>();
  const cfg = useTierConfig();
  const R = BLACK_HOLE.radius;

  const mats = useMemo(() => {
    const additive = { blending: AdditiveBlending, transparent: true, depthWrite: false, side: DoubleSide } as const;
    return {
      disk: new ShaderMaterial({
        vertexShader: localVertex, fragmentShader: diskFragment, ...additive,
        uniforms: {
          uTime: { value: 0 }, uIntensity: { value: 1 }, uInner: { value: R * 1.35 }, uOuter: { value: R * 4.8 },
          uBeaming: { value: 0.55 },
          uHot: { value: new Color(HOT) }, uWarm: { value: new Color(WARM) }, uCool: { value: new Color(COOL) },
        },
      }),
      halo: new ShaderMaterial({
        vertexShader: localVertex, fragmentShader: haloFragment, ...additive,
        uniforms: {
          uTime: { value: 0 }, uIntensity: { value: 0.9 }, uInner: { value: R * 1.04 }, uOuter: { value: R * 1.9 },
          uHot: { value: new Color(HOT) }, uWarm: { value: new Color(WARM) },
        },
      }),
      photon: new ShaderMaterial({
        vertexShader: localVertex, fragmentShader: photonRingFragment, ...additive,
        uniforms: { uRadius: { value: R * 1.03 }, uWidth: { value: R * 0.035 }, uIntensity: { value: 2.4 }, uColor: { value: new Color('#ffe6c4') } },
      }),
      inflow: new ShaderMaterial({
        vertexShader: inflowVertex, fragmentShader: inflowFragment, ...additive,
        uniforms: { uTime: { value: 0 }, uRadius: { value: R }, uPixelRatio: { value: 1 }, uColor: { value: new Color('#ffc07a') } },
      }),
    };
  }, [R]);

  const inflowGeo = useMemo(() => {
    const count = Math.round(cfg.heroParticles * 1.2);
    const rand = rng(55);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aSeed', new BufferAttribute(new Float32Array(count).map(() => rand()), 1));
    return geo;
  }, [cfg.heroParticles]);

  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  useEffect(() => () => inflowGeo.dispose(), [inflowGeo]);

  useFrame(({ clock, viewport }) => {
    const t = clock.elapsedTime;
    mats.disk.uniforms.uTime.value = t;
    mats.halo.uniforms.uTime.value = t;
    mats.inflow.uniforms.uTime.value = t;
    mats.inflow.uniforms.uPixelRatio.value = viewport.dpr;
  });

  return (
    <group ref={group} position={STATIONS[INDEX].center}>
      {/* Shadow: opaque and depth-writing, so the far half of the disc and
          the stars behind it disappear. */}
      <mesh renderOrder={-1}>
        <sphereGeometry args={[R, cfg.sphereDetail, cfg.sphereDetail / 2]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <group rotation={[-1.32, 0, 0.22]}>
        <mesh material={mats.disk}>
          <ringGeometry args={[R * 1.35, R * 4.8, 192, 1]} />
        </mesh>
        <points geometry={inflowGeo} material={mats.inflow} frustumCulled={false} />
      </group>
      <group ref={facing}>
        <mesh material={mats.halo}>
          <ringGeometry args={[R * 1.04, R * 1.9, 160, 1]} />
        </mesh>
        <mesh material={mats.photon}>
          <ringGeometry args={[R * 0.9, R * 1.25, 160, 1]} />
        </mesh>
      </group>
    </group>
  );
}
