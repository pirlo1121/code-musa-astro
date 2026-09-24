// One custom post effect for everything that re-samples the frame:
//  - gravitational lensing around the black hole (lens equation, β = θ − θE²/θ)
//  - speed-driven radial blur + chromatic aberration (the "motion blur":
//    a per-object velocity buffer would cost far more for the same read
//    during forward flight)
//  - an analytic lens flare (ghosts + anamorphic streak) from the key light
// Merging them keeps a single convolution effect in the chain, so the
// composer can still fuse everything into one EffectPass.

import { BlendFunction, Effect, EffectAttribute } from 'postprocessing';
import { Uniform, Vector3 } from 'three';

const fragmentShader = /* glsl */ `
uniform float uWarp;
uniform vec3 uHole;        // xy: centre in uv, z: horizon radius (uv.y units), 0 = off
uniform float uLens;       // Einstein radius / horizon radius
uniform vec3 uFlare;       // xy: source in uv, z: intensity
uniform float uAspect;

vec2 lensUv(vec2 uv) {
  if (uHole.z <= 0.0) return uv;
  vec2 d = uv - uHole.xy;
  d.x *= uAspect;
  float r = length(d);
  float rs = uHole.z;
  float thetaE = rs * uLens;
  // Deflection falls off smoothly so the far field is untouched
  float falloff = 1.0 - smoothstep(rs * 4.0, rs * 9.0, r);
  float beta = r - (thetaE * thetaE / max(r, 1e-4)) * falloff;
  vec2 src = d / max(r, 1e-4) * beta;
  src.x /= uAspect;
  return uHole.xy + src;
}

vec3 sampleScene(vec2 uv, float ca) {
  vec2 dir = uv - 0.5;
  return vec3(
    texture2D(inputBuffer, uv + dir * ca).r,
    texture2D(inputBuffer, uv).g,
    texture2D(inputBuffer, uv - dir * ca).b
  );
}

vec3 flare(vec2 uv) {
  vec2 src = uFlare.xy;
  vec2 axis = vec2(0.5) - src;
  vec3 f = vec3(0.0);
  vec2 asp = vec2(uAspect, 1.0);
  // Ghosts along the axis through the screen centre: small and faint
  f += vec3(0.25, 0.5, 1.0) * smoothstep(0.03, 0.0, length((uv - (src + axis * 0.7)) * asp)) * 0.12;
  f += vec3(1.0, 0.6, 0.3) * smoothstep(0.016, 0.009, length((uv - (src + axis * 1.25)) * asp)) * 0.18;
  f += vec3(0.4, 1.0, 0.6) * smoothstep(0.045, 0.03, length((uv - (src + axis * 1.6)) * asp)) * 0.06;
  f += vec3(0.7, 0.4, 1.0) * smoothstep(0.022, 0.0, length((uv - (src + axis * 2.1)) * asp)) * 0.1;
  // Anamorphic streak + soft halo at the source
  vec2 d = (uv - src) * asp;
  f += vec3(0.45, 0.65, 1.0) * exp(-abs(d.y) * 420.0) * exp(-abs(d.x) * 4.5) * 0.55;
  f += vec3(1.0, 0.85, 0.7) * exp(-length(d) * 10.0) * 0.3;
  return f * uFlare.z;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 luv = lensUv(uv);
  vec3 col;

  if (uWarp > 0.01) {
    // Radial blur towards the centre, with chromatic fringes that grow with speed
    vec2 dir = luv - 0.5;
    float ca = uWarp * 0.006;
    col = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      float t = float(i) / 7.0;
      col += sampleScene(luv - dir * uWarp * 0.05 * t, ca);
    }
    col /= 8.0;
  } else if (uHole.z > 0.0) {
    col = texture2D(inputBuffer, luv).rgb;
  } else {
    col = inputColor.rgb;
  }

  // Shadow: nothing inside the horizon survives the lensing
  if (uHole.z > 0.0) {
    vec2 d = (uv - uHole.xy) * vec2(uAspect, 1.0);
    col *= smoothstep(uHole.z * 0.98, uHole.z * 1.05, length(d));
  }

  if (uFlare.z > 0.001) col += flare(uv);

  outputColor = vec4(col, inputColor.a);
}
`;

export class CinematicEffect extends Effect {
  constructor() {
    super('CinematicEffect', fragmentShader, {
      blendFunction: BlendFunction.SET,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ['uWarp', new Uniform(0)],
        ['uHole', new Uniform(new Vector3())],
        ['uLens', new Uniform(1.0)],
        ['uFlare', new Uniform(new Vector3())],
        ['uAspect', new Uniform(1)],
      ]),
    });
  }

  get warp() {
    return this.uniforms.get('uWarp')!;
  }
  get hole() {
    return this.uniforms.get('uHole')! as Uniform<Vector3>;
  }
  get flare() {
    return this.uniforms.get('uFlare')! as Uniform<Vector3>;
  }
  get aspect() {
    return this.uniforms.get('uAspect')!;
  }
}
