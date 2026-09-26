import { output } from './common';

// Plain camera-facing quad with UVs (lens-flare ghosts).
export const quadVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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
