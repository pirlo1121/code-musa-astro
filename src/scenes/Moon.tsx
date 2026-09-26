import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Line, Mesh, Quaternion, ShaderMaterial,
  Vector2, Vector3,
} from 'three';
import { moonFragment, moonHaloFragment, moonHaloVertex, moonVertex, orbitFragment, orbitVertex } from '../shaders/moon';
import { Motes } from '../components/canvas/NebulaCloud';
import { useStationVisibility } from '../hooks/useStationVisibility';
import { useBillboard } from '../hooks/useBillboard';
import { useTierConfig } from '../hooks/useQuality';
import { MOON, STATIONS } from './layout';

const INDEX = 5;
/** Sunlight direction in world space: from the upper left, slightly behind
 *  the camera, so the Moon is a bright gibbous with a relief-lit terminator. */
const SUN = new Vector3(-0.78, 0.32, 0.5).normalize();
const SPIN = 0.012;

interface OrbitSpec {
  radius: number;      // in Moon radii
  tilt: [number, number, number];
  speed: number;       // rad / s
  phase: number;
  color: string;       // trail colour
  strobe: string;      // navigation light
}

const ORBITS: OrbitSpec[] = [
  { radius: 1.38, tilt: [0.32, 0, 0.18], speed: 0.21, phase: 0.4, color: '#8fd4ff', strobe: '#ff4a4a' },
  { radius: 1.62, tilt: [-0.55, 0, -0.35], speed: -0.14, phase: 2.6, color: '#ffd28f', strobe: '#5dff9a' },
  { radius: 1.95, tilt: [1.05, 0, 0.2], speed: 0.1, phase: 4.4, color: '#c9a8ff', strobe: '#ffffff' },
];

const DEBRIS_PALETTE = ['#d9dde6', '#b8bfcc', '#ffe2b8'];

/**
 * Station 5 · The Moon: a procedural surface (craters at several scales,
 * maria, ray systems, relief along the terminator, base lights on the night
 * side) with a soft halo, satellites on inclined orbits leaving light trails,
 * and a slowly turning ring of dust.
 */
export default function Moon() {
  const group = useStationVisibility(INDEX, 1.8);
  const cfg = useTierConfig();
  const R = MOON.radius;
  const moon = useRef<Mesh>(null);
  const halo = useBillboard<Mesh>();
  const debris = useRef<Group>(null);
  const tmp = useMemo(() => ({ light: new Vector3(), cam: new Vector3(), screen: new Vector3(), q: new Quaternion() }), []);

  const craterOctaves = cfg.sphereDetail >= 64 ? 4 : cfg.sphereDetail >= 48 ? 3 : 2;

  const surface = useMemo(() => new ShaderMaterial({
    vertexShader: moonVertex,
    fragmentShader: moonFragment,
    defines: { CRATER_OCTAVES: craterOctaves },
    uniforms: {
      uTime: { value: 0 },
      uLightObj: { value: SUN.clone() },
      uCamObj: { value: new Vector3(0, 0, R * 4) },
      uSun: { value: 1.05 },
      uBump: { value: 0.9 },
      uEarthshine: { value: new Color('#1b2536') },
      uCityColor: { value: new Color('#ffb45e') },
    },
  }), [R, craterOctaves]);

  const haloMat = useMemo(() => new ShaderMaterial({
    vertexShader: moonHaloVertex,
    fragmentShader: moonHaloFragment,
    uniforms: {
      uRadius: { value: R },
      uIntensity: { value: 0.55 },
      uColor: { value: new Color('#cfe0ff') },
      uLightDir: { value: new Vector2(-0.8, 0.5).normalize() },
    },
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
  }), [R]);

  useEffect(() => () => { surface.dispose(); haloMat.dispose(); }, [surface, haloMat]);

  useFrame(({ clock, camera }, dt) => {
    const mesh = moon.current;
    if (!mesh) return;
    mesh.rotation.y += SPIN * Math.min(dt, 0.1);
    surface.uniforms.uTime.value = clock.elapsedTime;
    // Light and camera in the Moon's object space.
    mesh.updateMatrixWorld();
    tmp.light.copy(SUN).applyQuaternion(mesh.getWorldQuaternion(tmp.q).invert());
    surface.uniforms.uLightObj.value.copy(tmp.light);
    surface.uniforms.uCamObj.value.copy(mesh.worldToLocal(tmp.cam.copy(camera.position)));
    // Halo brightens toward the sun as seen on screen.
    tmp.screen.copy(SUN).transformDirection(camera.matrixWorldInverse);
    (haloMat.uniforms.uLightDir.value as Vector2).set(tmp.screen.x, tmp.screen.y).normalize();
    if (debris.current) debris.current.rotation.y += 0.02 * Math.min(dt, 0.1);
  });

  return (
    <group ref={group} position={STATIONS[INDEX].center}>
      <mesh ref={moon} material={surface}>
        <sphereGeometry args={[R, cfg.sphereDetail * 2, cfg.sphereDetail]} />
      </mesh>
      <mesh ref={halo} material={haloMat}>
        <planeGeometry args={[R * 6.4, R * 6.4]} />
      </mesh>
      {ORBITS.map((o, i) => <Satellite key={i} spec={o} moonRadius={R} />)}
      <group rotation={[0.42, 0, -0.28]}>
        <group ref={debris}>
          <Motes
            radius={DEBRIS_RADIUS}
            ring={[R * 2.25, R * 2.8]}
            count={Math.round(cfg.dust * 0.7)}
            palette={DEBRIS_PALETTE}
            size={0.7}
            drift={0}
            seed={77}
          />
        </group>
      </group>
    </group>
  );
}

