import { noise } from './noise';
import { output } from './common';

// Tunnel: an open cone behind the portal. Energy filaments are 3D noise
// sampled on (cos θ, sin θ, depth) — seamless around the circumference —
// twisted with depth and scrolled toward the viewer.
export const tunnelVertex = /* glsl */ `
uniform float uLength;
varying float vDepth;
varying float vAngle;
void main() {
  vDepth = clamp(-position.z / uLength, 0.0, 1.0);
  vAngle = atan(position.y, position.x);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const tunnelFragment = /* glsl */ `
#define FBM_OCTAVES 4
uniform float uTime;
uniform float uIntensity;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
varying float vDepth;
varying float vAngle;
${noise}
void main() {
  float a = vAngle + vDepth * 7.0 + uTime * 0.35;
  vec3 q = vec3(cos(a) * 1.6, sin(a) * 1.6, vDepth * 10.0 - uTime * 0.9);
  float n = fbm(q);
  float filaments = pow(smoothstep(-0.1, 0.8, n), 3.0);
  vec3 col = mix(uColorA, uColorB, vDepth) * (0.15 + filaments * 2.2);
  col += uColorC * pow(vDepth, 5.0) * 3.5;
  float mouth = smoothstep(0.0, 0.06, vDepth);
  gl_FragColor = vec4(col * mouth * uIntensity, 1.0);
  ${output}
}
`;

// Accretion swirl: logarithmic spiral arms rotating around the portal.
export const diskFragment = /* glsl */ `
#define FBM_OCTAVES 4
uniform float uTime;
uniform float uIntensity;
uniform float uInner;
uniform float uOuter;
uniform vec3 uColorA;
uniform vec3 uColorB;
varying vec2 vLocal;
${noise}
void main() {
  float r = length(vLocal);
  float t = (r - uInner) / (uOuter - uInner);
  if (t < 0.0 || t > 1.0) discard;
  float angle = atan(vLocal.y, vLocal.x);
  float spiral = angle + log(r) * 3.2 - uTime * 0.5;
  float arms = fbm(vec3(cos(spiral) * 2.0, sin(spiral) * 2.0, t * 3.0 - uTime * 0.2));
  float density = smoothstep(-0.2, 0.9, arms) * pow(1.0 - t, 2.2) * smoothstep(0.0, 0.06, t);
  vec3 col = mix(uColorA, uColorB, t) * density * 2.4;
  gl_FragColor = vec4(col * uIntensity, 1.0);
  ${output}
}
`;

export const localVertex = /* glsl */ `
varying vec2 vLocal;
void main() {
  vLocal = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Energy rim of the portal: flickering, HDR bright for bloom.
export const rimVertex = /* glsl */ `
varying vec3 vObj;
void main() {
  vObj = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const rimFragment = /* glsl */ `
#define FBM_OCTAVES 3
uniform float uTime;
uniform float uIntensity;
uniform vec3 uColor;
varying vec3 vObj;
${noise}
void main() {
  float angle = atan(vObj.y, vObj.x);
  float n = fbm(vec3(cos(angle) * 3.0, sin(angle) * 3.0, uTime * 0.6));
  float energy = 0.8 + smoothstep(-0.3, 0.7, n) * 2.2;
  gl_FragColor = vec4(uColor * energy * uIntensity, 1.0);
  ${output}
}
`;

// Faint glow filling the mouth, brightest at the rim.
export const horizonFragment = /* glsl */ `
uniform float uRadius;
uniform float uIntensity;
uniform vec3 uColor;
varying vec2 vLocal;
void main() {
  float t = length(vLocal) / uRadius;
  float g = pow(smoothstep(0.35, 1.0, t), 3.0);
  gl_FragColor = vec4(uColor * g * uIntensity, 1.0);
  ${output}
}
`;

// Particles spiralling into the portal.
export const inflowVertex = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uRadius;
uniform float uPixelRatio;
varying float vLife;
void main() {
  float speed = 0.05 + fract(aSeed * 11.3) * 0.06;
  float life = fract(uTime * speed + aSeed);
  vLife = life;
  float r = mix(uRadius * 3.2, uRadius * 0.2, pow(life, 0.8));
  float angle = aSeed * 6.28318 * 7.0 + life * 9.0;
  vec3 pos = vec3(cos(angle) * r, sin(angle) * r, -pow(life, 3.0) * uRadius * 2.5 + (fract(aSeed * 3.7) - 0.5) * 3.0);
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
  float a = smoothstep(0.5, 0.0, d) * smoothstep(0.0, 0.15, vLife) * smoothstep(1.0, 0.7, vLife);
  gl_FragColor = vec4(uColor * a * 2.0, 1.0);
  ${output}
}
`;
