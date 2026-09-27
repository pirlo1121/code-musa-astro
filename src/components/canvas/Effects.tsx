import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Bloom, ChromaticAberration, DepthOfField, EffectComposer, Noise, ToneMapping, Vignette,
} from '@react-three/postprocessing';
import { BlendFunction, DepthOfFieldEffect, ToneMappingMode } from 'postprocessing';
import { Vector2 } from 'three';
import { sceneRefs } from '../../lib/scene-refs';

const ABERRATION = new Vector2(0.0005, 0.0007);

export default function Effects({ depthOfField }: { depthOfField: boolean }) {
  const dof = useRef<DepthOfFieldEffect>(null);

  useFrame(() => {
    dof.current?.target?.copy(sceneRefs.focusPoint);
  });

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom mipmapBlur intensity={1.15} luminanceThreshold={0.55} luminanceSmoothing={0.3} radius={0.78} />
      {depthOfField ? (
        <DepthOfField ref={dof} target={[0, 0, 0]} worldFocusRange={90} bokehScale={2.6} resolutionScale={0.5} />
      ) : <></>}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <ChromaticAberration offset={ABERRATION} radialModulation modulationOffset={0.35} />
      <Vignette offset={0.26} darkness={0.72} />
      <Noise opacity={0.04} premultiply blendFunction={BlendFunction.SCREEN} />
    </EffectComposer>
  );
}
