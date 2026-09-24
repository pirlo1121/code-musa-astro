import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, MathUtils, Mesh, ShaderMaterial, SRGBColorSpace, Texture, TextureLoader, Vector3 } from 'three';
import { hologramFragment } from '../../shaders/hologram';
import { quadVertex } from '../../shaders/planet';

const WIDTH = 7.6;
const HEIGHT = WIDTH * 9 / 16;

const loader = new TextureLoader();
const textureCache = new Map<string, Promise<Texture>>();

/** Screenshots are fetched only when their project is first focused. */
function loadTexture(url: string): Promise<Texture> {
  let p = textureCache.get(url);
  if (!p) {
    p = loader.loadAsync(url).then((tex) => {
      tex.colorSpace = SRGBColorSpace;
      tex.anisotropy = 4;
      return tex;
    });
    textureCache.set(url, p);
  }
  return p;
}

interface HologramProps {
  /** Returns the focused body (world position + radius) and its screenshot, or null to hide. */
  getTarget: () => { key: string; position: Vector3; size: number; image: string | null; tint: string } | null;
}

/**
 * Holographic projection floating above the focused project planet. Lives at
 * scene root (world space) so it can billboard toward the camera.
 */
export function Hologram({ getTarget }: HologramProps) {
  const mesh = useRef<Mesh>(null);
  const state = useRef({ key: '', opacity: 0, reveal: 0, wanted: '' });
  const up = useMemo(() => new Vector3(), []);

  const material = useMemo(() => new ShaderMaterial({
    vertexShader: quadVertex,
    fragmentShader: hologramFragment,
    uniforms: {
      uMap: { value: null },
      uHasMap: { value: 0 },
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uOpacity: { value: 0 },
      uTint: { value: new Color('#7fd8ff') },
    },
    transparent: true,
    depthWrite: false,
  }), []);

  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ camera, clock }, dt) => {
    const m = mesh.current;
    if (!m) return;
    const s = state.current;
    const target = getTarget();

    if (target && target.key !== s.key) {
      s.key = target.key;
      s.reveal = 0;
      s.wanted = target.image ?? '';
      material.uniforms.uHasMap.value = 0;
      material.uniforms.uTint.value.set(target.tint);
      if (target.image) {
        const url = target.image;
        loadTexture(url).then((tex) => {
          if (state.current.wanted !== url) return;
          material.uniforms.uMap.value = tex;
          material.uniforms.uHasMap.value = 1;
        }).catch(() => {});
      }
    }

    s.opacity = MathUtils.damp(s.opacity, target ? 1 : 0, 5, dt);
    // Start the wipe once the image is ready (or right away if there is none).
    const ready = material.uniforms.uHasMap.value > 0 || !s.wanted;
    if (target && ready) s.reveal = Math.min(1, s.reveal + dt * 0.9);

    material.uniforms.uOpacity.value = s.opacity;
    material.uniforms.uReveal.value = MathUtils.smootherstep(s.reveal, 0, 1);
    material.uniforms.uTime.value = clock.elapsedTime;
    m.visible = s.opacity > 0.01;

    if (target) {
      up.setFromMatrixColumn(camera.matrixWorld, 1);
      m.position.copy(target.position).addScaledVector(up, target.size * 1.25 + HEIGHT * 0.5 + 1.1);
      m.quaternion.copy(camera.quaternion);
    }
  });

  return (
    <mesh ref={mesh} material={material} visible={false} renderOrder={5}>
      <planeGeometry args={[WIDTH, HEIGHT]} />
    </mesh>
  );
}
