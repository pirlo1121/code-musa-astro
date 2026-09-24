// Experience: a constellation. Each career stage is a star; the line to the
// next one is drawn as the camera travels there, and a star ignites when the
// camera arrives. Driven directly by the journey coordinate, so it scrubs
// forwards and backwards with the scroll.

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { frame } from '../../scroll/store';
import { useWorld } from '../context';
import { useShader } from '../shaders/useShader';

const lineVertex = /* glsl */ `
attribute float aT;
varying float vT;
void main() {
  vT = aT;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const lineFragment = /* glsl */ `
uniform float uProgress;
uniform vec3 uColor;
varying float vT;
void main() {
  float drawn = step(vT, uProgress);
  // A brighter spark rides the tip of the line while it is being drawn
  float tip = exp(-abs(uProgress - vT) * 18.0) * step(vT, uProgress);
  gl_FragColor = vec4(uColor * (1.4 + tip * 4.0), drawn * 0.9);
}
`;

const starVertex = /* glsl */ `
attribute float aIndex;
attribute float aBase;
uniform float uProgress;
uniform float uScale;
uniform float uTime;
varying float vLit;
varying float vBase;
void main() {
  vLit = smoothstep(aIndex - 0.6, aIndex, uProgress);
  vBase = aBase;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float size = mix(aBase > 0.5 ? 1.2 : 0.6, 3.2, vLit * aBase);
  size *= 1.0 + 0.08 * sin(uTime * 2.0 + aIndex * 3.0);
  gl_PointSize = clamp(size * uScale / -mv.z, 1.0, 64.0);
  gl_Position = projectionMatrix * mv;
}
`;

const starFragment = /* glsl */ `
varying float vLit;
varying float vBase;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p);
  float core = exp(-d * 14.0) * 2.0;
  float spikes = (exp(-abs(p.x) * 60.0) + exp(-abs(p.y) * 60.0)) * smoothstep(0.5, 0.0, d) * 0.6;
  vec3 dim = vec3(0.45, 0.5, 0.7);
  vec3 lit = vec3(0.85, 0.8, 1.0) * 3.0;
  vec3 col = mix(dim, lit, vLit * vBase) * (core + spikes * vLit);
  gl_FragColor = vec4(col, smoothstep(0.5, 0.1, d));
}
`;

export default function Constellation() {
  const world = useWorld();
  const first = world.ranges.experience[0];
  const stars = world.xpStars;

  const { lines, points } = useMemo(() => {
    const pos: number[] = [];
    const t: number[] = [];
    for (let i = 0; i < stars.length - 1; i++) {
      const a = stars[i];
      const b = stars[i + 1];
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      t.push(i, i + 1);
    }
    const lines = new BufferGeometry();
    lines.setAttribute('position', new Float32BufferAttribute(pos, 3));
    lines.setAttribute('aT', new Float32BufferAttribute(t, 1));

    // Career stars plus faint companions that give the constellation a shape
    const sp: number[] = [];
    const idx: number[] = [];
    const base: number[] = [];
    stars.forEach((s, i) => {
      sp.push(s.x, s.y, s.z);
      idx.push(i);
      base.push(1);
      for (let k = 0; k < 4; k++) {
        sp.push(s.x + (Math.random() - 0.5) * 26, s.y + (Math.random() - 0.5) * 18, s.z + (Math.random() - 0.5) * 20);
        idx.push(i);
        base.push(0);
      }
    });
    const points = new BufferGeometry();
    points.setAttribute('position', new Float32BufferAttribute(sp, 3));
    points.setAttribute('aIndex', new Float32BufferAttribute(idx, 1));
    points.setAttribute('aBase', new Float32BufferAttribute(base, 1));
    return { lines, points };
  }, [stars]);
  useEffect(
    () => () => {
      lines.dispose();
      points.dispose();
    },
    [lines, points],
  );

  const lineMaterial = useShader(() => ({
    vertexShader: lineVertex,
    fragmentShader: lineFragment,
    uniforms: { uProgress: { value: 0 }, uColor: { value: new Color(0.62, 0.55, 1.0) } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  }));
  const starMaterial = useShader(() => ({
    vertexShader: starVertex,
    fragmentShader: starFragment,
    uniforms: { uProgress: { value: 0 }, uScale: { value: 1 }, uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  }));
  const lineUniforms = lineMaterial.uniforms;
  const starUniforms = starMaterial.uniforms;

  useFrame((state) => {
    const progress = frame.s - first;
    lineUniforms.uProgress.value = progress;
    starUniforms.uProgress.value = progress;
    starUniforms.uTime.value = state.clock.elapsedTime;
    const fov = (((state.camera as { fov?: number }).fov ?? 50) * Math.PI) / 180;
    starUniforms.uScale.value = (state.size.height * state.viewport.dpr * 0.5) / Math.tan(fov / 2);
  });

  return (
    <>
      <lineSegments geometry={lines} material={lineMaterial} />
      <points geometry={points} material={starMaterial} />
    </>
  );
}
