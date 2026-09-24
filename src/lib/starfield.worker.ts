// Runs the starfield renderer on an OffscreenCanvas, off the main thread.
import { applyMessage, createStarfieldRenderer, type StarfieldMessage, type StarfieldRenderer } from './starfield-renderer';

let renderer: StarfieldRenderer | null = null;

self.onmessage = (e: MessageEvent<StarfieldMessage>) => {
  const msg = e.data;
  if (msg.type === 'init') {
    renderer = createStarfieldRenderer(msg.canvas, msg.isMobile);
  } else if (renderer) {
    applyMessage(renderer, msg);
  }
};
