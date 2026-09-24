import { noise } from './noise';
import { output } from './common';

// Plasma surface: two layers of domain-warped fBm scrolling at different
// speeds read as convection cells. Output is HDR (>1) so Bloom picks it up.
export const starVertex = /* glsl */ `
varying vec3 vObj;
varying vec3 vNormalV;
varying vec3 vViewDir;
void main() {
  vObj = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

export const starFragment = /* glsl */ `
#define FBM_OCTAVES 4
uniform float uTime;
uniform float uRadius;
uniform vec3 uCool;
uniform vec3 uHot;
uniform vec3 uCore;
uniform float uIntensity;
varying vec3 vObj;
varying vec3 vNormalV;
varying vec3 vViewDir;
${noise}
void main() {
  vec3 p = normalize(vObj);
  float warp = fbm(p * 2.4 + vec3(0.0, uTime * 0.035, 0.0));
  float cells = fbm(p * 5.5 + warp * 1.4 - vec3(uTime * 0.05));
  float heat = clamp(0.55 + cells * 0.9 + warp * 0.25, 0.0, 1.0);

  vec3 col = mix(uCool, uHot, smoothstep(0.2, 0.75, heat));
  col = mix(col, uCore, smoothstep(0.7, 1.0, heat));

  float facing = max(dot(vNormalV, vViewDir), 0.0);
  // Limb brightening reads as a glowing corona once bloom is applied.
  float limb = pow(1.0 - facing, 2.5);
  col += uHot * limb * 1.6;

  gl_FragColor = vec4(col * uIntensity, 1.0);
  ${output}
}
`;

// Camera-facing glow quad around a star; additive, depth-tested against
// planets so bodies in front occlude it.
export const coronaVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const coronaFragment = /* glsl */ `
#define FBM_OCTAVES 3
uniform float uTime;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uCoreSize;
varying vec2 vUv;
${noise}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float d = length(p);
  float angle = atan(p.y, p.x);
  // Rays: noise sampled on a circle (cos/sin) has no seam at ±π.
  float rays = fbm(vec3(cos(angle) * 2.5, sin(angle) * 2.5, d * 1.5 - uTime * 0.08));
  float r = max(d - uCoreSize, 0.0) / (1.0 - uCoreSize);
  float glow = exp(-r * 5.0) * 0.9 + exp(-r * 14.0) * 1.2;
  glow *= 0.75 + rays * 0.6;
  glow *= smoothstep(1.0, 0.6, d);
  gl_FragColor = vec4(uColor * glow * uIntensity, 1.0);
  ${output}
}
`;

// Short-lived particles boiling off the surface, fully animated on the GPU.
export const flareParticlesVertex = /* glsl */ `
attribute vec3 aDir;
attribute float aSeed;
uniform float uTime;
uniform float uRadius;
uniform float uPixelRatio;
varying float vLife;
void main() {
  float speed = 0.6 + fract(aSeed * 13.7) * 1.4;
  float life = fract(uTime * 0.06 * speed + aSeed);
  vLife = life;
  // Slight curl so particles arc like prominences instead of flying straight.
  vec3 tangent = normalize(cross(aDir, vec3(0.0, 1.0, 0.0)) + 0.0001);
  vec3 pos = aDir * (uRadius * (1.0 + life * 0.9)) + tangent * sin(life * 3.14159) * uRadius * 0.12;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = min((0.8 + fract(aSeed * 7.1) * 1.8) * uPixelRatio * (120.0 / -mv.z), 9.0 * uPixelRatio);
  gl_Position = projectionMatrix * mv;
}
`;

export const flareParticlesFragment = /* glsl */ `
uniform vec3 uColor;
varying float vLife;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * (1.0 - vLife) * smoothstep(0.0, 0.08, vLife);
  gl_FragColor = vec4(uColor * a * 2.2, 1.0);
  ${output}
}
`;
