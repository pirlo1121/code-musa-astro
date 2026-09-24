import { useRef } from 'react';
import { Mesh, Vector3 } from 'three';
import { StarCore } from '../components/canvas/StarCore';
import { LensFlare } from '../components/canvas/LensFlare';
import { Motes } from '../components/canvas/NebulaCloud';
import { useStationVisibility } from '../hooks/useStationVisibility';
import { useTierConfig } from '../hooks/useQuality';
import { HERO, STATIONS } from './layout';

const INDEX = 0;
const MOTES_RADIUS = new Vector3(60, 30, 40);
const MOTES_PALETTE = ['#ffb070', '#ffd9a0', '#ff7a45'];

/** Station 0 · A massive star: plasma, corona, prominences and lens flare. */
export default function HeroStar() {
  const group = useStationVisibility(INDEX, 1.8);
  const star = useRef<Mesh>(null);
  const cfg = useTierConfig();

  return (
    <>
      <group ref={group} position={STATIONS[INDEX].center}>
        <StarCore
          ref={star}
          radius={HERO.radius}
          cool="#b3300a"
          hot="#ffae42"
          core="#fff4d6"
          intensity={2.4}
          corona="#ff9a3c"
          coronaScale={4.6}
          coronaIntensity={1.3}
          particles={cfg.heroParticles}
          detail={cfg.sphereDetail}
        />
        <Motes radius={MOTES_RADIUS} count={Math.round(cfg.heroParticles / 3)} palette={MOTES_PALETTE} size={1.2} drift={2} seed={11} />
      </group>
      {/* Outside the station group: flare quads are positioned in world space. */}
      <LensFlare source={star} station={INDEX} />
    </>
  );
}
