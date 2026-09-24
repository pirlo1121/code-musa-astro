import { output } from './common';

// Holographic projector panel showing a project screenshot next to its
// planet. The reveal wipes top-to-bottom with a bright scan front, then
// settles into subtle scanlines and edge glow.
export const hologramFragment = /* glsl */ `
uniform sampler2D uMap;
uniform float uHasMap;
uniform float uTime;
uniform float uReveal;
uniform float uOpacity;
uniform vec3 uTint;
varying vec2 vUv;
float hash(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  vec2 uv = vUv;
  // Row glitch that fades out as the reveal completes.
  float row = floor(uv.y * 48.0);
  float glitch = step(0.93, hash(row + floor(uTime * 12.0))) * (1.0 - uReveal) * 0.04;
  uv.x += glitch;

  vec3 tex = uHasMap > 0.5 ? texture2D(uMap, uv).rgb : uTint * 0.15;
  float scan = 0.9 + 0.1 * sin(uv.y * 320.0 - uTime * 6.0);
  vec3 col = mix(tex, tex * uTint * 1.4, 0.18) * scan;

  vec2 e = min(vUv, 1.0 - vUv);
  float edge = smoothstep(0.012, 0.0, min(e.x, e.y));
  float corner = step(min(e.x, e.y), 0.02) * step(max(e.x, e.y), 0.08);
  col += uTint * (edge * 1.2 + corner * 2.0);

  float fromTop = 1.0 - vUv.y;
  float visible = step(fromTop, uReveal);
  float line = smoothstep(0.02, 0.0, abs(fromTop - uReveal)) * step(0.001, uReveal) * step(uReveal, 0.999);
  col += uTint * line * 3.0;

  float alpha = uOpacity * max(visible * 0.94, line);
  gl_FragColor = vec4(col, alpha);
  ${output}
}
`;

// Lens-flare ghosts: disc, ring or anamorphic streak drawn procedurally.
export const flareFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform int uShape;   // 0 soft disc, 1 ring, 2 streak, 3 hexagon
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float a;
  if (uShape == 1) {
    float r = length(p);
    a = smoothstep(0.75, 0.9, r) * smoothstep(1.0, 0.9, r);
  } else if (uShape == 2) {
    a = exp(-abs(p.y) * 18.0) * pow(1.0 - min(abs(p.x), 1.0), 2.0);
  } else if (uShape == 3) {
    vec2 q = abs(p);
    float hex = max(q.x * 0.866 + q.y * 0.5, q.y);
    a = smoothstep(1.0, 0.8, hex) * 0.6 + smoothstep(1.0, 0.95, hex) * 0.4 * step(0.9, hex);
  } else {
    a = pow(max(1.0 - length(p), 0.0), 2.5);
  }
  gl_FragColor = vec4(uColor * a * uOpacity, 1.0);
  ${output}
}
`;