const DEBRIS_RADIUS = new Vector3(1, 0.25, 1);

function Satellite({ spec, moonRadius }: { spec: OrbitSpec; moonRadius: number }) {
  const r = spec.radius * moonRadius;
  const carrier = useRef<Group>(null);
  const strobe = useRef<Mesh>(null);
  const beacon = useRef<Mesh>(null);

  const orbitGeo = useMemo(() => {
    const segments = 256;
    const pos = new Float32Array((segments + 1) * 3);
    const ang = new Float32Array(segments + 1);
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 2] = -Math.sin(a) * r;
      ang[i] = a;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aAngle', new BufferAttribute(ang, 1));
    return geo;
  }, [r]);

  const orbitMat = useMemo(() => new ShaderMaterial({
    vertexShader: orbitVertex,
    fragmentShader: orbitFragment,
    uniforms: {
      uHead: { value: 0 },
      // The trail always lies behind the satellite, whichever way it flies.
      uDir: { value: Math.sign(spec.speed) || 1 },
      uColor: { value: new Color(spec.color) },
      uIntensity: { value: 1 },
    },
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
  }), [spec.color, spec.speed]);

  const orbitLine = useMemo(() => new Line(orbitGeo, orbitMat), [orbitGeo, orbitMat]);

  const strobeColor = useMemo(() => new Color(spec.strobe).multiplyScalar(6), [spec.strobe]);
  const beaconColor = useMemo(() => new Color(spec.color).multiplyScalar(2.5), [spec.color]);

  useEffect(() => () => { orbitGeo.dispose(); orbitMat.dispose(); }, [orbitGeo, orbitMat]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const theta = spec.phase + t * spec.speed;
    if (carrier.current) carrier.current.rotation.y = theta;
    orbitMat.uniforms.uHead.value = theta;
    const blink = (t * 1.3 + spec.phase) % 1;
    strobe.current?.scale.setScalar(blink < 0.08 ? 1 : 0.001);
    beacon.current?.scale.setScalar(0.8 + 0.2 * Math.sin(t * 3 + spec.phase));
  });

  return (
    <group rotation={spec.tilt}>
      <primitive object={orbitLine} />
      <group ref={carrier}>
        <group position={[r, 0, 0]} scale={0.6}>
          {/* Bus */}
          <mesh>
            <boxGeometry args={[0.55, 0.55, 1]} />
            <meshBasicMaterial color="#a7afbf" />
          </mesh>
          <mesh position={[0, 0.28, 0]}>
            <boxGeometry args={[0.5, 0.02, 0.95]} />
            <meshBasicMaterial color="#e8ecf4" />
          </mesh>
          {/* Solar wings */}
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 1.45, 0, 0]}>
              <mesh>
                <boxGeometry args={[2.2, 0.03, 0.7]} />
                <meshBasicMaterial color="#1d3f8a" />
              </mesh>
              <mesh position={[0, 0.02, 0]}>
                <boxGeometry args={[2.2, 0.01, 0.04]} />
                <meshBasicMaterial color="#7fa6ff" />
              </mesh>
            </group>
          ))}
          {/* Dish */}
          <mesh position={[0, 0, -0.62]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.32, 0.18, 20, 1, true]} />
            <meshBasicMaterial color="#d9dee8" side={DoubleSide} />
          </mesh>
          {/* Lights: steady beacon + navigation strobe (HDR, picked up by bloom) */}
          <mesh ref={beacon} position={[0, -0.32, 0.3]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshBasicMaterial color={beaconColor} toneMapped={false} />
          </mesh>
          <mesh ref={strobe} position={[0, 0.34, -0.3]}>
            <sphereGeometry args={[0.14, 8, 8]} />
            <meshBasicMaterial color={strobeColor} toneMapped={false} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
