// Contact: a futuristic station — a rotating ring of modules around a spire,
// with a holographic projector beaming a wireframe globe. The DOM form next
// to it is styled as the hologram's control panel.

import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, Color, DoubleSide, Group, InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import { useWorld } from '../context';
import { useShader } from '../shaders/useShader';

const MODULES = 20;

const hull = new MeshStandardMaterial({ color: '#c3cad8', metalness: 0.6, roughness: 0.35 });
const dark = new MeshStandardMaterial({ color: '#232a3a', metalness: 0.7, roughness: 0.45 });
const glowMat = new MeshStandardMaterial({ color: '#000000', emissive: '#6ee6ff', emissiveIntensity: 3.5 });
const warmMat = new MeshStandardMaterial({ color: '#000000', emissive: '#ffb35e', emissiveIntensity: 2.5 });

const holoVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormalW;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const holoFragment = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform float uFade;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormalW;
void main() {
  float scan = 0.55 + 0.45 * sin(vWorld.y * 14.0 - uTime * 5.0);
  float fresnel = pow(1.0 - abs(dot(normalize(vNormalW), normalize(cameraPosition - vWorld))), 1.5);
  float flicker = 0.88 + 0.12 * sin(uTime * 31.0) * sin(uTime * 7.3);
  float fade = mix(1.0, smoothstep(1.0, 0.1, vUv.y), uFade);
  float a = (0.12 + 0.55 * fresnel) * scan * flicker * fade;
  gl_FragColor = vec4(uColor * 1.8, a);
}
`;

export default function ContactStation() {
  const world = useWorld();
  const ring = useRef<Group>(null);
  const globe = useRef<Group>(null);
  const modules = useRef<InstancedMesh>(null);
  const windows = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const d = new Object3D();
    for (let i = 0; i < MODULES; i++) {
      const a = (i / MODULES) * Math.PI * 2;
      d.position.set(Math.cos(a) * 16, 0, Math.sin(a) * 16);
      d.rotation.set(0, -a, 0);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      modules.current!.setMatrixAt(i, d.matrix);
      d.position.set(Math.cos(a) * 17.05, 0, Math.sin(a) * 17.05);
      d.updateMatrix();
      windows.current!.setMatrixAt(i, d.matrix);
    }
    modules.current!.instanceMatrix.needsUpdate = true;
    windows.current!.instanceMatrix.needsUpdate = true;
  }, []);

  const holo = useShader(() => ({
    vertexShader: holoVertex,
    fragmentShader: holoFragment,
    uniforms: { uTime: { value: 0 }, uColor: { value: new Color('#6ee6ff') }, uFade: { value: 1 } },
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  }));
  const globeMaterial = useShader(() => ({
    vertexShader: holoVertex,
    fragmentShader: holoFragment,
    uniforms: { uTime: { value: 0 }, uColor: { value: new Color('#9ff3ff') }, uFade: { value: 0 } },
    wireframe: true,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  }));
  const holoUniforms = holo.uniforms;
  const globeUniforms = globeMaterial.uniforms;
  const beacon = useMemo(
    () => new MeshStandardMaterial({ color: '#000000', emissive: '#7dff9a', emissiveIntensity: 4 }),
    [],
  );

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    holoUniforms.uTime.value = t;
    globeUniforms.uTime.value = t;
    if (ring.current) ring.current.rotation.y += dt * 0.05;
    if (globe.current) {
      globe.current.rotation.y += dt * 0.4;
      globe.current.position.y = 22 + Math.sin(t * 0.8) * 0.4;
    }
    beacon.emissiveIntensity = Math.pow(Math.max(Math.sin(t * 1.8), 0), 16) * 9;
  });

  return (
    <group position={world.contactStation} rotation={[0.18, 0.5, 0]}>
      {/* Spire */}
      <mesh material={hull}>
        <cylinderGeometry args={[1.6, 2.4, 26, 32]} />
      </mesh>
      <mesh material={dark} position={[0, 15, 0]}>
        <coneGeometry args={[1.6, 4, 32]} />
      </mesh>
      <mesh material={dark} position={[0, -14.5, 0]}>
        <sphereGeometry args={[2.6, 32, 16]} />
      </mesh>
      {[-8, -3, 3].map((y) => (
        <mesh key={y} material={glowMat} position={[0, y, 0]}>
          <torusGeometry args={[2.05, 0.08, 8, 48]} />
        </mesh>
      ))}

      {/* Rotating module ring */}
      <group ref={ring}>
        <mesh material={hull} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[16, 0.7, 16, 128]} />
        </mesh>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <mesh key={i} material={dark} rotation={[0, (i * Math.PI) / 3, 0]}>
            <boxGeometry args={[32, 0.3, 0.3]} />
          </mesh>
        ))}
        <instancedMesh ref={modules} args={[undefined, dark, MODULES]}>
          <boxGeometry args={[1.8, 2.2, 4]} />
        </instancedMesh>
        <instancedMesh ref={windows} args={[undefined, warmMat, MODULES]}>
          <boxGeometry args={[0.1, 0.5, 2.6]} />
        </instancedMesh>
        <mesh position={[16, 1.4, 0]} material={beacon}>
          <sphereGeometry args={[0.18, 8, 8]} />
        </mesh>
      </group>

      {/* Holographic projector */}
      <group position={[0, 0, 0]}>
        <mesh position={[0, 20.5, 0]} material={holo}>
          <cylinderGeometry args={[5.5, 0.6, 7, 48, 1, true]} />
        </mesh>
        <group ref={globe} position={[0, 22, 0]}>
          <mesh material={globeMaterial}>
            <icosahedronGeometry args={[3.2, 2]} />
          </mesh>
        </group>
      </group>

      <pointLight position={[0, 20, 6]} color="#6ee6ff" intensity={60} distance={60} decay={2} />
    </group>
  );
}
