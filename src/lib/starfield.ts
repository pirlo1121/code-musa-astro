// Main-thread side of the starfield (the drawing lives in starfield-renderer).
//
// Where OffscreenCanvas is supported, the canvas is handed to a Web Worker so
// the per-frame drawing never blocks the main thread — on phones that work
// was competing with scrolling and made it stutter. Older browsers fall back
// to running the same renderer here.
//
// This side only watches page state (theme, tab visibility, reduced motion,
// size, pointer) and forwards it as messages.

import type { StarfieldMessage, StarfieldRenderer } from './starfield-renderer';

export function initStarfield(canvas: HTMLCanvasElement): void {
  const isMobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  // The stars are soft glows, so a high-DPR backing store buys nothing
  // visible on phones but multiplies the pixels to fill and composite.
  const maxDpr = isMobile ? 1.25 : 2;

  let send: (msg: StarfieldMessage) => void;
  let queue: StarfieldMessage[] | null = null;

  if ('transferControlToOffscreen' in canvas && typeof Worker !== 'undefined') {
    const offscreen = canvas.transferControlToOffscreen();
    const worker = new Worker(new URL('./starfield.worker.ts', import.meta.url), { type: 'module' });
    worker.postMessage({ type: 'init', canvas: offscreen, isMobile } satisfies StarfieldMessage, [offscreen]);
    send = (msg) => worker.postMessage(msg);
  } else {
    // Buffer messages until the renderer chunk has loaded
    queue = [];
    send = (msg) => queue!.push(msg);
    import('./starfield-renderer').then(({ createStarfieldRenderer, applyMessage }) => {
      const renderer: StarfieldRenderer | null = createStarfieldRenderer(canvas, isMobile);
      if (!renderer) return;
      send = (msg) => applyMessage(renderer, msg);
      queue!.forEach(send);
      queue = null;
    });
  }

  // The canvas is sized in CSS to 100lvh (the viewport with the mobile URL
  // bar hidden), so it already covers the screen in both URL bar states.
  let lastWidth = 0;
  function sendSize() {
    const rect = canvas.getBoundingClientRect();
    lastWidth = rect.width;
    send({
      type: 'resize',
      width: rect.width,
      height: rect.height,
      dpr: Math.min(window.devicePixelRatio || 1, maxDpr),
    });
  }

  function sendState() {
    send({
      type: 'state',
      running: document.body.classList.contains('dark-theme') && !document.hidden,
      reducedMotion: reducedMotion.matches,
    });
  }

  sendSize();
  sendState();

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    // On phones the URL bar showing/hiding while scrolling fires resize with
    // only the height changing. Resizing the canvas reallocates and clears it
    // mid-scroll (a visible hitch), and it is already tall enough, so only
    // react to real width changes (rotation, window resize).
    if (isMobile && canvas.getBoundingClientRect().width === lastWidth) return;
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(sendSize, 150);
  });

  if (finePointer && !reducedMotion.matches) {
    let pending = false;
    let px = 0, py = 0;
    window.addEventListener('pointermove', (e) => {
      px = (e.clientX / window.innerWidth - 0.5) * 0.12;
      py = (e.clientY / window.innerHeight - 0.5) * 0.12;
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        send({ type: 'pointer', x: px, y: py });
      });
    }, { passive: true });
  }

  document.addEventListener('visibilitychange', sendState);
  new MutationObserver(sendState).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  reducedMotion.addEventListener('change', sendState);
}
