import { noise } from './noise';
import { output } from './common';

export const localVertex = /* glsl */ `
varying vec2 vLocal;
void main() {
  vLocal = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Accretion disc: turbulent gas on differential rotation (inner orbits are
// faster), white-hot at the inner edge cooling to deep red. One side is
// brighter than the other — relativistic beaming of the gas moving toward us.
export const diskFragment = /* glsl */ `
#define FBM_OCTAVES 4
uniform float uTime;
uniform float uIntensity;
uniform float uInner;
uniform float uOuter;
uniform float uBeaming;
uniform vec3 uHot;
uniform vec3 uWarm;
uniform vec3 uCool;
varying vec2 vLocal;
${noise}
void main() {
  float r = length(vLocal);
  float t = (r - uInner) / (uOuter - uInner);
  if (t < 0.0 || t > 1.0) discard;
  float angle = atan(vLocal.y, vLocal.x);
  float spin = uTime * (0.9 / (0.35 + t * 2.2));
  float a = angle + spin;
  float gas = fbm(vec3(cos(a) * 2.4, sin(a) * 2.4, t * 9.0 - uTime * 0.15));
  float streaks = 0.55 + smoothstep(-0.35, 0.85, gas) * 0.9;
  float density = pow(1.0 - t, 1.6) * smoothstep(0.0, 0.05, t) * streaks;
  vec3 col = mix(uHot, uWarm, smoothstep(0.0, 0.35, t));
  col = mix(col, uCool, smoothstep(0.35, 1.0, t));
  float beam = 1.0 + uBeaming * sin(angle);
  gl_FragColor = vec4(col * density * beam * 2.6 * uIntensity, 1.0);
  ${output}
}
`;

// The far side of the disc, bent over and under the shadow by gravity. Drawn
// as a camera-facing ring, brightest above and below the hole.
export const haloFragment = /* glsl */ `
#define FBM_OCTAVES 3
uniform float uTime;
uniform float uIntensity;
uniform float uInner;
uniform float uOuter;
uniform vec3 uHot;
uniform vec3 uWarm;
varying vec2 vLocal;
${noise}
void main() {
  float r = length(vLocal);
  float t = (r - uInner) / (uOuter - uInner);
  if (t < 0.0 || t > 1.0) discard;
  float angle = atan(vLocal.y, vLocal.x);
  float arcs = pow(abs(sin(angle)), 1.6);
  float gas = fbm(vec3(cos(angle + uTime * 0.4) * 3.0, sin(angle + uTime * 0.4) * 3.0, t * 5.0));
  float density = pow(1.0 - t, 2.4) * smoothstep(0.0, 0.08, t) * (0.6 + smoothstep(-0.3, 0.8, gas) * 0.7);
  vec3 col = mix(uHot, uWarm, t);
  gl_FragColor = vec4(col * density * (0.25 + arcs) * 2.2 * uIntensity, 1.0);
  ${output}
}
`;

// Photon ring: the thin, razor-bright circle of light orbiting the shadow.
export const photonRingFragment = /* glsl */ `
uniform float uRadius;
uniform float uWidth;
uniform float uIntensity;
uniform vec3 uColor;
varying vec2 vLocal;
void main() {
  float d = (length(vLocal) - uRadius) / uWidth;
  float g = exp(-d * d * 2.5) + exp(-abs(d) * 1.2) * 0.25;
  gl_FragColor = vec4(uColor * g * uIntensity, 1.0);
  ${output}
}
`;

// Gas spiralling in along the disc plane until it crosses the horizon.
export const inflowVertex = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uRadius;
uniform float uPixelRatio;
varying float vLife;
void main() {
  float speed = 0.04 + fract(aSeed * 11.3) * 0.05;
  float life = fract(uTime * speed + aSeed);
  vLife = life;
  float r = mix(uRadius * 4.6, uRadius * 0.9, pow(life, 0.7));
  float angle = aSeed * 6.28318 * 7.0 + life * 12.0;
  vec3 pos = vec3(cos(angle) * r, sin(angle) * r, (fract(aSeed * 3.7) - 0.5) * uRadius * 0.12);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = (1.0 + fract(aSeed * 5.3) * 2.0) * uPixelRatio * (160.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

export const inflowFragment = /* glsl */ `
uniform vec3 uColor;
varying float vLife;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * smoothstep(0.0, 0.15, vLife) * smoothstep(1.0, 0.85, vLife);
  gl_FragColor = vec4(uColor * a * (1.0 + vLife * 2.0), 1.0);
  ${output}
}
`;
