import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, CylinderGeometry, DoubleSide, ShaderMaterial } from 'three';
import {
  diskFragment, horizonFragment, inflowFragment, inflowVertex, localVertex, rimFragment, rimVertex, tunnelFragment, tunnelVertex,
} from '../shaders/wormhole';
import { rng } from '../assets/textures';
import { useStationVisibility } from '../hooks/useStationVisibility';
import { useTierConfig } from '../hooks/useQuality';
import { PORTAL, STATIONS } from './layout';

const INDEX = 5;
const TUNNEL_LENGTH = 180;

/**
 * Station 5 · Wormhole: energy rim, spiralling accretion disc, a twisting
 * tunnel of light and particles being pulled in. The screen-space lensing
 * lives in Effects (LensingEffect) and is keyed to this station.
 */
export default function Wormhole() {
  const group = useStationVisibility(INDEX, 1.8);
  const cfg = useTierConfig();
  const R = PORTAL.radius;

  const tunnelGeo = useMemo(() => {
    // Open cone whose mouth sits at z = 0 and narrows into −Z.
    const geo = new CylinderGeometry(R * 0.02, R * 0.97, TUNNEL_LENGTH, 64, 24, true);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, -TUNNEL_LENGTH / 2);
    return geo;
  }, [R]);

  const mats = useMemo(() => {
    const additive = { blending: AdditiveBlending, transparent: true, depthWrite: false } as const;
    return {
      tunnel: new ShaderMaterial({
        vertexShader: tunnelVertex, fragmentShader: tunnelFragment, side: DoubleSide, ...additive,
        uniforms: {
          uTime: { value: 0 }, uIntensity: { value: 1 }, uLength: { value: TUNNEL_LENGTH },
          uColorA: { value: new Color('#2a6bff') }, uColorB: { value: new Color('#b04dff') }, uColorC: { value: new Color('#e9f6ff') },
        },
      }),
      disk: new ShaderMaterial({
        vertexShader: localVertex, fragmentShader: diskFragment, side: DoubleSide, ...additive,
        uniforms: {
          uTime: { value: 0 }, uIntensity: { value: 0.9 }, uInner: { value: R * 1.02 }, uOuter: { value: R * 2.8 },
          uColorA: { value: new Color('#bff3ff') }, uColorB: { value: new Color('#6a3dff') },
        },
      }),
      rim: new ShaderMaterial({
        vertexShader: rimVertex, fragmentShader: rimFragment,
        uniforms: { uTime: { value: 0 }, uIntensity: { value: 1.6 }, uColor: { value: new Color('#7fe6ff') } },
      }),
      horizon: new ShaderMaterial({
        vertexShader: localVertex, fragmentShader: horizonFragment, ...additive,
        uniforms: { uRadius: { value: R }, uIntensity: { value: 0.9 }, uColor: { value: new Color('#5aa8ff') } },
      }),
      inflow: new ShaderMaterial({
        vertexShader: inflowVertex, fragmentShader: inflowFragment, ...additive,
        uniforms: { uTime: { value: 0 }, uRadius: { value: R }, uPixelRatio: { value: 1 }, uColor: { value: new Color('#a8ecff') } },
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

  useEffect(() => () => { tunnelGeo.dispose(); Object.values(mats).forEach((m) => m.dispose()); }, [tunnelGeo, mats]);
  useEffect(() => () => inflowGeo.dispose(), [inflowGeo]);

  useFrame(({ clock, viewport }) => {
    const t = clock.elapsedTime;
    mats.tunnel.uniforms.uTime.value = t;
    mats.disk.uniforms.uTime.value = t;
    mats.rim.uniforms.uTime.value = t;
    mats.inflow.uniforms.uTime.value = t;
    mats.inflow.uniforms.uPixelRatio.value = viewport.dpr;
  });

  return (
    <group ref={group} position={STATIONS[INDEX].center} rotation={[0, 0.18, 0]}>
      <mesh geometry={tunnelGeo} material={mats.tunnel} frustumCulled={false} />
      <mesh material={mats.horizon}>
        <circleGeometry args={[R, 96]} />
      </mesh>
      <mesh material={mats.disk} position={[0, 0, -0.5]}>
        <ringGeometry args={[R * 1.02, R * 2.8, 160, 1]} />
      </mesh>
      <mesh material={mats.rim}>
        <torusGeometry args={[R, 0.32, 16, 160]} />
      </mesh>
      <points geometry={inflowGeo} material={mats.inflow} frustumCulled={false} />
    </group>
  );
}
