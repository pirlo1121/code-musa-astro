import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, MathUtils, ShaderMaterial, Vector3 } from 'three';
import { dustFragment, dustVertex, streakFragment, streakVertex } from '../../shaders/particles';
import { rng } from '../../assets/textures';
import { sceneRefs } from '../../lib/scene-refs';

const BOX = 70;
const TRAIL_SECONDS = 0.07;
const MAX_TRAIL = 22;

/**
 * Near-field dust that wraps around the camera (infinite, one buffer) plus
 * velocity-stretched streaks of the same particles. Parked: soft floating
 * motes that sell depth. Flying: hyperspace-like lines that sell speed.
 */
export function SpaceDust({ count }: { count: number }) {
  const { dustGeo, streakGeo } = useMemo(() => {
    const rand = rng(77);
    const seeds = new Float32Array(count * 3).map(() => rand());
    const sizes = new Float32Array(count).map(() => 0.6 + rand() * rand() * 2.2);

    const dust = new BufferGeometry();
    dust.setAttribute('position', new BufferAttribute(seeds, 3));
    dust.setAttribute('aSize', new BufferAttribute(sizes, 1));

    const streakCount = Math.floor(count * 0.6);
    const streakPos = new Float32Array(streakCount * 6);
    const ends = new Float32Array(streakCount * 2);
    for (let i = 0; i < streakCount; i++) {
      for (let k = 0; k < 3; k++) {
        streakPos[i * 6 + k] = seeds[i * 3 + k];
        streakPos[i * 6 + 3 + k] = seeds[i * 3 + k];
      }
      ends[i * 2] = 0;
      ends[i * 2 + 1] = 1;
    }
    const streak = new BufferGeometry();
    streak.setAttribute('position', new BufferAttribute(streakPos, 3));
    streak.setAttribute('aEnd', new BufferAttribute(ends, 1));
    return { dustGeo: dust, streakGeo: streak };
  }, [count]);

  const { dustMat, streakMat } = useMemo(() => {
    const shared = { uCamPos: { value: new Vector3() }, uBox: { value: BOX }, uTime: { value: 0 } };
    const dustMat = new ShaderMaterial({
      vertexShader: dustVertex,
      fragmentShader: dustFragment,
      uniforms: { ...shared, uPixelRatio: { value: 1 }, uColor: { value: new Color('#c9d6ff') }, uOpacity: { value: 0.55 } },
      blending: AdditiveBlending, transparent: true, depthWrite: false,
    });
    const streakMat = new ShaderMaterial({
      vertexShader: streakVertex,
      fragmentShader: streakFragment,
      uniforms: { ...shared, uVelocity: { value: new Vector3() }, uColor: { value: new Color('#a9c4ff') }, uOpacity: { value: 0 } },
      blending: AdditiveBlending, transparent: true, depthWrite: false,
    });
    return { dustMat, streakMat };
  }, []);

  useEffect(() => () => { dustGeo.dispose(); streakGeo.dispose(); }, [dustGeo, streakGeo]);
  useEffect(() => () => { dustMat.dispose(); streakMat.dispose(); }, [dustMat, streakMat]);

  useFrame(({ camera, clock, viewport }, dt) => {
    // uCamPos/uBox/uTime objects are shared by both materials.
    dustMat.uniforms.uCamPos.value.copy(camera.position);
    dustMat.uniforms.uTime.value = clock.elapsedTime;
    dustMat.uniforms.uPixelRatio.value = viewport.dpr;

    const velocity = streakMat.uniforms.uVelocity.value as Vector3;
    velocity.copy(sceneRefs.velocity).multiplyScalar(TRAIL_SECONDS).clampLength(0, MAX_TRAIL);
    const speed = sceneRefs.velocity.length();
    const target = MathUtils.smoothstep(speed, 12, 90) * 0.75;
    streakMat.uniforms.uOpacity.value = MathUtils.damp(streakMat.uniforms.uOpacity.value, target, 6, dt);
  });

  return (
    <>
      <points geometry={dustGeo} material={dustMat} frustumCulled={false} />
      <lineSegments geometry={streakGeo} material={streakMat} frustumCulled={false} />
    </>
  );
}
