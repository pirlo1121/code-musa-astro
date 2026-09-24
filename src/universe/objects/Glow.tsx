// Camera-facing HDR glow (star cores, sun corona, galaxy bulges). Values
// above 1.0 are what the bloom pass picks up.

import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, Vector3 } from 'three';
import { useShader } from '../shaders/useShader';

const vertexShader = /* glsl */ `
uniform float uSize;
varying vec2 vUv;
varying float vNear;
void main() {
  vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 center = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 world = center + (camRight * position.x + camUp * position.y) * uSize;
  vUv = uv;
  // A glow is a far-field effect: fade it as the camera flies inside it
  vNear = smoothstep(uSize * 0.8, uSize * 2.2, distance(center, cameraPosition));
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uTime;
uniform float uRays;
varying vec2 vUv;
varying float vNear;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float core = exp(-r * 9.0) * 2.5;
  float halo = pow(max(1.0 - r, 0.0), 3.0) * 0.6;
  float a = atan(p.y, p.x);
  float rays = uRays * pow(max(1.0 - r, 0.0), 2.0) * (0.5 + 0.5 * sin(a * 12.0 + uTime * 0.2) * sin(a * 7.0 - uTime * 0.13)) * 0.5;
  vec3 col = uColor * (core + halo + rays) * uIntensity * vNear;
  gl_FragColor = vec4(col, 1.0);
}
`;

interface Props {
  position?: Vector3 | [number, number, number];
  size: number;
  color: string;
  intensity?: number;
  rays?: number;
}

export function Glow({ position, size, color, intensity = 1, rays = 0 }: Props) {
  const material = useShader(
    () => ({
      vertexShader,
      fragmentShader,
      uniforms: {
        uSize: { value: size },
        uColor: { value: new Color(color) },
        uIntensity: { value: intensity },
        uTime: { value: 0 },
        uRays: { value: rays },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
    [size, color, intensity, rays],
  );
  const { uniforms } = material;
  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh position={position} material={material} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
