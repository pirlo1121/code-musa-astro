import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Bloom, ChromaticAberration, DepthOfField, EffectComposer, Noise, ToneMapping, Vignette,
} from '@react-three/postprocessing';
import { BlendFunction, DepthOfFieldEffect, Effect, ToneMappingMode } from 'postprocessing';
import { MathUtils, PerspectiveCamera, Uniform, Vector2, Vector3 } from 'three';
import { sceneRefs } from '../../lib/scene-refs';
import { stationDistance } from '../../lib/store';
import { PORTAL, STATIONS } from '../../scenes/layout';

// Gravitational lensing around the wormhole: a pure UV displacement merged
// into the effect pass, so it costs one texture lookup, not an extra pass.
const lensingShader = /* glsl */ `
uniform vec2 uCenter;
uniform float uRadius;
uniform float uStrength;
uniform float uAspect;
void mainUv(inout vec2 uv) {
  vec2 d = uv - uCenter;
  d.x *= uAspect;
  float r = length(d);
  float mask = smoothstep(uRadius * 0.7, uRadius * 1.15, r) * smoothstep(uRadius * 5.0, uRadius * 1.5, r);
  float bend = uStrength * uRadius * uRadius / max(r, uRadius * 0.5);
  vec2 offset = (d / max(r, 1e-4)) * bend * mask;
  offset.x /= uAspect;
  uv -= offset;
}
`;

class LensingEffect extends Effect {
  constructor() {
    super('LensingEffect', lensingShader, {
      uniforms: new Map<string, Uniform>([
        ['uCenter', new Uniform(new Vector2(0.5, 0.5))],
        ['uRadius', new Uniform(0.1)],
        ['uStrength', new Uniform(0)],
        ['uAspect', new Uniform(1)],
      ]),
    });
  }
}

const WORMHOLE = 5;

export default function Effects({ depthOfField }: { depthOfField: boolean }) {
  const lensing = useMemo(() => new LensingEffect(), []);
  const dof = useRef<DepthOfFieldEffect>(null);
  const tmp = useMemo(() => ({ center: new Vector3(), edge: new Vector3(), right: new Vector3() }), []);

  useEffect(() => () => lensing.dispose(), [lensing]);

  useFrame(({ camera, size }) => {
    const cam = camera as PerspectiveCamera;
    dof.current?.target?.copy(sceneRefs.focusPoint);

    const uniforms = lensing.uniforms;
    const proximity = 1 - MathUtils.smoothstep(stationDistance(WORMHOLE), 0.3, 1.2);
    tmp.center.copy(STATIONS[WORMHOLE].center).project(cam);
    const inFront = tmp.center.z < 1 && tmp.center.z > -1;
    if (proximity <= 0 || !inFront) {
      uniforms.get('uStrength')!.value = 0;
      return;
    }
    tmp.right.setFromMatrixColumn(cam.matrixWorld, 0);
    tmp.edge.copy(STATIONS[WORMHOLE].center).addScaledVector(tmp.right, PORTAL.radius).project(cam);
    const aspect = size.width / size.height;
    (uniforms.get('uCenter')!.value as Vector2).set(tmp.center.x * 0.5 + 0.5, tmp.center.y * 0.5 + 0.5);
    uniforms.get('uRadius')!.value = Math.abs(tmp.edge.x - tmp.center.x) * 0.5 * aspect;
    uniforms.get('uAspect')!.value = aspect;
    uniforms.get('uStrength')!.value = 0.22 * proximity;
  });

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom mipmapBlur intensity={1.15} luminanceThreshold={0.55} luminanceSmoothing={0.3} radius={0.78} />
      {depthOfField ? (
        <DepthOfField ref={dof} target={[0, 0, 0]} worldFocusRange={90} bokehScale={2.6} resolutionScale={0.5} />
      ) : <></>}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <primitive object={lensing} />
      <ChromaticAberration offset={new Vector2(0.0005, 0.0007)} radialModulation modulationOffset={0.35} />
      <Vignette offset={0.26} darkness={0.72} />
      <Noise opacity={0.04} premultiply blendFunction={BlendFunction.SCREEN} />
    </EffectComposer>
  );
}
