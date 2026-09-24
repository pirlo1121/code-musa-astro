import { output } from './common';

// Navigation beacons: blink pattern per light, computed on the GPU.
export const beaconVertex = /* glsl */ `
attribute vec3 aColor;
attribute float aPhase;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vColor;
void main() {
  float cycle = fract(uTime * 0.6 + aPhase);
  // Negative phase = steady light (shuttle engines).
  float on = aPhase < 0.0 ? 0.6 : smoothstep(0.0, 0.05, cycle) * smoothstep(0.25, 0.1, cycle);
  vColor = aColor * (0.15 + on * 3.0);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = (3.0 + on * 3.0) * uPixelRatio * (60.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

export const beaconFragment = /* glsl */ `
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = pow(smoothstep(0.5, 0.0, d), 2.0);
  gl_FragColor = vec4(vColor * a, 1.0);
  ${output}
}
`;

// Tractor / docking beam: soft cone of light with travelling pulses.
export const beamVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const beamFragment = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  float along = vUv.y;
  float pulses = 0.6 + 0.4 * sin(along * 30.0 + uTime * 4.0);
  float fade = smoothstep(0.0, 0.3, along) * smoothstep(1.0, 0.6, along);
  float edge = pow(sin(vUv.x * 3.14159), 0.5);
  gl_FragColor = vec4(uColor * pulses * fade * edge * 0.35, 1.0);
  ${output}
}
`;
