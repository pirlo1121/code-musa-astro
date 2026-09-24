// Occasional comets: a pool of three, spawned off the camera axis every
// 7–18 s. One instanced draw call; per-comet state lives in JS and is
// written to instance attributes each frame.

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, InstancedBufferAttribute, InstancedBufferGeometry, Vector3 } from 'three';
import { frame } from '../../scroll/store';
import { useQuality } from '../context';
import { streakQuad, streakVertex } from './SpaceDust';
import { useShader } from '../shaders/useShader';

const POOL = 3;

const vertexShader = /* glsl */ `
${streakVertex}
attribute vec3 aHead;
attribute vec3 aVel;
attribute float aAlpha;
varying float vAlong;
varying float vAlpha;
void main() {
  vec3 head = (viewMatrix * vec4(aHead, 1.0)).xyz;
  vec3 vel = (viewMatrix * vec4(aVel, 0.0)).xyz;
  vec3 pos = streak(head, vel, 0.45, 1.0, 0.9);
  vAlong = position.y;
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * vec4(pos, 1.0);
}
`;

const fragmentShader = /* glsl */ `
varying float vAlong;
varying float vAlpha;
void main() {
  float head = smoothstep(0.08, 0.0, vAlong) * 3.0;
  float tail = pow(1.0 - vAlong, 2.2);
  vec3 col = mix(vec3(0.5, 0.8, 1.0), vec3(1.0), smoothstep(0.3, 0.0, vAlong)) * (tail * 1.6 + head);
  gl_FragColor = vec4(col, tail * vAlpha);
}
`;

interface Comet {
  life: number;
  age: number;
  head: Vector3;
  vel: Vector3;
}

const forward = new Vector3();
const right = new Vector3();
const up = new Vector3();

export function Comets() {
  const { comets } = useQuality();
  const pool = useRef<Comet[]>(
    Array.from({ length: POOL }, () => ({ life: 0, age: 1, head: new Vector3(), vel: new Vector3() })),
  );
  const nextSpawn = useRef(4);

  const geometry = useMemo(() => {
    const g = streakQuad(new InstancedBufferGeometry());
    g.setAttribute('aHead', new InstancedBufferAttribute(new Float32Array(POOL * 3), 3));
    g.setAttribute('aVel', new InstancedBufferAttribute(new Float32Array(POOL * 3), 3));
    g.setAttribute('aAlpha', new InstancedBufferAttribute(new Float32Array(POOL), 1));
    g.instanceCount = POOL;
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const material = useShader(() => ({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  }));

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const cam = state.camera;
    const heads = geometry.getAttribute('aHead') as InstancedBufferAttribute;
    const vels = geometry.getAttribute('aVel') as InstancedBufferAttribute;
    const alphas = geometry.getAttribute('aAlpha') as InstancedBufferAttribute;

    if (t > nextSpawn.current && !frame.reducedMotion) {
      nextSpawn.current = t + 7 + Math.random() * 11;
      const c = pool.current.find((p) => p.age >= p.life);
      if (c) {
        cam.getWorldDirection(forward);
        right.crossVectors(forward, cam.up).normalize();
        up.crossVectors(right, forward).normalize();
        const side = Math.random() < 0.5 ? -1 : 1;
        c.head
          .copy(cam.position)
          .addScaledVector(forward, 160 + Math.random() * 220)
          .addScaledVector(right, -side * (80 + Math.random() * 120))
          .addScaledVector(up, 40 + Math.random() * 120);
        c.vel
          .copy(right)
          .multiplyScalar(side)
          .addScaledVector(up, -0.35 - Math.random() * 0.3)
          .addScaledVector(forward, (Math.random() - 0.5) * 0.4)
          .normalize()
          .multiplyScalar(70 + Math.random() * 60);
        c.age = 0;
        c.life = 3.5 + Math.random() * 2.5;
      }
    }

    pool.current.forEach((c, i) => {
      c.age += dt;
      const alive = c.age < c.life;
      if (alive) c.head.addScaledVector(c.vel, dt);
      const fade = alive ? Math.min(c.age / 0.6, 1) * Math.min((c.life - c.age) / 0.8, 1) : 0;
      heads.setXYZ(i, c.head.x, c.head.y, c.head.z);
      vels.setXYZ(i, c.vel.x, c.vel.y, c.vel.z);
      alphas.setX(i, fade);
    });
    heads.needsUpdate = true;
    vels.needsUpdate = true;
    alphas.needsUpdate = true;
  });

  if (!comets) return null;

  return (
    <mesh geometry={geometry} material={material} frustumCulled={false} />
  );
}
