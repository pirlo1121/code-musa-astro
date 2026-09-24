// Close-range dust that sells speed: each grain is a tiny quad stretched
// along the camera's velocity, so it is a dot while parked and a streak
// during travel. Wraps around the camera like the starfield.

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { AdditiveBlending, BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, Vector3 } from 'three';
import { frame } from '../../scroll/store';
import { useQuality } from '../context';
import { useShader } from '../shaders/useShader';

const BOX = 90;

export const streakVertex = /* glsl */ `
// position.x: side (-1..1), position.y: 0 = head, 1 = tail
vec3 streak(vec3 headView, vec3 velView, float stretch, float minLen, float width) {
  vec3 tail = headView - velView * stretch;
  vec3 axis = tail - headView;
  float len = length(axis);
  vec3 dir = len > 1e-4 ? axis / len : vec3(0.0, 1.0, 0.0);
  if (len < minLen) tail = headView + dir * minLen;
  vec3 c = cross(dir, normalize(headView));
  vec3 side = length(c) > 1e-4 ? normalize(c) : vec3(1.0, 0.0, 0.0);
  return mix(headView, tail, position.y) + side * position.x * width * (1.0 - position.y * 0.8);
}
`;

const vertexShader = /* glsl */ `
${streakVertex}
attribute vec3 aOffset;
uniform vec3 uVel;
uniform float uBox;
varying float vAlong;
varying float vAlpha;

void main() {
  vec3 halfBox = vec3(uBox * 0.5);
  vec3 p = mod(aOffset - cameraPosition + halfBox, uBox) - halfBox + cameraPosition;
  vec3 head = (viewMatrix * vec4(p, 1.0)).xyz;
  vec3 vel = (viewMatrix * vec4(uVel, 0.0)).xyz;
  vec3 pos = streak(head, vel, 0.035, 0.06, 0.045);
  float dist = length(head);
  vAlong = position.y;
  vAlpha = (1.0 - smoothstep(uBox * 0.3, uBox * 0.5, dist)) * smoothstep(1.5, 5.0, dist) * step(0.0, -head.z);
  gl_Position = projectionMatrix * vec4(pos, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform float uIntensity;
varying float vAlong;
varying float vAlpha;
void main() {
  float a = vAlpha * (1.0 - vAlong) * uIntensity;
  gl_FragColor = vec4(vec3(0.75, 0.85, 1.0), a);
}
`;

/** Unit quad for streaks: x ∈ {-1, 1} (side), y ∈ {0, 1} (head → tail). */
export function streakQuad(g: InstancedBufferGeometry) {
  g.setAttribute('position', new BufferAttribute(new Float32Array([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0]), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

export function SpaceDust() {
  const { particles } = useQuality();

  const geometry = useMemo(() => {
    const count = Math.round(1400 * particles);
    const g = streakQuad(new InstancedBufferGeometry());
    const offsets = new Float32Array(count * 3);
    for (let i = 0; i < offsets.length; i++) offsets[i] = (Math.random() - 0.5) * BOX;
    g.setAttribute('aOffset', new InstancedBufferAttribute(offsets, 3));
    g.instanceCount = count;
    return g;
  }, [particles]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useShader(() => ({
    vertexShader,
    fragmentShader,
    uniforms: { uVel: { value: new Vector3() }, uBox: { value: BOX }, uIntensity: { value: 0.5 } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  }));
  const { uniforms } = material;

  useFrame(() => {
    const [x, y, z] = frame.camVel;
    uniforms.uVel.value.set(x, y, z);
    uniforms.uIntensity.value = 0.35 + Math.min(frame.speed / 120, 1) * 0.65;
  });

  return (
    <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={-3} />
  );
}
