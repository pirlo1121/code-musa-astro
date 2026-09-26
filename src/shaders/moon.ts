import { noise } from './noise';
import { output } from './common';

// Procedural Moon. Everything is computed in object space so the surface
// rotates with the mesh while the sunlight (uLightObj) stays fixed in the
// world — the CPU re-expresses the light and the camera in object space
// every frame.

export const moonVertex = /* glsl */ `
varying vec3 vObj;
void main() {
  vObj = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const moonFragment = /* glsl */ `
#define FBM_OCTAVES 4
#ifndef CRATER_OCTAVES
#define CRATER_OCTAVES 4
#endif
uniform float uTime;
uniform vec3 uLightObj;
uniform vec3 uCamObj;
uniform float uSun;
uniform float uBump;
uniform vec3 uEarthshine;
uniform vec3 uCityColor;
varying vec3 vObj;
${noise}

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

// One octave of craters on a jittered 3D grid. Returns (height, fresh ejecta)
// and the analytic height gradient, so the relief is shaded smoothly without
// screen-space derivatives.
vec2 craterLayer(vec3 p, float scale, float seed, out vec3 grad) {
  vec3 q = p * scale;
  vec3 i = floor(q);
  vec3 f = fract(q);
  vec2 acc = vec2(0.0);
  grad = vec3(0.0);
  for (int x = -1; x <= 1; x++)
  for (int y = -1; y <= 1; y++)
  for (int z = -1; z <= 1; z++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 cell = i + g + seed;
    if (hash13(cell * 1.7) < 0.35) continue;
    vec3 c = g + 0.15 + 0.7 * hash33(cell);
    float r = mix(0.16, 0.44, hash13(cell * 3.1));
    vec3 toP = f - c;
    float len = length(toP);
    float d = len / r;
    if (d > 1.8) continue;
    float inside = step(d, 1.0);
    float bowl = inside * (d * d - 1.0);
    float rim = exp(-(d - 1.0) * (d - 1.0) * 14.0) * 0.45;
    float hasPeak = step(0.6, hash13(cell * 5.3));
    float peak = exp(-d * d * 60.0) * 0.35 * hasPeak;
    float slope = inside * 2.0 * d - rim * 28.0 * (d - 1.0) - peak * 120.0 * d;
    float age = hash13(cell * 7.9);
    acc.x += (bowl + rim + peak) * r;
    grad += slope * toP / max(len, 1e-4) * scale;
    acc.y += smoothstep(0.75, 1.0, age) * exp(-max(d - 0.9, 0.0) * 3.0) * smoothstep(1.8, 1.0, d);
  }
  return acc;
}

// Bright ray system of a young crater centred on direction c.
float rays(vec3 n, vec3 c, float spread, float seed) {
  float cosA = dot(n, c);
  if (cosA < 0.2) return 0.0;
  vec3 t = normalize(cross(c, vec3(0.3, 1.0, 0.1)));
  vec3 b = cross(c, t);
  vec3 dir = n - c * cosA;
  float az = atan(dot(dir, b), dot(dir, t));
  float ang = acos(clamp(cosA, -1.0, 1.0));
  float streaks = pow(max(snoise(vec3(cos(az) * 9.0, sin(az) * 9.0, seed)), 0.0), 2.0);
  streaks *= 0.6 + 0.4 * snoise(vec3(az * 3.0, ang * 12.0, seed));
  return streaks * exp(-ang * spread) * smoothstep(0.02, 0.06, ang);
}

vec3 surface(vec3 n, float footprint, out float height, out vec3 slopeSum) {
  // Maria: large dark basalt plains.
  float mare = smoothstep(0.05, 0.35, fbm(n * 1.3 + vec3(3.1, 0.0, 1.7)));

  float h = 0.0;
  slopeSum = vec3(0.0);
  float fresh = 0.0;
  float amp = 0.12;
  float scale = 2.6;
  for (int k = 0; k < CRATER_OCTAVES; k++) {
    // Anti-aliasing: fade out crater octaves smaller than a few pixels.
    float lod = smoothstep(3.0, 9.0, (1.0 / scale) / footprint);
    if (lod <= 0.0) break;
    vec3 g;
    vec2 c = craterLayer(n, scale, float(k) * 13.0, g) * lod;
    float weight = amp * mix(1.0, 0.4, mare);
    h += c.x * weight;
    slopeSum += g * lod * weight;
    fresh += c.y * amp * 6.0;
    amp *= 0.46;
    scale *= 2.15;
  }
  height = h;

  float albedo = mix(0.64, 0.3, mare);
  albedo *= 0.88 + 0.24 * fbm(n * 14.0);
  albedo += fresh * 0.22;
  albedo += rays(n, normalize(vec3(-0.25, -0.6, 0.76)), 5.0, 1.0) * 0.35;
  albedo += rays(n, normalize(vec3(0.55, 0.45, 0.7)), 7.0, 5.0) * 0.25;
  vec3 tint = mix(vec3(1.0, 0.98, 0.95), vec3(0.9, 0.93, 1.0), mare);
  tint = mix(tint, vec3(1.0, 0.94, 0.86), smoothstep(0.2, 0.6, snoise(n * 2.2 + 9.0)) * 0.3);
  return tint * albedo;
}

