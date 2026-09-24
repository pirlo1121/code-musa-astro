import { output } from './common';

// Point-sprite shaders. All motion happens on the GPU from a time uniform, so
// animating tens of thousands of particles costs zero JavaScript per frame.


// Background stars at "infinity": the group follows the camera, so there is
// no parallax, and sizes are in screen pixels (no distance attenuation).
export const starsVertex = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute float aPhase;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vColor;
void main() {
  float twinkle = 0.7 + 0.3 * sin(uTime * (0.4 + aPhase * 1.8) + aPhase * 50.0);
  vColor = aColor * twinkle;
  gl_PointSize = aSize * uPixelRatio * (0.85 + twinkle * 0.3);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const starsFragment = /* glsl */ `
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float core = smoothstep(0.5, 0.0, d);
  float a = pow(core, 2.2);
  gl_FragColor = vec4(vColor * a, 1.0);
  ${output}
}
`;

// Generic glowing points with perspective size (galaxy stars, nebula motes).
export const glowPointsVertex = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
uniform float uPixelRatio;
uniform float uSizeScale;
uniform float uTime;
uniform float uDrift;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec3 p = position;
  // Optional organic drift (nebula motes); 0 for rigid systems.
  p += uDrift * vec3(
    sin(uTime * 0.21 + position.y * 0.13),
    cos(uTime * 0.17 + position.x * 0.11),
    sin(uTime * 0.19 + position.z * 0.12));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float depth = -mv.z;
  vColor = aColor;
  // Fade points the camera is about to fly through instead of letting them
  // balloon into screen-filling squares.
  vAlpha = smoothstep(1.5, 9.0, depth);
  gl_PointSize = min(aSize * uSizeScale * uPixelRatio * (140.0 / depth), 28.0 * uPixelRatio);
  gl_Position = projectionMatrix * mv;
}
`;

export const glowPointsFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = pow(smoothstep(0.5, 0.0, d), 1.8) * vAlpha;
  gl_FragColor = vec4(vColor * a, 1.0);
  ${output}
}
`;

// Space dust: a box of particles that wraps around the camera, so it is
// infinite without ever allocating more than one buffer.
const dustWrap = /* glsl */ `
uniform vec3 uCamPos;
uniform float uBox;
uniform float uTime;
vec3 dustWorld(vec3 seed) {
  vec3 p = seed * uBox + vec3(sin(uTime * 0.07 + seed.y * 40.0), cos(uTime * 0.05 + seed.z * 40.0), 0.0) * 0.8;
  vec3 rel = mod(p - uCamPos + uBox * 0.5, uBox) - uBox * 0.5;
  return uCamPos + rel;
}
`;

export const dustVertex = /* glsl */ `
attribute float aSize;
uniform float uPixelRatio;
varying float vAlpha;
${dustWrap}
void main() {
  vec3 world = dustWorld(position);
  vec4 mv = viewMatrix * vec4(world, 1.0);
  float dist = length(world - uCamPos);
  vAlpha = smoothstep(uBox * 0.5, uBox * 0.25, dist) * smoothstep(0.4, 2.5, -mv.z);
  gl_PointSize = min(aSize * uPixelRatio * (30.0 / -mv.z), 6.0 * uPixelRatio);
  gl_Position = projectionMatrix * mv;
}
`;

export const dustFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.1, d) * vAlpha * uOpacity;
  gl_FragColor = vec4(uColor * a, 1.0);
  ${output}
}
`;

// Motion streaks: the same dust, drawn as short lines stretched against the
// camera velocity. Invisible when parked, a hyperspace hint during flights.
export const streakVertex = /* glsl */ `
attribute float aEnd;
uniform vec3 uVelocity;
varying float vAlpha;
${dustWrap}
void main() {
  vec3 world = dustWorld(position);
  float dist = length(world - uCamPos);
  world -= uVelocity * aEnd;
  vec4 mv = viewMatrix * vec4(world, 1.0);
  vAlpha = smoothstep(uBox * 0.5, uBox * 0.2, dist) * (1.0 - aEnd) * smoothstep(0.5, 3.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

export const streakFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
void main() {
  gl_FragColor = vec4(uColor * vAlpha * uOpacity, 1.0);
  ${output}
}
`;

// Instanced camera-facing cloud puffs for nebulae and volumetric haze.
export const nebulaVertex = /* glsl */ `
attribute vec3 aOffset;
attribute float aScale;
attribute vec3 aColor;
attribute float aRot;
attribute float aSeed;
uniform float uTime;
uniform float uNear;
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vSeed;
void main() {
  vec3 center = aOffset + vec3(sin(uTime * 0.03 + aSeed * 6.28), cos(uTime * 0.025 + aSeed * 4.0), 0.0) * aScale * 0.04;
  vec4 mv = modelViewMatrix * vec4(center, 1.0);
  float rot = aRot + uTime * 0.012 * (aSeed - 0.5);
  float c = cos(rot), s = sin(rot);
  mv.xy += mat2(c, s, -s, c) * position.xy * aScale;
  float depth = -mv.z;
  // Dissolve as the camera enters a cloud; volumetric feel without raymarching.
  vAlpha = smoothstep(uNear, uNear + aScale * 0.9, depth);
  vUv = uv;
  vColor = aColor;
  vSeed = aSeed;
  gl_Position = projectionMatrix * mv;
}
`;

export const nebulaFragment = /* glsl */ `
uniform sampler2D uMap;
uniform float uTime;
uniform float uIntensity;
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vSeed;
vec2 rotateUv(vec2 uv, float a) {
  float c = cos(a), s = sin(a);
  uv -= 0.5;
  return mat2(c, s, -s, c) * uv + 0.5;
}
void main() {
  // Two counter-rotating samples of the same puff blended over time give
  // slow, organic churning.
  float t = uTime * 0.02 + vSeed * 10.0;
  float a = texture2D(uMap, rotateUv(vUv, t)).r;
  float b = texture2D(uMap, rotateUv(vUv, -t * 0.7 + 1.7)).r;
  float density = mix(a, b, 0.5 + 0.5 * sin(t * 1.3)) * a * 1.6;
  gl_FragColor = vec4(vColor * density * vAlpha * uIntensity, 1.0);
  ${output}
}
`;
