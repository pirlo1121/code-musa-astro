// Island entry point. Kept tiny on purpose: it ships with the page, while
// three.js and the scene are fetched only once the browser is idle, so the
// hero text (the LCP element) never waits on WebGL.

import { useEffect, useState, type ComponentType } from 'react';
import type { SceneProps } from './Scene';

export default function Universe(props: SceneProps) {
  const [Scene, setScene] = useState<ComponentType<SceneProps> | null>(null);

  useEffect(() => {
    if (!document.documentElement.classList.contains('journey')) return;
    let cancelled = false;
    const load = () =>
      import('./Scene').then((m) => {
        if (!cancelled) setScene(() => m.default);
      });
    // Safari has no requestIdleCallback
    const idle = typeof window.requestIdleCallback === 'function';
    const id = idle ? window.requestIdleCallback(load, { timeout: 1200 }) : window.setTimeout(load, 200);
    return () => {
      cancelled = true;
      if (idle) window.cancelIdleCallback(id);
      else window.clearTimeout(id);
    };
  }, []);

  return Scene ? <Scene {...props} /> : null;
}