void main() {
  vec3 n = normalize(vObj);
  float footprint = max(length(fwidth(n)), 1e-5);
  float h;
  vec3 slope;
  vec3 albedo = surface(n, footprint, h, slope);
  vec3 nb = normalize(n - uBump * (slope - n * dot(slope, n)));

  vec3 L = normalize(uLightObj);
  vec3 V = normalize(uCamObj - vObj);
  // Bumps shade the surface but never light up the night side on their own.
  float mu0 = max(mix(dot(n, L), dot(nb, L), 0.8), 0.0);
  float mu = max(dot(nb, V), 0.001);
  // The Moon is not a Lambert sphere: Lommel–Seeliger keeps the full disc
  // evenly bright, Lambert adds relief near the terminator.
  float ls = 2.0 * mu0 / (mu0 + mu);
  float diffuse = mix(mu0, ls, 0.55);
  float phase = acos(clamp(dot(L, V), -1.0, 1.0));
  diffuse *= 1.0 + 0.25 * exp(-phase * 6.0);
  float day = smoothstep(-0.03, 0.12, dot(n, L));

  vec3 col = albedo * (diffuse * uSun + 0.035) * day;
  col += albedo * uEarthshine * (1.0 - day);

  // Lunar bases: clusters of warm lights on the night side.
  float cluster = smoothstep(0.45, 0.75, snoise(n * 2.4 + 4.0));
  vec3 cellP = n * 160.0;
  float spark = step(0.965, hash13(floor(cellP)));
  float dotMask = smoothstep(0.35, 0.0, length(fract(cellP) - 0.5));
  float flicker = 0.75 + 0.25 * sin(uTime * (2.0 + hash13(floor(cellP) + 3.0) * 4.0) + hash13(floor(cellP)) * 40.0);
  col += uCityColor * cluster * spark * dotMask * flicker * smoothstep(0.1, -0.1, dot(n, L)) * 3.0;

  gl_FragColor = vec4(col, 1.0);
  ${output}
}
`;

// Soft glow around the disc, stronger on the sunlit side.
export const moonHaloVertex = /* glsl */ `
varying vec2 vLocal;
void main() {
  vLocal = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const moonHaloFragment = /* glsl */ `
uniform float uRadius;
uniform float uIntensity;
uniform vec3 uColor;
uniform vec2 uLightDir;
varying vec2 vLocal;
void main() {
  float r = length(vLocal) / uRadius;
  if (r < 0.98) discard;
  float glow = exp(-(r - 1.0) * 3.2) * 0.8 + exp(-(r - 1.0) * 14.0) * 0.6;
  float side = 0.55 + 0.45 * dot(normalize(vLocal), uLightDir);
  // Faint 22° halo ring far out, like moonlight through high cirrus.
  float ring = exp(-pow((r - 2.6) * 7.0, 2.0)) * 0.12;
  gl_FragColor = vec4(uColor * (glow * side + ring) * uIntensity, 1.0);
  ${output}
}
`;

// Orbit line with a bright comet-like trail behind the satellite.
export const orbitVertex = /* glsl */ `
attribute float aAngle;
varying float vAngle;
void main() {
  vAngle = aAngle;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const orbitFragment = /* glsl */ `
uniform float uHead;
uniform float uDir;
uniform vec3 uColor;
uniform float uIntensity;
varying float vAngle;
void main() {
  float behind = fract(uDir * (uHead - vAngle) / 6.28318530718);
  float trail = pow(1.0 - behind, 6.0);
  gl_FragColor = vec4(uColor * (0.07 + trail * 1.6) * uIntensity, 1.0);
  ${output}
}
`;
