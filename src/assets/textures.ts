import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

// Procedural textures, generated once on the client and cached. The whole
// universe ships with zero image downloads: the only bitmaps loaded are the
// project screenshots, which Astro pre-optimises to WebP at build time.

const cache = new Map<string, Texture>();

function cached(key: string, make: () => Texture): Texture {
  let tex = cache.get(key);
  if (!tex) { tex = make(); cache.set(key, tex); }
  return tex;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic 0–1 value from any string (project ids → planet traits). */
export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

export { rng };

function valueNoise2D(seed: number) {
  const size = 256;
  const rand = rng(seed);
  const grid = new Float32Array(size * size).map(() => rand());
  const at = (x: number, y: number) => grid[(y & (size - 1)) * size + (x & (size - 1))];
  const fade = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = fade(x - xi), yf = fade(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}

/** Soft cloud puff: fBm density with a radial falloff, single channel. */
export function getNebulaPuffTexture(): Texture {
  return cached('nebula-puff', () => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    const n = valueNoise2D(7);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size - 0.5, v = y / size - 0.5;
        let f = 0, amp = 0.5, freq = 4;
        for (let o = 0; o < 5; o++) {
          f += amp * n(x / size * freq * 8 + o * 31, y / size * freq * 8 + o * 17);
          amp *= 0.5; freq *= 2;
        }
        const r = Math.sqrt(u * u + v * v) * 2;
        const falloff = Math.max(0, 1 - r) ** 1.8;
        const density = Math.max(0, f * 1.6 - 0.35) * falloff;
        const c = Math.min(255, density * 255 * 1.4);
        const i = (y * size + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = c;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new CanvasTexture(canvas);
    tex.minFilter = LinearMipmapLinearFilter;
    tex.magFilter = LinearFilter;
    return tex;
  });
}

/** Far-away galaxy billboard: a few logarithmic spiral arms of dots. */
export function getDistantGalaxyTexture(variant: number): Texture {
  return cached(`galaxy-${variant}`, () => {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const rand = rng(100 + variant);
    const c = size / 2;
    const core = ctx.createRadialGradient(c, c, 0, c, c, c * 0.5);
    core.addColorStop(0, 'rgba(255,240,220,0.9)');
    core.addColorStop(0.25, 'rgba(255,200,170,0.35)');
    core.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, size, size);
    const arms = 2 + (variant % 2);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 900; i++) {
      const arm = i % arms;
      const t = rand();
      const r = t * c * 0.92;
      const angle = (arm / arms) * Math.PI * 2 + t * 5.5 + (rand() - 0.5) * 0.6;
      const x = c + Math.cos(angle) * r;
      const y = c + Math.sin(angle) * r * 0.55;
      const a = (1 - t) * 0.35;
      ctx.fillStyle = t < 0.3 ? `rgba(255,220,190,${a})` : `rgba(170,190,255,${a})`;
      ctx.fillRect(x, y, 1.2, 1.2);
    }
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  });
}

/** Station hull: dark panels with rows of warm lit windows. Also used as the
 *  emissive map, so only the windows glow. */
export function getHullTextures(): { map: Texture; emissive: Texture } {
  const map = cached('hull-map', () => makeHull(false));
  const emissive = cached('hull-emissive', () => makeHull(true));
  return { map, emissive };
}

function makeHull(emissiveOnly: boolean): Texture {
  const w = 512, h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const rand = rng(42);
  ctx.fillStyle = emissiveOnly ? '#000' : '#6c717a';
  ctx.fillRect(0, 0, w, h);
  if (!emissiveOnly) {
    for (let x = 0; x < w; x += 32) {
      for (let y = 0; y < h; y += 16) {
        const g = 90 + Math.floor(rand() * 40);
        ctx.fillStyle = `rgb(${g},${g + 3},${g + 8})`;
        ctx.fillRect(x + 1, y + 1, 30, 14);
      }
    }
  }
  for (let x = 4; x < w; x += 8) {
    for (const y of [22, 40]) {
      if (rand() < 0.3) continue;
      ctx.fillStyle = rand() < 0.85 ? '#ffd9a0' : '#9fd8ff';
      ctx.fillRect(x, y, 4, 3);
    }
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(6, 1);
  tex.anisotropy = 4;
  return tex;
}
