import { Vector3 } from 'three';
import { NebulaCloud, Motes } from '../components/canvas/NebulaCloud';
import { StarCore } from '../components/canvas/StarCore';
import { useStationVisibility } from '../hooks/useStationVisibility';
import { useTierConfig } from '../hooks/useQuality';
import { NEBULA, STATIONS } from './layout';

const INDEX = 1;
// Emission-nebula palette: hydrogen magenta, oxygen teal, dusty blue.
const OUTER = ['#6a2bd9', '#2b5bd9', '#c0268f', '#1a8aa8'];
const INNER = ['#ff4fa3', '#39d5ff', '#ffb35c', '#9d6bff'];
const INNER_RADIUS = NEBULA.radius.clone().multiplyScalar(0.45);
const MOTE_RADIUS = NEBULA.radius.clone().multiplyScalar(0.8);
const MOTE_PALETTE = ['#ffd1f0', '#b8f3ff', '#ffe7c2'];
const YOUNG_STARS = [new Vector3(-12, 6, 10), new Vector3(18, -8, -14), new Vector3(-26, -4, -22)];

/** Station 1 · Nebula: layered volumetric clouds with young stars inside. */
export default function NebulaScene() {
  const group = useStationVisibility(INDEX, 1.9);
  const cfg = useTierConfig();

  return (
    <group ref={group} position={STATIONS[INDEX].center}>
      <NebulaCloud position={new Vector3()} radius={NEBULA.radius} count={cfg.nebulaPuffs} palette={OUTER} scale={[40, 90]} seed={5} intensity={0.32} near={10} />
      <NebulaCloud position={new Vector3()} radius={INNER_RADIUS} count={Math.round(cfg.nebulaPuffs * 0.6)} palette={INNER} scale={[18, 44]} seed={9} intensity={0.42} near={8} />
      <Motes radius={MOTE_RADIUS} count={Math.round(cfg.dust * 0.8)} palette={MOTE_PALETTE} size={1.4} drift={1.5} seed={21} />
      {YOUNG_STARS.map((p, i) => (
        <group key={i} position={p}>
          <StarCore radius={0.9 + i * 0.3} cool="#5fb6ff" hot="#d6f0ff" core="#ffffff" intensity={3} coronaScale={7} coronaIntensity={0.9} detail={24} />
        </group>
      ))}
    </group>
  );
}
