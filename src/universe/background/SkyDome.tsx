// The deep-space backdrop — galactic band, dust lanes, coloured nebulosity,
// hundreds of thousands of micro-stars and distant galaxies — is expensive
// procedural noise, but it sits at infinity and never changes. So it is
// rendered ONCE into a cube map at startup and used as scene.background:
// after that it costs a single texture lookup per pixel.

import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import {
  BackSide,
  CubeCamera,
  Mesh,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLCubeRenderTarget,
} from 'three';
import { useQuality } from '../context';
import { fbm, hash } from '../shaders/noise';

const GALAXIES: [number, number, number, number, string][] = [
  // direction xyz, angular size, colour
  [0.55, 0.35, -0.76, 0.05, '1.0, 0.85, 0.7'],
  [-0.7, 0.2, -0.68, 0.035, '0.75, 0.85, 1.0'],
  [0.2, -0.45, -0.87, 0.028, '1.0, 0.75, 0.9'],
  [-0.3, 0.7, 0.64, 0.04, '0.85, 0.9, 1.0'],
  [0.85, -0.1, 0.5, 0.03, '1.0, 0.9, 0.75'],
];

const galaxyCode = GALAXIES.map(([x, y, z, size, c], i) => {
  const d = new Vector3(x, y, z).normalize();
  return `col += galaxy(d, vec3(${d.x.toFixed(4)}, ${d.y.toFixed(4)}, ${d.z.toFixed(4)}), ${size}, ${(i * 1.7).toFixed(2)}) * vec3(${c});`;
}).join('\n');

const vertexShader = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
${fbm}
${hash}
varying vec3 vDir;

float galaxy(vec3 d, vec3 g, float size, float rot) {
  float facing = dot(d, g);
  if (facing < 0.9) return 0.0;
  vec3 t1 = normalize(cross(g, vec3(0.0, 1.0, 0.0)));
  vec3 t2 = cross(g, t1);
  vec2 p = vec2(dot(d, t1), dot(d, t2)) / size;
  float c = cos(rot), s = sin(rot);
  p = mat2(c, -s, s, c) * p;
  p.y *= 2.6;
  float r = length(p);
  float arms = 0.5 + 0.5 * sin(atan(p.y, p.x) * 2.0 + r * 9.0);
  return exp(-r * r * 5.0) * (0.25 + 0.35 * arms) + exp(-r * 30.0) * 1.4;
}

float stars(vec3 d, float scale, float threshold) {
  vec3 g = d * scale;
  vec3 cell = floor(g);
  float h = hash13(cell);
  if (h < threshold) return 0.0;
  vec3 center = cell + 0.5 + (hash33(cell) - 0.5) * 0.7;
  float dist = length(g - center);
  float b = (h - threshold) / (1.0 - threshold);
  return smoothstep(0.32, 0.0, dist) * (0.35 + b * 1.6);
}

void main() {
  vec3 d = normalize(vDir);

  // Galactic band: a great circle with dust lanes
  vec3 bandNormal = normalize(vec3(0.35, 1.0, 0.25));
  float b = dot(d, bandNormal);
  float band = exp(-b * b * 14.0);
  float glow = fbm(d * 3.0) * 0.5 + 0.5;
  float lanes = smoothstep(0.05, 0.45, fbm(d * 7.0 + 4.0));

  vec3 col = vec3(0.0025, 0.003, 0.007);
  col += band * mix(vec3(0.05, 0.045, 0.085), vec3(0.11, 0.08, 0.06), glow) * (0.5 + glow);
  col *= 1.0 - band * lanes * 0.65;

  // Faint coloured nebulosity patches
  col += vec3(0.07, 0.015, 0.09) * pow(max(fbm(d * 1.6 + 9.0), 0.0), 2.0) * 2.0;
  col += vec3(0.0, 0.045, 0.08) * pow(max(fbm(d * 2.2 + 3.0), 0.0), 2.0) * 2.0;

  // Micro stars, denser inside the band
  float st = stars(d, 240.0, 0.93 - band * 0.05) + stars(d, 520.0, 0.96 - band * 0.06) * 0.6;
  vec3 tint = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.85, 0.7), hash13(floor(d * 240.0) + 7.0));
  col += st * tint;

  ${galaxyCode}

  // Dither: kills banding in the dark gradients of an 8-bit target
  col += (hash13(d * 1000.0) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

export function SkyDome() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const quality = useQuality();

  useLayoutEffect(() => {
    const target = new WebGLCubeRenderTarget(quality.skyResolution, { generateMipmaps: true });
    // sRGB target: stored gamma-encoded in 8 bits, so dark gradients don't band
    target.texture.colorSpace = SRGBColorSpace;

    const bakeScene = new Scene();
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      side: BackSide,
      depthWrite: false,
      defines: { FBM_OCTAVES: quality.fbmOctaves },
    });
    const geometry = new SphereGeometry(10, 64, 32);
    bakeScene.add(new Mesh(geometry, material));
    const cubeCamera = new CubeCamera(0.1, 100, target);
    cubeCamera.update(gl, bakeScene);

    geometry.dispose();
    material.dispose();
    scene.background = target.texture;
    return () => {
      scene.background = null;
      target.dispose();
    };
  }, [gl, scene, quality.skyResolution, quality.fbmOctaves]);

  return null;
}
