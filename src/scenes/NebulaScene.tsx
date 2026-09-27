import { useFrame } from '@react-three/fiber';
import { MathUtils } from 'three';
import { NebulaCloud, Motes } from '../components/canvas/NebulaCloud';
import { StarCore } from '../components/canvas/StarCore';
import { useStationVisibility } from '../hooks/useStationVisibility';
import { useTierConfig } from '../hooks/useQuality';
import { frame } from '../lib/store';
import { NEBULA, NEBULAE, STATIONS } from './layout';

const INNER_RADIUS = NEBULA.radius.clone().multiplyScalar(0.45);
const MOTE_RADIUS = NEBULA.radius.clone().multiplyScalar(0.8);
const OUTER_SCALE: [number, number] = [40, 90];
const INNER_SCALE: [number, number] = [18, 44];
/** How much a nebula swells when its section is expanded. */
const EXPANDED = 1.45;

/**
 * A nebula station: layered volumetric clouds with young stars inside. Every
 * nebula shares the same composition (so the camera flies into each one the
 * same way); only the palette and the seeds change. When its section is
 * expanded, the cloud swells around the camera.
 */
export default function NebulaScene({ index }: { index: number }) {
  const group = useStationVisibility(index, 1.9);
  const cfg = useTierConfig();
  const look = NEBULAE[index];
  // Station 1 keeps its original seeds, so the first nebula looks exactly as before.
  const seed = (index - 1) * 17;

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const target = frame.expandedStation === index ? EXPANDED : 1;
    g.scale.setScalar(MathUtils.damp(g.scale.x, target, 1.2, Math.min(dt, 0.1)));
  });

  return (
    <group ref={group} position={STATIONS[index].center}>
      <NebulaCloud position={NEBULA.origin} radius={NEBULA.radius} count={cfg.nebulaPuffs} palette={look.outer} scale={OUTER_SCALE} seed={5 + seed} intensity={0.32} near={10} />
      <NebulaCloud position={NEBULA.origin} radius={INNER_RADIUS} count={Math.round(cfg.nebulaPuffs * 0.6)} palette={look.inner} scale={INNER_SCALE} seed={9 + seed} intensity={0.42} near={8} />
      <Motes radius={MOTE_RADIUS} count={Math.round(cfg.dust * 0.8)} palette={look.motes} size={1.4} drift={1.5} seed={21 + seed} />
      {look.stars.map((p, i) => (
        <group key={i} position={p}>
          <StarCore radius={0.9 + i * 0.3} cool={look.starCool} hot={look.starHot} core="#ffffff" intensity={3} coronaScale={7} coronaIntensity={0.9} detail={24} />
        </group>
      ))}
    </group>
  );
}
