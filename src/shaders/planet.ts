import { noise } from './noise';
import { output } from './common';

// One shader, three planet families (rocky / gas giant / ocean world),
// parameterised by palette and seed so every skill and project gets a
// unique body without loading a single texture.

export const planetVertex = /* glsl */ `
varying vec3 vObj;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
void main() {
  vObj = position;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const planetFragment = /* glsl */ `
#define FBM_OCTAVES 5
uniform float uTime;
uniform float uSeed;
uniform int uKind;          // 0 rocky, 1 gas, 2 ocean
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform vec3 uAtmosphere;
uniform vec3 uLightPos;
uniform float uActive;
varying vec3 vObj;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
${noise}
void main() {
  vec3 p = normalize(vObj);
  vec3 seed = vec3(uSeed * 7.13, uSeed * 3.71, uSeed * 1.93);
  vec3 col;
  float night = 0.0;

  if (uKind == 1) {
    // Gas giant: latitude bands distorted by slow turbulent flow.
    float flow = fbm(p * vec3(1.5, 6.0, 1.5) + seed + vec3(uTime * 0.015, 0.0, 0.0));
    float bands = sin((p.y * 7.0 + flow * 1.6) * 3.14159) * 0.5 + 0.5;
    col = mix(uColorA, uColorB, bands);
    float storms = smoothstep(0.35, 0.75, fbm(p * 3.0 + seed * 2.0));
    col = mix(col, uColorC, storms * 0.7);
  } else if (uKind == 2) {
    // Ocean world: continents, ice caps and drifting clouds.
    float h = fbm(p * 2.2 + seed);
    col = mix(uColorA, uColorA * 1.6, smoothstep(-0.4, 0.1, h));
    float land = smoothstep(0.08, 0.14, h);
    col = mix(col, uColorB, land);
    col = mix(col, uColorC, smoothstep(0.75, 0.9, abs(p.y)));
    float clouds = smoothstep(0.1, 0.6, fbm(p * 4.0 + seed + vec3(uTime * 0.02, 0.0, uTime * 0.01)));
    col = mix(col, vec3(1.0), clouds * 0.55);
    night = land * (1.0 - clouds);
  } else {
    // Rocky: ridged terrain, craters implied by sharp noise contrast.
    float h = fbm(p * 3.0 + seed);
    float ridges = 1.0 - abs(snoise(p * 7.0 + seed));
    col = mix(uColorA, uColorB, smoothstep(-0.3, 0.35, h));
    col = mix(col, uColorC, pow(ridges, 6.0) * 0.8);
    night = smoothstep(0.2, 0.4, h) * 0.6;
  }

  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(uLightPos - vWorldPos);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float ndl = dot(N, L);
  float wrap = smoothstep(-0.2, 1.0, ndl);
  vec3 lit = col * (0.035 + wrap * 1.15);

  // City-light speckles on the dark side hint that these worlds are "alive".
  float lights = step(0.82, snoise(p * 60.0 + seed)) * night * smoothstep(0.1, -0.25, ndl);
  lit += uAtmosphere * lights * 1.5;

  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  lit += uAtmosphere * rim * (0.25 + wrap * 0.9) * (1.0 + uActive * 1.5);

  gl_FragColor = vec4(lit, 1.0);
  ${output}
}
`;

// Back-faced shell: the classic Fresnel atmosphere halo.
export const atmosphereVertex = /* glsl */ `
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const atmosphereFragment = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uLightPos;
uniform float uIntensity;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 L = normalize(uLightPos - vWorldPos);
  // Back faces: −N·V is ~0.5 where the shell meets the planet's silhouette and
  // 0 at the shell's outer edge, giving a halo that fades away from the body.
  float x = clamp(-dot(N, V), 0.0, 1.0);
  float fres = pow(smoothstep(0.0, 0.55, x), 1.6);
  float day = smoothstep(-0.35, 0.5, dot(N, L));
  gl_FragColor = vec4(uColor * fres * (0.15 + day) * uIntensity, 1.0);
  ${output}
}
`;

// Planetary rings: radial bands with gaps, lit side brighter.
export const ringVertex = /* glsl */ `
varying vec2 vLocal;
void main() {
  vLocal = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const ringFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uInner;
uniform float uOuter;
uniform float uSeed;
varying vec2 vLocal;
float hash(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  float r = (length(vLocal) - uInner) / (uOuter - uInner);
  if (r < 0.0 || r > 1.0) discard;
  float bands = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float freq = 8.0 + hash(fi + uSeed) * 40.0;
    bands += sin(r * freq + hash(fi * 3.1 + uSeed) * 6.28) * 0.5 + 0.5;
  }
  bands /= 6.0;
  float a = smoothstep(0.0, 0.08, r) * smoothstep(1.0, 0.85, r) * mix(0.25, 1.0, bands);
  gl_FragColor = vec4(uColor * (0.55 + bands * 0.6), a * 0.85);
  ${output}
}
`;

// Level indicator: an arc that sweeps to the skill's percentage.
export const levelRingFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uProgress;
uniform float uOpacity;
uniform float uTime;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float angle = atan(p.x, p.y);                     // 0 at 12 o'clock, clockwise
  float t = fract(angle / 6.28318 + 1.0);
  float band = smoothstep(0.86, 0.88, r) * smoothstep(0.96, 0.94, r);
  float track = band * 0.12;
  float fill = band * step(t, uProgress);
  float head = band * smoothstep(0.02, 0.0, abs(t - uProgress)) * 2.0;
  // Fine tick marks every 10%.
  float ticks = smoothstep(0.97, 0.975, r) * smoothstep(1.0, 0.99, r) * step(0.985, fract(t * 10.0 + 0.0075));
  float a = (track + fill * (0.7 + 0.3 * sin(uTime * 3.0 - t * 20.0)) + head + ticks * 0.5) * uOpacity;
  gl_FragColor = vec4(uColor * a * 1.6, a);
  ${output}
}
`;

export const quadVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
