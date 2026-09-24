// Three parallax layers of real 3D stars. Each layer is a box of points that
// wraps around the camera in the vertex shader (mod against the camera
// position), so a few tens of thousands of stars fill an infinite journey
// with true parallax: near stars rush past, far ones barely move.

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color } from 'three';
import { useQuality } from '../context';
import { useShader } from '../shaders/useShader';

interface Layer {
  count: number;
  box: number;
  size: [number, number];
  bright: number;
}

const LAYERS: Layer[] = [
  { count: 3500, box: 180, size: [0.12, 0.32], bright: 1.2 },
  { count: 22000, box: 900, size: [0.5, 1.4], bright: 1.0 },
  { count: 40000, box: 3200, size: [1.8, 4.5], bright: 0.9 },
];

const PALETTE = ['#9bb8ff', '#cad7ff', '#f8f7ff', '#fff4e0', '#ffd9a8', '#ffb58a'].map((c) => new Color(c));
const WEIGHTS = [0.12, 0.22, 0.3, 0.18, 0.12, 0.06];

function pickColor(out: Color) {
  let r = Math.random();
  for (let i = 0; i < WEIGHTS.length; i++) {
    if ((r -= WEIGHTS[i]) <= 0) return out.copy(PALETTE[i]);
  }
  return out.copy(PALETTE[2]);
}

const vertexShader = /* glsl */ `
attribute float aSize;
attribute float aSeed;
attribute vec3 aColor;
uniform float uTime;
uniform float uBox;
uniform float uScale;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec3 halfBox = vec3(uBox * 0.5);
  vec3 p = mod(position - cameraPosition + halfBox, uBox) - halfBox + cameraPosition;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float dist = length(p - cameraPosition);

  float edge = 1.0 - smoothstep(uBox * 0.3, uBox * 0.5, dist);
  float twinkle = 0.7 + 0.3 * sin(uTime * (0.8 + aSeed * 2.5) + aSeed * 60.0);

  float px = aSize * uScale / max(-mv.z, 0.001);
  // Sub-pixel stars stay 1px but dim instead of shimmering
  vAlpha = edge * twinkle * clamp(px, 0.0, 1.0) * step(0.0, -mv.z);
  gl_PointSize = clamp(px, 1.0, 10.0);
  vColor = aColor;
  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float core = smoothstep(0.5, 0.0, d);
  core *= core;
  gl_FragColor = vec4(vColor, core * vAlpha);
}
`;

function StarLayer({ layer, factor }: { layer: Layer; factor: number }) {
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  const geometry = useMemo(() => {
    const count = Math.round(layer.count * factor);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const seeds = new Float32Array(count);
    const c = new Color();
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * layer.box;
      positions[i * 3 + 1] = (Math.random() - 0.5) * layer.box;
      positions[i * 3 + 2] = (Math.random() - 0.5) * layer.box;
      // A few bright stars (HDR > 1) catch the bloom; most stay subtle
      const bright = Math.random() < 0.015 ? 2.5 + Math.random() * 2 : 0.5 + Math.random() * 0.7;
      pickColor(c).multiplyScalar(bright * layer.bright);
      colors.set([c.r, c.g, c.b], i * 3);
      sizes[i] = layer.size[0] + Math.pow(Math.random(), 3) * (layer.size[1] - layer.size[0]);
      seeds[i] = Math.random();
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(positions, 3));
    g.setAttribute('aColor', new BufferAttribute(colors, 3));
    g.setAttribute('aSize', new BufferAttribute(sizes, 1));
    g.setAttribute('aSeed', new BufferAttribute(seeds, 1));
    return g;
  }, [layer, factor]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useShader(
    () => ({
      vertexShader,
      fragmentShader,
      uniforms: { uTime: { value: 0 }, uBox: { value: layer.box }, uScale: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
    [layer],
  );
  const { uniforms } = material;

  useFrame((state) => {
    const cam = state.camera as { fov?: number };
    const fov = ((cam.fov ?? 50) * Math.PI) / 180;
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uScale.value = (size.height * dpr * 0.5) / Math.tan(fov / 2);
  });

  return (
    // Always around the camera, so frustum culling would only ever hide it wrongly
    <points geometry={geometry} material={material} frustumCulled={false} renderOrder={-5} />
  );
}

export function Starfield() {
  const { particles } = useQuality();
  return (
    <>
      {LAYERS.map((layer, i) => (
        <StarLayer key={i} layer={layer} factor={particles} />
      ))}
    </>
  );
}
