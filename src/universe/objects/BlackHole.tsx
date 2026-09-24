// The transition between projects and experience: a black hole with a
// turbulent accretion disk (Doppler-beamed: the side spinning towards the
// camera is brighter) and an event horizon that swallows the stars. The
// gravitational lensing — including the arc of the far side of the disk bent
// over the top — is a post-processing pass (CinematicEffect).

import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, DoubleSide } from 'three';
import { useWorld } from '../context';
import { fbm } from '../shaders/noise';
import { useShader } from '../shaders/useShader';

export const HORIZON = 6;
const DISK_IN = 8;
const DISK_OUT = 30;

const diskVertex = /* glsl */ `
varying vec3 vLocal;
varying vec3 vWorld;
varying vec3 vTangent;
void main() {
  vLocal = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  // Orbital direction in world space (counter-clockwise in the disk plane)
  vTangent = normalize(mat3(modelMatrix) * vec3(-position.y, position.x, 0.0));
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const diskFragment = /* glsl */ `
${fbm}
uniform float uTime;
uniform float uInner;
uniform float uOuter;
varying vec3 vLocal;
varying vec3 vWorld;
varying vec3 vTangent;

void main() {
  float r = length(vLocal.xy);
  float rr = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
  float a = atan(vLocal.y, vLocal.x);

  // Keplerian-ish: inner gas orbits faster. Sampling noise on the rotated
  // unit circle (not the raw angle) avoids a seam at atan's discontinuity.
  float phase = a + uTime * (0.9 / (0.25 + rr));
  vec3 q = vec3(cos(phase), sin(phase), 0.0) * (1.5 + rr * 4.0) + vec3(0.0, 0.0, rr * 7.0);
  float n = fbm(q);
  float streaks = 0.5 + 0.5 * sin(rr * 48.0 + n * 7.0);

  float heat = pow(1.0 - rr, 1.7);
  float intensity = heat * (0.55 + 0.9 * n) * (0.55 + 0.45 * streaks);

  // Doppler beaming: tangential velocity towards the viewer brightens
  vec3 tangent = normalize(vTangent);
  vec3 V = normalize(cameraPosition - vWorld);
  float doppler = 1.0 + 0.75 * dot(tangent, V);

  vec3 col = mix(vec3(1.0, 0.32, 0.06), vec3(1.0, 0.88, 0.7), pow(1.0 - rr, 3.0));
  col *= intensity * doppler * 4.5;

  float edge = smoothstep(0.0, 0.04, rr) * smoothstep(1.0, 0.55, rr);
  gl_FragColor = vec4(col, edge);
}
`;

export default function BlackHole() {
  const world = useWorld();
  const disk = useShader(() => ({
    vertexShader: diskVertex,
    fragmentShader: diskFragment,
    uniforms: { uTime: { value: 0 }, uInner: { value: DISK_IN }, uOuter: { value: DISK_OUT } },
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  }));
  const uniforms = disk.uniforms;

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <group position={world.blackHole}>
      {/* Event horizon: pure black, writes depth so it hides everything behind */}
      <mesh renderOrder={1}>
        <sphereGeometry args={[HORIZON, 64, 48]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      <mesh rotation={[-Math.PI / 2 + 0.22, 0, 0.12]} material={disk}>
        <ringGeometry args={[DISK_IN, DISK_OUT, 256, 8]} />
      </mesh>

    </group>
  );
}
