// Creates a ShaderMaterial imperatively and disposes it on unmount.
//
// Why not <shaderMaterial uniforms={u} />: R3F does not keep the uniforms
// object passed as a JSX prop by reference, so per-frame writes to `u` never
// reach the GPU (uTime stayed at 0). Owning the material and mutating
// material.uniforms directly is reliable.

import { useEffect, useMemo } from 'react';
import { ShaderMaterial, type ShaderMaterialParameters } from 'three';

export function useShader(params: () => ShaderMaterialParameters, deps: unknown[] = []): ShaderMaterial {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const material = useMemo(() => new ShaderMaterial(params()), deps);
  useEffect(() => () => material.dispose(), [material]);
  return material;
}
